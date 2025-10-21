const Tour = require("../../models/tour.model.js");

// L?y toàn b? tour cho traveler (có h? tr? search, filter, sort)
const getAllToursForTraveler = async (req, res) => {
  try {
    const { search, destination, price, sortBy } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    if (destination && destination !== "all") {
      query.location = { $regex: destination, $options: "i" };
    }

    if (price && price !== "all") {
      const [min, max] = price.split("-").map(Number);
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        query.price = { $gte: min, $lte: max };
      }
    }

    let tours = await Tour.find(query);

    if (sortBy === "price-low") {
      tours = tours.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      tours = tours.sort((a, b) => b.price - a.price);
    } else if (sortBy === "rating") {
      tours = tours.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    }

    const formattedTours = tours.map((tour) => ({
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
    }));

    res.status(200).json({
      success: true,
      count: formattedTours.length,
      data: formattedTours,
    });
  } catch (error) {
    console.error("L?i khi l?y danh sách tour:", error);
    res.status(500).json({
      success: false,
      message: "L?i server khi l?y danh sách tour",
    });
  }
};

// L?y chi ti?t 1 tour theo id
const getTourById = async (req, res) => {
  try {
    const tour = await Tour.findById(req.params.id);
    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Không tìm th?y tour",
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
    console.error("L?i khi l?y chi ti?t tour:", error);
    res.status(500).json({
      success: false,
      message: "L?i server khi l?y chi ti?t tour",
    });
  }
};

module.exports = {
  getAllToursForTraveler,
  getTourById,
};
