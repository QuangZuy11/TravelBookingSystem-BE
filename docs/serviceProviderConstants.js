/**
 * Service Provider Constants
 * Import constants này vào FE project để sử dụng
 */

// ========== SERVICE TYPES ==========
export const SERVICE_TYPES = {
  HOTEL: {
    code: 'hotel',
    name: 'Khách sạn',
    icon: '🏨',
    maxLicenses: null, // Unlimited
    canAddLicense: true,
    description: 'Có thể có nhiều licenses (mỗi khách sạn = 1 license)'
  },
  TOUR: {
    code: 'tour',
    name: 'Tour',
    icon: '🗺️',
    maxLicenses: 1,
    canAddLicense: false,
    description: 'Chỉ có thể có 1 license duy nhất'
  },
  FLIGHT: {
    code: 'flight',
    name: 'Hàng không',
    icon: '✈️',
    maxLicenses: 1,
    canAddLicense: false,
    description: 'Chỉ có thể có 1 license duy nhất'
  }
};

// Service type array for iteration
export const SERVICE_TYPE_LIST = [
  SERVICE_TYPES.HOTEL,
  SERVICE_TYPES.TOUR,
  SERVICE_TYPES.FLIGHT
];

// ========== LICENSE STATUSES ==========
export const LICENSE_STATUS = {
  PENDING: {
    code: 'pending',
    label: 'Chờ xác minh',
    color: 'yellow',
    bgColor: '#fffbeb',
    borderColor: '#f59e0b',
    textColor: '#92400e',
    icon: '⏳',
    description: 'Đang chờ admin xác minh'
  },
  VERIFIED: {
    code: 'verified',
    label: 'Đã xác minh',
    color: 'green',
    bgColor: '#f0fdf4',
    borderColor: '#10b981',
    textColor: '#065f46',
    icon: '✓',
    description: 'Giấy phép đã được xác minh'
  },
  REJECTED: {
    code: 'rejected',
    label: 'Bị từ chối',
    color: 'red',
    bgColor: '#fef2f2',
    borderColor: '#ef4444',
    textColor: '#991b1b',
    icon: '✗',
    description: 'Giấy phép bị từ chối'
  }
};

// ========== API ENDPOINTS ==========
export const API_ENDPOINTS = {
  REGISTRATION: '/api/auth/service-provider/register',
  LOGIN: '/api/auth/service-provider/login',
  PROFILE: '/api/auth/service-provider/profile',
  UPDATE_PROFILE: '/api/auth/service-provider/profile',
  ADD_LICENSE: '/api/admin/service-providers/:id/add-license',
  
  // Admin endpoints
  ADMIN_GET_ALL: '/api/admin/service-providers',
  ADMIN_GET_PENDING: '/api/admin/service-providers/pending-verification',
  ADMIN_GET_STATS: '/api/admin/service-providers/stats',
  ADMIN_GET_BY_ID: '/api/admin/service-providers/:id',
  ADMIN_VERIFY_LICENSE: '/api/admin/service-providers/:id/verify-license',
  ADMIN_VERIFY_ALL: '/api/admin/service-providers/:id/verify-all'
};

// ========== ERROR MESSAGES ==========
export const ERROR_MESSAGES = {
  TOUR_MAX_LICENSES: {
    code: 'TOUR_MAX_LICENSES',
    message: 'Tour provider chỉ có thể đăng ký 1 license duy nhất',
    userMessage: 'Tour chỉ được có 1 giấy phép. Vui lòng xóa các giấy phép thừa.'
  },
  FLIGHT_MAX_LICENSES: {
    code: 'FLIGHT_MAX_LICENSES',
    message: 'Flight provider chỉ có thể đăng ký 1 license duy nhất',
    userMessage: 'Flight chỉ được có 1 giấy phép. Vui lòng xóa các giấy phép thừa.'
  },
  DUPLICATE_LICENSE: {
    code: 'DUPLICATE_LICENSE',
    message: 'License number không được trùng lặp',
    userMessage: 'Các license number phải khác nhau. Vui lòng kiểm tra lại.'
  },
  LICENSE_EXISTS: {
    code: 'LICENSE_EXISTS',
    message: 'License number đã được đăng ký bởi công ty khác',
    userMessage: 'License number này đã được sử dụng. Vui lòng sử dụng số khác.'
  },
  ONLY_HOTEL_CAN_ADD: {
    code: 'ONLY_HOTEL_CAN_ADD',
    message: 'Chỉ có thể thêm license cho service type hotel',
    userMessage: 'Tour và Flight chỉ được có 1 license duy nhất, không thể thêm mới.'
  }
};

