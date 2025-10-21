/**
 * File Upload Controller
 * Handle file uploads to Google Drive and update database
 */

const googleDriveService = require('../services/googleDrive.service');
const Hotel = require('../models/hotel.model');
const Room = require('../models/room.model');
const Tour = require('../models/tour.model');
const Review = require('../models/review.model');
const ServiceProvider = require('../models/service-provider.model');
const ItineraryActivity = require('../models/itinerary-activity.model');
const Destination = require('../models/destination.model');
const PointOfInterest = require('../models/point-of-interest.model');

/**
 * @route   POST /api/upload/hotel/:hotelId/images
 * @desc    Upload hotel images to Google Drive
 * @access  Private (Provider)
 */
exports.uploadHotelImages = async (req, res) => {
    console.log('\n🏨 === UPLOAD HOTEL IMAGES CONTROLLER ===');
    console.log('Hotel ID:', req.params.hotelId);
    console.log('Files received:', req.files ? req.files.length : 0);

    try {
        const { hotelId } = req.params;
        const files = req.files;

        if (!files || files.length === 0) {
            console.log('❌ No files provided');
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn ít nhất 1 file để upload',
                error: 'No files provided'
            });
        }

        console.log('📋 Files details:');
        files.forEach((file, i) => {
            console.log(`   ${i + 1}. ${file.originalname} (${(file.size / 1024).toFixed(2)} KB, ${file.mimetype})`);
        });

        // Check hotel exists
        console.log('🔍 Checking if hotel exists...');
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) {
            console.log('❌ Hotel not found');
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách sạn',
                error: 'Hotel not found'
            });
        }
        console.log('✅ Hotel found:', hotel.name);

        // Upload to Google Drive
        console.log('☁️ Starting Google Drive upload...');
        const uploadedFiles = await googleDriveService.uploadFiles(files, `hotels/${hotelId}`);

        // Update hotel images in database
        console.log('💾 Updating hotel database...');
        const imageUrls = uploadedFiles.map(f => f.direct_url);
        hotel.images = [...hotel.images, ...imageUrls]; // Append new images
        await hotel.save();

        console.log(`✅ SUCCESS: Uploaded ${uploadedFiles.length} images for hotel ${hotelId}`);
        console.log(`   Total hotel images now: ${hotel.images.length}`);
        console.log('🏨 === UPLOAD HOTEL IMAGES COMPLETE ===\n');

        res.status(200).json({
            success: true,
            message: `Upload thành công ${uploadedFiles.length} hình ảnh`,
            data: {
                hotel_id: hotelId,
                uploaded_files: uploadedFiles,
                total_images: hotel.images.length
            }
        });

    } catch (error) {
        console.error('❌ === ERROR IN UPLOAD HOTEL IMAGES ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi upload hình ảnh',
            error: error.message
        });
    }
};

/**
 * @route   POST /api/upload/room/:roomId/images
 * @desc    Upload room images to Google Drive
 * @access  Private (Provider)
 */
exports.uploadRoomImages = async (req, res) => {
    try {
        const { roomId } = req.params;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn ít nhất 1 file để upload'
            });
        }

        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phòng'
            });
        }

        const uploadedFiles = await googleDriveService.uploadFiles(files, `rooms/${roomId}`);
        const imageUrls = uploadedFiles.map(f => f.direct_url);

        room.images = [...room.images, ...imageUrls];
        await room.save();

        res.status(200).json({
            success: true,
            message: `Upload thành công ${uploadedFiles.length} hình ảnh`,
            data: {
                room_id: roomId,
                uploaded_files: uploadedFiles,
                total_images: room.images.length
            }
        });

    } catch (error) {
        console.error('❌ Error uploading room images:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi upload hình ảnh',
            error: error.message
        });
    }
};

/**
 * @route   POST /api/upload/tour/:tourId/image
 * @desc    Upload tour main image to Google Drive (SINGLE IMAGE ONLY)
 * @access  Private (Provider)
 */
exports.uploadTourImage = async (req, res) => {
    try {
        const { tourId } = req.params;
        const file = req.file; // Single file

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn 1 file để upload'
            });
        }

        const tour = await Tour.findById(tourId);
        if (!tour) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tour'
            });
        }

        // Upload to Google Drive
        const uploadedFile = await googleDriveService.uploadFile(file, `tours/${tourId}`);

        // Update tour image (replace old image)
        tour.image = uploadedFile.direct_url;
        await tour.save();

        res.status(200).json({
            success: true,
            message: 'Upload hình ảnh tour thành công',
            data: {
                tour_id: tourId,
                uploaded_file: uploadedFile
            }
        });

    } catch (error) {
        console.error('❌ Error uploading tour image:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi upload hình ảnh',
            error: error.message
        });
    }
};

/**
 * @route   POST /api/upload/review/:reviewId/images
 * @desc    Upload review images to Google Drive
 * @access  Private (Traveler)
 */
