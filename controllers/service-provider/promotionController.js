const mongoose = require('mongoose');
const Promotion = require('../../models/promotion.model');
const Hotel = require('../../models/hotel.model');
const Tour = require('../../models/tour.model');
const ServiceProvider = require('../../models/service-provider.model');

const TARGET_TYPES = ['hotel', 'tour'];
const ALLOWED_STATUSES = ['active', 'inactive', 'expired'];

const addPromotionReference = async (targetType, targetId, promotionId) => {
  if (!targetType || !targetId || !promotionId) {
    return;
  }

  try {
    if (targetType === 'hotel') {
      await Hotel.findByIdAndUpdate(
        targetId,
        { $addToSet: { promotions: promotionId } },
        { new: false }
      );
    } else if (targetType === 'tour') {
      await Tour.findByIdAndUpdate(
        targetId,
        { $addToSet: { promotions: promotionId } },
        { new: false }
      );
    }
  } catch (error) {
    console.error('Failed to add promotion reference', {
      targetType,
      targetId,
      promotionId,
      message: error.message,
    });
  }
};

const removePromotionReference = async (targetType, targetId, promotionId) => {
  if (!targetType || !targetId || !promotionId) {
    return;
  }

  try {
    if (targetType === 'hotel') {
      await Hotel.findByIdAndUpdate(
        targetId,
        { $pull: { promotions: promotionId } },
        { new: false }
      );
    } else if (targetType === 'tour') {
      await Tour.findByIdAndUpdate(
        targetId,
        { $pull: { promotions: promotionId } },
        { new: false }
      );
    }
  } catch (error) {
    console.error('Failed to remove promotion reference', {
      targetType,
      targetId,
      promotionId,
      message: error.message,
    });
  }
};

const findProviderFromRequest = async (req) => { // xác định xem đang gọi provider nào
  if (req.provider) {
    return req.provider;
  }

  const userId = req.user?.id || req.user?._id;
  if (!userId) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }

  const provider = await ServiceProvider.findOne({ user_id: userId });
  if (!provider) {
    const error = new Error('Service provider profile not found');
    error.statusCode = 403;
    throw error;
  }

  return provider;
};

const ensureTargetBelongsToProvider = async (targetType, targetId, providerId) => {
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    const error = new Error('Invalid target id');
    error.statusCode = 400;
    throw error;
  }

  if (targetType === 'hotel') {
    const hotel = await Hotel.findOne({ _id: targetId, providerId });
    if (!hotel) {
      const error = new Error('Target not found or not owned by provider');
      error.statusCode = 404;
      throw error;
    }
    return;
  }

  if (targetType === 'tour') {
    const tour = await Tour.findOne({ _id: targetId, provider_id: providerId });
    if (!tour) {
      const error = new Error('Target not found or not owned by provider');
      error.statusCode = 404;
      throw error;
    }
    return;
  }

  const error = new Error('Unsupported targetType');
  error.statusCode = 400;
  throw error;
};

exports.createPromotion = async (req, res) => {
  try {
    const provider = await findProviderFromRequest(req);
    const {
      targetType,
      targetId,
      name,
      code,
      description,
      discountType = 'percent',
      discountValue,
      startDate,
      endDate,
      usageLimit,
    } = req.body;

    if (!TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: 'targetType must be hotel or tour',
      });
    }

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'name and code are required',
      });
    }

    if (!['percent', 'amount'].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: 'discountType must be percent or amount',
      });
    }

    if (typeof discountValue !== 'number' || discountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'discountValue must be a positive number',
      });
    }

    if (discountType === 'percent' && discountValue > 100) {
      return res.status(400).json({
        success: false,
        message: 'Percent discount cannot exceed 100',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range',
      });
    }

    await ensureTargetBelongsToProvider(targetType, targetId, provider._id);

    const promotion = await Promotion.create({
      providerId: provider._id,
      targetType,
      targetId,
      name,
      code: code.trim().toUpperCase(),
      description,
      discountType,
      discountValue,
      startDate: start,
      endDate: end,
      usageLimit: usageLimit || undefined,
    });

    await addPromotionReference(targetType, targetId, promotion._id);

    return res.status(201).json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    const status = error.statusCode || (error.code === 11000 ? 409 : 500);
    const message =
      error.code === 11000
        ? 'Promotion code already exists for this target'
        : error.message || 'Failed to create promotion';

    return res.status(status).json({
      success: false,
      message,
    });
  }
};

exports.getMyPromotions = async (req, res) => {
  try {
    const provider = await findProviderFromRequest(req);
    const { targetType, status } = req.query;

    const query = {
      providerId: provider._id,
    };

    if (targetType) {
      if (!TARGET_TYPES.includes(targetType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid targetType filter',
        });
      }
      query.targetType = targetType;
    }

    if (status) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status filter',
        });
      }
      query.status = status;
    }

    const promotions = await Promotion.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: promotions,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to fetch promotions',
    });
  }
};

