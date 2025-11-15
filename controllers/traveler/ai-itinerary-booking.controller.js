const mongoose = require('mongoose');
const AiItineraryBooking = require('../../models/ai-itinerary-booking.model');
const AiGeneratedItinerary = require('../../models/ai_generated_itineraries.model');
const ServiceProvider = require('../../models/service-provider.model');
const User = require('../../models/user.model');
const { sendBookingNotificationToProviders, sendBookingApprovalToTraveler, sendBookingCancellationNotification } = require('../../services/ai-booking-notification.service');

/**
 * Create new AI Itinerary Booking Request
 * @route POST /api/ai-itinerary-bookings/create
 * @access Private (Traveler only)
 */
exports.createBooking = async (req, res) => {
    try {
        const {
            ai_itinerary_id,
            destination,
            duration_days,
            participant_number,
            start_date,
            total_budget,
            selected_activities,
            contact_info,
            special_requests
        } = req.body;

        // Validate required fields
        if (!ai_itinerary_id || !start_date || !participant_number || !contact_info) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required fields'
                }
            });
        }

        // Get user_id from authenticated user
        const user_id = req.user._id;

        // Verify AI itinerary exists and belongs to user
        const itinerary = await AiGeneratedItinerary.findOne({
            _id: ai_itinerary_id,
            user_id: user_id
        });

        if (!itinerary) {
            return res.status(404).json({
                success: false,
                message: 'AI itinerary not found',
                error: {
                    code: 'ITINERARY_NOT_FOUND',
                    message: `AI itinerary with ID ${ai_itinerary_id} not found or does not belong to user`
                }
            });
        }

        // Validate start date is in the future
        const startDate = new Date(start_date);
        if (startDate <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: {
                    code: 'INVALID_DATE',
                    message: 'Start date must be in the future',
                    details: {
                        field: 'start_date',
                        value: start_date
                    }
                }
            });
        }

        // Validate participant number
        if (participant_number < 1 || participant_number > 50) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: {
                    code: 'INVALID_PARTICIPANT_NUMBER',
                    message: 'Number of participants must be between 1 and 50',
                    details: {
                        field: 'participant_number',
                        value: participant_number
                    }
                }
            });
        }

        // Validate contact info
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(contact_info.email)) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: {
                    code: 'INVALID_EMAIL',
                    message: 'Invalid email format',
                    details: {
                        field: 'contact_info.email',
                        value: contact_info.email
                    }
                }
            });
        }

        const phoneRegex = /^[0-9]{10,11}$/;
        if (!phoneRegex.test(contact_info.phone)) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: {
                    code: 'INVALID_PHONE',
                    message: 'Invalid phone number format (10-11 digits required)',
                    details: {
                        field: 'contact_info.phone',
                        value: contact_info.phone
                    }
                }
            });
        }

        // ✅ Process selected_activities to ensure required fields
        const processedActivities = (selected_activities || []).map(activity => {
            // Auto-detect activity_type based on activity name keywords
            const activityName = (activity.activity_name || '').toLowerCase();
            let activityType = activity.activity_type || 'other';

            if (!activity.activity_type) {
                // Check in priority order (more specific first)
                if (activityName.includes('lớp học') || activityName.includes('học nấu ăn')) {
                    activityType = 'adventure';
                } else if (activityName.includes('chùa') || activityName.includes('đền') || activityName.includes('bảo tàng') || activityName.includes('văn hóa') || activityName.includes('lịch sử')) {
                    activityType = 'culture';
                } else if (activityName.includes('ăn') || activityName.includes('nhà hàng') || activityName.includes('thực') || activityName.includes('chợ')) {
                    activityType = 'food';
                } else if (activityName.includes('vườn') || activityName.includes('núi') || activityName.includes('biển') || activityName.includes('thiên nhiên') || activityName.includes('leo')) {
                    activityType = 'nature';
                } else if (activityName.includes('spa') || activityName.includes('massage') || activityName.includes('nghỉ')) {
                    activityType = 'relaxation';
                } else if (activityName.includes('mua sắm') || activityName.includes('shopping')) {
                    activityType = 'shopping';
                } else if (activityName.includes('phố') || activityName.includes('khám phá')) {
                    activityType = 'entertainment';
                }
            }

            return {
                day_number: activity.day_number,
                activity_name: activity.activity_name,
                activity_type: activityType,
                location: activity.location || destination || itinerary.destination || 'Chưa xác định',
                cost: activity.cost || 0,
                duration: activity.duration || null,
                description: activity.description || null
            };
        });        // Create booking
        const booking = new AiItineraryBooking({
            ai_itinerary_id,
            user_id,
            destination: destination || itinerary.destination,
            duration_days: duration_days || itinerary.duration_days,
            participant_number,
            start_date: startDate,
            total_budget: total_budget || itinerary.budget_total,
            selected_activities: processedActivities,
            contact_info,
            special_requests: special_requests || null,
            status: 'pending'
        });

        await booking.save();

        // ✅ Increment booking count in itinerary
        try {
            await itinerary.incrementBookingCount();
        } catch (countError) {
            console.error('Error incrementing booking count:', countError);
        }

        // ✅ Update user traveler profile
        try {
            await User.findByIdAndUpdate(user_id, {
                $inc: {
                    'traveler_profile.total_bookings': 1
                },
                $addToSet: {
                    'traveler_profile.preferred_destinations': itinerary.destination
                }
            });
        } catch (profileError) {
            console.error('Error updating user profile:', profileError);
        }

        // Send notification to available tour providers
        try {
            await sendBookingNotificationToProviders(booking);
        } catch (emailError) {
            console.error('Error sending notification to providers:', emailError);
            // Don't fail the booking creation if email fails
        }

        return res.status(201).json({
            success: true,
            data: booking,
            message: 'Booking request created successfully'
        });

    } catch (error) {
        console.error('Error creating booking:', error);
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
 * Get traveler's bookings
 * @route GET /api/ai-itinerary-bookings/traveler/:userId
 * @access Private (Traveler only)
 */
exports.getTravelerBookings = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, start_date, end_date } = req.query;

        // Authorization check - user can only view their own bookings
        if (req.user._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized',
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only access your own bookings'
                }
            });
        }

        // Build query
        const query = { user_id: userId };

        if (status) {
            query.status = status;
        }

        if (start_date || end_date) {
            query.start_date = {};
            if (start_date) query.start_date.$gte = new Date(start_date);
            if (end_date) query.start_date.$lte = new Date(end_date);
        }

        // Get bookings with provider info
        const bookings = await AiItineraryBooking.find(query)
            .populate({
                path: 'provider_id',
                select: 'company_name email phone'
            })
            .sort({ created_at: -1 })
            .lean();

        // Format response
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const formattedBookings = bookings.map(booking => {
            // Check if expired: start_date <= today AND status = pending AND no provider
            const bookingDate = new Date(booking.start_date);
            bookingDate.setHours(0, 0, 0, 0);
            const isExpired = bookingDate <= today && booking.status === 'pending' && !booking.provider_id;

            return {
                _id: booking._id,
                destination: booking.destination,
                duration_days: booking.duration_days,
                start_date: booking.start_date,
                participant_number: booking.participant_number,
                total_budget: booking.total_budget,
                quoted_price: booking.quoted_price,
                status: isExpired ? 'expired' : booking.status,
                is_expired: isExpired,
                provider_info: booking.provider_id ? {
                    business_name: booking.provider_id.company_name,
                    contact_email: booking.provider_id.email,
                    phone: booking.provider_id.phone
                } : null,
                created_at: booking.created_at
            };
        });

        return res.status(200).json({
            success: true,
            data: formattedBookings
        });

    } catch (error) {
        console.error('Error fetching traveler bookings:', error);
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
 * Get booking detail
 * @route GET /api/ai-itinerary-bookings/:bookingId
 * @access Private (Traveler/Provider/Admin)
 */
exports.getBookingDetail = async (req, res) => {
    try {
        const { bookingId } = req.params;

        const booking = await AiItineraryBooking.findById(bookingId)
            .populate({
                path: 'provider_id',
                select: 'company_name email phone'
            })
            .populate({
                path: 'user_id',
                select: 'name email'
            })
            .lean();

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

        // Authorization check
        const userId = req.user._id.toString();
        const isOwner = booking.user_id._id.toString() === userId;
        const isProvider = booking.provider_id && booking.provider_id._id.toString() === userId;
        const isAdmin = req.user.role && req.user.role.role_name === 'Admin';

        if (!isOwner && !isProvider && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden',
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to view this booking'
                }
            });
        }

        // Format response
        const response = {
            ...booking,
            provider_info: booking.provider_id ? {
                business_name: booking.provider_id.company_name,
                contact_email: booking.provider_id.email,
                phone: booking.provider_id.phone
            } : null
        };

        return res.status(200).json({
            success: true,
            data: response
        });

    } catch (error) {
        console.error('Error fetching booking detail:', error);
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
 * Cancel booking
 * @route PUT /api/ai-itinerary-bookings/:bookingId/cancel
 * @access Private (Traveler only)
 */
exports.cancelBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason } = req.body;

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

        // Authorization check - only owner can cancel
        if (booking.user_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden',
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only cancel your own bookings'
                }
            });
        }

        // Check if booking can be cancelled
        if (!booking.canBeCancelled()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel booking',
                error: {
                    code: 'INVALID_STATUS',
                    message: 'Only pending or approved bookings can be cancelled',
                    current_status: booking.status
                }
            });
        }

        // Cancel booking
        await booking.cancelBooking(reason);

        // Send cancellation notification to provider if assigned
        if (booking.provider_id) {
            try {
                await sendBookingCancellationNotification(booking);
            } catch (emailError) {
                console.error('Error sending cancellation notification:', emailError);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully'
        });

    } catch (error) {
        console.error('Error cancelling booking:', error);
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
