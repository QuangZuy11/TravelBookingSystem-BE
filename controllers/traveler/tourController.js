const mongoose = require("mongoose");
const Tour = require("../../models/tour.model");
const Itinerary = require("../../models/itinerary.model");
const Feedback = require("../../models/feedback.model");

// 🧭 Lấy toàn bộ tour cho traveler (có hỗ trợ search, filter, sort)
const getAllToursForTraveler = async (req, res) => {
  try {
    const { search, destination, price, sortBy } = req.query;
    let query = {};

    // 🔍 Tìm kiếm theo tên tour
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // 🎯 Lọc theo điểm đến (destination_id)
    if (destination && destination !== "all") {
      query.destination_id = destination;
    }

    // 💰 Lọc theo khoảng giá (vd: 1000000-5000000)
    if (price && price !== "all") {
      const [min, max] = price.split("-").map(Number);
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        query.price = { $gte: min, $lte: max };
      }
    }

    // 🧾 Truy vấn từ Mongo với populate destination
    let tours = await Tour.find(query).populate("destination_id", "name");

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

    // 🗺️ Lấy itineraries cho tất cả tours
    const tourIds = tours.map((tour) => tour._id);
    const allItineraries = await Itinerary.find({
      tour_id: { $in: tourIds },
    })
      .sort({ tour_id: 1, day: 1 })
      .lean();

    // 🗣️ Lấy feedbacks cho tất cả tours
    const allFeedbacks = await Feedback.find({ tour_id: { $in: tourIds } })
      .populate("user_id", "name")
      .lean();

    // 📊 Nhóm itineraries và feedbacks theo tour_id
    const itinerariesByTourId = {};
    const feedbacksByTourId = {};

    allItineraries.forEach((it) => {
      const id = it.tour_id.toString();
      if (!itinerariesByTourId[id]) itinerariesByTourId[id] = [];
      itinerariesByTourId[id].push(it);
    });

    allFeedbacks.forEach((fb) => {
      const id = fb.tour_id.toString();
      if (!feedbacksByTourId[id]) feedbacksByTourId[id] = [];
      feedbacksByTourId[id].push(fb);
    });

    // 🧩 Chuẩn hóa dữ liệu trả về
    const formattedTours = tours.map((tour) => ({
      id: tour._id,
      name: tour.title,
      destination: tour.destination_id
        ? {
            id: tour.destination_id._id,
            name: tour.destination_id.name,
          }
        : null,
      duration: tour.duration || tour.duration_hours,
      price: tour.price,
      rating: parseFloat(tour.rating) || 0,
      total_rating: parseInt(tour.total_rating) || 0,
      image: tour.image,
      highlights: tour.highlights,
      description: tour.description,
      included_services: tour.included_services,
      provider_id: tour.provider_id,
      created_at: tour.created_at,
      itineraries: itinerariesByTourId[tour._id.toString()] || [],
      feedbacks:
        (feedbacksByTourId[tour._id.toString()] || []).map((fb) => ({
          id: fb._id,
          user: fb.user_id ? fb.user_id.name : "Người dùng ẩn danh",
          comment: fb.comment,
          rating: fb.rating,
          created_at: fb.created_at,
        })) || [],
    }));

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
    const tour = await Tour.findById(req.params.id).populate(
      "destination_id",
      "name"
    );
    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tour",
      });
    }

    // 🔍 Chuyển đổi ID sang ObjectId cho itineraries
    const tourObjectId = new mongoose.Types.ObjectId(req.params.id);

    // 🔍 Lấy itineraries riêng biệt
    const itineraries = await Itinerary.find({ tour_id: tourObjectId })
      .sort({ day: 1 })
      .lean();

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

      console.log(
        `🔍 Query FEEDBACKS with string "${tourIdString}" - Found:`,
        rawFeedbacks.length
      );

      // Nếu không tìm thấy, thử với ObjectId
      if (rawFeedbacks.length === 0) {
        rawFeedbacks = await collection
          .find({ tour_id: tourObjectId })
          .toArray();
        console.log(
          `🔍 Query FEEDBACKS with ObjectId - Found:`,
          rawFeedbacks.length
        );
      }

      // Nếu vẫn không tìm thấy, thử query tất cả để xem cấu trúc
      if (rawFeedbacks.length === 0) {
        const allFeedbacks = await collection.find({}).limit(5).toArray();
        console.log("🔍 Sample feedbacks in FEEDBACKS:", allFeedbacks.length);
        if (allFeedbacks.length > 0) {
          console.log(
            "🔍 Sample feedback structure:",
            JSON.stringify(allFeedbacks[0], null, 2)
          );
          console.log("🔍 Sample tour_id:", allFeedbacks[0].tour_id);
          console.log(
            "🔍 Sample tour_id type:",
            typeof allFeedbacks[0].tour_id
          );
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

    const formattedTour = {
      id: tour._id,
      name: tour.title,
      destination: tour.destination_id
        ? {
            id: tour.destination_id._id,
            name: tour.destination_id.name,
          }
        : null,
      duration: tour.duration || tour.duration_hours,
      price: tour.price,
      rating: parseFloat(tour.rating) || 0,
      total_rating: parseInt(tour.total_rating) || 0,
      image: tour.image,
      highlights: tour.highlights,
      description: tour.description,
      included_services: tour.included_services,
      provider_id: tour.provider_id,
      created_at: tour.created_at,
      itineraries: itineraries || [],
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
