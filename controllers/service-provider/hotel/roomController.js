const Room = require('../../../models/Room');
const Hotel = require('../../../models/Hotel');

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

        const room = await Room.create({
            ...req.body,
            hotelId: req.params.hotelId
        });

        res.status(201).json({
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

// Update room
exports.updateRoom = async (req, res) => {
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
            req.body,
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