const express = require('express');
const router = express.Router();
const travelerHotel = require('../../controllers/traveler/hotel.controller');

/**
 * Routes cho chức năng quản lý khách sạn - Traveler
 * Base URL: /api/traveler/hotels
 */

// =============================================================================
// ROUTES CÔNG KHAI (Không cần authentication)
// =============================================================================

/**
 * GET /api/traveler/hotels/search
 * Tìm kiếm và lọc danh sách khách sạn
 * Query params: location, checkIn, checkOut, guests, rooms, priceMin, priceMax, 
 *               amenities, category, rating, page, limit, sortBy, sortOrder
 */
router.get('/search', travelerHotel.searchHotels);

/**
 * GET /api/traveler/hotels/featured
 * Lấy danh sách khách sạn nổi bật
 * Query params: limit (default: 6)
 */
router.get('/featured', travelerHotel.getFeaturedHotels);

/**
 * GET /api/traveler/hotels/amenities
 * Lấy danh sách tất cả tiện nghi có sẵn (cho dropdown filter)
 */
router.get('/amenities', travelerHotel.getAvailableAmenities);

/**
 * GET /api/traveler/hotels/locations
 * Lấy danh sách địa điểm có sẵn (cho search suggestions)
 */
router.get('/locations', travelerHotel.getAvailableLocations);

/**
 * GET /api/traveler/hotels/price-range
 * Lấy khoảng giá min/max (cho price slider)
 */
router.get('/price-range', travelerHotel.getPriceRange);

/**
 * GET /api/traveler/hotels/:hotelId
 * Lấy chi tiết khách sạn theo ID
 * Params: hotelId
 */
router.get('/:hotelId', travelerHotel.getHotelById);

// =============================================================================
// ROUTES BẢO MẬT (Cần authentication) - Commented out for now
// =============================================================================

// Uncomment các routes này khi đã có authentication middleware

// const authMiddleware = require('../../middleware/auth.middleware');

/**
 * POST /api/traveler/hotels/:hotelId/reviews
 * Thêm đánh giá cho khách sạn
 * Params: hotelId
 * Body: { rating, comment }
 * Require: Authentication
 */
// router.post('/:hotelId/reviews', authMiddleware, travelerHotel.addHotelReview);

/**
 * GET /api/traveler/hotels/:hotelId/availability
 * Kiểm tra phòng trống theo ngày
 * Params: hotelId
 * Query: checkIn, checkOut, rooms
 * Require: Authentication
 */
// router.get('/:hotelId/availability', authMiddleware, travelerHotel.checkAvailability);

/**
 * POST /api/traveler/hotels/:hotelId/favorites
 * Thêm khách sạn vào danh sách yêu thích
 * Params: hotelId
 * Require: Authentication
 */
// router.post('/:hotelId/favorites', authMiddleware, travelerHotel.addToFavorites);

/**
 * DELETE /api/traveler/hotels/:hotelId/favorites
 * Xóa khách sạn khỏi danh sách yêu thích
 * Params: hotelId
 * Require: Authentication
 */
// router.delete('/:hotelId/favorites', authMiddleware, travelerHotel.removeFromFavorites);

// =============================================================================
// EXPORT ROUTER
// =============================================================================

module.exports = router;