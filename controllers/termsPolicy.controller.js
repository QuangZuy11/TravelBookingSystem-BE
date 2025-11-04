const TermsPolicy = require('../models/terms-policy.model');
const ServiceProvider = require('../models/service-provider.model');
const mongoose = require('mongoose');

const PROMOTION_POLICY_ROLE = 'PROMOTION_TERMS';

const normalizeRole = (role) => (role || '').toString().trim().toUpperCase();
const normalizeTarget = (target) =>
  (target || '').toString().trim().toLowerCase().replace(/\s+/g, '_');
const normalizePolicyType = (value) => {
  if (!value && value !== 0) return null;
  const normalized = value.toString().trim().toLowerCase();

  if (normalized === 'tour' || normalized === 'hotel') {
    return normalized;
  }

  if (normalized === 'traveler') {
    return 'tour';
  }

  return null;
};
const toPolicyTypeEnum = (value) => {
  const upper = (value || '').toString().trim().toUpperCase();
  if (upper === 'TRAVELER') {
    return 'TOUR';
  }
  return upper;
};
const buildPolicyTarget = (type) => `promotion_${type}`;
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const policyTypeToLabel = (type) => {
  const normalized = (type || '').toString().trim().toUpperCase();
  if (!normalized) return '';

  if (normalized === 'HOTEL') return 'Hotel';
  if (normalized === 'TOUR') return 'Tour';
  if (normalized === 'TRAVELER') return 'Traveler';

  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
};
const formatPromotionPolicy = (policy) => {
  if (!policy) return null;
  const doc = policy.toObject ? policy.toObject() : policy;
  const rawType = doc.policyType || doc.promotionType;
  return {
    id: doc._id,
    _id: doc._id,
    title: doc.category,
    type: policyTypeToLabel(rawType),
    policyType: rawType,
    description: doc.description || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
};

const appendToSet = (set, value, normalizer) => {
  if (!value && value !== 0) return;

  if (Array.isArray(value)) {
    value.forEach((item) => appendToSet(set, item, normalizer));
    return;
  }

  value
    .toString()
    .split(',')
    .map((item) => (normalizer ? normalizer(item) : item))
    .filter(Boolean)
    .forEach((item) => set.add(item));
};

const setToQueryValue = (set) => {
  if (!set || set.size === 0) {
    return null;
  }
  if (set.size === 1) {
    return Array.from(set)[0];
  }
  return { $in: Array.from(set) };
};

const buildQueryFromSets = ({ targetSet, roleSet }) => {
  const query = {
    // Accept documents where isActive is true or not explicitly set to false
    isActive: { $ne: false },
  };

  const targetFilter = setToQueryValue(targetSet);
  const roleFilter = setToQueryValue(roleSet);

  if (targetFilter && roleFilter) {
    query.$or = [{ target: targetFilter }, { role: roleFilter }];
  } else if (targetFilter) {
    query.target = targetFilter;
  } else if (roleFilter) {
    query.role = roleFilter;
  }

  return query;
};

const categoryToIconKey = (category = '') => {
  const normalized = category.toLowerCase();

  if (normalized.includes('thanh toán') || normalized.includes('payment')) {
    return 'CREDITCARD';
  }
  if (normalized.includes('hoàn tiền') || normalized.includes('refund')) {
    return 'CREDITCARD';
  }
  if (normalized.includes('hủy') || normalized.includes('cancel')) {
    return 'XCIRCLE';
  }
  if (
    normalized.includes('trách nhiệm') ||
    normalized.includes('nghĩa vụ') ||
    normalized.includes('responsibility')
  ) {
    return 'USERS';
  }
  if (normalized.includes('bảo hiểm') || normalized.includes('an toàn')) {
    return 'SHIELD';
  }
  if (normalized.includes('liên hệ') || normalized.includes('support')) {
    return 'PHONE';
  }
  if (normalized.includes('thông tin') || normalized.includes('information')) {
    return 'INFO';
  }

  return 'FILETEXT';
};

const transformPolicyItem = (item, index) => {
  if (!item) {
    return null;
  }

  const text = (item.text || item.content || '').toString().trim();
  if (!text) {
    return null;
  }

  const tone = (item.type || '').toString().trim().toLowerCase();
  const important =
    typeof item.important === 'boolean'
      ? item.important
      : tone === 'warning' || tone === 'critical';

  return {
    text,
    important,
    tone,
    order:
      typeof item.order === 'number' && !Number.isNaN(item.order)
        ? item.order
        : index,
  };
};

const transformPolicy = (policy) => {
  const items = (policy.items || [])
    .map(transformPolicyItem)
    .filter(Boolean)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return {
    _id: policy._id,
    category: policy.category,
    iconKey: policy.iconKey || categoryToIconKey(policy.category),
    highlight: policy.highlight ?? false,
    color: policy.color ?? 'teal',
    description: policy.description || '',
    items,
    target: policy.target,
    role: policy.role,
    order: policy.order ?? 0,
  };
};

const fetchPolicies = async ({ targetSet, roleSet }) => {
  const query = buildQueryFromSets({ targetSet, roleSet });

  const terms = await TermsPolicy.find(query)
    .sort({ order: 1, createdAt: 1 })
    .lean();

  return terms.map(transformPolicy);
};

exports.getTermsPolicies = async (req, res) => {
  try {
    const targetSet = new Set();
    const roleSet = new Set();

    appendToSet(targetSet, req.query.target, normalizeTarget);
    appendToSet(targetSet, req.query.targets, normalizeTarget);

    appendToSet(roleSet, req.query.role, normalizeRole);
    appendToSet(roleSet, req.query.roles, normalizeRole);

    if (parseBoolean(req.query.includeCommon)) {
      targetSet.add('common');
    }

    const policies = await fetchPolicies({ targetSet, roleSet });

    return res.status(200).json({
      success: true,
      count: policies.length,
      data: policies,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch terms & policies',
    });
  }
};

exports.getCurrentUserTermsPolicies = async (req, res) => {
  try {
    const targetSet = new Set();
    const roleSet = new Set();

    const userRole = normalizeRole(req.user?.role);
    if (!userRole) {
      return res.status(400).json({
        success: false,
        message: 'Missing role information for current user',
      });
    }

    roleSet.add(userRole);

    const normalizedRole = userRole.toLowerCase();
    if (normalizedRole === 'traveler') {
      targetSet.add('traveler');
    } else if (normalizedRole === 'serviceprovider' || normalizedRole === 'service_provider') {
      targetSet.add('service_provider');

      const userId = req.user?.id || req.user?._id;
      if (userId) {
        const provider = await ServiceProvider.findOne({ user_id: userId })
          .select('type')
          .lean();

        if (provider?.type) {
          targetSet.add(`${provider.type.toLowerCase()}_provider`);
        }
      }
    }

    appendToSet(targetSet, req.query.target, normalizeTarget);
    appendToSet(targetSet, req.query.targets, normalizeTarget);

    if (parseBoolean(req.query.includeCommon)) {
      targetSet.add('common');
    }

    const policies = await fetchPolicies({ targetSet, roleSet });

    return res.status(200).json({
      success: true,
      count: policies.length,
      data: policies,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message || 'Failed to fetch terms & policies for current user',
    });
  }
};

exports.listPromotionTermsPolicies = async (req, res) => {
  try {
    const policies = await TermsPolicy.find({ role: PROMOTION_POLICY_ROLE })
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: policies.length,
      data: policies.map(formatPromotionPolicy),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch promotion terms policies',
    });
  }
};

