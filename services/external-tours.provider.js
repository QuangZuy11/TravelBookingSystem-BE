const RAPIDAPI_HOST = 'tripadvisor16.p.rapidapi.com';

async function httpGet(url) {
  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': RAPIDAPI_HOST,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
  return res.json();
}

async function searchLocation(query) {
  if (!query) return null;
  const url = `https://${RAPIDAPI_HOST}/api/v1/attractions/searchLocation?query=${encodeURIComponent(query)}`;
  const data = await httpGet(url);
  const item = Array.isArray(data?.data) ? data.data[0] : null;
  if (!item?.latitude || !item?.longitude) return null;
  return { lat: item.latitude, lng: item.longitude, name: item.name || query };
}

async function searchAttractionsByLatLng({ lat, lng, radiusKm = 25 }) {
  const url = `https://${RAPIDAPI_HOST}/api/v1/attractions/search?latLong=${encodeURIComponent(`${lat},${lng}`)}&radius=${radiusKm}`;
  const data = await httpGet(url);
  const list = data?.data?.data || [];
  return list.slice(0, 10).map((x) => ({
    id: String(x?.placeId || x?.locationId || x?.webUrl || x?.title || Math.random()),
    name: x?.title || x?.name || 'Tour/Hoạt động',
    price: null,
    location: x?.address || x?.category?.name || null,
    type: 'tour',
    link: x?.webUrl || null,
    rating: x?.rating || null,
    source: 'external',
  }));
}

exports.searchExternalTours = async ({ location, query }) => {
  if (!process.env.RAPIDAPI_KEY) return [];
  try {
    const q = query || location;
    if (!q) return [];
    const loc = await searchLocation(q);
    if (!loc) return [];
    return await searchAttractionsByLatLng({ lat: loc.lat, lng: loc.lng, radiusKm: 25 });
  } catch (err) {
    console.error('external tours provider error:', err?.message || err);
    return [];
  }
};