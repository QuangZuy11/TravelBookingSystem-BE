const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireAIBookingProvider, requireAdmin } = require('../middlewares/ai-booking-auth.middleware');
const { validateObjectId } = require('../middlewares/validateObjectId.middleware');

// Import controllers
const travelerController = require('../controllers/traveler/ai-itinerary-booking.controller');
const providerController = require('../controllers/provider/ai-itinerary-booking.controller');
const adminController = require('../controllers/admin/ai-itinerary-booking.controller');

// =====================
// TRAVELER ROUTES
// =====================

/**
 * @route   POST /api/ai-itinerary-bookings/create
 * @desc    Create new AI Itinerary booking request
 * @access  Private (Traveler only)
 */
router.post('/create', requireAuth, travelerController.createBooking);

/**
 * @route   GET /api/ai-itinerary-bookings/traveler/:userId
 * @desc    Get traveler's bookings with optional filters
 * @access  Private (Traveler only)
 */
router.get('/traveler/:userId', requireAuth, validateObjectId('userId'), travelerController.getTravelerBookings);

/**
 * @route   GET /api/ai-itinerary-bookings/:bookingId
 * @desc    Get booking detail
 * @access  Private (Traveler/Provider/Admin)
 */
router.get('/:bookingId', requireAuth, validateObjectId('bookingId'), travelerController.getBookingDetail);

/**
 * @route   PUT /api/ai-itinerary-bookings/:bookingId/cancel
 * @desc    Cancel booking
 * @access  Private (Traveler only)
 */
router.put('/:bookingId/cancel', requireAuth, validateObjectId('bookingId'), travelerController.cancelBooking);

// =====================
// PROVIDER ROUTES
// =====================

/**
 * @route   GET /api/ai-itinerary-bookings/provider/:providerId
 * @desc    Get provider's bookings with pagination
 * @access  Private (Provider only)
 */
router.get('/provider/:providerId', requireAuth, requireAIBookingProvider, validateObjectId('providerId'), providerController.getProviderBookings);

/**
 * @route   PUT /api/ai-itinerary-bookings/:bookingId/approve
 * @desc    Approve booking with quote
 * @access  Private (Provider only)
 */
router.put('/:bookingId/approve', requireAuth, requireAIBookingProvider, validateObjectId('bookingId'), providerController.approveBooking);

/**
 * @route   PUT /api/ai-itinerary-bookings/:bookingId/reject
 * @desc    Reject booking
 * @access  Private (Provider only)
 */
router.put('/:bookingId/reject', requireAuth, requireAIBookingProvider, validateObjectId('bookingId'), providerController.rejectBooking);

/**
 * @route   PUT /api/ai-itinerary-bookings/:bookingId/update
 * @desc    Update booking details
 * @access  Private (Provider only)
 */
router.put('/:bookingId/update', requireAuth, requireAIBookingProvider, validateObjectId('bookingId'), providerController.updateBooking);

/**
 * @route   PUT /api/ai-itinerary-bookings/:bookingId/complete
 * @desc    Mark booking as completed
 * @access  Private (Provider only)
 */
router.put('/:bookingId/complete', requireAuth, requireAIBookingProvider, validateObjectId('bookingId'), providerController.completeBooking);

// =====================
// ADMIN ROUTES
// =====================

/**
 * @route   GET /api/ai-itinerary-bookings/admin/all
 * @desc    Get all bookings with filters and pagination
 * @access  Private (Admin only)
 */
router.get('/admin/all', requireAuth, requireAdmin, adminController.getAllBookings);

/**
 * @route   GET /api/ai-itinerary-bookings/admin/statistics
 * @desc    Get booking statistics
 * @access  Private (Admin only)
 */
router.get('/admin/statistics', requireAuth, requireAdmin, adminController.getBookingStatistics);

/**
 * @route   PUT /api/ai-itinerary-bookings/:bookingId/admin-action
 * @desc    Admin action on booking (approve, reject, refund, resolve)
 * @access  Private (Admin only)
 */
router.put('/:bookingId/admin-action', requireAuth, requireAdmin, validateObjectId('bookingId'), adminController.adminAction);

module.exports = router;
