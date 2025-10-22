const AdBooking = require("../models/adbooking.model");
const Tour = require("../models/tour.model");

exports.getActiveAds = async (req, res) => {
  try {
    const now = new Date();

    const ads = await AdBooking.find({
      status: { $regex: /^active$/i },
      start_date: { $lte: now },
      end_date: { $gte: now },
    })
      .populate({
        path: "tour_id",
        select:
          "title highlights description provider_id price duration_hours location image rating total_rating included_services images created_at updated_at",
      })
      .sort({ start_date: -1 })
      .lean();

    const result = ads
      .filter((ad) => ad.tour_id)
      .map((ad) => ({
        _id: ad.tour_id._id,
        title: ad.tour_id.title,
        highlights: ad.tour_id.highlights || [],
        description: ad.tour_id.description || "",
        provider_id: ad.tour_id.provider_id,
        price: ad.tour_id.price,
        duration_hours: ad.tour_id.duration_hours,
        location: ad.tour_id.location,
        image: ad.tour_id.image,
        rating: ad.tour_id.rating,
        total_rating: ad.tour_id.total_rating,
        included_services: ad.tour_id.included_services || [],
        images: ad.tour_id.images || [],
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
