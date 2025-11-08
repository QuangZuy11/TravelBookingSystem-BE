const mongoose = require("mongoose");
const crypto = require("crypto");

/**
 * Schema cho Tour Payments Collection
 * Quản lý các giao dịch thanh toán cho tour bookings
 * Quan hệ 1:1 với TourBooking
 */
const tourPaymentSchema = new mongoose.Schema(
  {
    // ID người dùng thực hiện thanh toán
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "ID người dùng là bắt buộc"],
    },

    // ID booking (quan hệ 1:1 với TourBooking)
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TourBooking",
      default: null,
    },

    // Số tiền thanh toán
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: [true, "Số tiền thanh toán là bắt buộc"],
      min: [0, "Số tiền không thể âm"],
      get: function (value) {
        if (value) {
          return parseFloat(value.toString());
        }
        return value;
      },
    },

    // Đơn vị tiền tệ
    currency: {
      type: String,
      default: "VND",
      enum: {
        values: ["VND", "USD", "EUR", "GBP", "JPY", "CNY"],
        message: "{VALUE} không phải đơn vị tiền tệ hợp lệ",
      },
    },

    // Phương thức thanh toán
    method: {
      type: String,
      required: [true, "Phương thức thanh toán là bắt buộc"],
      enum: {
        values: [
          "credit_card",
          "debit_card",
          "bank_transfer",
          "paypal",
          "momo",
          "vnpay",
          "zalopay",
          "cash",
          "crypto",
          "qr_code",
        ],
        message: "{VALUE} không phải phương thức thanh toán hợp lệ",
      },
    },

    // Trạng thái thanh toán
    status: {
      type: String,
      enum: {
        values: [
          "pending",
          "processing",
          "completed",
          "failed",
          "refunded",
          "cancelled",
          "expired",
        ],
        message: "{VALUE} không phải trạng thái thanh toán hợp lệ",
      },
      default: "pending",
    },

    // Mã giao dịch (transaction reference)
    transaction_ref: {
      type: String,
      unique: true,
      sparse: true,
    },

    // PayOS specific fields
    payos_order_code: {
      type: Number,
      unique: true,
      sparse: true,
    },

    payos_payment_link_id: {
      type: String,
    },

    checkout_url: {
      type: String,
    },

    qr_code: {
      type: String,
    },

    expired_at: {
      type: Date,
    },

    paid_at: {
      type: Date,
    },

    failed_at: {
      type: Date,
    },

    cancelled_at: {
      type: Date,
    },

    // Mô tả giao dịch
    description: {
      type: String,
      maxlength: [500, "Mô tả không được vượt quá 500 ký tự"],
    },

    // Tên cổng thanh toán
    payment_gateway: {
      type: String,
      enum: [
        "vnpay",
        "momo",
        "zalopay",
        "paypal",
        "stripe",
        "payos",
        "manual",
        "other",
      ],
    },

    // Lý do thất bại (nếu có)
    failure_reason: {
      type: String,
    },

    // Metadata bổ sung
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Thời gian tạo
    created_at: {
      type: Date,
      default: Date.now,
    },

    // Thời gian cập nhật
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// Index để tối ưu tìm kiếm
tourPaymentSchema.index({ user_id: 1, created_at: -1 });
tourPaymentSchema.index({ booking_id: 1 });
tourPaymentSchema.index({ transaction_ref: 1 });
tourPaymentSchema.index({ status: 1, created_at: -1 });
tourPaymentSchema.index({ payment_gateway: 1, status: 1 });
tourPaymentSchema.index({ payos_order_code: 1 });

// Middleware: Tạo transaction reference tự động
tourPaymentSchema.pre("save", function (next) {
  if (this.isNew && !this.transaction_ref) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = crypto.randomBytes(4).toString("hex").toUpperCase();
    this.transaction_ref = `TOUR-PAY-${dateStr}-${random}`;
  }
  this.updated_at = Date.now();
  next();
});

