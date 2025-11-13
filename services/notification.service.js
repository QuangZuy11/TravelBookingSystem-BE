const Notification = require("../models/notification.model");

/**
 * Notification Service
 * Service để tạo và quản lý thông báo
 */

/**
 * Tạo thông báo đặt phòng/tour thành công
 * @param {Object} data - Dữ liệu thông báo
 * @param {string} data.userId - ID người dùng
 * @param {string} data.type - 'hotel' hoặc 'tour'
 * @param {string} data.bookingId - ID booking
 * @param {string} data.bookingNumber - Số booking
 * @param {string} data.hotelName - Tên khách sạn (nếu là hotel)
 * @param {string} data.tourName - Tên tour (nếu là tour)
 * @param {number} data.amount - Số tiền thanh toán
 */
exports.createBookingSuccessNotification = async (data) => {
  try {
    const {
      userId,
      type,
      bookingId,
      bookingNumber,
      hotelName,
      tourName,
      amount,
    } = data;

    // Validate required fields
    if (!userId) {
      console.error("❌ [NOTIFICATION] Missing userId");
      throw new Error("userId is required");
    }

    if (!type || !["hotel", "tour"].includes(type)) {
      console.error("❌ [NOTIFICATION] Invalid type:", type);
      throw new Error("Invalid booking type");
    }

    console.log("📧 [NOTIFICATION] Creating booking success notification:", {
      userId,
      type,
      bookingId,
      bookingNumber,
      hotelName,
      tourName,
      amount,
    });

    let title, message;
    let relatedType;

    if (type === "hotel") {
      title = "Đặt phòng thành công";
      message = `Đặt phòng khách sạn ${
        hotelName || ""
      } thành công. Mã đặt phòng: ${
        bookingNumber || bookingId
      }. Số tiền thanh toán: ${formatPrice(amount)}.`;
      relatedType = "HotelBooking";
    } else if (type === "tour") {
      title = "Đặt tour thành công";
      message = `Đặt tour ${tourName || ""} thành công. Mã đặt tour: ${
        bookingNumber || bookingId
      }. Số tiền thanh toán: ${formatPrice(amount)}.`;
      relatedType = "TourBooking";
    } else {
      throw new Error("Invalid booking type");
    }

    const notification = await Notification.createNotification({
      user_id: userId,
      title,
      message,
      type: "success",
      status: "unread",
      related_id: bookingId,
      related_type: relatedType,
      metadata: {
        bookingNumber,
        amount,
        hotelName,
        tourName,
      },
    });

    console.log("✅ [NOTIFICATION] Notification created successfully:", {
      notificationId: notification._id,
      userId: notification.user_id,
      title: notification.title,
    });

    return notification;
  } catch (error) {
    console.error(
      "❌ [NOTIFICATION] Error creating booking success notification:",
      error
    );
    console.error("   Error stack:", error.stack);
    throw error;
  }
};

/**
 * Tạo thông báo hủy booking
 * @param {Object} data - Dữ liệu thông báo
 * @param {string} data.userId - ID người dùng
 * @param {string} data.type - 'hotel' hoặc 'tour'
 * @param {string} data.bookingId - ID booking
 * @param {string} data.bookingNumber - Số booking
 * @param {string} data.hotelName - Tên khách sạn (nếu là hotel)
 * @param {string} data.tourName - Tên tour (nếu là tour)
 * @param {string} data.reason - Lý do hủy (optional)
 */
exports.createBookingCancellationNotification = async (data) => {
  try {
    const {
      userId,
      type,
      bookingId,
      bookingNumber,
      hotelName,
      tourName,
      reason,
    } = data;

    let title, message;
    let relatedType;

    if (type === "hotel") {
      title = "Hủy đặt phòng";
      message = `Đặt phòng khách sạn ${
        hotelName || ""
      } đã được hủy. Mã đặt phòng: ${bookingNumber || bookingId}.${
        reason ? ` Lý do: ${reason}` : ""
      }`;
      relatedType = "HotelBooking";
    } else if (type === "tour") {
      title = "Hủy đặt tour";
      message = `Đặt tour ${tourName || ""} đã được hủy. Mã đặt tour: ${
        bookingNumber || bookingId
      }.${reason ? ` Lý do: ${reason}` : ""}`;
      relatedType = "TourBooking";
    } else {
      throw new Error("Invalid booking type");
    }

    const notification = await Notification.createNotification({
      user_id: userId,
      title,
      message,
      type: "info",
      status: "unread",
      related_id: bookingId,
      related_type: relatedType,
      metadata: {
        bookingNumber,
        hotelName,
        tourName,
        reason,
      },
    });

    return notification;
  } catch (error) {
    console.error("Error creating booking cancellation notification:", error);
    throw error;
  }
};

/**
 * Tạo thông báo book ads thành công (Provider)
 * @param {Object} data - Dữ liệu thông báo
 * @param {string} data.userId - ID người dùng (provider)
 * @param {string} data.type - 'hotel' hoặc 'tour'
 * @param {string} data.adBookingId - ID ad booking
 * @param {string} data.serviceName - Tên dịch vụ (hotel/tour name)
 * @param {number} data.amount - Số tiền thanh toán
 * @param {Date} data.startDate - Ngày bắt đầu
 * @param {Date} data.endDate - Ngày kết thúc
 */
