const Room = require('../../../models/room.model');
const Hotel = require('../../../models/hotel.model');
const HotelBooking = require('../../../models/hotel-booking.model');
const googleDriveService = require('../../../services/googleDrive.service');
const { createBookingCancellationNotification } = require('../../../services/notification.service');

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

exports.createRoomsBulk = async (req, res) => {
    let createdRooms = [];
    let uploadedImageUrls = [];

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
        let roomsData;
        if (req.body.roomsData) {
            roomsData = JSON.parse(req.body.roomsData);
        } else {
            roomsData = req.body.rooms || [];
        }

        if (!roomsData || !Array.isArray(roomsData) || roomsData.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Rooms array is required and cannot be empty'
            });
        }

        // Parse JSON strings in each room data for array/object fields
        const fieldsToParseAsJSON = ['amenities', 'images', 'bookings'];

        roomsData = roomsData.map(roomData => {
            const parsedRoom = { ...roomData };

            fieldsToParseAsJSON.forEach(field => {
                if (parsedRoom[field] && typeof parsedRoom[field] === 'string') {
                    try {
                        parsedRoom[field] = JSON.parse(parsedRoom[field]);
                    } catch (e) {
                        console.warn(`Failed to parse ${field} for room ${parsedRoom.roomNumber}:`, e.message);
                        // Keep as empty array if parse fails for array fields
                        if (['amenities', 'images', 'bookings'].includes(field)) {
                            parsedRoom[field] = [];
                        }
                    }
                }
                // Ensure array fields are always arrays
                if (['amenities', 'images', 'bookings'].includes(field) && !Array.isArray(parsedRoom[field])) {
                    parsedRoom[field] = [];
                }
            });

            return parsedRoom;
        });

        // 1. Upload shared images to Google Drive if provided
        if (req.files && req.files.length > 0) {
            console.log(`📸 Uploading ${req.files.length} shared images for ${roomsData.length} rooms`);

            const uploadedFiles = await googleDriveService.uploadFiles(
                req.files,
                `hotels/${req.params.hotelId}/rooms/shared`
            );

            uploadedImageUrls = uploadedFiles.map(f => f.direct_url);
            console.log(`✅ Uploaded shared images:`, uploadedImageUrls);
        }

        // 2. Validate all rooms before creating any
        for (let i = 0; i < roomsData.length; i++) {
            const roomData = roomsData[i];
            if (!roomData.roomNumber) {
                return res.status(400).json({
                    success: false,
                    error: `Room at index ${i} is missing roomNumber`
                });
            }

            // Check if room number already exists in this hotel
            const existingRoom = await Room.findOne({
                hotelId: req.params.hotelId,
                roomNumber: roomData.roomNumber
            });

            if (existingRoom) {
                return res.status(400).json({
                    success: false,
                    error: `Room number ${roomData.roomNumber} already exists in this hotel`
                });
            }
        }

        // 3. Create all rooms with shared images
        for (const roomData of roomsData) {
            // Combine uploaded shared images with any specific room images
            const roomImages = [
                ...uploadedImageUrls, // Shared images for all rooms
                ...(roomData.images || []) // Specific images for this room (if any)
            ];

            const newRoom = await Room.create({
                ...roomData,
                hotelId: req.params.hotelId,
                images: roomImages
            });
            createdRooms.push(newRoom);
        }

        res.status(201).json({
            success: true,
            message: req.files && req.files.length > 0
                ? `Successfully created ${createdRooms.length} rooms with ${uploadedImageUrls.length} shared images`
                : `Successfully created ${createdRooms.length} rooms`,
            count: createdRooms.length,
            sharedImagesCount: uploadedImageUrls.length,
            data: createdRooms
        });

    } catch (error) {
        console.error('❌ Error creating rooms in bulk:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        // Rollback: delete any rooms that were created
        if (createdRooms.length > 0) {
            try {
                const roomIds = createdRooms.map(room => room._id);
                await Room.deleteMany({ _id: { $in: roomIds } });
                console.log(`🔄 Rolled back ${createdRooms.length} rooms due to error`);
            } catch (rollbackError) {
                console.error('❌ Rollback failed:', rollbackError);
            }
        }

        // Enhanced error response
        let errorResponse = {
            success: false,
            error: error.message
        };

        // Handle Mongoose validation errors
        if (error.name === 'ValidationError' && error.errors) {
            errorResponse.details = Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message,
                value: error.errors[key].value
            }));
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            errorResponse.error = 'Duplicate room number detected';
            errorResponse.details = [{ field: 'roomNumber', message: 'Room number already exists' }];
        }

        res.status(400).json(errorResponse);
    }
};

