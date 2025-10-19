const ServiceProvider = require('../models/service-provider.model');

const checkServiceProviderVerification = (serviceType) => {
    return async (req, res, next) => {
        try {
            const serviceProviderId = req.user?.service_provider_id || req.user?.id;
            const providerIdFromUrl = req.params.providerId;

            if (!serviceProviderId) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền truy cập',
                    error: 'Service provider ID not found in token'
                });
            }

            let provider = await ServiceProvider.findById(serviceProviderId);
            
            if (!provider) {
                provider = await ServiceProvider.findOne({ user_id: serviceProviderId });
            }
            
            if (!provider) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy thông tin nhà cung cấp dịch vụ',
                    error: 'Service provider not found'
                });
            }

            if (providerIdFromUrl && providerIdFromUrl !== provider._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền truy cập resource này',
                    error: 'Provider ID mismatch'
                });
            }

            if (provider.type !== serviceType) {
                return res.status(403).json({
                    success: false,
                    message: `Bạn đã đăng ký cung cấp dịch vụ ${provider.type}, không phải ${serviceType}`,
                    error: `Service type mismatch`,
                    hint: 'Mỗi nhà cung cấp chỉ có thể đăng ký 1 loại dịch vụ'
                });
            }

            const license = provider.getLicenseByType(serviceType);
            
            if (!license) {
                return res.status(403).json({
                    success: false,
                    message: `Không tìm thấy giấy phép cho dịch vụ ${serviceType}`,
                    error: `License for ${serviceType} not found`,
                    hint: 'Vui lòng thêm giấy phép cho loại dịch vụ này'
                });
            }

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

            req.serviceProvider = provider;
            req.verifiedLicense = license;

            next();

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi kiểm tra quyền',
                error: error.message
            });
        }
    };
};

const checkFullVerification = async (req, res, next) => {
    try {
        const serviceProviderId = req.user?.service_provider_id || req.user?.id;

        if (!serviceProviderId) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền truy cập',
                error: 'Service provider ID not found'
            });
        }

        let provider = await ServiceProvider.findById(serviceProviderId);
        
        if (!provider) {
            provider = await ServiceProvider.findOne({ user_id: serviceProviderId });
        }
        
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
