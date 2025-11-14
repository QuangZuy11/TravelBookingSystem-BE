const mongoose = require("mongoose");
const Tour = require("../../models/tour.model");
const Itinerary = require("../../models/itinerary.model");
const Feedback = require("../../models/feedback.model");
const Promotion = require("../../models/promotion.model");

// 🎁 Helper function: Tính giá sau discount và lấy active promotion
const calculatePriceWithPromotion = (originalPrice, promotions) => {
  if (!promotions || promotions.length === 0) {
    return {
      originalPrice,
      finalPrice: originalPrice,
      discount: 0,
      promotion: null,
    };
  }

  const now = new Date();

  // Tìm promotion active (status = 'active' và trong khoảng thời gian)
  const activePromotion = promotions.find((promo) => {
    if (!promo) return false;
    const startDate = new Date(promo.startDate);
    const endDate = new Date(promo.endDate);
    return promo.status === "active" && now >= startDate && now <= endDate;
  });

  if (!activePromotion) {
    return {
      originalPrice,
      finalPrice: originalPrice,
      discount: 0,
      promotion: null,
    };
  }

  let finalPrice = originalPrice;
  let discount = 0;

  if (activePromotion.discountType === "percent") {
    discount = (originalPrice * activePromotion.discountValue) / 100;
    finalPrice = Math.max(0, originalPrice - discount);
  } else if (activePromotion.discountType === "amount") {
    discount = activePromotion.discountValue;
    finalPrice = Math.max(0, originalPrice - discount);
  }

  return {
    originalPrice,
    finalPrice: Math.round(finalPrice),
    discount: Math.round(discount),
    promotion: {
      id: activePromotion._id,
      name: activePromotion.name,
      code: activePromotion.code,
      discountType: activePromotion.discountType,
      discountValue: activePromotion.discountValue,
    },
  };
};

