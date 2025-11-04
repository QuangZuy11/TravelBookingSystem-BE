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
  if (doc.booking_id && doc.status === "completed") {
    const TourBooking = mongoose.model("TourBooking");
    await TourBooking.findByIdAndUpdate(doc.booking_id, {
      "payment.status": "completed",
      "payment.paid_at": new Date(),
      "payment.transaction_id": doc.transaction_ref,
      status: "paid",
    });
  }
});

module.exports = mongoose.model(
  "TourPayment",
  tourPaymentSchema,
  "TOUR_PAYMENTS"
);
