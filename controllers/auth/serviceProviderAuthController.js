/**
 * Service Provider Authentication Controller
 * Xử lý đăng ký, đăng nhập cho nhà cung cấp dịch vụ
 */

const User = require('../../models/user.model');
const ServiceProvider = require('../../models/service-provider.model');
const Role = require('../../models/role.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * @route   POST /api/auth/service-provider/register
 * @desc    Đăng ký tài khoản Service Provider
 * @access  Public
 */
exports.registerServiceProvider = async (req, res) => {
    try {
        const {
            // User credentials (optional - sẽ tự động generate nếu không có)
            email,
            password,
            name, // Tên đầy đủ
            phone,
            
            // Service Provider info
            company_name,
            contact_person,
            company_email,
            company_phone,
            address,
            service_types, // ['hotel', 'tour'] - hoặc dùng 'type' cũng được
            type, // Alias của service_types
            licenses // [{ service_type, license_number, documents }]
        } = req.body;

        // Support cả 'type' và 'service_types', nhưng CHỈ nhận 1 loại dịch vụ
        let serviceType = service_types || type;
        
        // Nếu là array, chỉ lấy phần tử đầu tiên và warn
        if (Array.isArray(serviceType)) {
            if (serviceType.length > 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Mỗi nhà cung cấp chỉ được chọn 1 loại dịch vụ duy nhất',
                    error: 'Only one service type allowed'
                });
            }
            serviceType = serviceType[0];
        }

            email: email || company_email,
            name: name || contact_person,
            company_name,
            service_type: serviceType,
            licenses: licenses?.map(l => ({ type: l.service_type, number: l.license_number }))
        });

        // ===== VALIDATION =====
        
        // User email: dùng company_email nếu không có email riêng
        const userEmail = email || company_email;
        const userName = name || contact_person;
        const userPhone = phone || company_phone;
        
        // Company info: dùng user info nếu không có company info riêng
        const finalCompanyEmail = company_email || email;
        const finalCompanyPhone = company_phone || phone;
        
        // Password: tự động generate nếu không có
        let userPassword = password;
        if (!userPassword) {
            // Auto-generate password từ company_name + random
            userPassword = `${company_name.replace(/\s/g, '')}@${Math.random().toString(36).slice(-8)}`;
        }
        
        if (!userEmail) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp email (email hoặc company_email)',
                error: 'Missing required field: email'
            });
        }

        // Check required company fields
        if (!company_name || !contact_person || !address) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp đầy đủ thông tin công ty',
                error: 'Missing required fields: company_name, contact_person, address'
            });
        }

        // Check service type
        if (!serviceType) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn loại hình dịch vụ (field: type hoặc service_types)',
                error: 'service type is required'
            });
        }

        // Validate service type
        const validTypes = ['hotel', 'tour'];
        if (!validTypes.includes(serviceType)) {
            return res.status(400).json({
                success: false,
                message: `Loại dịch vụ không hợp lệ: ${serviceType}`,
                error: `Valid types are: ${validTypes.join(', ')}`
            });
        }

        // Check licenses
        if (!licenses || !Array.isArray(licenses) || licenses.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp giấy phép kinh doanh cho từng loại dịch vụ',
                error: 'licenses array is required'
            });
        }

        // Validate license count based on service type
    const hotelLicenses = licenses.filter(l => l.service_type === 'hotel');
    const tourLicenses = licenses.filter(l => l.service_type === 'tour');
        // Tour chỉ được có 1 license
        if (tourLicenses.length > 1) {
            return res.status(400).json({
                success: false,
                message: 'Tour provider chỉ có thể đăng ký 1 license duy nhất',
                error: 'Tour service type can only have 1 license'
            });
        }
        
        for (const license of licenses) {
            if (!license.service_type || !license.license_number) {
                return res.status(400).json({
                    success: false,
                    message: 'Mỗi giấy phép cần có service_type và license_number',
                    error: 'Invalid license format'
                });
            }

            if (license.service_type !== serviceType) {
                return res.status(400).json({
                    success: false,
                    message: `Loại dịch vụ ${license.service_type} trong license không khớp với service type đã chọn (${serviceType})`,
                    error: 'License service_type must match declared service type'
                });
            }
        }

        // Check for duplicate license_number in the same registration
        const licenseNumbers = licenses.map(l => l.license_number);
        const uniqueLicenseNumbers = [...new Set(licenseNumbers)];
        if (licenseNumbers.length !== uniqueLicenseNumbers.length) {
            return res.status(400).json({
                success: false,
                message: 'License number không được trùng lặp',
                error: 'Duplicate license numbers detected'
            });
        }

        // Check if license_number already exists in database
        const existingLicense = await ServiceProvider.findOne({
            'licenses.license_number': { $in: licenseNumbers }
        });
        if (existingLicense) {
            const duplicateLicense = existingLicense.licenses.find(l => 
                licenseNumbers.includes(l.license_number)
            );
            return res.status(400).json({
                success: false,
                message: `License number ${duplicateLicense.license_number} đã được đăng ký bởi công ty khác`,
                error: 'License number already exists'
            });
        }

    // NOTE: Không cần check service_types.length === licenses.length nữa
    // Vì hotel có thể có nhiều licenses, tour chỉ 1

        // ===== CHECK EXISTING USER =====
        
        const existingUser = await User.findOne({ email: userEmail.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email đã được sử dụng',
                error: 'Email already exists'
            });
        }

        // Check existing company
        const existingCompany = await ServiceProvider.findOne({ 
            company_name: { $regex: new RegExp(`^${company_name}$`, 'i') }
        });
        if (existingCompany) {
            return res.status(400).json({
                success: false,
                message: 'Tên công ty đã tồn tại trong hệ thống',
                error: 'Company name already exists'
            });
        }

        // ===== CREATE USER =====
        
        // Find or create service_provider role
        let serviceProviderRole = await Role.findOne({ role_name: 'ServiceProvider' });
        if (!serviceProviderRole) {
            serviceProviderRole = await Role.create({
                role_name: 'ServiceProvider',
                permissions: ['manage_own_services', 'view_bookings', 'manage_licenses']
            });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userPassword, salt);

        // Create user with role 'service_provider'
        const user = new User({
            email: userEmail.toLowerCase(),
            password: hashedPassword,
            name: userName,
            phone: userPhone,
            role: serviceProviderRole._id
        });

        await user.save();


        // ===== CREATE SERVICE PROVIDER =====
        
        // Format licenses array
        const formattedLicenses = licenses.map(license => ({
            service_type: license.service_type,
            license_number: license.license_number,
            verification_status: 'pending',
            documents: license.documents || []
        }));

        const serviceProvider = new ServiceProvider({
            user_id: user._id,
            company_name,
            contact_person,
            email: finalCompanyEmail,
            phone: finalCompanyPhone,
            address,
            type: serviceType,
            licenses: formattedLicenses
        });

        await serviceProvider.save();


        // ===== GENERATE JWT TOKEN =====
        
        const token = jwt.sign(
            { 
                user_id: user._id,
                email: user.email,
                role: 'ServiceProvider',
                service_provider_id: serviceProvider._id
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        // ===== RESPONSE =====
        
        res.status(201).json({
            success: true,
            message: password 
                ? 'Đăng ký thành công! Tài khoản của bạn đang chờ xác minh.' 
                : `Đăng ký thành công! Mật khẩu tự động: ${userPassword}`,
            data: {
                token,
                user: {
                    _id: user._id,
                    email: user.email,
                    name: user.name,
                    phone: user.phone,
                    role: 'ServiceProvider'
                },
                provider: {
                    _id: serviceProvider._id,
                    user_id: serviceProvider.user_id,
                    company_name: serviceProvider.company_name,
                    contact_person: serviceProvider.contact_person,
                    email: serviceProvider.email,
                    phone: serviceProvider.phone,
                    address: serviceProvider.address,
                    type: serviceProvider.type,
                    service_types: serviceProvider.type, // Alias for backward compatibility
                    licenses: serviceProvider.licenses.map(l => ({
                        _id: l._id,
                        service_type: l.service_type,
                        license_number: l.license_number,
                        verification_status: l.verification_status,
                        verified_at: l.verified_at,
                        verified_by: l.verified_by,
                        rejection_reason: l.rejection_reason,
                        documents: l.documents
                    })),
                    rating: serviceProvider.rating,
                    total_reviews: serviceProvider.total_reviews,
                    is_verified: serviceProvider.is_verified,
                    has_pending_verification: serviceProvider.has_pending_verification,
                    created_at: serviceProvider.created_at,
                    updated_at: serviceProvider.updated_at
                }
            }
        });

    } catch (error) {
        console.error('❌ Error registering service provider:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi đăng ký',
            error: error.message
        });
    }
};