exports.getPromotionById = async (req, res) => {
  try {
    const provider = await findProviderFromRequest(req);
    const { promotionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(promotionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid promotion id',
      });
    }

    const promotion = await Promotion.findOne({
      _id: promotionId,
      providerId: provider._id,
    });

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to fetch promotion',
    });
  }
};

exports.updatePromotion = async (req, res) => {
  try {
    const provider = await findProviderFromRequest(req);
    const { promotionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(promotionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid promotion id',
      });
    }

    const promotion = await Promotion.findOne({
      _id: promotionId,
      providerId: provider._id,
    });

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found',
      });
    }

    const previousTargetType = promotion.targetType;
    const previousTargetId = promotion.targetId;

    const nextTargetType = req.body.targetType ?? promotion.targetType;
    const nextTargetId = req.body.targetId ?? promotion.targetId;

    if (!TARGET_TYPES.includes(nextTargetType)) {
      return res.status(400).json({
        success: false,
        message: 'targetType must be hotel or tour',
      });
    }

    if (req.body.targetType !== undefined || req.body.targetId !== undefined) {
      await ensureTargetBelongsToProvider(nextTargetType, nextTargetId, provider._id);
    }

    const nextDiscountType = req.body.discountType ?? promotion.discountType;
    const nextDiscountValue = req.body.discountValue ?? promotion.discountValue;

    if (!['percent', 'amount'].includes(nextDiscountType)) {
      return res.status(400).json({
        success: false,
        message: 'discountType must be percent or amount',
      });
    }

    if (typeof nextDiscountValue !== 'number' || nextDiscountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'discountValue must be a positive number',
      });
    }

    if (nextDiscountType === 'percent' && nextDiscountValue > 100) {
      return res.status(400).json({
        success: false,
        message: 'Percent discount cannot exceed 100',
      });
    }

    const nextStartDate =
      req.body.startDate !== undefined ? new Date(req.body.startDate) : promotion.startDate;
    const nextEndDate =
      req.body.endDate !== undefined ? new Date(req.body.endDate) : promotion.endDate;

    if (
      Number.isNaN(nextStartDate.getTime()) ||
      Number.isNaN(nextEndDate.getTime()) ||
      nextStartDate >= nextEndDate
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range',
      });
    }

    const updateDoc = {
      targetType: nextTargetType,
      targetId: nextTargetId,
      discountType: nextDiscountType,
      discountValue: nextDiscountValue,
      startDate: nextStartDate,
      endDate: nextEndDate,
    };

    if (req.body.name !== undefined) {
      if (!req.body.name) {
        return res.status(400).json({
          success: false,
          message: 'name cannot be empty',
        });
      }
      updateDoc.name = req.body.name;
    }

    if (req.body.code !== undefined) {
      if (!req.body.code) {
        return res.status(400).json({
          success: false,
          message: 'code cannot be empty',
        });
      }
      updateDoc.code = req.body.code.trim().toUpperCase();
    }

    if (req.body.description !== undefined) {
      updateDoc.description = req.body.description;
    }

    const unsetDoc = {};

    if (req.body.usageLimit !== undefined) {
      if (req.body.usageLimit === null) {
        unsetDoc.usageLimit = '';
      } else if (typeof req.body.usageLimit !== 'number' || req.body.usageLimit < 1) {
        return res.status(400).json({
          success: false,
          message: 'usageLimit must be a positive number',
        });
      } else {
        updateDoc.usageLimit = req.body.usageLimit;
      }
    }

    if (req.body.status !== undefined) {
      if (!ALLOWED_STATUSES.includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value',
        });
      }
      updateDoc.status = req.body.status;
    }

    const updatePayload =
      Object.keys(unsetDoc).length > 0
        ? { $set: updateDoc, $unset: unsetDoc }
        : { $set: updateDoc };

    const updatedPromotion = await Promotion.findByIdAndUpdate(
      promotionId,
      updatePayload,
      { new: true }
    );

    if (!updatedPromotion) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update promotion',
      });
    }

    await addPromotionReference(
      updatedPromotion.targetType,
      updatedPromotion.targetId,
      updatedPromotion._id
    );

    if (
      previousTargetType &&
      previousTargetId &&
      (previousTargetType !== updatedPromotion.targetType ||
        previousTargetId.toString() !== updatedPromotion.targetId.toString())
    ) {
      await removePromotionReference(previousTargetType, previousTargetId, updatedPromotion._id);
    }

    return res.status(200).json({
      success: true,
      data: updatedPromotion,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to update promotion',
    });
  }
};

exports.deletePromotion = async (req, res) => {
  try {
    const provider = await findProviderFromRequest(req);
    const { promotionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(promotionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid promotion id',
      });
    }

    const promotion = await Promotion.findOne({
      _id: promotionId,
      providerId: provider._id,
    });

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found',
      });
    }

    await Promotion.deleteOne({ _id: promotionId });
    await removePromotionReference(promotion.targetType, promotion.targetId, promotion._id);

    return res.status(200).json({
      success: true,
      message: 'Promotion deleted successfully',
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to delete promotion',
    });
  }
};