exports.uploadReviewImages = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn ít nhất 1 file để upload'
            });
        }

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đánh giá'
            });
        }

        const uploadedFiles = await googleDriveService.uploadFiles(files, `reviews/${reviewId}`);
        const imageUrls = uploadedFiles.map(f => f.direct_url);

        review.images = [...review.images, ...imageUrls];
        await review.save();

        res.status(200).json({
            success: true,
            message: `Upload thành công ${uploadedFiles.length} hình ảnh`,
            data: {
                review_id: reviewId,
                uploaded_files: uploadedFiles
            }
        });

    } catch (error) {
        console.error('❌ Error uploading review images:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi upload hình ảnh',
            error: error.message
        });
    }
};

/**
 * @route   POST /api/upload/service-provider/license/:licenseId/documents
 * @desc    Upload license documents to Google Drive
 * @access  Private (Provider)
 */
exports.uploadLicenseDocuments = async (req, res) => {
    try {
        const { licenseId } = req.params;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn ít nhất 1 file để upload'
            });
        }

        // Find provider by license ID
        const provider = await ServiceProvider.findOne({ 'licenses._id': licenseId });
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy license'
            });
        }

        const license = provider.licenses.id(licenseId);
        if (!license) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy license'
            });
        }

        const uploadedFiles = await googleDriveService.uploadFiles(files, `licenses/${licenseId}`);
        const docUrls = uploadedFiles.map(f => f.direct_url);

        license.documents = [...license.documents, ...docUrls];
        await provider.save();

        res.status(200).json({
            success: true,
            message: `Upload thành công ${uploadedFiles.length} tài liệu`,
            data: {
                license_id: licenseId,
                uploaded_files: uploadedFiles
            }
        });

    } catch (error) {
        console.error('❌ Error uploading license documents:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi upload tài liệu',
            error: error.message
        });
    }
};

/**
 * @route   POST /api/upload/itinerary-activity/:activityId/images
 * @desc    Upload activity images to Google Drive
 * @access  Private (Provider)
 */
exports.uploadActivityImages = async (req, res) => {
    try {
        const { activityId } = req.params;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn ít nhất 1 file để upload'
            });
        }

        const activity = await ItineraryActivity.findById(activityId);
        if (!activity) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hoạt động'
            });
        }

        const uploadedFiles = await googleDriveService.uploadFiles(files, `activities/${activityId}`);
        const imageUrls = uploadedFiles.map(f => f.direct_url);

        activity.images = [...activity.images, ...imageUrls];
        await activity.save();

        res.status(200).json({
            success: true,
            message: `Upload thành công ${uploadedFiles.length} hình ảnh`,
            data: {
                activity_id: activityId,
                uploaded_files: uploadedFiles
            }
        });

    } catch (error) {
        console.error('❌ Error uploading activity images:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi upload hình ảnh',
            error: error.message
        });
    }
};

/**
 * @route   POST /api/upload/destination/:destinationId/images
 * @desc    Upload destination images to Google Drive
 * @access  Private (Admin)
 */
exports.uploadDestinationImages = async (req, res) => {
    try {
        const { destinationId } = req.params;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn ít nhất 1 file để upload'
            });
        }

        const destination = await Destination.findById(destinationId);
        if (!destination) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy điểm đến'
            });
        }

        const uploadedFiles = await googleDriveService.uploadFiles(files, `destinations/${destinationId}`);
        const imageUrls = uploadedFiles.map(f => f.direct_url);

        destination.images = [...destination.images, ...imageUrls];
        await destination.save();

        res.status(200).json({
            success: true,
            message: `Upload thành công ${uploadedFiles.length} hình ảnh`,
            data: {
                destination_id: destinationId,
                uploaded_files: uploadedFiles
            }
        });

    } catch (error) {
        console.error('❌ Error uploading destination images:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi upload hình ảnh',
            error: error.message
        });
    }
};

/**
 * @route   POST /api/upload/poi/:poiId/images
 * @desc    Upload POI images to Google Drive
 * @access  Private (Admin)
 */
exports.uploadPOIImages = async (req, res) => {
    try {
        const { poiId } = req.params;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn ít nhất 1 file để upload'
            });
        }

        const poi = await PointOfInterest.findById(poiId);
        if (!poi) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy điểm tham quan'
            });
        }

        const uploadedFiles = await googleDriveService.uploadFiles(files, `pois/${poiId}`);
        const imageUrls = uploadedFiles.map(f => f.direct_url);

        poi.images = [...poi.images, ...imageUrls];
        await poi.save();

        res.status(200).json({
            success: true,
            message: `Upload thành công ${uploadedFiles.length} hình ảnh`,
            data: {
                poi_id: poiId,
                uploaded_files: uploadedFiles
            }
        });

    } catch (error) {
        console.error('❌ Error uploading POI images:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi upload hình ảnh',
            error: error.message
        });
    }
};

module.exports = exports;