/**
 * @route   POST /api/auth/service-provider/create-profile
 * @desc    Tạo Service Provider profile cho user đã tồn tại
 * @access  Private (requires valid JWT token)
 */
exports.createProviderProfile = async (req, res) => {
    try {
        const {
            company_name,
            contact_person,
            company_email,
            company_phone,
            address,
            service_types, // ['hotel', 'tour']
            type, // Alias
            licenses // [{ service_type, license_number, documents }]
        } = req.body;

        // Get user from token (set by auth middleware)
        const userId = req.user?.user_id || req.user?._id || req.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized - Token không hợp lệ',
                error: 'User ID not found in token'
            });
        }

        // Accept both 'type' and 'service_types', nhưng CHỈ nhận 1 loại dịch vụ
        let serviceType = service_types || type;
        
        if (Array.isArray(serviceType)) {
            if (serviceType.length > 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Mỗi nhà cung cấp chỉ được chọn 1 loại dịch vụ duy nhất',
                    error: 'Only one service type allowed'
                });
            }
            serviceType = serviceType[0];
        }

            userId,
            company_name,
            service_type: serviceType
        });

        const existingProvider = await ServiceProvider.findOne({ user_id: userId });
        if (existingProvider) {
            return res.status(400).json({
                success: false,
                message: 'User này đã có Service Provider profile',
                error: 'Provider profile already exists'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại',
                error: 'User not found'
            });
        }

        if (!company_name || !contact_person || !address) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp đầy đủ thông tin công ty',
                error: 'Missing required fields: company_name, contact_person, address'
            });
        }

        if (!serviceType) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn loại hình dịch vụ',
                error: 'service type is required'
            });
        }

        const validTypes = ['hotel', 'tour'];
        if (!validTypes.includes(serviceType)) {
            return res.status(400).json({
                success: false,
                message: `Loại dịch vụ không hợp lệ: ${serviceType}`,
                error: `Valid types are: ${validTypes.join(', ')}`
            });
        }

        if (!licenses || !Array.isArray(licenses) || licenses.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp giấy phép kinh doanh',
                error: 'licenses array is required'
            });
        }

        // Validate license count
    const hotelLicenses = licenses.filter(l => l.service_type === 'hotel');
    const tourLicenses = licenses.filter(l => l.service_type === 'tour');
        if (tourLicenses.length > 1) {
            return res.status(400).json({
                success: false,
                message: 'Tour provider chỉ có thể đăng ký 1 license duy nhất',
                error: 'Tour service type can only have 1 license'
            });
        }
        
        // no flight validations (flight feature removed)

        // Validate each license
        for (const license of licenses) {
            if (!license.service_type || !license.license_number) {
                return res.status(400).json({
                    success: false,
                    message: 'Mỗi giấy phép cần có service_type và license_number',
                    error: 'Invalid license format'
                });
            }

            if (license.service_type !== serviceType) {
                return res.status(400).json({
                    success: false,
                    message: `Loại dịch vụ ${license.service_type} trong license không khớp với service type đã chọn (${serviceType})`,
                    error: 'License service_type must match declared service type'
                });
            }
        }

        // Check duplicate license numbers
        const licenseNumbers = licenses.map(l => l.license_number);
        const uniqueLicenseNumbers = [...new Set(licenseNumbers)];
        if (licenseNumbers.length !== uniqueLicenseNumbers.length) {
            return res.status(400).json({
                success: false,
                message: 'License number không được trùng lặp',
                error: 'Duplicate license numbers detected'
            });
        }

        // Check if license_number already exists
        const existingLicense = await ServiceProvider.findOne({
            'licenses.license_number': { $in: licenseNumbers }
        });
        if (existingLicense) {
            const duplicateLicense = existingLicense.licenses.find(l => 
                licenseNumbers.includes(l.license_number)
            );
            return res.status(400).json({
                success: false,
                message: `License number ${duplicateLicense.license_number} đã được đăng ký`,
                error: 'License number already exists'
            });
        }

        // Check company name
        const existingCompany = await ServiceProvider.findOne({ 
            company_name: { $regex: new RegExp(`^${company_name}$`, 'i') }
        });
        if (existingCompany) {
            return res.status(400).json({
                success: false,
                message: 'Tên công ty đã tồn tại trong hệ thống',
                error: 'Company name already exists'
            });
        }

        // ===== UPDATE USER ROLE =====
        
        let serviceProviderRole = await Role.findOne({ role_name: 'ServiceProvider' });
        if (!serviceProviderRole) {
            serviceProviderRole = await Role.create({
                role_name: 'ServiceProvider',
                permissions: ['manage_own_services', 'view_bookings', 'manage_licenses']
            });
        }
        
        user.role = serviceProviderRole._id;
        await user.save();

        // ===== CREATE SERVICE PROVIDER =====
        
        const formattedLicenses = licenses.map(license => ({
            service_type: license.service_type,
            license_number: license.license_number,
            verification_status: 'pending',
            documents: license.documents || []
        }));

        const serviceProvider = new ServiceProvider({
            user_id: userId,
            company_name,
            contact_person,
            email: company_email || user.email,
            phone: company_phone || user.phone,
            address,
            type: serviceType,
            licenses: formattedLicenses
        });

        await serviceProvider.save();


        // ===== RESPONSE =====
        
        res.status(201).json({
            success: true,
            message: 'Tạo Service Provider profile thành công! Đang chờ xác minh.',
            data: {
                provider: {
                    _id: serviceProvider._id,
                    user_id: serviceProvider.user_id,
                    company_name: serviceProvider.company_name,
                    contact_person: serviceProvider.contact_person,
                    email: serviceProvider.email,
                    phone: serviceProvider.phone,
                    address: serviceProvider.address,
                    type: serviceProvider.type,
                    service_types: serviceProvider.type,
                    licenses: serviceProvider.licenses.map(l => ({
                        _id: l._id,
                        service_type: l.service_type,
                        license_number: l.license_number,
                        verification_status: l.verification_status,
                        verified_at: l.verified_at,
                        verified_by: l.verified_by,
                        rejection_reason: l.rejection_reason,
                        documents: l.documents
                    })),
                    rating: serviceProvider.rating,
                    total_reviews: serviceProvider.total_reviews,
                    is_verified: serviceProvider.is_verified,
                    has_pending_verification: serviceProvider.has_pending_verification,
                    created_at: serviceProvider.created_at,
                    updated_at: serviceProvider.updated_at
                }
            }
        });

    } catch (error) {
        console.error('❌ Error creating service provider profile:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo profile',
            error: error.message
        });
    }
};

