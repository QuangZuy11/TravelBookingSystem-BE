const cron = require("node-cron");
const mongoose = require("mongoose");
const TourBooking = require("../models/tour-booking.model");
const Tour = require("../models/tour.model");
const { createTourNoShowNotification } = require("./notification.service");

/**
 * Service để tự động xử lý no-show cho tour bookings
 * Chạy mỗi giờ để kiểm tra các booking đã qua tour_date nhưng traveler không đến
 */
class TourNoShowService {
  constructor() {
    this.cronTask = null;
  }

  /**
   * Bắt đầu cron job
   */
  start() {
    console.log("🚀 Starting Tour No-Show Service...");

    // Chạy mỗi giờ (vào phút 0 của mỗi giờ)
    this.cronTask = cron.schedule("0 * * * *", async () => {
      await this.checkNoShowBookings();
    });

    console.log("✅ Tour No-Show Service started - Running every hour");
  }

  /**
   * Dừng cron job
   */
  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      console.log("⏹️ Tour No-Show Service stopped");
    }
  }

  /**
   * Kiểm tra và xử lý các booking no-show
   * Logic: Tìm các booking có:
   * - status là "paid" hoặc "confirmed"
   * - tour_date đã qua (đã khởi hành)
   * - Chưa được đánh dấu là no-show
   */
  async checkNoShowBookings() {
    try {
      const now = new Date();
      // Lấy thời điểm bắt đầu ngày hôm nay (00:00:00)
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      console.log(
        `[${now.toISOString()}] 🔍 Checking for no-show tour bookings...`
      );

      // Tìm các booking có tour_date đã qua và status là paid hoặc confirmed
      // Chỉ check các booking có tour_date trong quá khứ (đã qua ngày khởi hành)
      // VÀ chưa được check-in (attendance_status vẫn là "pending")
      const noShowBookings = await TourBooking.find({
        status: { $in: ["paid", "confirmed"] },
        tour_date: { $lt: startOfToday }, // Tour đã khởi hành (trước hôm nay)
        attendance_status: "pending", // Chưa được check-in
        no_show_at: { $exists: false }, // Chưa được đánh dấu no-show
      })
        .populate("tour_id", "title")
        .populate("customer_id", "name email")
        .populate("provider_id", "name email")
        .lean();

      if (noShowBookings.length === 0) {
        console.log("✓ No no-show bookings found");
        return;
      }

      console.log(`⚠️ Found ${noShowBookings.length} no-show booking(s)`);

      let successCount = 0;
      let errorCount = 0;

      // Xử lý từng booking no-show
      for (const booking of noShowBookings) {
        try {
          console.log(
            `🔄 Processing no-show booking: ${booking._id} (${booking.booking_number})`
          );

          await this.markBookingAsNoShow(booking);

          successCount++;
          console.log(
            `✅ Booking ${booking._id} marked as no-show successfully`
          );
        } catch (error) {
          console.error(
            `❌ Error processing no-show booking ${booking._id}:`,
            error.message
          );
          errorCount++;
        }
      }

      console.log(
        `✅ No-show check completed: ${successCount} processed, ${errorCount} errors`
      );
    } catch (error) {
      console.error("❌ Error in checkNoShowBookings:", error);
    }
  }

  /**
   * Đánh dấu booking là no-show
   * @param {Object} booking - Booking object (có thể là lean object)
   */
  async markBookingAsNoShow(booking) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Cập nhật booking status và attendance status thành "no-show"
      const updatedBooking = await TourBooking.findByIdAndUpdate(
        booking._id,
        {
          status: "no-show",
          attendance_status: "no-show",
          no_show_at: new Date(),
          updated_at: new Date(),
        },
        {
          new: true,
          session,
        }
      )
        .populate("tour_id", "title")
        .populate("customer_id", "name email")
        .populate("provider_id", "name email");

      if (!updatedBooking) {
        throw new Error("Booking not found");
      }

      // 2. Tạo thông báo cho traveler (customer)
      try {
        const tourName = updatedBooking.tour_id?.title || "N/A";
        const bookingNumber =
          updatedBooking.booking_number ||
          `T-${updatedBooking._id.toString().slice(-6).toUpperCase()}`;

        await createTourNoShowNotification({
          userId: updatedBooking.customer_id?._id || updatedBooking.customer_id,
          bookingId: updatedBooking._id,
          bookingNumber: bookingNumber,
          tourName: tourName,
          tourDate: updatedBooking.tour_date,
        });

        console.log(
          `📧 No-show notification sent to traveler: ${
            updatedBooking.customer_id?.email || "N/A"
          }`
        );
      } catch (notificationError) {
        console.error(
          "❌ Error sending no-show notification to traveler:",
          notificationError
        );
        // Không throw error, chỉ log để không block transaction
      }

      // 3. Tạo thông báo cho provider (nếu có provider_id)
      if (updatedBooking.provider_id) {
        try {
          const Notification = require("../models/notification.model");
          const tourName = updatedBooking.tour_id?.title || "N/A";
          const bookingNumber =
            updatedBooking.booking_number ||
            `T-${updatedBooking._id.toString().slice(-6).toUpperCase()}`;
          const customerName = updatedBooking.customer_id?.name || "Khách hàng";

          await Notification.createNotification({
            user_id:
              updatedBooking.provider_id._id || updatedBooking.provider_id,
            title: "Khách hàng không đến tour",
            message: `Khách hàng ${customerName} đã không đến tour "${tourName}" vào ngày ${new Date(
              updatedBooking.tour_date
            ).toLocaleDateString("vi-VN")}. Mã đặt tour: ${bookingNumber}.`,
            type: "warning",
            status: "unread",
            related_id: updatedBooking._id,
            related_type: "TourBooking",
            metadata: {
              bookingNumber,
              tourName,
              tourDate: updatedBooking.tour_date,
              customerName,
            },
          });

          console.log(
            `📧 No-show notification sent to provider: ${
              updatedBooking.provider_id?.email || "N/A"
            }`
          );
        } catch (providerNotificationError) {
          console.error(
            "❌ Error sending no-show notification to provider:",
            providerNotificationError
          );
          // Không throw error, chỉ log
        }
      }

      await session.commitTransaction();
      console.log(
        `✅ Booking ${booking._id} marked as no-show and notifications sent`
      );
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Chạy check ngay lập tức (không chờ cron)
   * Useful cho testing hoặc manual check
   */
  async runNow() {
    console.log("🔄 Running manual no-show check...");
    await this.checkNoShowBookings();
  }
}

// Export singleton instance
const tourNoShowService = new TourNoShowService();

module.exports = tourNoShowService;
