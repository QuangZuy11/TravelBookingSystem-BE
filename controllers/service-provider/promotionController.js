const mongoose = require('mongoose');
const Promotion = require('../../models/promotion.model');
const Hotel = require('../../models/hotel.model');
const Tour = require('../../models/tour.model');
const ServiceProvider = require('../../models/service-provider.model');

const TARGET_TYPES = ['hotel', 'tour'];

const findProviderFromRequest = async (req) => {
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

  let target = null;
  if (targetType === 'hotel') {
    target = await Hotel.findOne({ _id: targetId, providerId });
  } else if (targetType === 'tour') {
    target = await Tour.findOne({ _id: targetId, provider_id: providerId });
  }

  if (!target) {
    const error = new Error('Target not found or not owned by provider');
    error.statusCode = 404;
    throw error;
  }

  return target;
};

exports.createPromotion = async (req, res) => {
  try {
    const provider = await findProviderFromRequest(req);
    console.log('[promotion] provider _id:', provider._id.toString());
    console.log('[promotion] body targetId:', req.body?.targetId);

    if (req.body?.targetId) {
      console.log('[promotion] total hotels in DB:', await Hotel.countDocuments());
      const hotelsSnapshot = await Hotel.find({}, '_id providerId').lean();
      console.log('[promotion] hotels snapshot:', hotelsSnapshot);
      const debugHotel = await Hotel.findById(req.body.targetId);
      console.log(
        '[promotion] hotel lookup:',
        debugHotel
          ? {
              _id: debugHotel._id.toString(),
              providerId: debugHotel.providerId?.toString(),
            }
          : null
      );
    }
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
      minSpend = 0,
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
      minSpend,
    });

    if (targetType === 'hotel') {
      try {
        const label =
          discountType === 'percent'
            ? `Giảm ${discountValue}%`
            : `Giảm ${discountValue} VND`;

        await Hotel.findByIdAndUpdate(targetId, {
          latestPromotion: {
            promotionId: promotion._id,
            code: promotion.code,
            label,
            discountType: promotion.discountType,
            discountValue: promotion.discountValue,
            startDate: promotion.startDate,
            endDate: promotion.endDate,
            updatedAt: new Date(),
          },
        });
      } catch (syncError) {
        console.error('Failed to update latestPromotion for hotel:', syncError);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Promotion created successfully',
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

    if (targetType && TARGET_TYPES.includes(targetType)) {
      query.targetType = targetType;
    }

    if (status) {
      query.status = status;
    }

    const promotions = await Promotion.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: promotions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch promotions',
    });
  }
};
