const mongoose = require("mongoose");

/**
 * Schema cho Ad Payments Collection
 * Quản lý các giao dịch thanh toán cho ad bookings
 */
const adPaymentSchema = new mongoose.Schema(
  {
    // ID người dùng thực hiện thanh toán (provider)
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "ID người dùng là bắt buộc"],
    },

    // ID ad booking
    ad_booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdBooking",
      required: true,
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
        values: ["qr_code", "bank_transfer", "credit_card"],
        message: "{VALUE} không phải phương thức thanh toán hợp lệ",
      },
      default: "qr_code",
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

    // PayOS specific fields
    payos_order_code: {
      type: Number,
      unique: true,
      sparse: true,
    },

    payos_payment_link_id: {
      type: String,
    },

    // Link thanh toán
    checkout_url: {
      type: String,
    },

    // QR code
    qr_code: {
      type: String,
    },

    // Mô tả thanh toán
    description: {
      type: String,
      default: "Thanh toán quảng cáo tour",
    },

    // Thời gian hết hạn
    expired_at: {
      type: Date,
    },

    // Payment gateway
    payment_gateway: {
      type: String,
      default: "payos",
    },

    // Metadata
    metadata: {
      tour_title: String,
      tour_id: mongoose.Schema.Types.ObjectId,
      hotel_name: String,
      hotel_id: mongoose.Schema.Types.ObjectId,
      ad_type: {
        type: String,
        enum: ["tour", "hotel"],
      },
    },

    // Timestamps
    paid_at: {
      type: Date,
    },
    failed_at: {
      type: Date,
    },
    failure_reason: {
      type: String,
    },
    transaction_ref: {
      type: String,
    },
    payment_details: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    collection: "AD_PAYMENTS",
  }
);

// Indexes
adPaymentSchema.index({ ad_booking_id: 1 });
adPaymentSchema.index({ user_id: 1 });
adPaymentSchema.index({ payos_order_code: 1 });
adPaymentSchema.index({ status: 1 });

module.exports = mongoose.model("AdPayment", adPaymentSchema);
