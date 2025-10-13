/**
 * Admin Service Provider Verification Controller
 * Admin phê duyệt/từ chối service provider
 */

const ServiceProvider = require('../../models/service-provider.model');

/**
 * @route   GET /api/admin/service-providers/pending
 * @desc    Lấy danh sách providers chờ phê duyệt
 * @access  Admin only
 */
exports.getPendingProviders = async (req, res) => {
    try {
        const providers = await ServiceProvider.find({
            $or: [
                { admin_verified: false },
                { 'licenses.verification_status': 'pending' }
            ]
        })
        .populate('user_id', 'name email phone')
        .sort({ created_at: -1 });

        res.status(200).json({
            success: true,
            count: providers.length,
            data: providers
        });

    } catch (error) {
        console.error('❌ Error getting pending providers:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
};

/**
 * @route   GET /api/admin/service-providers/:id
 * @desc    Lấy thông tin chi tiết một provider
 * @access  Admin only
 */
exports.getServiceProviderById = async (req, res) => {
    try {
        const { id } = req.params;

        const provider = await ServiceProvider.findById(id)
            .populate('user_id', 'name email phone')
            .populate('admin_verified_by', 'name email');

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy service provider',
                error: 'Provider not found'
            });
        }

        // Convert to object to include virtuals
        const providerData = provider.toObject({ virtuals: true });

        res.status(200).json({
            success: true,
            data: providerData
        });

    } catch (error) {
        console.error('❌ Error getting service provider:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
};

/**
 * @route   PUT /api/admin/service-providers/:id/verify-admin
 * @desc    Admin phê duyệt/từ chối toàn bộ provider
 * @access  Admin only
 */
exports.updateAdminVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const { approved, rejection_reason } = req.body;
        const adminId = req.user?.user_id || req.user?._id || req.user?.id;

        if (approved === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp trạng thái phê duyệt (approved: true/false)',
                error: 'Missing required field: approved'
            });
        }

        if (!approved && !rejection_reason) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp lý do từ chối',
                error: 'rejection_reason required when approved=false'
            });
        }

        const provider = await ServiceProvider.findById(id);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy service provider',
                error: 'Provider not found'
            });
        }

        // Update admin verification
        await provider.updateAdminVerification(approved, adminId, rejection_reason);

        console.log(`✅ Admin ${approved ? 'approved' : 'rejected'} provider: ${provider.company_name}`);

        res.status(200).json({
            success: true,
            message: approved 
                ? 'Phê duyệt provider thành công' 
                : 'Từ chối provider thành công',
            data: {
                provider_id: provider._id,
                company_name: provider.company_name,
                admin_verified: provider.admin_verified,
                admin_verified_at: provider.admin_verified_at,
                admin_rejection_reason: provider.admin_rejection_reason,
                is_fully_approved: provider.is_fully_approved
            }
        });

    } catch (error) {
        console.error('❌ Error updating admin verification:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
};

/**
 * @route   PUT /api/admin/service-providers/:id/verify-license
 * @desc    Admin xác minh license cụ thể
 * @access  Admin only
 */
exports.updateLicenseVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const { license_id, status, rejection_reason } = req.body;
        const adminId = req.user?.user_id || req.user?._id || req.user?.id;

        if (!license_id || !status) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp license_id và status',
                error: 'Missing required fields'
            });
        }

        if (!['verified', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status phải là "verified" hoặc "rejected"',
                error: 'Invalid status value'
            });
        }

        if (status === 'rejected' && !rejection_reason) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp lý do từ chối',
                error: 'rejection_reason required when status=rejected'
            });
        }

        const provider = await ServiceProvider.findById(id);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy service provider',
                error: 'Provider not found'
            });
        }

        // Find license
        const license = provider.licenses.id(license_id);
        if (!license) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy license',
                error: 'License not found'
            });
        }

        // Update license status
        license.verification_status = status;
        if (status === 'verified') {
            license.verified_at = new Date();
            license.verified_by = adminId;
            license.rejection_reason = null;
        } else {
            license.rejection_reason = rejection_reason;
            license.verified_at = null;
            license.verified_by = null;
        }

        await provider.save();

        console.log(`✅ Admin ${status} license ${license.license_number} for ${provider.company_name}`);

        res.status(200).json({
            success: true,
            message: status === 'verified' 
                ? 'Xác minh license thành công' 
                : 'Từ chối license thành công',
            data: {
                provider_id: provider._id,
                company_name: provider.company_name,
                license: {
                    _id: license._id,
                    service_type: license.service_type,
                    license_number: license.license_number,
                    verification_status: license.verification_status,
                    verified_at: license.verified_at,
                    rejection_reason: license.rejection_reason
                },
                is_verified: provider.is_verified,
                is_fully_approved: provider.is_fully_approved
            }
        });

    } catch (error) {
        console.error('❌ Error updating license verification:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
};

module.exports = exports;
