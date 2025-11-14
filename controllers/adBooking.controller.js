const mongoose = require("mongoose");
const AdBooking = require("../models/adbooking.model");
const Tour = require("../models/tour.model");
const Hotel = require("../models/hotel.model");
const AdPayment = require("../models/ad-payment.model");
const adPaymentPayOSService = require("../services/ad-payment-payos.service");
const ServiceProvider = require("../models/service-provider.model");
const QRCode = require("qrcode");

/**
 * Helper function: Tính toán start_date và end_date cho ad booking
 * Logic: Tối đa 3 ads active PER TYPE (tour hoặc hotel), ad thứ 4 sẽ được schedule sau khi ad đầu tiên hết hạn
 * @param {String} adType - "tour" hoặc "hotel"
 */
const calculateAdSchedule = async (adType = "tour") => {
  const now = new Date();
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000; // 3 ngày

  // Lấy tất cả ad bookings active hoặc pending cho loại ad cụ thể
  const activeAds = await AdBooking.find({
    ad_type: adType, // Filter by ad type
    status: { $in: ["active", "pending"] },
    end_date: { $gte: now },
  })
    .sort({ start_date: 1 }) // Sắp xếp theo start_date tăng dần
    .lean();

  // Nếu có ít hơn 3 ads active, schedule ngay
  if (activeAds.length < 3) {
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate.getTime() + threeDaysInMs);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  // Nếu đã có 3 ads active, tìm ad sớm nhất sẽ hết hạn
  const earliestEndDate = activeAds[0].end_date;
  const startDate = new Date(earliestEndDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate.getTime() + threeDaysInMs);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
};

/**
 * Lấy danh sách ad active (tour và hotel, tối đa 3 mỗi loại)
 * Query parameter: ?type=tour hoặc ?type=hotel (mặc định trả về cả hai)
 */