// ========== VALIDATION RULES ==========
export const VALIDATION_RULES = {
  LICENSE_NUMBER: {
    pattern: /^[A-Z]{3}-\d{4}-\d{3}$/,
    patternExample: 'HTL-2024-001',
    description: 'Format: XXX-YYYY-NNN (VD: HTL-2024-001)',
    required: true,
    unique: true
  },
  SERVICE_TYPES: {
    required: true,
    minLength: 1,
    allowedValues: ['hotel', 'tour', 'flight']
  },
  LICENSE_LIMITS: {
    hotel: { min: 0, max: null }, // Unlimited
    tour: { min: 0, max: 1 },
    flight: { min: 0, max: 1 }
  }
};

// ========== HELPER FUNCTIONS ==========

/**
 * Check if can add license for service type
 * @param {string} serviceType - 'hotel', 'tour', or 'flight'
 * @returns {boolean}
 */
export const canAddLicense = (serviceType) => {
  return serviceType === 'hotel';
};

/**
 * Get licenses by service type
 * @param {Array} licenses - Array of license objects
 * @param {string} serviceType - 'hotel', 'tour', or 'flight'
 * @returns {Array}
 */
export const getLicensesByType = (licenses, serviceType) => {
  return licenses.filter(license => license.service_type === serviceType);
};

/**
 * Get status configuration
 * @param {string} status - 'pending', 'verified', or 'rejected'
 * @returns {Object}
 */
export const getStatusConfig = (status) => {
  return LICENSE_STATUS[status.toUpperCase()] || LICENSE_STATUS.PENDING;
};

/**
 * Validate licenses array
 * @param {Array} serviceTypes - Selected service types
 * @param {Array} licenses - License objects
 * @returns {Object} { valid: boolean, error: string }
 */
export const validateLicenses = (serviceTypes, licenses) => {
  // Check tour licenses count
  const tourLicenses = licenses.filter(l => l.service_type === 'tour');
  if (tourLicenses.length > 1) {
    return { 
      valid: false, 
      error: ERROR_MESSAGES.TOUR_MAX_LICENSES.userMessage 
    };
  }

  // Check flight licenses count
  const flightLicenses = licenses.filter(l => l.service_type === 'flight');
  if (flightLicenses.length > 1) {
    return { 
      valid: false, 
      error: ERROR_MESSAGES.FLIGHT_MAX_LICENSES.userMessage 
    };
  }

  // Check duplicate license_number
  const licenseNumbers = licenses.map(l => l.license_number);
  const uniqueNumbers = [...new Set(licenseNumbers)];
  if (licenseNumbers.length !== uniqueNumbers.length) {
    return { 
      valid: false, 
      error: ERROR_MESSAGES.DUPLICATE_LICENSE.userMessage 
    };
  }

  // Check empty license_number
  if (licenses.some(l => !l.license_number)) {
    return { 
      valid: false, 
      error: 'Vui lòng nhập đầy đủ license number' 
    };
  }

  // Check if licenses match service types
  const licensesServiceTypes = [...new Set(licenses.map(l => l.service_type))];
  const missingTypes = licensesServiceTypes.filter(t => !serviceTypes.includes(t));
  if (missingTypes.length > 0) {
    return { 
      valid: false, 
      error: `Service types không khớp: ${missingTypes.join(', ')}` 
    };
  }

  return { valid: true };
};

