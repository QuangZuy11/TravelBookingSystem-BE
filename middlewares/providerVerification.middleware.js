/**
 * Provider Verification Middleware
 * Kiểm tra trạng thái xác minh của Service Provider
 */

const ServiceProvider = require('../models/service-provider.model');

/**
 * Check if provider is fully verified
 * (Tất cả licenses đều đã được verify)
 */
exports.requireVerifiedProvider = async (req, res, next) => {
    try {
        const userId = req.user?.user_id || req.user?._id || req.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
                error: 'User ID not found'
            });
        }

        const provider = await ServiceProvider.findOne({ user_id: userId });
        
        if (!provider) {
            return res.status(403).json({
                success: false,
                message: 'Bạn chưa đăng ký thông tin nhà cung cấp dịch vụ',
                error: 'Provider profile not found',
                redirect: '/service-provider/register'
            });
        }

        // Check if licenses are verified (using virtual field)
        if (!provider.is_verified) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản của bạn chưa được xác minh. Vui lòng chờ admin phê duyệt.',
                error: 'Provider licenses not verified',
                data: {
                    provider_id: provider._id,
                    company_name: provider.company_name,
                    is_verified: false,
                    has_pending_verification: provider.has_pending_verification,
                    licenses: provider.licenses.map(l => ({
                        service_type: l.service_type,
                        license_number: l.license_number,
                        verification_status: l.verification_status,
                        rejection_reason: l.rejection_reason
                    }))
                }
            });
        }

        // Attach provider to request
        req.provider = provider;
        next();

    } catch (error) {
        console.error('❌ Error in requireVerifiedProvider middleware:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
};

/**
 * Check if provider is fully approved by admin
 * (Licenses verified + admin approved)
 */
exports.requireAdminApproval = async (req, res, next) => {
    try {
        const userId = req.user?.user_id || req.user?._id || req.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
                error: 'User ID not found'
            });
        }

        const provider = await ServiceProvider.findOne({ user_id: userId });
        
        if (!provider) {
            return res.status(403).json({
                success: false,
                message: 'Bạn chưa đăng ký thông tin nhà cung cấp dịch vụ',
                error: 'Provider profile not found',
                redirect: '/service-provider/register'
            });
        }

        // Check if fully approved (using virtual field)
        if (!provider.is_fully_approved) {
            const reasons = [];
            
            if (!provider.is_verified) {
                reasons.push('Giấy phép chưa được xác minh');
            }
            
            if (!provider.admin_verified) {
                reasons.push('Chưa được admin phê duyệt');
                if (provider.admin_rejection_reason) {
                    reasons.push(`Lý do: ${provider.admin_rejection_reason}`);
                }
            }
            
            return res.status(403).json({
                success: false,
                message: `Tài khoản chưa được phê duyệt hoàn toàn. ${reasons.join('. ')}`,
                error: 'Provider not fully approved',
                data: {
                    provider_id: provider._id,
                    company_name: provider.company_name,
                    is_verified: provider.is_verified,
                    admin_verified: provider.admin_verified,
                    is_fully_approved: provider.is_fully_approved,
                    admin_rejection_reason: provider.admin_rejection_reason
                }
            });
        }

        req.provider = provider;
        next();

    } catch (error) {
        console.error('❌ Error in requireAdminApproval middleware:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
};

/**
 * Check if provider has at least one verified license
 * (Có ít nhất 1 license được verify)
 */
exports.requireAnyVerifiedLicense = async (req, res, next) => {
    try {
        const userId = req.user?.user_id || req.user?._id || req.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
                error: 'User ID not found'
            });
        }

        const provider = await ServiceProvider.findOne({ user_id: userId });
        
        if (!provider) {
            return res.status(403).json({
                success: false,
                message: 'Bạn chưa đăng ký thông tin nhà cung cấp dịch vụ',
                error: 'Provider profile not found'
            });
        }

        // Check if has any verified license
        const hasVerifiedLicense = provider.licenses.some(l => l.verification_status === 'verified');
        
        if (!hasVerifiedLicense) {
            return res.status(403).json({
                success: false,
                message: 'Bạn cần có ít nhất 1 giấy phép được xác minh',
                error: 'No verified license found',
                data: {
                    provider_id: provider._id,
                    licenses: provider.licenses.map(l => ({
                        service_type: l.service_type,
                        verification_status: l.verification_status
                    }))
                }
            });
        }

        req.provider = provider;
        next();

    } catch (error) {
        console.error('❌ Error in requireAnyVerifiedLicense middleware:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
};

/**
 * Check if provider has verified license for specific service type
 * Usage: requireVerifiedLicenseFor('hotel')
 */
exports.requireVerifiedLicenseFor = (serviceType) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?.user_id || req.user?._id || req.user?.id;
            
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                    error: 'User ID not found'
                });
            }

            const provider = await ServiceProvider.findOne({ user_id: userId });
            
            if (!provider) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn chưa đăng ký thông tin nhà cung cấp dịch vụ',
                    error: 'Provider profile not found'
                });
            }

            // Check if has verified license for this service type
            const verifiedLicense = provider.licenses.find(
                l => l.service_type === serviceType && l.verification_status === 'verified'
            );
            
            if (!verifiedLicense) {
                return res.status(403).json({
                    success: false,
                    message: `Bạn cần có giấy phép ${serviceType} được xác minh`,
                    error: `No verified ${serviceType} license found`,
                    data: {
                        required_service_type: serviceType,
                        available_licenses: provider.licenses
                            .filter(l => l.service_type === serviceType)
                            .map(l => ({
                                license_number: l.license_number,
                                verification_status: l.verification_status,
                                rejection_reason: l.rejection_reason
                            }))
                    }
                });
            }

            req.provider = provider;
            req.verifiedLicense = verifiedLicense;
            next();

        } catch (error) {
            console.error('❌ Error in requireVerifiedLicenseFor middleware:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server',
                error: error.message
            });
        }
    };
};

/**
 * Check if provider exists (no verification required)
 * Just check if provider profile exists
 */
exports.requireProviderProfile = async (req, res, next) => {
    try {
        const userId = req.user?.user_id || req.user?._id || req.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
                error: 'User ID not found'
            });
        }

        const provider = await ServiceProvider.findOne({ user_id: userId });
        
        if (!provider) {
            return res.status(403).json({
                success: false,
                message: 'Bạn chưa đăng ký thông tin nhà cung cấp dịch vụ',
                error: 'Provider profile not found',
                redirect: '/service-provider/register'
            });
        }

        req.provider = provider;
        next();

    } catch (error) {
        console.error('❌ Error in requireProviderProfile middleware:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
};

module.exports = exports;