// Create new room
exports.createRoom = async (req, res) => {

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
            const fieldsToParseAsJSON = ['amenities', 'images', 'bookings'];

            fieldsToParseAsJSON.forEach(field => {
                if (roomData[field] && typeof roomData[field] === 'string') {
                    try {
                        roomData[field] = JSON.parse(roomData[field]);
                    } catch (e) {
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


        // 2. Upload images to Google Drive if provided
        if (req.files && req.files.length > 0) {

            const uploadedFiles = await googleDriveService.uploadFiles(
                req.files,
                `rooms/${createdRoom._id}`
            );

            const imageUrls = uploadedFiles.map(f => f.direct_url);

            // 3. Update room with image URLs
            createdRoom.images = imageUrls;
            await createdRoom.save();

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

    try {
        // Initialize req.body if undefined/null
        if (!req.body) {
            req.body = {};
        }

        // Parse JSON strings in req.body for array/object fields
        const fieldsToParseAsJSON = ['amenities', 'images', 'bookings', 'existing_images'];

        fieldsToParseAsJSON.forEach(field => {
            if (req.body[field] && typeof req.body[field] === 'string') {
                try {
                    req.body[field] = JSON.parse(req.body[field]);
                } catch (e) {
                }
            }
        });


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
            return res.status(404).json({
                success: false,
                error: 'Room not found'
            });
        }

        // Handle image uploads to Google Drive
        let finalImageUrls = [];

        // 1. Get existing images from frontend (images user wants to keep)
        const existingImages = req.body.existing_images || [];

        // 2. Upload new images if provided
        if (req.files && req.files.length > 0) {

            const uploadedFiles = await googleDriveService.uploadFiles(
                req.files,
                `rooms/${req.params.roomId}`
            );

            const newImageUrls = uploadedFiles.map(f => f.direct_url);

            // 3. Combine: existing images + new uploaded images
            finalImageUrls = [...existingImages, ...newImageUrls];
        } else {
            // No new files, just use existing images
            finalImageUrls = existingImages;
        }

        // 4. Set final images array
        req.body.images = finalImageUrls;

        // 5. Remove temporary field
        delete req.body.existing_images;

        // Update room in database
        const room = await Room.findOneAndUpdate(
            { _id: req.params.roomId, hotelId: req.params.hotelId },
            req.body,
            { new: true, runValidators: true }
        );


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

// Get bookings by date for a hotel (simplified approach)
exports.getBookingsByDate = async (req, res) => {
    try {
        const { hotelId, providerId } = req.params;
        const { date } = req.query; // Format: YYYY-MM-DD

        console.log('📅 Getting bookings by date:', { hotelId, providerId, date });

        // Validate hotel
        let hotel;
        try {
            hotel = await Hotel.findOne({
                _id: hotelId,
                providerId: providerId
            });
        } catch (hotelError) {
            console.error('Error finding hotel:', hotelError);
            return res.status(400).json({
                success: false,
                error: 'Invalid hotel ID',
                message: hotelError.message
            });
        }

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        // Parse date or use today
        let targetDate;
        try {
            targetDate = date ? new Date(date) : new Date();
            if (isNaN(targetDate.getTime())) {
                throw new Error('Invalid date format');
            }
            // Set về 00:00:00 để so sánh chính xác
            targetDate.setHours(0, 0, 0, 0);
        } catch (dateError) {
            console.error('Error parsing date:', dateError);
            return res.status(400).json({
                success: false,
                error: 'Invalid date format',
                message: dateError.message
            });
        }

        // Tính nextDay (ngày tiếp theo, 00:00:00)
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);

        console.log(`📅 Filtering bookings for date: ${targetDate.toISOString().split('T')[0]} (range: ${targetDate.toISOString()} to ${nextDay.toISOString()})`);

        // Get all room IDs for this hotel
        let rooms = [];
        let roomIds = [];
        try {
            rooms = await Room.find({ hotelId: hotelId }).select('_id').lean();
            roomIds = rooms.map(r => r._id);
            console.log('Found rooms:', roomIds.length);
        } catch (roomError) {
            console.error('Error finding rooms:', roomError);
            return res.status(500).json({
                success: false,
                error: 'Error finding rooms',
                message: roomError.message
            });
        }

        if (roomIds.length === 0) {
            return res.status(200).json({
                success: true,
                date: targetDate.toISOString().split('T')[0],
                data: [],
                rooms: []
            });
        }

        // Get bookings for the target date
        // Logic: Chỉ lấy booking có check-in trong ngày targetDate
        // - check_in_date >= targetDate AND check_in_date < nextDay (check-in trong ngày đang xem)
        // Ví dụ: check-in 16/11, check-out 17/11
        // - Ngày 16/11: phòng đã đặt (check_in >= 16/11 && check_in < 17/11) ✓
        // - Ngày 17/11: phòng trống (check_in KHÔNG >= 17/11 hoặc check_in >= 18/11) ✓
        let bookings = [];
        try {
            bookings = await HotelBooking.find({
                hotel_room_id: { $in: roomIds },
                booking_status: { $in: ['reserved', 'confirmed', 'in_use'] },
                check_in_date: { $gte: targetDate, $lt: nextDay }
            })
                .populate({
                    path: 'user_id',
                    select: 'name email phone',
                    strictPopulate: false
                })
                .populate({
                    path: 'hotel_room_id',
                    select: 'roomNumber type floor capacity pricePerNight',
                    strictPopulate: false
                })
                .sort({ check_in_date: 1 })
                .lean();
            console.log(`Found ${bookings.length} bookings for date ${targetDate.toISOString().split('T')[0]}`);
            // Log một vài booking để debug
            if (bookings.length > 0) {
                bookings.slice(0, 3).forEach(b => {
                    console.log(`  - Booking: check_in=${b.check_in_date?.toISOString()?.split('T')[0]}, check_out=${b.check_out_date?.toISOString()?.split('T')[0]}, room=${b.hotel_room_id?.roomNumber || b.hotel_room_id}`);
                });
            }
        } catch (bookingError) {
            console.error('Error finding bookings:', bookingError);
            // If populate fails, try without populate
            try {
                bookings = await HotelBooking.find({
                    hotel_room_id: { $in: roomIds },
                    booking_status: { $in: ['reserved', 'confirmed', 'in_use'] },
                    check_in_date: { $gte: targetDate, $lt: nextDay }
                })
                    .sort({ check_in_date: 1 })
                    .lean();
                console.log('Found bookings (without populate):', bookings.length);
            } catch (retryError) {
                console.error('Error finding bookings (retry):', retryError);
                return res.status(500).json({
                    success: false,
                    error: 'Error finding bookings',
                    message: retryError.message
                });
            }
        }

        // Get all rooms with details
        let allRooms = [];
        try {
            allRooms = await Room.find({ hotelId: hotelId })
                .select('_id roomNumber type floor capacity pricePerNight status')
                .sort({ roomNumber: 1 })
                .lean();
            console.log('Found all rooms:', allRooms.length);
        } catch (roomsError) {
            console.error('Error finding all rooms:', roomsError);
            return res.status(500).json({
                success: false,
                error: 'Error finding all rooms',
                message: roomsError.message
            });
        }

        res.status(200).json({
            success: true,
            date: targetDate.toISOString().split('T')[0],
            data: bookings,
            rooms: allRooms
        });
    } catch (error) {
        console.error('Error getting bookings by date:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

// Release room to available (from booking - "Không đến" action)
exports.releaseRoomFromBooking = async (req, res) => {
    try {
        const { providerId, hotelId, bookingId } = req.params;

        // Validate hotel belongs to provider
        const hotel = await Hotel.findOne({
            _id: hotelId,
            providerId: providerId
        });

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        // Find booking to get room ID (populate để lấy user_id cho notification)
        const booking = await HotelBooking.findById(bookingId)
            .populate({
                path: 'user_id',
                select: '_id',
                strictPopulate: false
            });

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Get room ID from booking
        const roomId = booking.hotel_room_id?._id || booking.hotel_room_id;

        if (!roomId) {
            return res.status(400).json({
                success: false,
                error: 'Booking does not have a room assigned'
            });
        }

        // Update room status to available
        const room = await Room.findOneAndUpdate(
            { _id: roomId, hotelId: hotelId },
            { status: 'available', updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!room) {
            return res.status(404).json({
                success: false,
                error: 'Room not found or does not belong to this hotel'
            });
        }

        // Update booking status to cancelled
        booking.booking_status = 'cancelled';
        booking.cancelled_at = new Date();
        await booking.save({ validateBeforeSave: false });
        
        console.log(`✅ Booking ${bookingId} cancelled. Status: ${booking.booking_status}`);

        // Verify booking was saved correctly
        const verifyBooking = await HotelBooking.findById(bookingId);
        if (verifyBooking.booking_status !== 'cancelled') {
            console.error('❌ Booking status was not updated correctly!');
            return res.status(500).json({
                success: false,
                error: 'Failed to update booking status'
            });
        }

        // Get hotel name for notification
        const hotelName = hotel.name || 'N/A';
        const bookingNumber = `HB-${booking._id.toString().slice(-6).toUpperCase()}`;
        const cancellationReason = 'Phòng bị hủy do quý khách không đến check-in';

        // Create cancellation notification for user
        try {
            const userId = booking.user_id?._id || booking.user_id;
            if (userId) {
                await createBookingCancellationNotification({
                    userId: userId,
                    type: 'hotel',
                    bookingId: booking._id,
                    bookingNumber: bookingNumber,
                    hotelName: hotelName,
                    reason: cancellationReason
                });
                console.log('✅ Notification created for booking cancellation');
            } else {
                console.warn('⚠️ No user_id found for booking, skipping notification');
            }
        } catch (notificationError) {
            console.error('❌ Error creating cancellation notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: 'Room released to available and booking cancelled successfully',
            data: {
                room: {
                    _id: room._id,
                    roomNumber: room.roomNumber,
                    status: room.status
                },
                booking: {
                    _id: booking._id,
                    booking_status: booking.booking_status,
                    cancelled_at: booking.cancelled_at
                }
            }
        });
    } catch (error) {
        console.error('Error releasing room from booking:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error.message || 'Failed to release room'
        });
    }
};

// Add maintenance record - REMOVED: maintenanceHistory field no longer exists
// exports.addMaintenanceRecord = async (req, res) => {
//     // Function removed because maintenanceHistory field was removed from Room model
// };