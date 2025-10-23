const Tour = require("../../models/tour.model");
const Itinerary = require("../../models/itinerary.model");
// 🧭 Lấy toàn bộ tour cho traveler (có hỗ trợ search, filter, sort)
const getAllToursForTraveler = async (req, res) => {
  try {
    const { search, destination, price, sortBy } = req.query;
    let query = {};

    // 🔍 Tìm kiếm theo tên hoặc địa điểm
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    // 🎯 Lọc theo địa điểm
    if (destination && destination !== "all") {
      query.location = { $regex: destination, $options: "i" };
    }

    // 💰 Lọc theo khoảng giá (vd: 1000000-5000000)
    if (price && price !== "all") {
      const [min, max] = price.split("-").map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        query.price = { $gte: min, $lte: max };
      }
    }

    // 📦 Lấy dữ liệu từ MongoDB (bỏ populate itinerary)
    let tours = await Tour.find(query)
      .select(
        "title location duration_hours price rating total_rating image highlights description included_services provider_id created_at"
      )
      .lean();

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

    // 📊 Nhóm itineraries theo tour_id
    const itinerariesByTourId = allItineraries.reduce((acc, itinerary) => {
      const tourId = itinerary.tour_id.toString();
      if (!acc[tourId]) {
        acc[tourId] = [];
      }
      acc[tourId].push(itinerary);
      return acc;
    }, {});

    // 🧩 Chuẩn hóa dữ liệu trả về
    const formattedTours = tours.map((tour) => ({
      id: tour._id,
      title: tour.title,
      location: tour.location,
      duration: tour.duration_hours,
      price: tour.price,
      rating: parseFloat(tour.rating) || 0,
      total_rating: parseInt(tour.total_rating) || 0,
      image: tour.image,
      highlights: tour.highlights,
      description: tour.description,
      included_services: tour.included_services,
      provider_id: tour.provider_id,
      created_at: tour.created_at,
      itineraries: itinerariesByTourId[tour._id.toString()] || [], // ✅ Thêm itineraries
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
    const tour = await Tour.findById(req.params.id).lean();

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tour",
      });
    }

    // 🔍 Lấy itineraries riêng biệt vì mối quan hệ ngược
    const itineraries = await Itinerary.find({ tour_id: req.params.id })
      .sort({ day: 1 })
      .lean();

    const formattedTour = {
      id: tour._id,
      title: tour.title,
      location: tour.location,
      duration: tour.duration_hours,
      price: tour.price,
      rating: parseFloat(tour.rating) || 0,
      total_rating: parseInt(tour.total_rating) || 0,
      image: tour.image,
      highlights: tour.highlights,
      description: tour.description,
      included_services: tour.included_services,
      provider_id: tour.provider_id,
      created_at: tour.created_at,
      itineraries: itineraries || [], // ✅ Lấy từ query riêng biệt
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
