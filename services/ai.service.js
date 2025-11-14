const Groq = require('groq-sdk');

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const callGroqAI = async (messages, maxTokens = 1200) => {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set in environment variables');

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: process.env.GROQ_MODEL || 'llama3-8b-8192', // Fast and good model
      temperature: 0.7,
      max_tokens: maxTokens,
      top_p: 1,
      stream: false
    });

    const content = chatCompletion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from Groq API');
    }

    return content;
  } catch (error) {
    if (error.status === 429) {
      throw new Error('Groq API rate limit exceeded. Please try again later.');
    } else if (error.status === 401) {
      throw new Error('Invalid Groq API key. Please check your GROQ_API_KEY.');
    } else {
      throw new Error(`Groq API error: ${error.message}`);
    }
  }
};

/**
 * generateDestinationSuggestion: Ask AI to suggest a destination based on user preferences
 */
exports.generateDestinationSuggestion = async ({ request, availableDestinations }) => {
  const system = `Bạn là một chuyên gia tư vấn du lịch chuyên nghiệp. Hãy gợi ý điểm đến TỐT NHẤT từ danh sách có sẵn dựa trên sở thích, ngân sách và phong cách du lịch của khách hàng. Trả về CHỈ JSON bằng tiếng Việt, không có bình luận thêm.`;

  const destinationList = availableDestinations.map(d => ({
    id: d._id,
    name: d.destination_name,
    country: d.country,
    description: d.description,
    popular_activities: d.popular_activities || []
  }));

  const user = `Thông tin khách hàng:
- Thời gian: ${request.duration_days} ngày
- Ngân sách: ${request.budget_total ? `${request.budget_total.toLocaleString()} VND` : request.budget_level === 'high' ? 'cao cấp' : request.budget_level === 'low' ? 'tiết kiệm' : 'trung bình'}
- Số người: ${request.participant_number} người
- Độ tuổi: ${request.age_range.join(', ')}
- Sở thích: ${request.preferences.join(', ')}

Các điểm đến có sẵn tại Việt Nam:
${JSON.stringify(destinationList, null, 2)}

Dựa trên sở thích và ngân sách của khách hàng, hãy gợi ý MỘT điểm đến tốt nhất.

Trả về CHỈ định dạng JSON này (bằng tiếng Việt):
{
  "suggested_destination_id": "<destination id>",
  "suggested_destination_name": "<tên điểm đến>",
  "reason": "Lý do ngắn gọn tại sao điểm đến này phù hợp với nhu cầu của khách hàng (2-3 câu bằng tiếng Việt)"
}`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];

  const content = await callGroqAI(messages, 500);

  // Parse JSON response
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    const m = content && content.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
    else throw new Error('Failed to parse AI destination suggestion as JSON');
  }

  return parsed;
};

/**
 * Fast AI itinerary generation - optimized for speed and token efficiency
 * No destination validation needed, accepts destination as string (can contain multiple places)
 */