exports.createAdBookingSuccessNotification = async (data) => {
  try {
    const {
      userId,
      type,
      adBookingId,
      serviceName,
      amount,
      startDate,
      endDate,
    } = data;

    const title = "Đặt quảng cáo thành công";
    const message = `Đặt quảng cáo ${
      type === "hotel" ? "khách sạn" : "tour"
    } "${serviceName || ""}" thành công. Số tiền thanh toán: ${formatPrice(
      amount
    )}. Thời gian hiển thị: ${formatDate(startDate)} - ${formatDate(endDate)}.`;

    const notification = await Notification.createNotification({
      user_id: userId,
      title,
      message,
      type: "success",
      status: "unread",
      related_id: adBookingId,
      related_type: "AdBooking",
      metadata: {
        serviceName,
        amount,
        startDate,
        endDate,
        serviceType: type,
      },
    });

    return notification;
  } catch (error) {
    console.error("Error creating ad booking success notification:", error);
    throw error;
  }
};

/**
 * Tạo thông báo no-show cho tour booking
 * @param {Object} data - Dữ liệu thông báo
 * @param {string} data.userId - ID người dùng (traveler)
 * @param {string} data.bookingId - ID booking
 * @param {string} data.bookingNumber - Số booking
 * @param {string} data.tourName - Tên tour
 * @param {Date} data.tourDate - Ngày khởi hành tour
 */
/**
 * Tạo thông báo check-in tour thành công
 * @param {Object} data - Dữ liệu thông báo
 * @param {string} data.userId - ID người dùng (traveler)
 * @param {string} data.bookingId - ID booking
 * @param {string} data.bookingNumber - Số booking
 * @param {string} data.tourName - Tên tour
 * @param {Date} data.tourDate - Ngày tour
 */
exports.createTourCheckInNotification = async (data) => {
  try {
    const { userId, bookingId, bookingNumber, tourName, tourDate } = data;

    if (!userId) {
      console.error("❌ [NOTIFICATION] Missing userId");
      throw new Error("userId is required");
    }

    // Convert userId to ObjectId if it's a string
    const mongoose = require("mongoose");
    const userIdObjectId =
      userId instanceof mongoose.Types.ObjectId
        ? userId
        : new mongoose.Types.ObjectId(userId);

    console.log("📧 [NOTIFICATION] Creating check-in notification:", {
      userId: userIdObjectId.toString(),
      bookingId,
      bookingNumber,
      tourName,
      tourDate,
    });

    const tourDateFormatted = tourDate
      ? new Date(tourDate).toLocaleDateString("vi-VN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      : "";

    const title = "Đã check-in tour";
    const message = `Bạn đã được check-in thành công cho tour "${
      tourName || ""
    }" vào ngày ${tourDateFormatted}. Mã đặt tour: ${
      bookingNumber || bookingId
    }.`;

    const notification = await Notification.createNotification({
      user_id: userIdObjectId,
      title,
      message,
      type: "success",
      status: "unread",
      related_id: bookingId,
      related_type: "TourBooking",
      metadata: {
        bookingNumber,
        tourName,
        tourDate,
        checkIn: true,
      },
    });

    console.log("✅ [NOTIFICATION] Tour check-in notification created:", {
      notificationId: notification._id,
      userId: notification.user_id,
      title: notification.title,
    });

    return notification;
  } catch (error) {
    console.error(
      "❌ [NOTIFICATION] Error creating tour check-in notification:",
      error
    );
    throw error;
  }
};

exports.createTourNoShowNotification = async (data) => {
  try {
    const { userId, bookingId, bookingNumber, tourName, tourDate } = data;

    // Validate required fields
    if (!userId) {
      console.error(
        "❌ [NOTIFICATION] Missing userId for no-show notification"
      );
      throw new Error("userId is required");
    }

    const title = "Không đến tour";
    const tourDateFormatted = tourDate
      ? new Date(tourDate).toLocaleDateString("vi-VN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      : "N/A";

    const message = `Bạn đã không đến tour "${
      tourName || ""
    }" vào ngày ${tourDateFormatted}. Mã đặt tour: ${
      bookingNumber || bookingId
    }.`;

    const notification = await Notification.createNotification({
      user_id: userId,
      title,
      message,
      type: "warning",
      status: "unread",
      related_id: bookingId,
      related_type: "TourBooking",
      metadata: {
        bookingNumber,
        tourName,
        tourDate,
        noShow: true,
      },
    });

    console.log(
      "✅ [NOTIFICATION] No-show notification created successfully:",
      {
        notificationId: notification._id,
        userId: notification.user_id,
        title: notification.title,
      }
    );

    return notification;
  } catch (error) {
    console.error(
      "❌ [NOTIFICATION] Error creating no-show notification:",
      error
    );
    console.error("   Error stack:", error.stack);
    throw error;
  }
};

/**
 * Format giá tiền
 */
function formatPrice(amount) {
  if (!amount) return "0 VNĐ";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

/**
 * Format ngày tháng
 */
function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

module.exports = {
  createBookingSuccessNotification: exports.createBookingSuccessNotification,
  createBookingCancellationNotification:
    exports.createBookingCancellationNotification,
  createAdBookingSuccessNotification:
    exports.createAdBookingSuccessNotification,
  createTourCheckInNotification: exports.createTourCheckInNotification,
  createTourNoShowNotification: exports.createTourNoShowNotification,
};
