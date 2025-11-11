const mongoose = require("mongoose");
const AdBooking = require("../models/adbooking.model");
const Tour = require("../models/tour.model");
const AdPayment = require("../models/ad-payment.model");
const adPaymentPayOSService = require("../services/ad-payment-payos.service");
const ServiceProvider = require("../models/service-provider.model");
const QRCode = require("qrcode");

/**
 * Helper function: Tính toán start_date và end_date cho ad booking
 * Logic: Tối đa 3 tour active, tour thứ 4 sẽ được schedule sau khi tour đầu tiên hết hạn
 */
const calculateAdSchedule = async () => {
  const now = new Date();
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000; // 3 ngày

  // Lấy tất cả ad bookings active hoặc pending
  const activeAds = await AdBooking.find({
    status: { $in: ["active", "pending"] },
    end_date: { $gte: now },
  })
    .sort({ start_date: 1 }) // Sắp xếp theo start_date tăng dần
    .lean();

  // Nếu có ít hơn 3 tour active, schedule ngay
  if (activeAds.length < 3) {
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate.getTime() + threeDaysInMs);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  // Nếu đã có 3 tour active, tìm tour sớm nhất sẽ hết hạn
  const earliestEndDate = activeAds[0].end_date;
  const startDate = new Date(earliestEndDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate.getTime() + threeDaysInMs);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
};

/**
 * Lấy danh sách ad active (chỉ trả về tối đa 3 tour)
 */