exports.generateItinerary = async ({ request, destination, pois, days }) => {
  // Build compact POI list to send (sử dụng đúng field names từ POI model)
  // ✅ Ensure balanced POI sampling from all destinations
  const POI_SEND_LIMIT = 30; // ✅ Increased from 12 to 30 for multi-destination trips

  // ✅ Group POIs by destination first to ensure balanced representation
  const poisByDestination = {};
  (pois || []).forEach(p => {
    const destName = p.destinationName || p.destinationId?.destination_name || 'unknown';
    if (!poisByDestination[destName]) {
      poisByDestination[destName] = [];
    }
    poisByDestination[destName].push(p);
  });

  // ✅ Sample evenly from each destination (round-robin)
  const sampledPois = [];
  const destinationKeys = Object.keys(poisByDestination);
  const maxPerDestination = Math.ceil(POI_SEND_LIMIT / destinationKeys.length);

  destinationKeys.forEach(dest => {
    sampledPois.push(...poisByDestination[dest].slice(0, maxPerDestination));
  });

  const poiSummaries = sampledPois
    .slice(0, POI_SEND_LIMIT)
    .map(p => ({
      id: p._id,
      name: p.name,
      // keep description short and single-line to save tokens
      description: (p.description || '').replace(/\s+/g, ' ').slice(0, 120),
      type: p.type || 'other',
      rating: p.ratings?.average || 0,
      entryFee: p.entryFee?.adult || 0,
      destination: p.destinationName || p.destinationId?.destination_name || destination?.destination_name || request.destination,
      // normalized duration in hours (float)
      recommendedDurationHours: ((p.recommendedDuration?.hours || 0) + (p.recommendedDuration?.minutes || 0) / 60) || 2
    }));

  // Build natural language prompt
  const destinations = request.destination
    ? request.destination.split(',').map(d => d.trim())
    : [destination?.destination_name || request.ai_suggested_destination];
  const destinationName = destinations.join(', '); // ✅ Keep comma-separated for fallback splitting
  const budget = request.budget_total || 0;
  const budgetText = request.budget_total
    ? `${(request.budget_total / 1000000).toFixed(1)} triệu VND`
    : request.budget_level === 'high' ? 'cao cấp' : request.budget_level === 'low' ? 'tiết kiệm' : 'trung bình';

  const ageRangeText = request.age_range && request.age_range.length > 0
    ? `tuổi ${request.age_range.join(', ')}`
    : 'mọi lứa tuổi';

  const preferencesText = request.preferences && request.preferences.length > 0
    ? request.preferences.join(', ')
    : 'tham quan chung';

  // ✅ Enhanced budget instructions with STRICT rules
  const budgetInstruction = request.budget_level === 'high' || request.budget_total >= 10000000
    ? '⚠️ QUAN TRỌNG: ƯU TIÊN POIs có entryFee >= 200.000 VND. Chọn POIs đắt nhất có sẵn. Tránh POIs miễn phí.'
    : request.budget_level === 'low' || (request.budget_total > 0 && request.budget_total < 3000000)
      ? '⚠️ QUAN TRỌNG: CHỈ chọn POIs có entryFee <= 100.000 VND hoặc miễn phí. Không được chọn POIs cao cấp.'
      : 'Cân bằng giữa POIs miễn phí, trung bình (100-300K) và cao cấp (>300K).';

  const system = `Bạn là chuyên gia lập kế hoạch du lịch. Tạo lịch trình JSON tiếng Việt.

QUY TẮC BẮT BUỘC:
1. activity_name = TÊN CHÍNH XÁC của POI từ danh sách (VD: "Nhà hát Lớn Hà Nội")
2. cost = entryFee của POI
3. poi_id = ID của POI
4. MỖI NGÀY phải có 3-4 hoạt động
5. PHÂN BỔ địa điểm: Mỗi ngày CHỈ ở MỘT địa điểm (VD: Ngày 1-2: Hà Nội, Ngày 3-4: Ninh Bình)
6. CHỈ dùng POIs có trong danh sách
7. ⚠️ TỔNG THỜI GIAN MỖI NGÀY: 8-10 giờ (480-600 phút), KHÔNG VƯỢT QUÁ 10 giờ`;

  // ✅ Enhanced prompt with strict rules
  const user = `Tạo lịch trình ${days} ngày cho ${request.participant_number} người đi ${destinations.join(' → ')}.
Ngân sách: ${budgetText}. Sở thích: ${preferencesText}.

POIs CÓ SẴN:
${JSON.stringify(poiSummaries, null, 2)}

QUY TẮC:
- ${budgetInstruction}
- MỖI NGÀY: 3-4 activities
- ⚠️ QUAN TRỌNG: TỔNG thời gian hoạt động mỗi ngày PHẢI từ 8-10 giờ (không quá 10 giờ)
- PHÂN BỔ: ${destinations.length > 1 ? destinations.map((d, i) => {
    const daysForDest = Math.ceil(days / destinations.length);
    const start = i * daysForDest + 1;
    const end = Math.min(start + daysForDest - 1, days);
    return `Ngày ${start}-${end}: ${d}`;
  }).join(', ') : `Tất cả ${days} ngày ở ${destinations[0]}`}
- activity_name = Tên POI chính xác
- cost = entryFee của POI
- duration_hours = Thời gian hợp lý (1-3 giờ/hoạt động)

Format JSON:
{"title":"string","total_budget":number,"days":[{"day_number":number,"title":"Ngày X - Địa điểm","description":"string","activities":[{"activity_name":"TÊN POI","poi_id":"ID","start_time":"HH:MM","duration_hours":number,"description":"string","cost":number,"optional":false}]}]}

CHỈ JSON, không text khác.`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];

  // 🔍 DEBUG: Log prompt to verify POI data
  console.log('🔍 AI Prompt Debug:');
  console.log(`   Destinations: ${destinations.join(', ')}`);
  console.log(`   Budget Level: ${request.budget_level || 'not set'}`);
  console.log(`   POIs Available: ${poiSummaries.length}`);
  if (poiSummaries.length > 0) {
    console.log(`   Sample POIs (first 3):`);
    poiSummaries.slice(0, 3).forEach((p, i) => {
      console.log(`     ${i + 1}. "${p.name}" (${p.destination}) - ${p.entryFee} VND - ID: ${p.id}`);
    });
  }

  // Use increased max_tokens for better AI response quality
  const content = await callGroqAI(messages, 1500);

  // 🔍 DEBUG: Log raw AI response
  console.log('\n🔍 RAW AI RESPONSE (first 500 chars):');
  console.log(content.substring(0, 500));
  console.log('...\n');

  // Enhanced JSON parsing with error recovery
  let parsed = null;
  try {
    // Try direct parsing first
    parsed = JSON.parse(content);
  } catch (err) {
    try {
      // Method 1: Extract JSON block between curly braces
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        // Method 2: Try to find JSON starting with {"title" or {"days"
        const titleMatch = content.match(/\{"title"[\s\S]*\}/);
        const daysMatch = content.match(/\{"days"[\s\S]*\}/);

        if (titleMatch) {
          parsed = JSON.parse(titleMatch[0]);
        } else if (daysMatch) {
          parsed = JSON.parse(daysMatch[0]);
        } else {
          throw new Error('No valid JSON pattern found in AI response');
        }
      }
    } catch (parseErr) {
      try {
        // Method 3: Try to fix common JSON issues
        let repairedJson = content;

        // Fix incomplete JSON by adding missing closing braces
        const openBraces = (repairedJson.match(/\{/g) || []).length;
        const closeBraces = (repairedJson.match(/\}/g) || []).length;
        const missingBraces = openBraces - closeBraces;

        if (missingBraces > 0) {
          repairedJson += '}'.repeat(missingBraces);
        }

        // Try parsing the repaired JSON
        parsed = JSON.parse(repairedJson);

      } catch (repairErr) {
        // Fallback: Generate a simple itinerary structure (in Vietnamese) using real POIs
        parsed = generateFallbackItinerary(
          destinationName || (destination && destination.destination_name) || request.destination || 'điểm đến',
          days || 1,
          budget,
          request.preferences || request.interests || [],
          poiSummaries // ✅ Pass POIs to fallback generator
        );
      }
    }
  }

  // Validate required structure
  if (!parsed.days || !Array.isArray(parsed.days)) {
    throw new Error('Invalid itinerary structure: missing days array');
  }

  return parsed;
};

