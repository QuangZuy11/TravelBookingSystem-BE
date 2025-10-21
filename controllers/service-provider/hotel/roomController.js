const Room = require('../../../models/room.model');
const Hotel = require('../../../models/hotel.model');
const googleDriveService = require('../../../services/googleDrive.service');

// Get all rooms of a hotel
exports.getHotelRooms = async (req, res) => {
    try {
        const hotel = await Hotel.findOne({
            _id: req.params.hotelId,
            providerId: req.params.providerId
        });

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        const rooms = await Room.find({ hotelId: req.params.hotelId });
        res.status(200).json({
            success: true,
            count: rooms.length,
            data: rooms
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get room by ID
exports.getRoomById = async (req, res) => {
    try {
        const hotel = await Hotel.findOne({
            _id: req.params.hotelId,
            providerId: req.params.providerId
        });

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        const room = await Room.findOne({
            _id: req.params.roomId,
            hotelId: req.params.hotelId
        });

        if (!room) {
            return res.status(404).json({
                success: false,
                error: 'Room not found'
            });
        }

        res.status(200).json({
            success: true,
            data: room
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Create new room
exports.createRoom = async (req, res) => {
    console.log('📝 Creating room with body:', req.body);
    console.log('📁 Files received:', req.files ? req.files.length : 0);

    let createdRoom = null;

    try {
        const hotel = await Hotel.findOne({
            _id: req.params.hotelId,
            providerId: req.params.providerId
        });

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        // Parse room data if sent as multipart/form-data
        let roomData;
        if (req.body.roomData) {
            roomData = JSON.parse(req.body.roomData);
        } else {
            roomData = req.body;

            // Parse JSON strings in roomData for array/object fields
            const fieldsToParseAsJSON = ['amenities', 'images', 'bookings', 'maintenanceHistory'];

            fieldsToParseAsJSON.forEach(field => {
                if (roomData[field] && typeof roomData[field] === 'string') {
                    try {
                        roomData[field] = JSON.parse(roomData[field]);
                        console.log(`✅ Parsed ${field} from string to object/array`);
                    } catch (e) {
                        console.log(`⚠️ Could not parse ${field}, keeping as string`);
                    }
                }
            });
        }

        // 1. Create room WITHOUT images first
        createdRoom = await Room.create({
            ...roomData,
            hotelId: req.params.hotelId,
            images: [] // Will be updated after upload
        });

        console.log('✅ Room created:', createdRoom._id);

        // 2. Upload images to Google Drive if provided
        if (req.files && req.files.length > 0) {
            console.log(`📤 Uploading ${req.files.length} images to Drive...`);

            const uploadedFiles = await googleDriveService.uploadFiles(
                req.files,
                `rooms/${createdRoom._id}`
            );

            const imageUrls = uploadedFiles.map(f => f.direct_url);

            // 3. Update room with image URLs
            createdRoom.images = imageUrls;
            await createdRoom.save();

            console.log(`✅ Uploaded ${imageUrls.length} images successfully`);
        }

        res.status(201).json({
            success: true,
            message: req.files && req.files.length > 0
                ? `Room created with ${req.files.length} images`
                : 'Room created successfully',
            data: createdRoom
        });
    } catch (error) {
        console.error('❌ Error creating room:', error);

        // Rollback: delete room if it was created but upload failed
        if (createdRoom) {
            try {
                await Room.findByIdAndDelete(createdRoom._id);
                console.log('🔄 Rolled back room creation');
            } catch (rollbackError) {
                console.error('❌ Rollback failed:', rollbackError);
            }
        }

        res.status(400).json({
            success: false,
            error: error.message,
            details: error.errors ? Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            })) : undefined
        });
    }
};

// Update room
exports.updateRoom = async (req, res) => {
    console.log('\n🏨 === UPDATE ROOM CONTROLLER ===');
    console.log('Room ID:', req.params.roomId);
    console.log('Hotel ID:', req.params.hotelId);
    console.log('Files received:', req.files ? req.files.length : 0);
    console.log('Body fields:', req.body ? Object.keys(req.body).join(', ') : 'EMPTY');

    try {
        // Initialize req.body if undefined/null
        if (!req.body) {
            req.body = {};
        }

        // Parse JSON strings in req.body for array/object fields
        const fieldsToParseAsJSON = ['amenities', 'images', 'bookings', 'maintenanceHistory', 'existing_images'];

        fieldsToParseAsJSON.forEach(field => {
            if (req.body[field] && typeof req.body[field] === 'string') {
                try {
                    req.body[field] = JSON.parse(req.body[field]);
                    console.log(`✅ Parsed ${field} from string to object/array`);
                } catch (e) {
                    console.log(`⚠️ Could not parse ${field}, keeping as string`);
                }
            }
        });

        console.log('📋 Existing images from frontend:', req.body.existing_images);
        console.log('📤 New files to upload:', req.files ? req.files.length : 0);

        // Verify hotel ownership
        const hotel = await Hotel.findOne({
            _id: req.params.hotelId,
            providerId: req.params.providerId
        });

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        // Find existing room
        const existingRoom = await Room.findOne({
            _id: req.params.roomId,
            hotelId: req.params.hotelId
        });

        if (!existingRoom) {
            console.log('❌ Room not found');
            return res.status(404).json({
                success: false,
                error: 'Room not found'
            });
        }

        // Handle image uploads to Google Drive
        let finalImageUrls = [];

        // 1. Get existing images from frontend (images user wants to keep)
        const existingImages = req.body.existing_images || [];
        console.log(`📸 Keeping ${existingImages.length} existing images`);

        // 2. Upload new images if provided
        if (req.files && req.files.length > 0) {
            console.log(`📤 Uploading ${req.files.length} new images to Drive...`);

            const uploadedFiles = await googleDriveService.uploadFiles(
                req.files,
                `rooms/${req.params.roomId}`
            );

            const newImageUrls = uploadedFiles.map(f => f.direct_url);
            console.log(`✅ Uploaded ${newImageUrls.length} images successfully`);

            // 3. Combine: existing images + new uploaded images
            finalImageUrls = [...existingImages, ...newImageUrls];
        } else {
            // No new files, just use existing images
            finalImageUrls = existingImages;
        }

        // 4. Set final images array
        req.body.images = finalImageUrls;
        console.log(`🖼️ Total images: ${finalImageUrls.length}`);

        // 5. Remove temporary field
        delete req.body.existing_images;

        // Update room in database
        console.log('💾 Updating room in database...');
        const room = await Room.findOneAndUpdate(
            { _id: req.params.roomId, hotelId: req.params.hotelId },
            req.body,
            { new: true, runValidators: true }
        );

        console.log('✅ Room updated successfully');
        console.log(`📸 Final image count: ${room.images ? room.images.length : 0}`);
        console.log('🏨 === UPDATE ROOM COMPLETE ===\n');

        res.status(200).json({
            success: true,
            message: req.files && req.files.length > 0
                ? `Room updated with ${req.files.length} new images (${room.images.length} total)`
                : `Room updated successfully (${room.images.length} images)`,
            data: room
        });
    } catch (error) {
        console.error('❌ === ERROR IN UPDATE ROOM ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Delete room
exports.deleteRoom = async (req, res) => {
    try {
        const hotel = await Hotel.findOne({
            _id: req.params.hotelId,
            providerId: req.params.providerId
        });

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        const room = await Room.findOneAndDelete({
            _id: req.params.roomId,
            hotelId: req.params.hotelId
        });

        if (!room) {
            return res.status(404).json({
                success: false,
                error: 'Room not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get room bookings
exports.getRoomBookings = async (req, res) => {
    try {
        const hotel = await Hotel.findOne({
            _id: req.params.hotelId,
            providerId: req.params.providerId
        });

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        const room = await Room.findOne({
            _id: req.params.roomId,
            hotelId: req.params.hotelId
        });

        if (!room) {
            return res.status(404).json({
                success: false,
                error: 'Room not found'
            });
        }

        res.status(200).json({
            success: true,
            count: room.bookings.length,
            data: room.bookings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Update room status
exports.updateRoomStatus = async (req, res) => {
    try {
        const hotel = await Hotel.findOne({
            _id: req.params.hotelId,
            providerId: req.params.providerId
        });

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        const room = await Room.findOneAndUpdate(
            { _id: req.params.roomId, hotelId: req.params.hotelId },
            { status: req.body.status },
            { new: true, runValidators: true }
        );

        if (!room) {
            return res.status(404).json({
                success: false,
                error: 'Room not found'
            });
        }

        res.status(200).json({
            success: true,
            data: room
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Add maintenance record
exports.addMaintenanceRecord = async (req, res) => {
    try {
        const hotel = await Hotel.findOne({
            _id: req.params.hotelId,
            providerId: req.params.providerId
        });

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        const room = await Room.findOneAndUpdate(
            { _id: req.params.roomId, hotelId: req.params.hotelId },
            {
                $push: {
                    maintenanceHistory: {
                        date: new Date(),
                        description: req.body.description,
                        cost: req.body.cost
                    }
                }
            },
            { new: true, runValidators: true }
        );

        if (!room) {
            return res.status(404).json({
                success: false,
                error: 'Room not found'
            });
        }

        res.status(200).json({
            success: true,
            data: room
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};