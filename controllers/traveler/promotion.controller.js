const mongoose = require('mongoose');
const Promotion = require('../../models/promotion.model');

const TARGET_TYPES = ['hotel', 'tour'];

const buildActiveQuery = ({ targetType, targetId, providerId }) => {
  const now = new Date();
  const query = {
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
  };

  if (targetType) {
    query.targetType = targetType;
  }

  if (targetId) {
    query.targetId = targetId;
  }

  if (providerId) {
    query.providerId = providerId;
  }

  query.$expr = {
    $or: [
      { $lt: ['$usageCount', '$usageLimit'] },
      { $eq: ['$usageLimit', null] },
    ],
  };

  return query;
};

exports.getActivePromotions = async (req, res) => {
  try {
    const { targetType, targetId, providerId } = req.query;

    if (targetType && !TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: 'targetType must be hotel or tour',
      });
    }

    let normalizedTargetId;
    if (targetId) {
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid targetId',
        });
      }
      normalizedTargetId = new mongoose.Types.ObjectId(targetId);
    }

    let normalizedProviderId;
    if (providerId) {
      if (!mongoose.Types.ObjectId.isValid(providerId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid providerId',
        });
      }
      normalizedProviderId = new mongoose.Types.ObjectId(providerId);
    }

    const query = buildActiveQuery({
      targetType,
      targetId: normalizedTargetId,
      providerId: normalizedProviderId,
    });

    const promotions = await Promotion.find(query)
      .sort({ 'discountValue': -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: promotions.length,
      data: promotions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch promotions',
    });
  }
};