// Middleware: Cập nhật payment status của tour booking khi thanh toán thành công
tourPaymentSchema.post("save", async function (doc) {
  // Only run if this is a new save or status changed to completed
  const wasJustCompleted = doc.isNew || doc.isModified("status");

  console.log("🔔 Tour Payment post-save hook triggered");
  console.log("   Payment ID:", doc._id);
  console.log("   Payment Status:", doc.status);
  console.log("   Booking ID:", doc.booking_id);
  console.log("   Is New:", doc.isNew);
  console.log("   Status Modified:", doc.isModified("status"));
  console.log("   Was Just Completed:", wasJustCompleted);

  if (doc.booking_id && doc.status === "completed" && wasJustCompleted) {
    console.log("✅ Payment completed, updating booking status...");
    const TourBooking = mongoose.model("TourBooking");
    const Tour = mongoose.model("Tour");
    const Itinerary = mongoose.model("Itinerary");

    // Update booking status
    const updatedBooking = await TourBooking.findByIdAndUpdate(
      doc.booking_id,
      {
        "payment.status": "completed",
        "payment.paid_at": new Date(),
        "payment.transaction_id": doc.transaction_ref,
        status: "paid",
      },
      { new: true }
    );

    if (updatedBooking) {
      console.log("✅ Booking status updated to 'paid'");
    } else {
      console.error("❌ Failed to update booking status");
    }

    // Send confirmation email (async, don't block)
    try {
      console.log("📧 Preparing to send confirmation email...");
      const booking = await TourBooking.findById(doc.booking_id)
        .populate({
          path: "tour_id",
          select: "title meeting_point",
        })
        .populate({
          path: "customer_id",
          select: "name email",
        })
        .lean();

      if (booking && booking.tour_id && booking.customer_id) {
        console.log("📧 Booking data loaded, fetching itineraries...");
        // Get itineraries
        const itineraries = await Itinerary.find({
          origin_id: booking.tour_id._id,
          type: "tour",
        })
          .sort({ day_number: 1 })
          .lean();

        const {
          sendTourBookingConfirmationEmail,
        } = require("../services/tour-booking-email.service");

        const customerEmail =
          booking.customer_id.email || booking.contact_info?.email;
        const customerName =
          booking.customer_id.name || booking.contact_info?.contact_name;

        console.log("📧 Email details:", {
          customerEmail,
          customerName,
          bookingNumber: booking.booking_number,
          tourTitle: booking.tour_id.title,
        });

        if (!customerEmail) {
          console.error("❌ No email address found for customer");
          console.error("   Customer ID email:", booking.customer_id?.email);
          console.error("   Contact info email:", booking.contact_info?.email);
          return;
        }

        const emailResult = await sendTourBookingConfirmationEmail({
          customerEmail,
          customerName,
          bookingNumber: booking.booking_number,
          tourTitle: booking.tour_id.title,
          tourDate: booking.tour_date,
          participants: booking.total_participants || 1,
          totalAmount: booking.pricing?.total_amount || doc.amount,
          meetingPoint: booking.tour_id.meeting_point,
          itineraries: itineraries,
          contactInfo: booking.contact_info,
        });

        if (emailResult.success) {
          if (emailResult.dev) {
            console.log("✅ [DEV MODE] Confirmation email logged to console");
          } else {
            console.log(
              "✅ Confirmation email sent successfully from post-save hook"
            );
          }
        } else {
          console.error(
            "❌ Failed to send email from post-save hook:",
            emailResult.error
          );
        }
      } else {
        console.error("❌ Missing booking data:", {
          hasBooking: !!booking,
          hasTour: !!booking?.tour_id,
          hasCustomer: !!booking?.customer_id,
        });
      }
    } catch (emailError) {
      console.error("❌ Error sending email in post-save hook:", emailError);
      console.error("   Error stack:", emailError.stack);
      // Don't throw error, just log it
    }
  } else {
    console.log("⏭️  Skipping hook - payment not completed or no booking_id");
  }
});

module.exports = mongoose.model(
  "TourPayment",
  tourPaymentSchema,
  "TOUR_PAYMENTS"
);
