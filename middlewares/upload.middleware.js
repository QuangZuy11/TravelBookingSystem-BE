/**
 * Upload Middleware
 * Multer configuration for file uploads
 */

const multer = require('multer');

// Memory storage (không lưu vào disk)
const storage = multer.memoryStorage();

// File filter - chỉ cho phép images và documents
const fileFilter = (req, file, cb) => {
    console.log('📁 File received in middleware:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size ? `${(file.size / 1024).toFixed(2)} KB` : 'unknown'
    });

    // Allowed MIME types
    const allowedImageTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif'
    ];

    const allowedDocTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const allowedTypes = [...allowedImageTypes, ...allowedDocTypes];

    if (allowedTypes.includes(file.mimetype)) {
        console.log('✅ File type accepted:', file.mimetype);
        cb(null, true);
    } else {
        console.log('❌ File type rejected:', file.mimetype);
        cb(new Error(`File type not allowed: ${file.mimetype}. Allowed: images (jpg, png, webp, gif) and documents (pdf, doc, docx)`), false);
    }
};

// Multer config
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB max file size
        files: 10 // Max 10 files per request
    }
});

// Export different upload configurations

/**
 * Upload single image
 */
exports.uploadSingleImage = (req, res, next) => {
    console.log('🔧 uploadSingleImage middleware called');
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.log('❌ uploadSingleImage error:', err.message);
            return next(err);
        }
        console.log('✅ uploadSingleImage completed:', req.file ? `1 file (${req.file.originalname})` : 'No file');
        next();
    });
};

/**
 * Upload multiple images (max 10)
 */
exports.uploadMultipleImages = (req, res, next) => {
    console.log('🔧 uploadMultipleImages middleware called');
    upload.array('images', 10)(req, res, (err) => {
        if (err) {
            console.log('❌ uploadMultipleImages error:', err.message);
            return next(err);
        }
        console.log('✅ uploadMultipleImages completed:', req.files ? `${req.files.length} files` : 'No files');
        if (req.files && req.files.length > 0) {
            req.files.forEach((file, index) => {
                console.log(`   ${index + 1}. ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);
            });
        }
        next();
    });
};

/**
 * Upload single document
 */
exports.uploadSingleDocument = (req, res, next) => {
    console.log('🔧 uploadSingleDocument middleware called');
    upload.single('document')(req, res, (err) => {
        if (err) {
            console.log('❌ uploadSingleDocument error:', err.message);
            return next(err);
        }
        console.log('✅ uploadSingleDocument completed:', req.file ? `1 file (${req.file.originalname})` : 'No file');
        next();
    });
};

/**
 * Upload multiple documents (max 5)
 */
exports.uploadMultipleDocuments = (req, res, next) => {
    console.log('🔧 uploadMultipleDocuments middleware called');
    upload.array('documents', 5)(req, res, (err) => {
        if (err) {
            console.log('❌ uploadMultipleDocuments error:', err.message);
            return next(err);
        }
        console.log('✅ uploadMultipleDocuments completed:', req.files ? `${req.files.length} files` : 'No files');
        next();
    });
};

/**
 * Upload mixed files (images + documents)
 */
exports.uploadMixedFiles = (req, res, next) => {
    console.log('🔧 uploadMixedFiles middleware called');
    upload.fields([
        { name: 'images', maxCount: 10 },
        { name: 'documents', maxCount: 5 }
    ])(req, res, (err) => {
        if (err) {
            console.log('❌ uploadMixedFiles error:', err.message);
            return next(err);
        }
        console.log('✅ uploadMixedFiles completed');
        if (req.files) {
            if (req.files.images) {
                console.log(`   Images: ${req.files.images.length} files`);
            }
            if (req.files.documents) {
                console.log(`   Documents: ${req.files.documents.length} files`);
            }
        }
        next();
    });
};

/**
 * Error handling middleware for multer errors
 */
exports.handleMulterError = (err, req, res, next) => {
    console.log('🚨 Multer error handler triggered:', err.message);

    if (err instanceof multer.MulterError) {
        console.log('   Error type: MulterError');
        console.log('   Error code:', err.code);

        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File quá lớn. Giới hạn 10MB mỗi file.',
                error: 'File size limit exceeded'
            });
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Quá nhiều file. Tối đa 10 files.',
                error: 'Too many files'
            });
        }

        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: 'Field name không hợp lệ.',
                error: 'Unexpected field'
            });
        }

        return res.status(400).json({
            success: false,
            message: 'Lỗi upload file',
            error: err.message
        });
    }

    // Other errors (file type, etc.)
    if (err.message) {
        console.log('   Error type: Custom validation error');
        return res.status(400).json({
            success: false,
            message: err.message,
            error: 'Upload validation failed'
        });
    }

    console.log('   Error type: Unknown error');
    next(err);
};