/**
 * Format license number
 * @param {string} type - Service type
 * @param {number} year - Year
 * @param {number} number - Sequential number
 * @returns {string}
 */
export const formatLicenseNumber = (type, year, number) => {
  const prefix = type.toUpperCase().slice(0, 3);
  const paddedNumber = String(number).padStart(3, '0');
  return `${prefix}-${year}-${paddedNumber}`;
};

/**
 * Check if provider can create service
 * @param {Object} provider - Provider object
 * @param {string} serviceType - Service type to check
 * @returns {boolean}
 */
export const canCreateService = (provider, serviceType) => {
  if (!provider || !provider.licenses) return false;
  
  const license = provider.licenses.find(l => l.service_type === serviceType);
  return license && license.verification_status === 'verified';
};

/**
 * Get service type configuration
 * @param {string} serviceType - 'hotel', 'tour', or 'flight'
 * @returns {Object}
 */
export const getServiceTypeConfig = (serviceType) => {
  return SERVICE_TYPES[serviceType.toUpperCase()] || null;
};

/**
 * Count licenses by status
 * @param {Array} licenses - Array of license objects
 * @returns {Object} { pending: number, verified: number, rejected: number }
 */
export const countLicensesByStatus = (licenses) => {
  return {
    pending: licenses.filter(l => l.verification_status === 'pending').length,
    verified: licenses.filter(l => l.verification_status === 'verified').length,
    rejected: licenses.filter(l => l.verification_status === 'rejected').length
  };
};

/**
 * Check if provider is fully verified
 * @param {Object} provider - Provider object
 * @returns {boolean}
 */
export const isFullyVerified = (provider) => {
  if (!provider || !provider.licenses || provider.licenses.length === 0) {
    return false;
  }
  return provider.licenses.every(l => l.verification_status === 'verified');
};

/**
 * Get pending licenses
 * @param {Array} licenses - Array of license objects
 * @returns {Array}
 */
export const getPendingLicenses = (licenses) => {
  return licenses.filter(l => l.verification_status === 'pending');
};

/**
 * Get verified licenses
 * @param {Array} licenses - Array of license objects
 * @returns {Array}
 */
export const getVerifiedLicenses = (licenses) => {
  return licenses.filter(l => l.verification_status === 'verified');
};

/**
 * Get rejected licenses
 * @param {Array} licenses - Array of license objects
 * @returns {Array}
 */
export const getRejectedLicenses = (licenses) => {
  return licenses.filter(l => l.verification_status === 'rejected');
};

// ========== UI CONFIGS ==========
export const UI_CONFIG = {
  REGISTRATION_STEPS: [
    {
      step: 1,
      title: 'Thông tin cá nhân',
      fields: ['email', 'password', 'first_name', 'last_name']
    },
    {
      step: 2,
      title: 'Thông tin công ty',
      fields: ['company_name', 'contact_person', 'company_email', 'company_phone', 'address']
    },
    {
      step: 3,
      title: 'Loại hình dịch vụ',
      fields: ['service_types'],
      description: 'Chọn các loại dịch vụ bạn muốn cung cấp'
    },
    {
      step: 4,
      title: 'Giấy phép kinh doanh',
      fields: ['licenses'],
      description: 'Cung cấp giấy phép cho từng loại dịch vụ',
      dynamic: true
    }
  ],
  
  COLORS: {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    gray: '#6b7280'
  }
};

// ========== EXPORT ALL ==========
export default {
  SERVICE_TYPES,
  SERVICE_TYPE_LIST,
  LICENSE_STATUS,
  API_ENDPOINTS,
  ERROR_MESSAGES,
  VALIDATION_RULES,
  UI_CONFIG,
  
  // Helper functions
  canAddLicense,
  getLicensesByType,
  getStatusConfig,
  validateLicenses,
  formatLicenseNumber,
  canCreateService,
  getServiceTypeConfig,
  countLicensesByStatus,
  isFullyVerified,
  getPendingLicenses,
  getVerifiedLicenses,
  getRejectedLicenses
};
