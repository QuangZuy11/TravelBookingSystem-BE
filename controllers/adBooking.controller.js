const AdBooking = require("../models/AdBooking");
const Tour = require("../models/Tour");
// Lấy danh sách quảng cáo đang active 
exports.getActiveAds = async (req, res) => {
  try {
    const now = new Date();
    const ads = await AdBooking.find({
      status: "active",
      start_date: { $lte: now },
      end_date: { $gte: now },
    }).populate("tour_id");
    res.json(ads.map((ad) => ad.tour_id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
