/**
 * Middleware kiểm tra Service Provider có verified license hay không
 */

const ServiceProvider = require('../models/service-provider.model');

/**
 * Check if service provider has verified license for specific service type
 * @param {string} serviceType - 'hotel' or 'tour'
 */
const checkServiceProviderVerification = (serviceType) => {
    return async (req, res, next) => {
        try {
            // Get service provider ID from token
            const serviceProviderId = req.user?.service_provider_id;

            if (!serviceProviderId) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền truy cập',
                    error: 'Service provider ID not found in token'
                });
            }

            // Find service provider
            const provider = await ServiceProvider.findById(serviceProviderId);
            
            if (!provider) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy thông tin nhà cung cấp dịch vụ',
                    error: 'Service provider not found'
                });
            }

            // Check if provider registered for this service type
            if (!provider.type.includes(serviceType)) {
                return res.status(403).json({
                    success: false,
                    message: `Bạn chưa đăng ký cung cấp dịch vụ ${serviceType}`,
                    error: `Service type ${serviceType} not registered`,
                    hint: 'Vui lòng liên hệ admin để thêm loại dịch vụ này'
                });
            }

            // Find license for this service type
            const license = provider.getLicenseByType(serviceType);
            
            if (!license) {
                return res.status(403).json({
                    success: false,
                    message: `Không tìm thấy giấy phép cho dịch vụ ${serviceType}`,
                    error: `License for ${serviceType} not found`,
                    hint: 'Vui lòng thêm giấy phép cho loại dịch vụ này'
                });
            }

            // Check verification status
            if (license.verification_status !== 'verified') {
                const statusMessages = {
                    pending: 'Giấy phép của bạn đang chờ xác minh từ Admin',
                    rejected: 'Giấy phép của bạn đã bị từ chối'
                };

                return res.status(403).json({
                    success: false,
                    message: `Bạn chưa được xác minh để cung cấp dịch vụ ${serviceType}`,
                    error: `License status: ${license.verification_status}`,
                    details: {
                        status: license.verification_status,
                        message: statusMessages[license.verification_status],
                        license_number: license.license_number,
                        rejection_reason: license.rejection_reason
                    },
                    hint: license.verification_status === 'pending' 
                        ? 'Vui lòng chờ admin xác minh giấy phép của bạn'
                        : 'Vui lòng liên hệ admin để biết thêm chi tiết'
                });
            }

            // All checks passed - attach provider info to request
            req.serviceProvider = provider;
            req.verifiedLicense = license;

            console.log(`✅ Verified access for ${provider.company_name} to create ${serviceType}`);

            next();

        } catch (error) {
            console.error('❌ Error in verification middleware:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi kiểm tra quyền',
                error: error.message
            });
        }
    };
};

/**
 * Check if service provider is fully verified (all licenses verified)
 */
const checkFullVerification = async (req, res, next) => {
    try {
        const serviceProviderId = req.user?.service_provider_id;

        if (!serviceProviderId) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền truy cập',
                error: 'Service provider ID not found'
            });
        }

        const provider = await ServiceProvider.findById(serviceProviderId);
        
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin nhà cung cấp dịch vụ',
                error: 'Service provider not found'
            });
        }

        if (!provider.is_verified) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản của bạn chưa được xác minh đầy đủ',
                error: 'Not fully verified',
                details: {
                    pending_licenses: provider.licenses
                        .filter(l => l.verification_status !== 'verified')
                        .map(l => ({
                            service_type: l.service_type,
                            status: l.verification_status,
                            rejection_reason: l.rejection_reason
                        }))
                }
            });
        }

        req.serviceProvider = provider;
        next();

    } catch (error) {
        console.error('❌ Error in full verification check:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
};

module.exports = {
    checkServiceProviderVerification,
    checkFullVerification
};