exports.getActiveAds = async (req, res) => {
  try {
    const now = new Date();

    const ads = await AdBooking.find({
      status: "active",
      payment_status: "paid",
      start_date: { $lte: now },
      end_date: { $gte: now },
    })
      .populate({
        path: "tour_id",
        select:
          "title highlights description provider_id price duration duration_hours location image rating total_rating included_services images created_at updated_at destination meeting_point capacity difficulty",
      })
      .sort({ start_date: 1 }) // Sắp xếp theo start_date tăng dần
      .limit(3) // Chỉ lấy 3 tour đầu tiên
      .lean();

    const result = ads
      .filter((ad) => ad.tour_id)
      .map((ad) => ({
        _id: ad.tour_id._id,
        id: ad.tour_id._id,
        title: ad.tour_id.title,
        name: ad.tour_id.title,
        highlights: ad.tour_id.highlights || [],
        description: ad.tour_id.description || "",
        provider_id: ad.tour_id.provider_id,
        price: ad.tour_id.price,
        duration: ad.tour_id.duration || ad.tour_id.duration_hours,
        duration_hours: ad.tour_id.duration_hours,
        location: ad.tour_id.location || ad.tour_id.destination,
        image: ad.tour_id.image,
        rating: ad.tour_id.rating || 0,
        total_rating: ad.tour_id.total_rating || 0,
        included_services: ad.tour_id.included_services || [],
        images: ad.tour_id.images || [],
        meeting_point: ad.tour_id.meeting_point || null,
        capacity: ad.tour_id.capacity || null,
        difficulty: ad.tour_id.difficulty || "easy",
        status: ad.status,
        created_at: ad.tour_id.created_at,
        updated_at: ad.tour_id.updated_at,
      }));

    res.status(200).json(result);
  } catch (err) {
    console.error("Lỗi khi lấy quảng cáo active:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Tạo ad booking với payment
 * @route POST /api/ad-bookings/create
 */
exports.createAdBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { tour_id } = req.body;
    const userId = req.user._id;
    const serviceProviderId =
      req.user?.service_provider_id || req.user?.serviceProviderId;

    console.log("=== Create Ad Booking ===");
    console.log("Tour ID:", tour_id);
    console.log("User ID (req.user._id):", userId);
    console.log(
      "Service Provider ID (req.user.service_provider_id):",
      serviceProviderId
    );
    console.log("req.user keys:", Object.keys(req.user));
    console.log("req.user full:", JSON.stringify(req.user, null, 2));

    // Validate input
    if (!tour_id) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Thiếu tour_id",
      });
    }

    // Kiểm tra tour có tồn tại không và thuộc về provider này
    const tour = await Tour.findById(tour_id).session(session);
    if (!tour) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tour",
      });
    }

    console.log("Tour found:");
    console.log("Tour provider_id:", tour.provider_id);
    console.log("Tour provider_id type:", typeof tour.provider_id);
    console.log("Tour provider_id toString():", tour.provider_id?.toString());

    // Kiểm tra tour có thuộc về provider này không
    // Tour.provider_id có thể là User ID hoặc ServiceProvider ID
    const tourProviderIdStr = tour.provider_id?.toString();
    const userIdStr = userId?.toString();
    const serviceProviderIdStr = serviceProviderId?.toString();

    if (!tourProviderIdStr) {
      await session.abortTransaction();
      console.error("Tour missing provider_id");
      return res.status(500).json({
        success: false,
        message: "Tour không có provider_id",
      });
    }

    // Kiểm tra authorization:
    // Tour.provider_id có thể là User ID hoặc ServiceProvider ID (tùy cách tạo tour)
    // Cần kiểm tra cả hai trường hợp
    let isAuthorized = false;

    // Trước tiên, tìm ServiceProvider từ User ID (nếu chưa có từ token)
    let actualServiceProviderId = serviceProviderIdStr;
    if (!actualServiceProviderId && userIdStr) {
      try {
        const serviceProvider = await ServiceProvider.findOne({
          user_id: userIdStr,
        }).session(session);
        if (serviceProvider) {
          actualServiceProviderId = serviceProvider._id?.toString();
          console.log(
            "ServiceProvider found from User ID:",
            actualServiceProviderId
          );
        }
      } catch (spError) {
        console.error("Error finding ServiceProvider:", spError);
      }
    }

    // Check 1: Tour.provider_id === User ID
    if (userIdStr && tourProviderIdStr === userIdStr) {
      isAuthorized = true;
      console.log("✅ Authorized: Tour provider_id matches User ID");
    }
    // Check 2: Tour.provider_id === ServiceProvider ID (từ token hoặc database)
    else if (
      actualServiceProviderId &&
      tourProviderIdStr === actualServiceProviderId
    ) {
      isAuthorized = true;
      console.log("✅ Authorized: Tour provider_id matches ServiceProvider ID");
    }
    // Check 3: Thử convert tour.provider_id sang ObjectId và so sánh lại (trường hợp ObjectId vs string)
    else {
      try {
        const tourProviderObjectId = new mongoose.Types.ObjectId(
          tourProviderIdStr
        );
        if (userIdStr && tourProviderObjectId.toString() === userIdStr) {
          isAuthorized = true;
          console.log(
            "✅ Authorized: Tour provider_id (ObjectId) matches User ID"
          );
        } else if (actualServiceProviderId) {
          const serviceProviderObjectId = new mongoose.Types.ObjectId(
            actualServiceProviderId
          );
          if (
            tourProviderObjectId.toString() ===
            serviceProviderObjectId.toString()
          ) {
            isAuthorized = true;
            console.log(
              "✅ Authorized: Tour provider_id (ObjectId) matches ServiceProvider ID"
            );
          }
        }
      } catch (oidError) {
        console.error("Error converting to ObjectId:", oidError);
      }
    }

    if (!isAuthorized) {
      await session.abortTransaction();
      console.error("❌ Provider ID mismatch:", {
        tourProviderId: tourProviderIdStr,
        userId: userIdStr,
        serviceProviderId: serviceProviderIdStr,
        message: "Tour does not belong to this provider",
      });
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền quảng cáo tour này",
      });
    }

    console.log("✅ Authorization passed - Tour belongs to provider");

    // Kiểm tra tour đã có ad booking pending hoặc active chưa
    const existingAd = await AdBooking.findOne({
      tour_id: tour_id,
      status: { $in: ["pending", "active"] },
    }).session(session);

    if (existingAd) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Tour này đã có quảng cáo đang chờ hoặc đang active",
      });
    }

    // Tính toán schedule
    const { startDate, endDate } = await calculateAdSchedule();

    // Tạo ad booking với status pending
    // Lưu provider_id là User ID (req.user._id) để nhất quán với AdBooking model (ref: "User")
    const adPrice = 300000; // 300,000 VND
    const newAdBooking = new AdBooking({
      tour_id: tour_id,
      provider_id: userId, // User ID từ req.user._id (AdBooking model ref: "User")
      start_date: startDate,
      end_date: endDate,
      status: "pending",
      price: adPrice,
      payment_status: "pending",
    });

    await newAdBooking.save({ session });

    // Tạo payment link
    const buyerInfo = {
      name:
        req.user.name || req.user.fullName || req.user.username || "Provider",
      email: req.user.email || "provider@example.com",
      phone: req.user.phone || req.user.phoneNumber || "",
    };

    const description = `Quang cao tour ${tour.title}`.substring(0, 25);

    const paymentLinkData = await adPaymentPayOSService.createAdPaymentLink({
      bookingId: newAdBooking._id.toString(),
      amount: adPrice,
      description: description,
      buyerInfo: buyerInfo,
    });

    // Tạo payment record
    const newPayment = new AdPayment({
      ad_booking_id: newAdBooking._id,
      user_id: userId, // User ID của provider tạo ad booking
      payos_order_code: paymentLinkData.orderCode,
      payos_payment_link_id: paymentLinkData.paymentLinkId,
      amount: adPrice,
      currency: "VND",
      method: "qr_code",
      description: description,
      checkout_url: paymentLinkData.checkoutUrl,
      qr_code: paymentLinkData.qrCode,
      status: "pending",
      expired_at: paymentLinkData.expiredAt,
      payment_gateway: "payos",
      metadata: {
        tour_title: tour.title,
        tour_id: tour._id,
      },
    });

    await newPayment.save({ session });

    // Cập nhật ad booking với payment_id
    newAdBooking.payment_id = newPayment._id;
    await newAdBooking.save({ session });

    await session.commitTransaction();

    // Convert QR string thành base64 image
    let qrCodeBase64 = null;
    try {
      qrCodeBase64 = await QRCode.toDataURL(paymentLinkData.qrCode);
    } catch (qrError) {
      console.error("Error generating QR code:", qrError);
    }

    res.status(201).json({
      success: true,
      data: {
        adBookingId: newAdBooking._id,
        paymentId: newPayment._id,
        payment: {
          payment_id: newPayment._id,
          qr_code_base64: qrCodeBase64,
          qr_code: paymentLinkData.qrCode,
          checkout_url: paymentLinkData.checkoutUrl,
          amount: adPrice,
          expired_at: paymentLinkData.expiredAt,
          order_code: paymentLinkData.orderCode,
        },
        schedule: {
          start_date: startDate,
          end_date: endDate,
        },
      },
      message: "Tạo quảng cáo thành công. Vui lòng thanh toán trong 2 phút.",
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Create Ad Booking Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi tạo quảng cáo",
    });
  } finally {
    session.endSession();
  }
};
