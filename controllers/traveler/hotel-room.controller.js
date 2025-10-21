const mongoose = require('mongoose');
const Room = require('../../models/room.model');
const Hotel = require('../../models/hotel.model');

/**
 * Lấy danh sách phòng của một khách sạn và phân loại theo loại phòng
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getRoomsByHotelId = async (req, res) => {
    try {
        const { hotelId } = req.params;
        const {
            checkIn,
            checkOut,
            status,
            minPrice,
            maxPrice,
            minCapacity,
            type
        } = req.query;

        // Kiểm tra tính hợp lệ của hotelId
        if (!mongoose.Types.ObjectId.isValid(hotelId)) {
            return res.status(400).json({
                success: false,
                message: 'ID khách sạn không hợp lệ'
            });
        }

        // Kiểm tra khách sạn có tồn tại không
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách sạn'
            });
        }

        // Khởi tạo query tìm kiếm
        let searchQuery = { hotelId: hotelId };

        // Lọc theo status
        if (status) {
            searchQuery.status = status;
        } else {
            // Mặc định chỉ lấy phòng available
            searchQuery.status = { $in: ['available', 'reserved'] };
        }

        // Lọc theo giá
        if (minPrice) {
            searchQuery.pricePerNight = { ...searchQuery.pricePerNight, $gte: Number(minPrice) };
        }
        if (maxPrice) {
            searchQuery.pricePerNight = { ...searchQuery.pricePerNight, $lte: Number(maxPrice) };
        }

        // Lọc theo sức chứa tối thiểu
        if (minCapacity) {
            searchQuery.capacity = { $gte: Number(minCapacity) };
        }

        // Lọc theo loại phòng
        if (type) {
            const types = Array.isArray(type) ? type : type.split(',').map(item => item.trim());
            searchQuery.type = { $in: types };
        }

        // Kiểm tra phòng trống theo ngày check-in và check-out
        if (checkIn && checkOut) {
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);

            // Kiểm tra ngày hợp lệ
            if (isNaN(checkInDate) || isNaN(checkOutDate)) {
                return res.status(400).json({
                    success: false,
                    message: 'Ngày check-in hoặc check-out không hợp lệ'
                });
            }

            if (checkInDate >= checkOutDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Ngày check-out phải sau ngày check-in'
                });
            }

            // Tìm phòng không có booking trùng ngày
            searchQuery.$or = [
                { 'bookings': { $size: 0 } }, // Phòng chưa có booking nào
                {
                    'bookings': {
                        $not: {
                            $elemMatch: {
                                $or: [
                                    // Booking bắt đầu trong khoảng thời gian tìm kiếm
                                    {
                                        checkIn: { $lt: checkOutDate },
                                        checkOut: { $gt: checkInDate }
                                    }
                                ]
                            }
                        }
                    }
                }
            ];
        }

        // Lấy danh sách phòng
        const rooms = await Room.find(searchQuery)
            .populate('hotelId', 'name address')
            .sort({ type: 1, pricePerNight: 1 });

        // Phân loại theo loại phòng và đếm số lượng
        const roomsByType = rooms.reduce((acc, room) => {
            const roomType = room.type;
            
            if (!acc[roomType]) {
                acc[roomType] = {
                    type: roomType,
                    count: 0,
                    availableCount: 0,
                    occupiedCount: 0,
                    maintenanceCount: 0,
                    reservedCount: 0,
                    minPrice: room.pricePerNight,
                    maxPrice: room.pricePerNight,
                    avgPrice: 0,
                    totalCapacity: 0,
                    avgCapacity: 0,
                    rooms: []
                };
            }

            // Đếm số lượng theo status
            acc[roomType].count++;
            switch (room.status) {
                case 'available':
                    acc[roomType].availableCount++;
                    break;
                case 'occupied':
                    acc[roomType].occupiedCount++;
                    break;
                case 'maintenance':
                    acc[roomType].maintenanceCount++;
                    break;
                case 'reserved':
                    acc[roomType].reservedCount++;
                    break;
            }

            // Cập nhật giá min/max
            if (room.pricePerNight < acc[roomType].minPrice) {
                acc[roomType].minPrice = room.pricePerNight;
            }
            if (room.pricePerNight > acc[roomType].maxPrice) {
                acc[roomType].maxPrice = room.pricePerNight;
            }

            // Cộng dồn capacity
            acc[roomType].totalCapacity += room.capacity;

            // Thêm phòng vào danh sách
            acc[roomType].rooms.push(room);

            return acc;
        }, {});

        // Tính giá trung bình và capacity trung bình cho mỗi loại
        Object.keys(roomsByType).forEach(type => {
            const data = roomsByType[type];
            data.avgPrice = Math.round(
                data.rooms.reduce((sum, room) => sum + room.pricePerNight, 0) / data.count
            );
            data.avgCapacity = Math.round(data.totalCapacity / data.count);
        });

        // Tổng hợp thống kê
        const summary = {
            totalRooms: rooms.length,
            totalAvailable: rooms.filter(r => r.status === 'available').length,
            totalOccupied: rooms.filter(r => r.status === 'occupied').length,
            totalMaintenance: rooms.filter(r => r.status === 'maintenance').length,
            totalReserved: rooms.filter(r => r.status === 'reserved').length,
            roomTypes: Object.keys(roomsByType).length,
            priceRange: {
                min: Math.min(...rooms.map(r => r.pricePerNight)),
                max: Math.max(...rooms.map(r => r.pricePerNight)),
                avg: Math.round(rooms.reduce((sum, r) => sum + r.pricePerNight, 0) / rooms.length)
            }
        };

        res.status(200).json({
            success: true,
            data: {
                hotel: {
                    _id: hotel._id,
                    name: hotel.name,
                    address: hotel.address
                },
                summary,
                roomsByType,
                searchCriteria: {
                    checkIn,
                    checkOut,
                    status,
                    minPrice,
                    maxPrice,
                    minCapacity,
                    type
                }
            },
            message: `Tìm thấy ${rooms.length} phòng trong ${Object.keys(roomsByType).length} loại`
        });

    } catch (error) {
        console.error('Lỗi lấy danh sách phòng:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ nội bộ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lấy chi tiết một phòng theo ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getRoomById = async (req, res) => {
    try {
        const { roomId } = req.params;

        // Kiểm tra tính hợp lệ của ID
        if (!mongoose.Types.ObjectId.isValid(roomId)) {
            return res.status(400).json({
                success: false,
                message: 'ID phòng không hợp lệ'
            });
        }

        // Tìm phòng theo ID
        const room = await Room.findById(roomId)
            .populate('hotelId', 'name address contactInfo rating')
            .populate('bookings.bookingId', 'checkIn checkOut status totalPrice');

        // Kiểm tra phòng có tồn tại không
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phòng'
            });
        }

        res.status(200).json({
            success: true,
            data: room,
            message: 'Lấy thông tin phòng thành công'
        });

    } catch (error) {
        console.error('Lỗi lấy chi tiết phòng:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ nội bộ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Kiểm tra phòng trống trong khoảng thời gian
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.checkRoomAvailability = async (req, res) => {
    try {
        const { hotelId } = req.params;
        const { checkIn, checkOut, roomType, capacity } = req.query;

        // Kiểm tra các tham số bắt buộc
        if (!checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp ngày check-in và check-out'
            });
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        // Kiểm tra ngày hợp lệ
        if (isNaN(checkInDate) || isNaN(checkOutDate)) {
            return res.status(400).json({
                success: false,
                message: 'Ngày check-in hoặc check-out không hợp lệ'
            });
        }

        if (checkInDate >= checkOutDate) {
            return res.status(400).json({
                success: false,
                message: 'Ngày check-out phải sau ngày check-in'
            });
        }

        // Khởi tạo query
        let searchQuery = {
            hotelId: hotelId,
            status: { $in: ['available', 'reserved'] }
        };

        if (roomType) {
            searchQuery.type = roomType;
        }

        if (capacity) {
            searchQuery.capacity = { $gte: Number(capacity) };
        }

        // Tìm phòng trống
        const availableRooms = await Room.find({
            ...searchQuery,
            $or: [
                { 'bookings': { $size: 0 } },
                {
                    'bookings': {
                        $not: {
                            $elemMatch: {
                                checkIn: { $lt: checkOutDate },
                                checkOut: { $gt: checkInDate }
                            }
                        }
                    }
                }
            ]
        }).populate('hotelId', 'name address');

        // Phân loại theo type
        const availabilityByType = availableRooms.reduce((acc, room) => {
            if (!acc[room.type]) {
                acc[room.type] = {
                    type: room.type,
                    availableCount: 0,
                    minPrice: room.pricePerNight,
                    maxPrice: room.pricePerNight,
                    rooms: []
                };
            }

            acc[room.type].availableCount++;
            if (room.pricePerNight < acc[room.type].minPrice) {
                acc[room.type].minPrice = room.pricePerNight;
            }
            if (room.pricePerNight > acc[room.type].maxPrice) {
                acc[room.type].maxPrice = room.pricePerNight;
            }
            acc[room.type].rooms.push(room);

            return acc;
        }, {});

        res.status(200).json({
            success: true,
            data: {
                checkIn,
                checkOut,
                totalAvailable: availableRooms.length,
                availabilityByType
            },
            message: `Có ${availableRooms.length} phòng trống trong khoảng thời gian này`
        });

    } catch (error) {
        console.error('Lỗi kiểm tra phòng trống:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ nội bộ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lấy danh sách loại phòng có sẵn
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAvailableRoomTypes = async (req, res) => {
    try {
        const { hotelId } = req.params;

        // Lấy danh sách loại phòng duy nhất
        const roomTypes = await Room.distinct('type', { hotelId: hotelId });

        res.status(200).json({
            success: true,
            data: roomTypes,
            message: 'Lấy danh sách loại phòng thành công'
        });

    } catch (error) {
        console.error('Lỗi lấy danh sách loại phòng:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ nội bộ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
