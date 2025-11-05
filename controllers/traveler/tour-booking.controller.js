const mongoose = require("mongoose");
const TourBooking = require("../../models/tour-booking.model");
const Tour = require("../../models/tour.model");

/**
 * Tạo tour booking tạm thời (reserved) khi user click "Đặt tour"
 * @route POST /api/traveler/tour-bookings/reserve
 * @desc Tạo booking với status 'pending', chuẩn bị cho thanh toán
 * @access Private (User đã đăng nhập)
 */
exports.createReservedTourBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      tour_id,
      tour_date,
      guests,
      contactName,
      contactEmail,
      contactPhone,
      emergencyContact,
      emergencyPhone,
      specialRequests,
    } = req.body;

    // Kiểm tra authentication
    if (!req.user || !req.user._id) {
      await session.abortTransaction();
      return res.status(401).json({
        success: false,
        message: "Người dùng chưa được xác thực. Vui lòng đăng nhập.",
      });
    }

    const userId = req.user._id;

    // Validate input
    if (
      !tour_id ||
      !tour_date ||
      !guests ||
      !contactName ||
      !contactEmail ||
      !contactPhone
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc",
      });
    }

    // Kiểm tra tour có tồn tại không
    const tour = await Tour.findById(tour_id).session(session);
    if (!tour) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tour",
      });
    }

    // Kiểm tra số khách
    if (guests < 1 || guests > (tour.capacity?.max_participants || 20)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Số khách phải từ 1 đến ${
          tour.capacity?.max_participants || 20
        }`,
      });
    }

    // Kiểm tra ngày tour hợp lệ
    const tourDate = new Date(tour_date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (tourDate < now) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Ngày tour phải từ hôm nay trở đi",
      });
    }

    // Tính tổng tiền
    const basePrice = tour.price;
    const discount = tour.discount || 0;
    const subtotal = basePrice * guests;
    const discountAmount = (subtotal * discount) / 100;
    const totalAmount = subtotal - discountAmount;

    // Tạo booking number
    const bookingNumber = await TourBooking.generateBookingNumber();

    // Lấy provider_id từ tour
    const providerId = tour.provider_id;

    // Tạo booking
    const newBooking = new TourBooking({
      booking_number: bookingNumber,
      tour_id: tour_id,
      customer_id: userId,
      provider_id: providerId,
      tour_date: tourDate,
      participants: {
        adults: guests,
        children: 0,
        infants: 0,
      },
      total_participants: guests,
      pricing: {
        adult_price: basePrice,
        child_price: 0,
        infant_price: 0,
        subtotal: subtotal,
        discount: discountAmount,
        total_amount: totalAmount,
      },
      payment: {
        method: "qr_code", // Sẽ thanh toán qua QR
        status: "pending",
      },
      contact_info: {
        phone: contactPhone,
        email: contactEmail,
        emergency_contact:
          emergencyContact && emergencyPhone
            ? {
                name: emergencyContact,
                phone: emergencyPhone,
              }
            : undefined,
      },
      special_requests: specialRequests || "",
      status: "pending",
    });

    await newBooking.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Populate thông tin để trả về
    await newBooking.populate([
      {
        path: "tour_id",
        select: "title price image destination duration",
      },
      {
        path: "customer_id",
        select: "name email",
      },
    ]);

    res.status(201).json({
      success: true,
      data: {
        bookingId: newBooking._id,
        bookingNumber: newBooking.booking_number,
        tour: {
          id: newBooking.tour_id._id,
          title: newBooking.tour_id.title,
          price: newBooking.tour_id.price,
          image: newBooking.tour_id.image,
        },
        booking: {
          tourDate: newBooking.tour_date,
          guests: newBooking.total_participants,
          totalAmount: parseFloat(newBooking.pricing.total_amount),
          bookingStatus: newBooking.status,
          paymentStatus: newBooking.payment.status,
        },
      },
      message: "Tạo booking thành công. Vui lòng thanh toán trong 2 phút.",
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Create Reserved Tour Booking Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi tạo booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

/**
 * Hủy booking khi user đóng modal (chưa thanh toán)
 * @route POST /api/traveler/tour-bookings/:bookingId/cancel
 * @desc Hủy booking pending và giải phóng slot
 * @access Private (User đã đăng nhập)
 */
exports.cancelReservedTourBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId } = req.params;

    if (!req.user || !req.user._id) {
      await session.abortTransaction();
      return res.status(401).json({
        success: false,
        message: "Người dùng chưa được xác thực. Vui lòng đăng nhập.",
      });
    }

    const userId = req.user._id;

    // Tìm booking
    const booking = await TourBooking.findById(bookingId).session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy booking",
      });
    }

    // Kiểm tra quyền
    if (booking.customer_id.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền hủy booking này",
      });
    }

    // Chỉ cho phép hủy booking có status 'pending'
    if (booking.status !== "pending") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Không thể hủy booking với trạng thái: ${booking.status}`,
      });
    }

    // Cập nhật booking status
    booking.status = "cancelled";
    booking.cancellation.is_cancelled = true;
    booking.cancellation.cancelled_at = new Date();
    booking.cancellation.cancelled_by = userId;
    await booking.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Hủy booking thành công.",
      data: {
        bookingId: booking._id,
        bookingStatus: booking.status,
        cancelledAt: booking.cancellation.cancelled_at,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Cancel Reserved Tour Booking Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hủy booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

/**
 * Lấy thông tin thanh toán booking để hiển thị trước khi thanh toán
 * @route GET /api/traveler/tour-bookings/:bookingId/payment-info
 * @desc Hiển thị thông tin chi tiết booking khi người dùng click vào button thanh toán
 * @access Private (User đã đăng nhập)
 */
exports.getTourBookingPaymentInfo = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Người dùng chưa được xác thực. Vui lòng đăng nhập.",
      });
    }

    const userId = req.user._id;

    // Kiểm tra booking có tồn tại không
    const booking = await TourBooking.findById(bookingId)
      .populate({
        path: "tour_id",
        select: "title price image destination duration",
      })
      .populate({
        path: "customer_id",
        select: "name email",
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy booking",
      });
    }

    // Kiểm tra quyền truy cập
    if (booking.customer_id._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem thông tin booking này",
      });
    }

    const tour = booking.tour_id;

    // Chuẩn bị dữ liệu trả về
    const paymentInfo = {
      // Thông tin tour
      tour: {
        id: tour._id,
        title: tour.title,
        image: tour.image,
        destination: tour.destination,
        duration: tour.duration,
      },

      // Thông tin người đặt
      guest: {
        name: booking.contact_info.phone
          ? booking.contact_info.email.split("@")[0]
          : "Khách hàng",
        email: booking.contact_info.email,
        phone: booking.contact_info.phone,
      },

      // Thông tin đặt tour
      booking: {
        bookingId: booking._id,
        bookingNumber: booking.booking_number,
        tourDate: booking.tour_date,
        guests: booking.total_participants,
        bookingDate: booking.booking_date,
        bookingStatus: booking.status,
        paymentStatus: booking.payment.status,
      },

      // Thông tin giá tiền
      pricing: {
        pricePerPerson: parseFloat(booking.pricing.adult_price),
        guests: booking.total_participants,
        subtotal: parseFloat(booking.pricing.subtotal),
        discount: parseFloat(booking.pricing.discount),
        totalAmount: parseFloat(booking.pricing.total_amount),
        calculation: `${parseFloat(booking.pricing.adult_price).toLocaleString(
          "vi-VN"
        )} VNĐ × ${booking.total_participants} khách = ${parseFloat(
          booking.pricing.total_amount
        ).toLocaleString("vi-VN")} VNĐ`,
      },
    };

    res.status(200).json({
      success: true,
      data: paymentInfo,
      message: "Lấy thông tin thanh toán thành công",
    });
  } catch (error) {
    console.error("Get Tour Booking Payment Info Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy thông tin thanh toán",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Lấy danh sách booking của user
 * @route GET /api/traveler/tour-bookings
 * @desc Lấy tất cả tour booking của user đang đăng nhập
 * @access Private
 */
exports.getUserTourBookings = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Người dùng chưa được xác thực. Vui lòng đăng nhập.",
      });
    }

    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { customer_id: userId };

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const bookings = await TourBooking.find(query)
      .populate({
        path: "tour_id",
        select: "title price image destination duration",
      })
      .sort({ booking_date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TourBooking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: bookings.length,
          totalRecords: total,
        },
      },
      message: "Lấy danh sách booking thành công",
    });
  } catch (error) {
    console.error("Get User Tour Bookings Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Lấy chi tiết một tour booking
 * @route GET /api/traveler/tour-bookings/:bookingId
 * @desc Lấy thông tin chi tiết của một tour booking
 * @access Private
 */
exports.getTourBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Người dùng chưa được xác thực. Vui lòng đăng nhập.",
      });
    }

    const userId = req.user._id;

    // Validate bookingId format
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "ID booking không hợp lệ",
      });
    }

    const booking = await TourBooking.findById(bookingId)
      .populate({
        path: "tour_id",
        select:
          "title name price image destination duration duration_hours description highlights included_services rating total_rating discount provider_id",
      })
      .populate({
        path: "customer_id",
        select: "name email",
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy booking",
      });
    }

    // Kiểm tra quyền truy cập - kiểm tra cả trường hợp customer_id là object hoặc string
    let customerId;
    if (
      booking.customer_id &&
      typeof booking.customer_id === "object" &&
      booking.customer_id._id
    ) {
      customerId = booking.customer_id._id.toString();
    } else if (booking.customer_id) {
      customerId = booking.customer_id.toString();
    } else {
      return res.status(403).json({
        success: false,
        message: "Booking không có thông tin khách hàng",
      });
    }

    if (customerId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem booking này",
      });
    }

    // Convert to plain object và format dữ liệu
    const bookingData = booking.toObject ? booking.toObject() : booking;

    // Đảm bảo tour có đầy đủ thông tin
    if (bookingData.tour_id) {
      // Nếu tour có name nhưng không có title, dùng name
      if (!bookingData.tour_id.title && bookingData.tour_id.name) {
        bookingData.tour_id.title = bookingData.tour_id.name;
      }
    }

    res.status(200).json({
      success: true,
      data: bookingData,
      message: "Lấy thông tin booking thành công",
    });
  } catch (error) {
    console.error("Get Tour Booking By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy thông tin booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = exports;