// ✅ Enhanced fallback generator using REAL POIs with proper destination splitting
const generateFallbackItinerary = (destination, duration, budget, interests, poisParam) => {
  const dailyBudget = Math.floor((budget || 0) / Math.max(1, duration));

  // Split destination into multiple locations if comma-separated
  const locations = (destination || 'điểm đến').toString().split(',').map(loc => loc.trim());
  const fallback = {
    title: `Khám phá ${locations.length > 1 ? locations.join(' & ') : destination}`,
    total_budget: budget || 0,
    days: []
  };

  // Get POIs from outer scope if available
  const availablePois = poisParam || [];

  // ✅ FIX: Group POIs by destination using fuzzy matching
  const poisByDestination = {};

  console.log(`\n📊 GROUPING ${availablePois.length} POIs FOR ${locations.length} DESTINATIONS:`);
  console.log(`   Destinations: ${locations.join(', ')}`);

  // Debug: show all POI destinations
  const uniqueDestinations = [...new Set(availablePois.map(p => p.destinationName || p.destination || 'unknown'))];
  console.log(`   POI destinations found: ${uniqueDestinations.join(', ')}`);

  locations.forEach(loc => {
    const locLower = loc.toLowerCase().trim();
    poisByDestination[loc] = availablePois.filter(poi => {
      if (!poi.destination && !poi.destinationName) return false;

      // Try both destinationName and destination fields
      let poiDestName = (poi.destinationName || poi.destination || '').toLowerCase().trim();

      // Remove common suffixes to normalize
      poiDestName = poiDestName.replace(/, việt nam$/i, '').trim();

      // Strict matching: exact match or starts with the location name
      const isExactMatch = poiDestName === locLower;
      const isStartsWith = poiDestName.startsWith(locLower + ' ') || poiDestName.startsWith(locLower + ',');
      const isLocationInName = locLower.length >= 4 && poiDestName.split(/[,\s]+/)[0] === locLower;

      return isExactMatch || isStartsWith || isLocationInName;
    });

    console.log(`   ✅ "${loc}": ${poisByDestination[loc].length} POIs`);
    if (poisByDestination[loc].length > 0) {
      console.log(`      Sample: ${poisByDestination[loc].slice(0, 3).map(p => p.name).join(', ')}`);
    }
  });

  // Calculate days per location
  const daysPerLocation = Math.floor(duration / locations.length);
  const extraDays = duration % locations.length;
  const locationDays = locations.map((_, index) =>
    daysPerLocation + (index < extraDays ? 1 : 0)
  );

  // ✅ Handle destinations with insufficient POIs: borrow from neighbors
  const allPois = availablePois; // Keep all POIs as fallback pool
  const lowFeePoiPool = allPois.filter(p => (p.entryFee?.adult || 0) <= 100000).sort((a, b) => (a.entryFee?.adult || 0) - (b.entryFee?.adult || 0));

  console.log(`\n🔄 POI BORROWING CHECK:`);
  console.log(`   Total POIs available: ${allPois.length}`);
  console.log(`   Low-fee POIs (<=100K): ${lowFeePoiPool.length}`);
  if (lowFeePoiPool.length > 0) {
    console.log(`   Sample low-fee POIs: ${lowFeePoiPool.slice(0, 3).map(p => `${p.name} (${(p.entryFee?.adult || 0).toLocaleString()} VND)`).join(', ')}`);
  }

  locations.forEach(loc => {
    if ((poisByDestination[loc] || []).length === 0 && lowFeePoiPool.length > 0) {
      const borrowedPois = lowFeePoiPool.slice(0, 6);
      console.log(`   ⚠️  "${loc}" has 0 POIs, borrowing ${borrowedPois.length} low-fee POIs:`);
      borrowedPois.forEach((p, i) => {
        console.log(`      ${i + 1}. ${p.name} - ${(p.entryFee?.adult || 0).toLocaleString()} VND`);
      });
      poisByDestination[loc] = borrowedPois;
    }
  });

  const timeSlots = ['08:00', '11:30', '14:30', '17:30'];
  let dayCounter = 1;

  // Iterate through each location
  for (let locIndex = 0; locIndex < locations.length; locIndex++) {
    const currentLocation = locations[locIndex];
    const daysInLocation = locationDays[locIndex];
    const locationPois = poisByDestination[currentLocation] || [];

    console.log(`📍 ${currentLocation}: ${daysInLocation} ngày, ${locationPois.length} POIs`);

    // ✅ ENSURE 3-4 activities per day: distribute POIs evenly
    const MIN_ACTIVITIES_PER_DAY = 3;
    const MAX_ACTIVITIES_PER_DAY = 4;

    // Calculate how many POIs per day (aim for 3-4)
    let poisPerDay = Math.max(MIN_ACTIVITIES_PER_DAY, Math.min(MAX_ACTIVITIES_PER_DAY, Math.floor(locationPois.length / daysInLocation)));

    // If not enough POIs, we'll need to fill with generic activities later
    const needsGenericActivities = locationPois.length < (daysInLocation * MIN_ACTIVITIES_PER_DAY);

    for (let dayInLoc = 0; dayInLoc < daysInLocation; dayInLoc++) {
      const dayActivities = [];
      let totalDayDuration = 0; // Track total duration in minutes
      const MAX_DAY_DURATION = 600; // 10 hours max
      const MIN_DAY_DURATION = 480; // 8 hours min

      // ✅ Calculate POI slice for this day (round-robin distribution)
      const startIdx = dayInLoc * poisPerDay;
      const endIdx = Math.min(startIdx + poisPerDay, locationPois.length);
      const dayPois = locationPois.slice(startIdx, endIdx);

      console.log(`   Ngày ${dayCounter}: ${dayPois.length} POIs được phân bổ`);

      // ✅ MIXED PRICING: Alternate between paid and free POIs for balanced budget
      const paidPois = dayPois.filter(p => (p.entryFee?.adult || 0) > 0);
      const freePois = dayPois.filter(p => (p.entryFee?.adult || 0) === 0);

      // Strategy: 2 paid + 1-2 free per day for balanced experience
      const selectedPois = [];
      if (paidPois.length >= 2) {
        selectedPois.push(paidPois[0], paidPois[1]); // 2 paid activities
        if (freePois.length > 0) selectedPois.push(freePois[0]); // 1 free to balance
        if (selectedPois.length < MAX_ACTIVITIES_PER_DAY && paidPois.length > 2) {
          selectedPois.push(paidPois[2]); // 3rd paid if space and available
        }
      } else {
        // Not enough paid POIs, use what we have + free ones
        selectedPois.push(...paidPois, ...freePois.slice(0, MAX_ACTIVITIES_PER_DAY - paidPois.length));
      }

      // ✅ Add selected POI activities with duration control (max 10 hours/day)
      selectedPois.slice(0, MAX_ACTIVITIES_PER_DAY).forEach((poi, idx) => {
        // Calculate duration in minutes (convert hours to minutes)
        const poiDurationHours = poi.recommendedDuration?.hours || 2;
        const poiDurationMinutes = (poi.recommendedDuration?.minutes || 0);
        const totalPoiMinutes = (poiDurationHours * 60) + poiDurationMinutes;

        // Check if adding this POI exceeds max day duration
        if (totalDayDuration + totalPoiMinutes <= MAX_DAY_DURATION) {
          dayActivities.push({
            activity_name: poi.name,
            poi_id: poi.id,
            start_time: timeSlots[Math.min(idx, 3)],
            duration_hours: poiDurationHours + (poiDurationMinutes / 60), // Keep as decimal hours for compatibility
            description: poi.description || `Tham quan ${poi.name}`,
            cost: poi.entryFee?.adult || 0,
            optional: false
          });
          totalDayDuration += totalPoiMinutes;
        }
      });

      // ✅ ENSURE minimum 3 activities per day (but respect max duration)
      while (dayActivities.length < MIN_ACTIVITIES_PER_DAY && totalDayDuration < MAX_DAY_DURATION) {
        const activityIndex = dayActivities.length;
        let activityDuration = 90; // 1.5 hours in minutes

        if (activityIndex === 1 || dayActivities.length === 2) {
          // Add lunch activity at position 1 or 2
          if (totalDayDuration + activityDuration <= MAX_DAY_DURATION) {
            dayActivities.push({
              activity_name: `Ăn trưa ẩm thực địa phương ${currentLocation}`,
              poi_id: null,
              start_time: timeSlots[1], // 11:30
              duration_hours: 1.5,
              description: `Thưởng thức món ăn đặc sản ${currentLocation}`,
              cost: Math.floor(dailyBudget * 0.15),
              optional: false
            });
            totalDayDuration += activityDuration;
          }
        } else {
          // Add generic exploration activity (2 hours)
          activityDuration = 120;
          if (totalDayDuration + activityDuration <= MAX_DAY_DURATION) {
            dayActivities.push({
              activity_name: `Khám phá ${currentLocation} tự do`,
              poi_id: null,
              start_time: timeSlots[Math.min(activityIndex, 3)],
              duration_hours: 2,
              description: `Thời gian tự do khám phá ${currentLocation}`,
              cost: Math.floor(dailyBudget * 0.2),
              optional: true
            });
            totalDayDuration += activityDuration;
          } else {
            break; // Stop if we can't fit more activities
          }
        }
      }

      const dayTotal = dayActivities.reduce((s, a) => s + (a.cost || 0), 0);
      const totalHours = (totalDayDuration / 60).toFixed(1);

      console.log(`      Total duration: ${totalHours} hours (${totalDayDuration} minutes)`);

      fallback.days.push({
        day_number: dayCounter,
        title: `Ngày ${dayCounter} - ${currentLocation}`,
        description: `Khám phá ${currentLocation} với ${dayActivities.length} hoạt động`,
        activities: dayActivities,
        day_total: dayTotal
      });

      dayCounter++;
    }
  }

  return fallback;
};

// Export the callGroqAI function for direct use
exports.callGroqAI = callGroqAI;

// Export a helper that gracefully falls back to throwing when no API key
exports.callAIOrThrow = async (opts) => {
  return exports.generateItinerary(opts);
};

// Test function to verify Groq API connection
exports.testGroqConnection = async () => {
  try {
    const messages = [
      { role: 'user', content: 'Hello, respond with "Groq API is working!" if you can see this message.' }
    ];

    const response = await callGroqAI(messages, 50);
    return {
      success: true,
      message: 'Groq API connection successful',
      response: response
    };
  } catch (error) {
    return {
      success: false,
      message: 'Groq API connection failed',
      error: error.message
    };
  }
};