exports.createPromotionTermsPolicy = async (req, res) => {
  try {
    const { type, policyType, title, description } = req.body || {};

    const normalizedType = normalizePolicyType(policyType ?? type);
    if (!normalizedType) {
      return res.status(400).json({
        success: false,
        message: 'Loại điều khoản không hợp lệ. Giá trị hợp lệ: Traveler hoặc Tour.',
      });
    }

    const trimmedTitle = (title || '').toString().trim();
    if (!trimmedTitle) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề điều khoản là bắt buộc.',
      });
    }

    const policy = await TermsPolicy.create({
      target: buildPolicyTarget(normalizedType),
      policyType: toPolicyTypeEnum(normalizedType),
      role: PROMOTION_POLICY_ROLE,
      category: trimmedTitle,
      description:
        description === null || description === undefined
          ? ''
          : description.toString(),
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      data: formatPromotionPolicy(policy),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create promotion terms policy',
    });
  }
};

exports.getPromotionTermsPolicyDetail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy điều khoản quảng cáo yêu cầu.',
      });
    }

    const policy = await TermsPolicy.findOne({
      _id: id,
      role: PROMOTION_POLICY_ROLE,
    }).lean();

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy điều khoản quảng cáo yêu cầu.',
      });
    }

    return res.status(200).json({
      success: true,
      data: formatPromotionPolicy(policy),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch promotion terms policy detail',
    });
  }
};

exports.updatePromotionTermsPolicy = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy điều khoản quảng cáo yêu cầu.',
      });
    }

    const existing = await TermsPolicy.findOne({
      _id: id,
      role: PROMOTION_POLICY_ROLE,
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy điều khoản quảng cáo yêu cầu.',
      });
    }

    const { type, policyType, title, description } = req.body || {};

    const trimmedTitle = (title ?? '').toString().trim();
    if (!trimmedTitle) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề điều khoản là bắt buộc.',
      });
    }

    const normalizedType = normalizePolicyType(policyType ?? type ?? existing.policyType);
    if (!normalizedType) {
      return res.status(400).json({
        success: false,
        message: 'Loại điều khoản không hợp lệ. Giá trị hợp lệ: Tour hoặc Hotel.',
      });
    }

    existing.category = trimmedTitle;
    existing.description =
      description === null || description === undefined
        ? ''
        : description.toString();
    existing.policyType = toPolicyTypeEnum(normalizedType);
    existing.target = buildPolicyTarget(normalizedType);

    await existing.save();

    return res.status(200).json({
      success: true,
      data: formatPromotionPolicy(existing),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update promotion terms policy',
    });
  }
};

exports.deletePromotionTermsPolicy = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy điều khoản quảng cáo yêu cầu.',
      });
    }

    const policy = await TermsPolicy.findOneAndDelete({
      _id: id,
      role: PROMOTION_POLICY_ROLE,
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy điều khoản quảng cáo yêu cầu.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã xóa điều khoản quảng cáo.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete promotion terms policy',
    });
  }
};
