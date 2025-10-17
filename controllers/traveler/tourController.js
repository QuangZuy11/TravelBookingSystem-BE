const Tour = require("../../models/tour.model.js");

// 🧭 Lấy toàn bộ tour cho traveler (có hỗ trợ search, filter, sort)
const getAllToursForTraveler = async (req, res) => {
  try {
    const { search, destination, price, sortBy } = req.query;

    let query = {};

    // 🔍 Tìm kiếm theo tên tour hoặc địa điểm
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    // 🎯 Lọc theo điểm đến
    if (destination && destination !== "all") {
      query.location = { $regex: destination, $options: "i" };
    }

    // 💰 Lọc theo khoảng giá
    if (price && price !== "all") {
      const [min, max] = price.split("-").map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        query.price = { $gte: min, $lte: max };
      }
    }

    // 🧾 Truy vấn từ Mongo
    let tours = await Tour.find(query);

    // 🔽 Sắp xếp theo yêu cầu
    if (sortBy === "price-low") {
      tours = tours.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      tours = tours.sort((a, b) => b.price - a.price);
    } else if (sortBy === "rating") {
      tours = tours.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    }

    // 🧩 Format lại dữ liệu để frontend dễ hiển thị
    const formattedTours = tours.map((tour) => ({
      id: tour._id,
      name: tour.title,
      destination: tour.location,
      duration: tour.duration_hours,
      price: tour.price,
      rating: parseFloat(tour.rating),
      reviews: parseInt(tour.total_rating),
      image: tour.image,
      highlights: tour.description, // description là mảng => dùng luôn làm highlights
      type: tour.price === 0 ? "free" : "package",
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

// 🧭 Lấy chi tiết 1 tour theo id
const getTourById = async (req, res) => {
  try {
    const tour = await Tour.findById(req.params.id);
    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tour",
      });
    }

    const formattedTour = {
      id: tour._id,
      name: tour.title,
      destination: tour.location,
      duration: tour.duration_hours,
      price: tour.price,
      rating: parseFloat(tour.rating),
      reviews: parseInt(tour.total_rating),
      image: tour.image,
      highlights: tour.description,
      type: tour.price === 0 ? "free" : "package",
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