// 🧭 Lấy toàn bộ tour cho traveler (có hỗ trợ search, filter, sort)
const getAllToursForTraveler = async (req, res) => {
  try {
    const { search, destination, price, sortBy } = req.query;
    let query = {};

    // ✅ Chỉ lấy tour có status là 'published' cho traveler
    query.status = "published";

    // 🔍 Tìm kiếm theo tên tour
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // 🎯 Lọc theo điểm đến (destination string)
    if (destination && destination !== "all") {
      query.destination = destination;
    }

    // 💰 Lọc theo khoảng giá (vd: 1000000-5000000)
    if (price && price !== "all") {
      const [min, max] = price.split("-").map(Number);
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        query.price = { $gte: min, $lte: max };
      }
    }

    // 🧾 Truy vấn từ Mongo (destination is a string, no populate needed)
    // ✅ Debug: Log query để kiểm tra
    console.log("🔍 Tour query:", JSON.stringify(query, null, 2));
    let tours = await Tour.find(query).lean();
    console.log(`✅ Found ${tours.length} tours with status='published'`);

    // ✅ Filter thêm một lần nữa để đảm bảo (defensive programming)
    tours = tours.filter((tour) => tour.status === "published");
    console.log(`✅ After filtering: ${tours.length} tours`);

    // 🔽 Sắp xếp
    if (sortBy === "price-low") {
      tours = tours.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      tours = tours.sort((a, b) => b.price - a.price);
    } else if (sortBy === "rating") {
      tours = tours.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    } else if (sortBy === "newest") {
      tours = tours.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
    }

    // 🗺️ Lấy itineraries cho tất cả tours (UNIFIED ARCHITECTURE)
    const tourIds = tours.map((tour) => tour._id);
    const allItineraries = await Itinerary.find({
      origin_id: { $in: tourIds },
      type: "tour",
    })
      .sort({ origin_id: 1, day_number: 1 })
      .lean();

    // 🗣️ Lấy feedbacks cho tất cả tours
    const allFeedbacks = await Feedback.find({ tour_id: { $in: tourIds } })
      .populate("user_id", "name")
      .lean();

    // 🎁 Lấy promotions cho tất cả tours
    const allPromotions = await Promotion.find({
      targetType: "tour",
      targetId: { $in: tourIds },
    }).lean();

    // 📊 Nhóm itineraries, feedbacks và promotions theo tour_id
    const itinerariesByTourId = {};
    const feedbacksByTourId = {};
    const promotionsByTourId = {};

    allItineraries.forEach((it) => {
      const id = it.origin_id.toString(); // Use origin_id instead of tour_id
      if (!itinerariesByTourId[id]) itinerariesByTourId[id] = [];
      itinerariesByTourId[id].push(it);
    });

    allFeedbacks.forEach((fb) => {
      const id = fb.tour_id.toString();
      if (!feedbacksByTourId[id]) feedbacksByTourId[id] = [];
      feedbacksByTourId[id].push(fb);
    });

    allPromotions.forEach((promo) => {
      const id = promo.targetId.toString();
      if (!promotionsByTourId[id]) promotionsByTourId[id] = [];
      promotionsByTourId[id].push(promo);
    });

    // 🧩 Chuẩn hóa dữ liệu trả về với MORE INFORMATION
    const formattedTours = tours.map((tour) => {
      const tourIdStr = tour._id.toString();
      const promotions = promotionsByTourId[tourIdStr] || [];
      const priceInfo = calculatePriceWithPromotion(tour.price, promotions);

      return {
        id: tour._id,
        name: tour.title,
        destination: tour.destination_id
          ? {
              id: tour.destination_id._id,
              name: tour.destination_id.name,
            }
          : null,
        duration: tour.duration,

        // ✅ Price & Rating Info
        price: priceInfo.finalPrice,
        originalPrice: priceInfo.originalPrice,
        discount: priceInfo.discount,
        promotion: priceInfo.promotion,
        rating: parseFloat(tour.rating) || 0,
        total_rating: parseInt(tour.total_rating) || 0,

        // ✅ Media & Description
        image: tour.image,
        highlights: tour.highlights,
        description: tour.description,
        included_services: tour.included_services,

        // ✅ NEW Advanced Fields
        difficulty: tour.difficulty || "easy",
        meeting_point: tour.meeting_point || {
          address: null,
          instructions: null,
        },
        capacity: tour.capacity || {
          max_participants: null,
          min_participants: null,
        },
        available_dates: tour.available_dates || [],
        status: tour.status || "draft",

        // ✅ Meta Info
        provider_id: tour.provider_id,
        created_at: tour.created_at,

        // Advanced tour fields
        difficulty: tour.difficulty,
        meeting_point: tour.meeting_point,
        capacity: tour.capacity,

        available_dates: tour.available_dates,
        status: tour.status,
        itineraries: itinerariesByTourId[tour._id.toString()] || [],
        feedbacks: (feedbacksByTourId[tour._id.toString()] || []).map((fb) => ({
          id: fb._id,
          user: fb.user_id ? fb.user_id.name : "Người dùng ẩn danh",
          comment: fb.comment,
          rating: fb.rating,
          created_at: fb.created_at,
        })),
      };
    });

    res.status(200).json({
      success: true,
      count: formattedTours.length,
      data: formattedTours,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách tour:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách tour",
    });
  }
};