/**
 * ⚠️ LOGIN: Không cần function riêng
 * Sử dụng /api/auth/login (auth.controller.js)
 * Login chung cho tất cả roles, tự động trả về provider info nếu role = ServiceProvider
 */

/**
 * @route   GET /api/auth/service-provider/profile
 * @desc    Lấy thông tin profile Service Provider
 * @access  Private (Service Provider)
 */
exports.getServiceProviderProfile = async (req, res) => {
    try {
        // req.user should be set by auth middleware
        const userId = req.user?.user_id || req.user?._id;

        const serviceProvider = await ServiceProvider.findOne({ user_id: userId })
            .populate('user_id', 'email name phone');

        if (!serviceProvider) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin Service Provider',
                error: 'Service provider not found'
            });
        }

        res.status(200).json({
            success: true,
            data: serviceProvider
        });

    } catch (error) {
        console.error('❌ Error getting service provider profile:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
};

/**
 * @route   PUT /api/auth/service-provider/profile
 * @desc    Cập nhật thông tin Service Provider
 * @access  Private (Service Provider)
 */
exports.updateServiceProviderProfile = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?._id;
        const {
            company_name,
            contact_person,
            email,
            phone,
            address
        } = req.body;

        const serviceProvider = await ServiceProvider.findOne({ user_id: userId });

        if (!serviceProvider) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin Service Provider',
                error: 'Service provider not found'
            });
        }

        // Update fields (only if provided)
        if (company_name !== undefined) serviceProvider.company_name = company_name;
        if (contact_person !== undefined) serviceProvider.contact_person = contact_person;
        if (email !== undefined) serviceProvider.email = email;
        if (phone !== undefined) serviceProvider.phone = phone;
        if (address !== undefined) serviceProvider.address = address;

        serviceProvider.updated_at = new Date();
        await serviceProvider.save();


        res.status(200).json({
            success: true,
            message: 'Cập nhật thông tin thành công',
            data: serviceProvider
        });

    } catch (error) {
        console.error('❌ Error updating service provider profile:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật',
            error: error.message
        });
    }
};

module.exports = exports;
