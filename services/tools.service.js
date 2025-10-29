const Tour = require('../models/tour.model');
const Hotel = require('../models/hotel.model');

const { searchExternalTours } = require('./external-tours.provider');

const buildRegex = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function findInternalTours(filters, limit = 10) {
  const tours = await Tour.find(filters).limit(limit).lean();
  return tours.map((t) => ({
    id: String(t._id),
    name: t.name,
    price: t.price ?? t.basePrice ?? t.total_price ?? null,
    location: t.location ?? t.city ?? t.destination ?? null,
    type: 'tour',
    source: 'internal',
  }));
}

exports.searchTours = async (args = {}) => {
  const { location, query, maxPrice } = args;
  const filters = {};
  const or = [];

  if (location) {
    const rx = buildRegex(location);
    or.push({ location: rx }, { destination: rx }, { city: rx }, { name: rx });
  }
  if (query) {
    const rxq = buildRegex(query);
    or.push({ name: rxq }, { description: rxq });
  }
  if (or.length) filters.$or = or;

  if (maxPrice) {
    // chấp nhận nhiều schema giá khác nhau
    const priceCond = { $lte: Number(maxPrice) };
    filters.$and = [
      { $or: [{ price: priceCond }, { basePrice: priceCond }, { total_price: priceCond }] },
    ];
  }

  const timeoutMs = Number(process.env.CHAT_PRIMARY_SEARCH_TIMEOUT_MS || 1500);

  // 1) Thử nguồn nội bộ với timeout
  let internalItems = [];
  try {
    internalItems = await Promise.race([
      findInternalTours(filters, 10),
      (async () => {
        await delay(timeoutMs);
        return 'TIMEOUT';
      })(),
    ]);
  } catch (e) {
    internalItems = [];
  }

  if (Array.isArray(internalItems) && internalItems.length) {
    return { items: internalItems };
  }

  // 2) Hết thời gian hoặc không có -> fallback nguồn ngoài (TripAdvisor16)
  const external = await searchExternalTours({ location, query });
  const items = (external || []).map((x) => ({ ...x, source: x.source || 'external' }));
  return { items };
};

exports.searchHotels = async (args = {}) => {
  const { location, maxPrice } = args;
  const filters = {};
  const or = [];

  if (location) {
    const rx = buildRegex(location);
    or.push({ city: rx }, { location: rx }, { name: rx }, { address: rx });
  }
  if (or.length) filters.$or = or;

  const hotels = await Hotel.find(filters).limit(10).lean();
  const items = hotels
    .map((h) => ({
      id: String(h._id),
      name: h.name,
      city: h.city ?? h.location ?? null,
      minPrice: h.minPrice ?? null,
      type: 'hotel',
      source: 'internal',
    }))
    .filter((h) => !maxPrice || !h.minPrice || h.minPrice <= Number(maxPrice));

  return { items };
};