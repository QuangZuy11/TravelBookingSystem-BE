const ServiceProvider = require('../models/service-provider.model');
const Role = require('../models/role.model');

/**
 * Middleware to authenticate service provider for AI Itinerary Bookings
 * Verifies provider is authenticated and has tour service type
 */
exports.requireAIBookingProvider = async (req, res, next) => {
    try {
        // Check if user is authenticated
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Please login to continue'
                }
            });
        }

        // Check user role
        let userRole;
        if (typeof req.user.role === 'string') {
            userRole = req.user.role.toLowerCase();
        } else if (req.user.role && req.user.role.role_name) {
            userRole = req.user.role.role_name.toLowerCase();
        } else {
            // Fetch role from database
            const Role = require('../models/role.model');
            const roleDoc = await Role.findById(req.user.role);
            if (roleDoc) {
                userRole = roleDoc.role_name.toLowerCase();
            }
        }

        // Check if user is a service provider
        if (userRole !== 'provider' && userRole !== 'serviceprovider') {
            return res.status(403).json({
                success: false,
                message: 'Forbidden',
                error: {
                    code: 'FORBIDDEN',
                    message: 'Only service providers can access this resource'
                }
            });
        }

        // Get provider details
        const provider = await ServiceProvider.findOne({ user_id: req.user._id });

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found',
                error: {
                    code: 'PROVIDER_NOT_FOUND',
                    message: 'Service provider profile not found'
                }
            });
        }

        // Check if provider is verified
        if (!provider.admin_verified) {
            return res.status(403).json({
                success: false,
                message: 'Provider not verified',
                error: {
                    code: 'PROVIDER_NOT_VERIFIED',
                    message: 'Your provider account is not yet verified by admin'
                }
            });
        }

        // Check if provider type is 'tour' (AI itinerary bookings are tour-related)
        if (provider.type !== 'tour') {
            return res.status(403).json({
                success: false,
                message: 'Invalid provider type',
                error: {
                    code: 'INVALID_PROVIDER_TYPE',
                    message: 'Only tour providers can manage AI itinerary bookings'
                }
            });
        }

        // Attach provider to request
        req.provider = provider;

        next();
    } catch (error) {
        console.error('AI Booking Provider Auth Middleware Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Error verifying provider authentication'
            }
        });
    }
};

/**
 * Middleware to check if user is admin
 */
exports.requireAdmin = async (req, res, next) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Please login to continue'
                }
            });
        }

        // Fetch user with role
        const User = require('../models/user.model');
        const user = await User.findById(req.user._id).populate('role');

        if (!user || !user.role || user.role.role_name !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'Forbidden',
                error: {
                    code: 'FORBIDDEN',
                    message: 'Admin access required'
                }
            });
        }

        next();
    } catch (error) {
        console.error('Admin Auth Middleware Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Error verifying admin authentication'
            }
        });
    }
};
