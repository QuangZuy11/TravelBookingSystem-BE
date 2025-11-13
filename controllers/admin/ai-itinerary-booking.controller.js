const mongoose = require('mongoose');
const AiItineraryBooking = require('../../models/ai-itinerary-booking.model');
const ServiceProvider = require('../../models/service-provider.model');
const User = require('../../models/user.model');

/**
 * Get all bookings (Admin)
 * @route GET /api/ai-itinerary-bookings/admin/all
 * @access Private (Admin only)
 */
exports.getAllBookings = async (req, res) => {
    try {
        const {
            status,
            provider_id,
            destination,
            search,
            start_date,
            end_date,
            page = 1,
            limit = 20,
            sort_by = 'created_at',
            order = 'desc'
        } = req.query;

        // Build query
        const query = {};

        if (status) {
            query.status = status;
        }

        if (provider_id) {
            query.provider_id = provider_id;
        }

        if (destination) {
            query.destination = new RegExp(destination, 'i');
        }

        if (start_date || end_date) {
            query.start_date = {};
            if (start_date) query.start_date.$gte = new Date(start_date);
            if (end_date) query.start_date.$lte = new Date(end_date);
        }

        // Text search
        if (search) {
            query.$or = [
                { 'contact_info.name': new RegExp(search, 'i') },
                { 'contact_info.email': new RegExp(search, 'i') },
                { destination: new RegExp(search, 'i') }
            ];
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await AiItineraryBooking.countDocuments(query);

        // Sort
        const sortOrder = order === 'asc' ? 1 : -1;
        const sortOptions = { [sort_by]: sortOrder };

        // Get bookings
        const bookings = await AiItineraryBooking.find(query)
            .populate({
                path: 'user_id',
                select: 'name email'
            })
            .populate({
                path: 'provider_id',
                select: 'company_name email phone'
            })
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get status statistics
        const statistics = await AiItineraryBooking.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const stats = {
            total_bookings: total,
            pending: 0,
            approved: 0,
            confirmed: 0,
            completed: 0,
            rejected: 0,
            cancelled: 0
        };

        statistics.forEach(stat => {
            stats[stat._id] = stat.count;
        });

        return res.status(200).json({
            success: true,
            data: bookings,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                total_pages: Math.ceil(total / parseInt(limit))
            },
            statistics: stats
        });

    } catch (error) {
        console.error('Error fetching all bookings:', error);
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
 * Get booking statistics
 * @route GET /api/ai-itinerary-bookings/admin/statistics
 * @access Private (Admin only)
 */
exports.getBookingStatistics = async (req, res) => {
    try {
        const { start_date, end_date, provider_id } = req.query;

        const filters = {};
        if (start_date) filters.start_date = start_date;
        if (end_date) filters.end_date = end_date;
        if (provider_id) filters.provider_id = provider_id;

        // Get comprehensive statistics
        const matchStage = {};

        if (start_date || end_date) {
            matchStage.created_at = {};
            if (start_date) matchStage.created_at.$gte = new Date(start_date);
            if (end_date) matchStage.created_at.$lte = new Date(end_date);
        }

        if (provider_id) {
            matchStage.provider_id = mongoose.Types.ObjectId(provider_id);
        }

        const stats = await AiItineraryBooking.aggregate([
            { $match: matchStage },
            {
                $facet: {
                    // Status counts
                    statusCounts: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    // Revenue statistics
                    revenueStats: [
                        {
                            $match: {
                                status: 'completed',
                                quoted_price: { $exists: true, $ne: null }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                total_revenue: { $sum: '$quoted_price' },
                                average_booking_value: { $avg: '$quoted_price' },
                                completed_count: { $sum: 1 }
                            }
                        }
                    ],
                    // Bookings by destination
                    byDestination: [
                        {
                            $group: {
                                _id: '$destination',
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { count: -1 } },
                        { $limit: 10 }
                    ],
                    // Bookings by provider
                    byProvider: [
                        {
                            $match: { provider_id: { $ne: null } }
                        },
                        {
                            $group: {
                                _id: '$provider_id',
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { count: -1 } },
                        { $limit: 10 }
                    ],
                    // Bookings by month
                    byMonth: [
                        {
                            $group: {
                                _id: {
                                    year: { $year: '$created_at' },
                                    month: { $month: '$created_at' }
                                },
                                count: { $sum: 1 },
                                revenue: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $eq: ['$status', 'completed'] },
                                                    { $ne: ['$quoted_price', null] }
                                                ]
                                            },
                                            '$quoted_price',
                                            0
                                        ]
                                    }
                                }
                            }
                        },
                        { $sort: { '_id.year': -1, '_id.month': -1 } },
                        { $limit: 12 }
                    ]
                }
            }
        ]);

        const result = stats[0];

        // Format status counts
        const statusData = {
            total_bookings: 0,
            pending: 0,
            approved: 0,
            confirmed: 0,
            completed: 0,
            rejected: 0,
            cancelled: 0
        };

        result.statusCounts.forEach(item => {
            statusData[item._id] = item.count;
            statusData.total_bookings += item.count;
        });

        // Format revenue data
        const revenueData = result.revenueStats[0] || {
            total_revenue: 0,
            average_booking_value: 0,
            completed_count: 0
        };

        // Calculate conversion rate
        const conversion_rate = statusData.total_bookings > 0
            ? (statusData.completed / statusData.total_bookings).toFixed(2)
            : 0;

        // Format destination data
        const byDestination = {};
        result.byDestination.forEach(item => {
            byDestination[item._id] = item.count;
        });

        // Populate provider names
        const providerIds = result.byProvider.map(item => item._id);
        const providers = await ServiceProvider.find({ _id: { $in: providerIds } })
            .select('company_name')
            .lean();

        const providerMap = {};
        providers.forEach(p => {
            providerMap[p._id.toString()] = p.company_name;
        });

        const byProvider = {};
        result.byProvider.forEach(item => {
            const providerName = providerMap[item._id.toString()] || 'Unknown Provider';
            byProvider[providerName] = item.count;
        });

        // Format monthly data
        const byMonth = result.byMonth.map(item => ({
            month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
            count: item.count,
            revenue: item.revenue
        }));

        return res.status(200).json({
            success: true,
            data: {
                ...statusData,
                total_revenue: revenueData.total_revenue,
                average_booking_value: Math.round(revenueData.average_booking_value),
                conversion_rate: parseFloat(conversion_rate),
                by_destination: byDestination,
                by_provider: byProvider,
                by_month: byMonth
            }
        });

    } catch (error) {
        console.error('Error fetching booking statistics:', error);
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
 * Admin action on booking
 * @route PUT /api/ai-itinerary-bookings/:bookingId/admin-action
 * @access Private (Admin only)
 */
exports.adminAction = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { action, admin_notes } = req.body;

        if (!action || !['approve', 'reject', 'refund', 'resolve'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Valid action is required (approve, reject, refund, resolve)'
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

        const adminId = req.user._id;

        // Execute action based on type
        switch (action) {
            case 'approve':
                // Force approve even if rejected
                booking.status = 'approved';
                booking.approved_at = new Date();
                break;

            case 'reject':
                // Force reject with admin reason
                booking.status = 'rejected';
                booking.rejection_reason = admin_notes || 'Rejected by admin';
                booking.rejected_at = new Date();
                break;

            case 'refund':
                // Process refund
                booking.payment_status = 'refunded';
                booking.status = 'cancelled';
                booking.cancellation_reason = 'Refunded by admin';
                booking.cancelled_at = new Date();
                break;

            case 'resolve':
                // General resolution - add notes only
                break;
        }

        // Add admin action to history
        await booking.addAdminAction(action, adminId, admin_notes);

        return res.status(200).json({
            success: true,
            message: 'Admin action executed successfully',
            data: {
                booking_id: booking._id,
                status: booking.status,
                action: action
            }
        });

    } catch (error) {
        console.error('Error executing admin action:', error);
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