exports.getActiveAds = async (req, res) => {
  try {
    const now = new Date();
    const { type } = req.query; // "tour", "hotel", or undefined (both)

    const filter = {
      status: "active",
      payment_status: "paid",
      start_date: { $lte: now },
      end_date: { $gte: now },
    };

    // Add type filter if specified
    if (type && ["tour", "hotel"].includes(type)) {
      filter.ad_type = type;
    }

    const ads = await AdBooking.find(filter)
      .populate({
        path: "tour_id",
        match: { status: "published" }, // ✅ Chỉ populate tour có status là 'published'
        select:
          "title highlights description provider_id price duration duration_hours location image rating total_rating included_services images created_at updated_at destination meeting_point capacity difficulty status",
      })
      .populate({
        path: "hotel_id",
        select:
          "name address city description amenities images rating reviews_count check_in_time check_out_time policies providerId created_at updated_at",
      })
      .sort({ start_date: 1 })
      .lean();

    // Separate tours and hotels
    // ✅ Lọc tour ads: chỉ lấy những ad có tour_id (đã được populate) và tour có status = 'published'
    const tourAds = ads
      .filter((ad) => {
        if (ad.ad_type !== "tour" || !ad.tour_id) return false;
        // ✅ Đảm bảo tour có status là 'published'
        return ad.tour_id.status === "published";
      })
      .slice(0, 3);
    const hotelAds = ads
      .filter((ad) => ad.ad_type === "hotel" && ad.hotel_id)
      .slice(0, 3);

    // Format tour ads
    const formattedTours = tourAds.map((ad) => ({
      _id: ad.tour_id._id,
      id: ad.tour_id._id,
      type: "tour",
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
      status: ad.tour_id.status || "draft", // ✅ Lấy status của tour, không phải status của ad
      created_at: ad.tour_id.created_at,
      updated_at: ad.tour_id.updated_at,
    }));

    // Format hotel ads
    const formattedHotels = hotelAds.map((ad) => ({
      _id: ad.hotel_id._id,
      id: ad.hotel_id._id,
      type: "hotel",
      name: ad.hotel_id.name,
      address: ad.hotel_id.address,
      city: ad.hotel_id.city,
      description: ad.hotel_id.description || "",
      amenities: ad.hotel_id.amenities || [],
      images: ad.hotel_id.images || [],
      rating: ad.hotel_id.rating || 0,
      reviews_count: ad.hotel_id.reviews_count || 0,
      check_in_time: ad.hotel_id.check_in_time || "14:00",
      check_out_time: ad.hotel_id.check_out_time || "12:00",
      policies: ad.hotel_id.policies || {},
      provider_id: ad.hotel_id.providerId,
      status: ad.status,
      created_at: ad.hotel_id.created_at,
      updated_at: ad.hotel_id.updated_at,
    }));

    // Return based on type filter
    if (type === "tour") {
      return res.status(200).json(formattedTours);
    }
    if (type === "hotel") {
      return res.status(200).json(formattedHotels);
    }

    // Return both if no type specified
    res.status(200).json({
      tours: formattedTours,
      hotels: formattedHotels,
    });
  } catch (err) {
    console.error("Lỗi khi lấy quảng cáo active:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Tạo ad booking với payment (hỗ trợ cả tour và hotel)
 * @route POST /api/ad-bookings/create
 * Body: { tour_id: "..." } hoặc { hotel_id: "..." }
 */
exports.createAdBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { tour_id, hotel_id } = req.body;
    const userId = req.user._id;
    const serviceProviderId =
      req.user?.service_provider_id || req.user?.serviceProviderId;

    console.log("=== Create Ad Booking ===");
    console.log("Tour ID:", tour_id);
    console.log("Hotel ID:", hotel_id);
    console.log("User ID (req.user._id):", userId);
    console.log(
      "Service Provider ID (req.user.service_provider_id):",
      serviceProviderId
    );

    // Validate input - phải có tour_id HOẶC hotel_id
    if (!tour_id && !hotel_id) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Thiếu tour_id hoặc hotel_id",
      });
    }

    if (tour_id && hotel_id) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Chỉ được cung cấp tour_id HOẶC hotel_id, không phải cả hai",
      });
    }

    const adType = tour_id ? "tour" : "hotel";
    const itemId = tour_id || hotel_id;
    let item, itemName, itemProviderIdStr;

    // Lấy thông tin tour hoặc hotel
    if (adType === "tour") {
      item = await Tour.findById(itemId).session(session);
      if (!item) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy tour",
        });
      }

      // ✅ Chỉ cho phép tạo ad cho tour có status là 'published'
      if (item.status !== "published") {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message:
            "Chỉ có thể tạo quảng cáo cho tour đã được xuất bản (published). Tour này hiện đang ở trạng thái: " +
            (item.status || "draft"),
        });
      }

      itemName = item.title;
      itemProviderIdStr = item.provider_id?.toString();
    } else {
      // hotel
      item = await Hotel.findById(itemId).session(session);
      if (!item) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy khách sạn",
        });
      }
      itemName = item.name;
      // Hotel model uses 'providerId' (camelCase)
      if (item.providerId) {
        itemProviderIdStr = item.providerId._id
          ? item.providerId._id.toString()
          : item.providerId.toString();
      } else if (item.provider_id) {
        itemProviderIdStr = item.provider_id._id
          ? item.provider_id._id.toString()
          : item.provider_id.toString();
      }
    }

    console.log(`${adType.toUpperCase()} found:`, itemName);
    console.log(`${adType} provider_id:`, itemProviderIdStr);

    const userIdStr = userId?.toString();
    const serviceProviderIdStr = serviceProviderId?.toString();

    if (!itemProviderIdStr) {
      await session.abortTransaction();
      console.error(`${adType} missing provider_id`);
      return res.status(500).json({
        success: false,
        message: `${
          adType === "tour" ? "Tour" : "Khách sạn"
        } không có provider_id`,
      });
    }

    // Kiểm tra authorization:
    // provider_id có thể là User ID hoặc ServiceProvider ID (tùy cách tạo item)
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

    // Check 1: item.provider_id === User ID
    if (userIdStr && itemProviderIdStr === userIdStr) {
      isAuthorized = true;
      console.log(`✅ Authorized: ${adType} provider_id matches User ID`);
    }
    // Check 2: item.provider_id === ServiceProvider ID (từ token hoặc database)
    else if (
      actualServiceProviderId &&
      itemProviderIdStr === actualServiceProviderId
    ) {
      isAuthorized = true;
      console.log(
        `✅ Authorized: ${adType} provider_id matches ServiceProvider ID`
      );
    }
    // Check 3: Thử convert item.provider_id sang ObjectId và so sánh lại
    else {
      try {
        const itemProviderObjectId = new mongoose.Types.ObjectId(
          itemProviderIdStr
        );
        if (userIdStr && itemProviderObjectId.toString() === userIdStr) {
          isAuthorized = true;
          console.log(
            `✅ Authorized: ${adType} provider_id (ObjectId) matches User ID`
          );
        } else if (actualServiceProviderId) {
          const serviceProviderObjectId = new mongoose.Types.ObjectId(
            actualServiceProviderId
          );
          if (
            itemProviderObjectId.toString() ===
            serviceProviderObjectId.toString()
          ) {
            isAuthorized = true;
            console.log(
              `✅ Authorized: ${adType} provider_id (ObjectId) matches ServiceProvider ID`
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
        itemProviderId: itemProviderIdStr,
        userId: userIdStr,
        serviceProviderId: serviceProviderIdStr,
        message: `${adType} does not belong to this provider`,
      });
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền quảng cáo ${
          adType === "tour" ? "tour" : "khách sạn"
        } này`,
      });
    }

    console.log(`✅ Authorization passed - ${adType} belongs to provider`);

    // Kiểm tra item đã có ad booking pending hoặc active chưa
    const filter = {
      status: { $in: ["pending", "active"] },
    };
    if (adType === "tour") {
      filter.tour_id = itemId;
    } else {
      filter.hotel_id = itemId;
    }

    const existingAd = await AdBooking.findOne(filter).session(session);

    if (existingAd) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `${
          adType === "tour" ? "Tour" : "Khách sạn"
        } này đã có quảng cáo đang chờ hoặc đang active`,
      });
    }

    // Tính toán schedule cho loại ad cụ thể
    const { startDate, endDate } = await calculateAdSchedule(adType);

    // Tạo ad booking với status pending
    // Lưu provider_id là User ID (req.user._id) để nhất quán với AdBooking model (ref: "User")
    const adPrice = 300000; // 300,000 VND
    const adBookingData = {
      ad_type: adType,
      provider_id: userId, // User ID từ req.user._id (AdBooking model ref: "User")
      start_date: startDate,
      end_date: endDate,
      status: "pending",
      price: adPrice,
      payment_status: "pending",
    };

    // Thêm tour_id hoặc hotel_id
    if (adType === "tour") {
      adBookingData.tour_id = itemId;
    } else {
      adBookingData.hotel_id = itemId;
    }

    const newAdBooking = new AdBooking(adBookingData);
    await newAdBooking.save({ session });

    // Tạo payment link
    const buyerInfo = {
      name:
        req.user.name || req.user.fullName || req.user.username || "Provider",
      email: req.user.email || "provider@example.com",
      phone: req.user.phone || req.user.phoneNumber || "",
    };

    const description = `Quang cao ${adType} ${itemName}`.substring(0, 25);

    const paymentLinkData = await adPaymentPayOSService.createAdPaymentLink({
      bookingId: newAdBooking._id.toString(),
      amount: adPrice,
      description: description,
      buyerInfo: buyerInfo,
    });

    // Tạo payment record với metadata phù hợp
    const paymentMetadata = {
      ad_type: adType,
    };
    if (adType === "tour") {
      paymentMetadata.tour_title = itemName;
      paymentMetadata.tour_id = itemId;
    } else {
      paymentMetadata.hotel_name = itemName;
      paymentMetadata.hotel_id = itemId;
    }

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
      metadata: paymentMetadata,
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
        ad_type: adType,
        item_name: itemName,
      },
      message: `Tạo quảng cáo ${
        adType === "tour" ? "tour" : "khách sạn"
      } thành công. Vui lòng thanh toán trong 2 phút.`,
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