// 🧭 Lấy chi tiết 1 tour theo ID
const getTourById = async (req, res) => {
  try {
    // Chỉ lấy tour có status là 'published' cho traveler
    const tour = await Tour.findOne({
      _id: req.params.id,
      status: "published",
    });
    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tour hoặc tour chưa được xuất bản",
      });
    }

    // 🔍 Chuyển đổi ID sang ObjectId cho itineraries
    const tourObjectId = new mongoose.Types.ObjectId(req.params.id);

    // 🔍 Lấy itineraries với UNIFIED ARCHITECTURE (origin_id + type)
    const itineraries = await Itinerary.find({
      origin_id: tourObjectId,
      type: "tour",
    })
      .sort({ day_number: 1 })
      .lean();

    // 🎁 Lấy promotions cho tour này
    const promotions = await Promotion.find({
      targetType: "tour",
      targetId: req.params.id,
    }).lean();

    // 🔍 Lấy feedbacks riêng biệt - Query trực tiếp từ collection FEEDBACKS
    let feedbacks = [];
    const tourIdString = req.params.id;

    try {
      const db = mongoose.connection.db;
      const collection = db.collection("FEEDBACKS");

      // Query trực tiếp từ collection với tour_id là string
      let rawFeedbacks = await collection
        .find({ tour_id: tourIdString })
        .toArray();

      // Nếu không tìm thấy, thử với ObjectId
      if (rawFeedbacks.length === 0) {
        rawFeedbacks = await collection
          .find({ tour_id: tourObjectId })
          .toArray();
      }

      // Nếu vẫn không tìm thấy, thử query tất cả để xem cấu trúc
      if (rawFeedbacks.length === 0) {
        const allFeedbacks = await collection.find({}).limit(5).toArray();
        if (allFeedbacks.length > 0) {
        }
      }

      // Xử lý rawFeedbacks và populate user_id thủ công
      if (rawFeedbacks.length > 0) {
        const User = require("../../models/user.model");

        // Populate user_id thủ công
        const userIds = rawFeedbacks.map((fb) => fb.user_id).filter((id) => id);

        const users = await User.find({ _id: { $in: userIds } })
          .select("name email")
          .lean();

        const usersMap = {};
        users.forEach((user) => {
          usersMap[user._id.toString()] = user;
        });

        // Format feedbacks - đảm bảo user_id là string hoặc ObjectId
        feedbacks = rawFeedbacks.map((fb) => ({
          _id: fb._id,
          id: fb._id,
          user_id: fb.user_id
            ? fb.user_id.toString
              ? fb.user_id.toString()
              : fb.user_id
            : null,
          tour_id: fb.tour_id,
          comment: fb.comment,
          rating: fb.rating,
          created_at: fb.created_at || fb.createdAt,
          user_id_populated: usersMap[fb.user_id?.toString()] || null,
        }));

        // Sort theo created_at giảm dần
        feedbacks.sort((a, b) => {
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        });
      }
    } catch (error) {
      console.error("❌ Lỗi khi lấy feedbacks:", error);
      feedbacks = []; // Đảm bảo feedbacks là array rỗng nếu có lỗi
    }

    // Tính giá với promotion
    const priceInfo = calculatePriceWithPromotion(tour.price, promotions);

    const formattedTour = {
      id: tour._id,
      name: tour.title,
      destination: tour.destination_id
        ? {
            id: tour.destination_id._id,
            name: tour.destination_id.name,
          }
        : null,
      duration: tour.duration,

      // ✅ Price & Rating Info
      price: priceInfo.finalPrice,
      originalPrice: priceInfo.originalPrice,
      discount: priceInfo.discount,
      promotion: priceInfo.promotion,
      rating: parseFloat(tour.rating) || 0,
      total_rating: parseInt(tour.total_rating) || 0,

      // ✅ Media & Description
      image: tour.image,
      highlights: tour.highlights,
      description: tour.description,
      included_services: tour.included_services,

      // ✅ NEW Advanced Fields from updated tour model
      difficulty: tour.difficulty || "easy",
      meeting_point: tour.meeting_point || {
        address: null,
        instructions: null,
      },
      capacity: tour.capacity || {
        max_participants: null,
        min_participants: null,
      },
      available_dates: tour.available_dates || [],
      status: tour.status || "draft",

      // ✅ Meta Info
      provider_id: tour.provider_id,
      created_at: tour.created_at,

      // ✅ Related Data (với unified format)
      itineraries:
        itineraries?.map((itinerary) => {
          // Use unified response formatting for consistency
          const formatted = Itinerary.formatResponse
            ? Itinerary.formatResponse(itinerary)
            : itinerary;
          return {
            ...formatted,
            // Legacy compatibility
            day: formatted.day_number || itinerary.day_number,
            tour_id: itinerary.origin_id,
          };
        }) || [],
      feedbacks: feedbacks.map((fb) => ({
        id: fb._id || fb.id,
        user_id: fb.user_id
          ? typeof fb.user_id === "object" && fb.user_id.toString
            ? fb.user_id.toString()
            : fb.user_id
          : fb.user_id_populated?._id
          ? typeof fb.user_id_populated._id === "object"
            ? fb.user_id_populated._id.toString()
            : fb.user_id_populated._id
          : null,
        user: fb.user_id_populated
          ? fb.user_id_populated.name
          : "Người dùng ẩn danh",
        comment: fb.comment,
        rating: fb.rating,
        created_at: fb.created_at || fb.createdAt,
      })),
    };

    res.status(200).json({
      success: true,
      data: formattedTour,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy chi tiết tour:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy chi tiết tour",
    });
  }
};

module.exports = {
  getAllToursForTraveler,
  getTourById,
};
