const mongoose = require('mongoose');
const AiItineraryBooking = require('../../models/ai-itinerary-booking.model');
const ServiceProvider = require('../../models/service-provider.model');
const User = require('../../models/user.model');
const { sendBookingApprovalToTraveler, sendBookingRejectionToTraveler } = require('../../services/ai-booking-notification.service');

/**
 * Get provider's bookings
 * @route GET /api/ai-itinerary-bookings/provider/:providerId
 * @access Private (Provider only)
 */
exports.getProviderBookings = async (req, res) => {
    try {
        const { providerId } = req.params;
        const { status, destination, start_date, end_date, page = 1, limit = 10 } = req.query;

        // Authorization check - provider can only view their own bookings
        if (req.user._id.toString() !== providerId && req.provider._id.toString() !== providerId) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden',
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only access your own bookings'
                }
            });
        }

        // Build query
        const query = {
            $or: [
                { provider_id: providerId },
                { provider_id: null, status: 'pending' } // Show pending bookings without assigned provider
            ]
        };

        if (status) {
            query.status = status;
        }

        if (destination) {
            query.destination = new RegExp(destination, 'i');
        }

        if (start_date || end_date) {
            query.start_date = {};
            if (start_date) query.start_date.$gte = new Date(start_date);
            if (end_date) query.start_date.$lte = new Date(end_date);
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await AiItineraryBooking.countDocuments(query);

        // Get bookings
        const bookings = await AiItineraryBooking.find(query)
            .populate({
                path: 'user_id',
                select: 'name email'
            })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Format response
        const formattedBookings = bookings.map(booking => ({
            _id: booking._id,
            destination: booking.destination,
            duration_days: booking.duration_days,
            start_date: booking.start_date,
            participant_number: booking.participant_number,
            total_budget: booking.total_budget,
            quoted_price: booking.quoted_price,
            status: booking.status,
            contact_info: booking.contact_info,
            special_requests: booking.special_requests,
            selected_activities: booking.selected_activities || [], // ✅ Correct field name
            created_at: booking.created_at,
            user: booking.user_id ? {
                _id: booking.user_id._id,
                name: booking.user_id.name,
                email: booking.user_id.email
            } : null
        }));

        return res.status(200).json({
            success: true,
            data: formattedBookings,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                total_pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching provider bookings:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
};

/**
 * Approve booking with quote
 * @route PUT /api/ai-itinerary-bookings/:bookingId/approve
 * @access Private (Provider only)
 */
exports.approveBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { quoted_price, provider_notes, included_services, excluded_services } = req.body;

        // Validate required fields
        if (!quoted_price || !included_services || included_services.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'quoted_price and included_services are required'
                }
            });
        }

        // Validate quoted_price is positive
        if (quoted_price <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'quoted_price must be a positive number'
                }
            });
        }

        const booking = await AiItineraryBooking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found',
                error: {
                    code: 'BOOKING_NOT_FOUND',
                    message: `Booking with ID ${bookingId} not found`
                }
            });
        }

        // Check if booking can be approved
        if (!booking.canBeApproved()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot approve booking',
                error: {
                    code: 'INVALID_STATUS',
                    message: 'Only pending bookings can be approved',
                    current_status: booking.status
                }
            });
        }

        // Get provider info from authenticated user
        const provider = req.provider;

        // ✅ Calculate quote using provider's pricing settings (optional - use if no quoted_price provided)
        let finalQuotedPrice = quoted_price;
        if (!quoted_price && provider.calculateQuote) {
            finalQuotedPrice = provider.calculateQuote(booking);
        }

        // Assign provider to booking and approve
        booking.provider_id = provider._id;
        await booking.approveBooking(
            finalQuotedPrice,
            provider_notes || '',
            included_services,
            excluded_services || []
        );

        // ✅ Update provider booking stats
        try {
            await provider.updateBookingStats('approved');
        } catch (statsError) {
            console.error('Error updating provider stats:', statsError);
        }

        // Send approval email to traveler
        try {
            await sendBookingApprovalToTraveler(booking, provider);
        } catch (emailError) {
            console.error('Error sending approval email:', emailError);
        }

        return res.status(200).json({
            success: true,
            data: {
                _id: booking._id,
                status: booking.status,
                quoted_price: booking.quoted_price,
                provider_notes: booking.provider_notes,
                included_services: booking.included_services,
                excluded_services: booking.excluded_services,
                approved_at: booking.approved_at
            },
            message: 'Booking approved successfully'
        });

    } catch (error) {
        console.error('Error approving booking:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
};

/**
 * Reject booking
 * @route PUT /api/ai-itinerary-bookings/:bookingId/reject
 * @access Private (Provider only)
 */
exports.rejectBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Rejection reason is required'
                }
            });
        }

        const booking = await AiItineraryBooking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found',
                error: {
                    code: 'BOOKING_NOT_FOUND',
                    message: `Booking with ID ${bookingId} not found`
                }
            });
        }

        // Authorization check - only assigned provider or any provider for pending bookings
        const provider = req.provider;
        if (booking.provider_id && booking.provider_id.toString() !== provider._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden',
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to reject this booking'
                }
            });
        }

        // Check if booking can be rejected
        if (!booking.canBeRejected()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot reject booking',
                error: {
                    code: 'INVALID_STATUS',
                    message: 'Only pending bookings can be rejected',
                    current_status: booking.status
                }
            });
        }

        // Reject booking
        await booking.rejectBooking(reason);

        // ✅ Update provider booking stats
        try {
            await provider.updateBookingStats('rejected');
        } catch (statsError) {
            console.error('Error updating provider stats:', statsError);
        }

        // Send rejection email to traveler
        try {
            await sendBookingRejectionToTraveler(booking, provider);
        } catch (emailError) {
            console.error('Error sending rejection email:', emailError);
        }

        return res.status(200).json({
            success: true,
            message: 'Booking rejected successfully'
        });

    } catch (error) {
        console.error('Error rejecting booking:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
};

/**
 * Update booking details
 * @route PUT /api/ai-itinerary-bookings/:bookingId/update
 * @access Private (Provider only)
 */
exports.updateBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { provider_notes, quoted_price, included_services, excluded_services } = req.body;

        const booking = await AiItineraryBooking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found',
                error: {
                    code: 'BOOKING_NOT_FOUND',
                    message: `Booking with ID ${bookingId} not found`
                }
            });
        }

        // Authorization check - only assigned provider can update
        const provider = req.provider;
        if (!booking.provider_id || booking.provider_id.toString() !== provider._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden',
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to update this booking'
                }
            });
        }

        // Update allowed fields
        if (provider_notes !== undefined) booking.provider_notes = provider_notes;
        if (quoted_price !== undefined && quoted_price > 0) booking.quoted_price = quoted_price;
        if (included_services !== undefined) booking.included_services = included_services;
        if (excluded_services !== undefined) booking.excluded_services = excluded_services;

        await booking.save();

        return res.status(200).json({
            success: true,
            data: {
                _id: booking._id,
                quoted_price: booking.quoted_price,
                provider_notes: booking.provider_notes,
                included_services: booking.included_services,
                excluded_services: booking.excluded_services,
                updated_at: booking.updated_at
            },
            message: 'Booking updated successfully'
        });

    } catch (error) {
        console.error('Error updating booking:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
};

/**
 * Complete booking
 * @route PUT /api/ai-itinerary-bookings/:bookingId/complete
 * @access Private (Provider only)
 */
exports.completeBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { completion_notes } = req.body;

        const booking = await AiItineraryBooking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found',
                error: {
                    code: 'BOOKING_NOT_FOUND',
                    message: `Booking with ID ${bookingId} not found`
                }
            });
        }

        // Authorization check - only assigned provider can complete
        const provider = req.provider;
        if (!booking.provider_id || booking.provider_id.toString() !== provider._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden',
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to complete this booking'
                }
            });
        }

        // Check if booking can be completed
        if (!booking.canBeCompleted()) {
            // ✅ Provide specific error message based on current status
            let errorMessage = 'Only approved or confirmed bookings can be completed';

            if (booking.status === 'cancelled') {
                errorMessage = 'Cannot complete a cancelled booking';
            } else if (booking.status === 'rejected') {
                errorMessage = 'Cannot complete a rejected booking';
            } else if (booking.status === 'completed') {
                errorMessage = 'Booking is already completed';
            } else if (booking.status === 'pending') {
                errorMessage = 'Booking must be approved first before completion';
            }

            return res.status(400).json({
                success: false,
                message: 'Cannot complete booking',
                error: {
                    code: 'INVALID_STATUS',
                    message: errorMessage,
                    current_status: booking.status,
                    required_status: ['approved', 'confirmed']
                }
            });
        }

        // Complete booking
        await booking.completeBooking(completion_notes || '');

        // ✅ Update provider booking stats with revenue
        try {
            await provider.updateBookingStats('completed', booking.quoted_price || 0);
        } catch (statsError) {
            console.error('Error updating provider stats:', statsError);
        }

        // ✅ Update user traveler profile
        try {
            await User.findByIdAndUpdate(booking.user_id, {
                $inc: {
                    'traveler_profile.completed_trips': 1,
                    'traveler_profile.total_spent': booking.quoted_price || 0
                }
            });
        } catch (profileError) {
            console.error('Error updating user profile:', profileError);
        }

        return res.status(200).json({
            success: true,
            message: 'Booking marked as completed'
        });

    } catch (error) {
        console.error('Error completing booking:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
};
