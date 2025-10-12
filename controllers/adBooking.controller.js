const AdBooking = require("../models/adbooking.model");
const Tour = require("../models/tour.model");

// Lấy danh sách quảng cáo đang active
exports.getActiveAds = async (req, res) => {
  try {
    const now = new Date();
    const ads = await AdBooking.find({
      status: "active",
      start_date: { $lte: now },
      end_date: { $gte: now },
    }).populate("tour_id");

    const result = ads.map((ad) => ({
      _id: ad.tour_id._id,
      title: ad.tour_id.title,
      description: ad.tour_id.description,
      provider_id: ad.tour_id.provider_id,
      price: ad.tour_id.price,
      duration_hours: ad.tour_id.duration_hours,
      location: ad.tour_id.location,
      rating: ad.tour_id.rating,
      total_rating: ad.tour_id.total_rating,
      image: ad.tour_id.image,
      status: ad.status,
      created_at: ad.tour_id.created_at,
      updated_at: ad.tour_id.updated_at,
      included_services: ad.tour_id.included_services || [],
      images: ad.tour_id.images || [],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
