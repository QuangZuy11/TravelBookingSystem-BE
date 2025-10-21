/**
 * File Upload Routes
 * Routes for uploading files to Google Drive
 */

const express = require('express');
const router = express.Router();
const fileUploadController = require('../controllers/fileUpload.controller');
const uploadMiddleware = require('../middlewares/upload.middleware');
const authMiddleware = require('../middlewares/auth.middleware');

// Apply auth middleware to all upload routes (optional - có thể bỏ comment nếu muốn require auth)
// router.use(authMiddleware);

/**
 * HOTEL IMAGES
 * POST /api/upload/hotel/:hotelId/images
 * Upload multiple hotel images
 */
router.post(
    '/hotel/:hotelId/images',
    authMiddleware, // Re-enabled after testing
    uploadMiddleware.uploadMultipleImages,
    uploadMiddleware.handleMulterError,
    fileUploadController.uploadHotelImages
);

/**
 * ROOM IMAGES
 * POST /api/upload/room/:roomId/images
 * Upload multiple room images
 */
router.post(
    '/room/:roomId/images',
    authMiddleware,
    uploadMiddleware.uploadMultipleImages,
    uploadMiddleware.handleMulterError,
    fileUploadController.uploadRoomImages
);

/**
 * TOUR IMAGE (SINGLE)
 * POST /api/upload/tour/:tourId/image
 * Upload tour main image (only 1 image)
 */
router.post(
    '/tour/:tourId/image',
    authMiddleware,
    uploadMiddleware.uploadSingleImage,
    uploadMiddleware.handleMulterError,
    fileUploadController.uploadTourImage
);

/**
 * REVIEW IMAGES
 * POST /api/upload/review/:reviewId/images
 * Upload review images from travelers
 */
router.post(
    '/review/:reviewId/images',
    authMiddleware,
    uploadMiddleware.uploadMultipleImages,
    uploadMiddleware.handleMulterError,
    fileUploadController.uploadReviewImages
);

/**
 * LICENSE DOCUMENTS
 * POST /api/upload/service-provider/license/:licenseId/documents
 * Upload service provider license documents
 */
router.post(
    '/service-provider/license/:licenseId/documents',
    authMiddleware,
    uploadMiddleware.uploadMultipleDocuments,
    uploadMiddleware.handleMulterError,
    fileUploadController.uploadLicenseDocuments
);

/**
 * ACTIVITY IMAGES
 * POST /api/upload/itinerary-activity/:activityId/images
 * Upload itinerary activity images
 */
router.post(
    '/itinerary-activity/:activityId/images',
    authMiddleware,
    uploadMiddleware.uploadMultipleImages,
    uploadMiddleware.handleMulterError,
    fileUploadController.uploadActivityImages
);

/**
 * DESTINATION IMAGES
 * POST /api/upload/destination/:destinationId/images
 * Upload destination images (admin only)
 */
router.post(
    '/destination/:destinationId/images',
    authMiddleware,
    // TODO: Add admin middleware
    uploadMiddleware.uploadMultipleImages,
    uploadMiddleware.handleMulterError,
    fileUploadController.uploadDestinationImages
);

/**
 * POI IMAGES
 * POST /api/upload/poi/:poiId/images
 * Upload point of interest images (admin only)
 */
router.post(
    '/poi/:poiId/images',
    authMiddleware,
    // TODO: Add admin middleware
    uploadMiddleware.uploadMultipleImages,
    uploadMiddleware.handleMulterError,
    fileUploadController.uploadPOIImages
);

module.exports = router;
