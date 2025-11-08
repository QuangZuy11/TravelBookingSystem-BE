/**
 * Danh sách tiện nghi chuẩn cho khách sạn
 * Đồng bộ với Frontend
 */

const STANDARD_AMENITIES = [
    'Wifi',
    'Bãi đậu xe',
    'Hồ bơi',
    'Phòng gym',
    'Nhà hàng',
    'Spa',
    'Quầy bar',
    'Trung tâm thương mại',
    'Thang máy',
    'Đưa đón sân bay',
    'Điều hòa',
    'Dịch vụ giặt là'
];

/**
 * Danh sách tiện nghi với thông tin chi tiết (để mở rộng sau này)
 */
const AMENITIES_DETAILS = [
    {
        code: 'wifi',
        name: 'Wifi',
        icon: '📶',
        category: 'basic',
        description: 'Kết nối internet không dây miễn phí'
    },
    {
        code: 'parking',
        name: 'Bãi đậu xe',
        icon: '🚗',
        category: 'basic',
        description: 'Chỗ đậu xe miễn phí'
    },
    {
        code: 'pool',
        name: 'Hồ bơi',
        icon: '🏊',
        category: 'facility',
        description: 'Hồ bơi ngoài trời hoặc trong nhà'
    },
    {
        code: 'gym',
        name: 'Phòng gym',
        icon: '💪',
        category: 'facility',
        description: 'Phòng tập thể dục với đầy đủ trang thiết bị'
    },
    {
        code: 'restaurant',
        name: 'Nhà hàng',
        icon: '🍽️',
        category: 'service',
        description: 'Nhà hàng phục vụ ẩm thực đa dạng'
    },
    {
        code: 'spa',
        name: 'Spa',
        icon: '💆',
        category: 'premium',
        description: 'Dịch vụ spa và massage thư giãn'
    },
    {
        code: 'bar',
        name: 'Quầy bar',
        icon: '🍸',
        category: 'premium',
        description: 'Quầy bar phục vụ đồ uống'
    },
    {
        code: 'mall',
        name: 'Trung tâm thương mại',
        icon: '🛍️',
        category: 'facility',
        description: 'Trung tâm mua sắm hoặc khu thương mại'
    },
    {
        code: 'elevator',
        name: 'Thang máy',
        icon: '🛗',
        category: 'basic',
        description: 'Thang máy hiện đại và an toàn'
    },
    {
        code: 'airport_shuttle',
        name: 'Đưa đón sân bay',
        icon: '✈️',
        category: 'service',
        description: 'Dịch vụ đưa đón sân bay'
    },
    {
        code: 'ac',
        name: 'Điều hòa',
        icon: '❄️',
        category: 'basic',
        description: 'Máy điều hòa nhiệt độ'
    },
    {
        code: 'laundry',
        name: 'Dịch vụ giặt là',
        icon: '🧺',
        category: 'service',
        description: 'Dịch vụ giặt ủi quần áo'
    }
];

/**
 * Map từ tên tiện nghi sang code (để normalize)
 */
const AMENITIES_NAME_TO_CODE = {
    'Wifi': 'wifi',
    'Bãi đậu xe': 'parking',
    'Hồ bơi': 'pool',
    'Phòng gym': 'gym',
    'Nhà hàng': 'restaurant',
    'Spa': 'spa',
    'Quầy bar': 'bar',
    'Trung tâm thương mại': 'mall',
    'Thang máy': 'elevator',
    'Đưa đón sân bay': 'airport_shuttle',
    'Điều hòa': 'ac',
    'Dịch vụ giặt là': 'laundry'
};

/**
 * Validate amenity name
 * @param {string} amenity - Tên tiện nghi cần validate
 * @returns {boolean}
 */
const isValidAmenity = (amenity) => {
    return STANDARD_AMENITIES.includes(amenity);
};

/**
 * Normalize amenity name (loại bỏ khoảng trắng thừa, chuẩn hóa chữ hoa/thường)
 * @param {string} amenity - Tên tiện nghi cần normalize
 * @returns {string|null} - Trả về tên chuẩn hoặc null nếu không hợp lệ
 */
const normalizeAmenity = (amenity) => {
    if (!amenity || typeof amenity !== 'string') return null;

    const trimmed = amenity.trim();
    const found = STANDARD_AMENITIES.find(
        a => a.toLowerCase() === trimmed.toLowerCase()
    );

    return found || null;
};

module.exports = {
    STANDARD_AMENITIES,
    AMENITIES_DETAILS,
    AMENITIES_NAME_TO_CODE,
    isValidAmenity,
    normalizeAmenity
};
