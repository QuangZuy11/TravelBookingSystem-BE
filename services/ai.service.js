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
  // Reduce token usage: send only top N POIs with compact fields and truncated descriptions
  const POI_SEND_LIMIT = 12;
  const poiSummaries = (pois || [])
    .slice(0, POI_SEND_LIMIT)
    .map(p => ({
      id: p._id,
      name: p.name,
      // keep description short and single-line to save tokens
      description: (p.description || '').replace(/\s+/g, ' ').slice(0, 120),
      type: p.type || 'other',
      rating: p.ratings?.average || 0,
      entryFee: p.entryFee?.adult || 0,
      destination: p.destinationId ? p.destinationName : destination?.destination_name || request.destination,
      // normalized duration in hours (float)
      recommendedDurationHours: ((p.recommendedDuration?.hours || 0) + (p.recommendedDuration?.minutes || 0) / 60) || 2
    }));

  // Build natural language prompt
  const destinations = request.destination
    ? request.destination.split(',').map(d => d.trim())
    : [destination?.destination_name || request.ai_suggested_destination];
  const destinationName = destinations.join(' & ');
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

  const system = `Bạn là một chuyên gia lập kế hoạch lịch trình du lịch chuyên nghiệp. Hãy tạo lịch trình chi tiết theo từng ngày ở định dạng JSON hoàn toàn bằng tiếng Việt, dựa trên yêu cầu của khách hàng và các điểm tham quan có sẵn.`;

  // Compact prompt: reduce verbosity and include minified POI payload to save tokens
  const user = `Tạo lịch trình ${days} ngày cho ${request.participant_number} người ${destinations.length > 1 ? 'qua các điểm: ' + destinations.join(', ') : 'đến ' + destinationName}. Ngân sách: ${budgetText}. Ưu tiên: ${preferencesText}.

POI_JSON:${JSON.stringify(poiSummaries)}

Yêu cầu:
- Nội dung hoàn toàn bằng tiếng Việt.
- Trả CHỈ JSON hợp lệ theo schema: {title, total_budget, days:[{day_number,title,description,activities:[{activity_name,poi_id,start_time,duration_hours,description,cost,optional}]}]}.
- Sắp xếp các điểm đến theo lộ trình hợp lý.
- Không thêm text ngoài JSON.`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];

  // Use shorter max_tokens for faster response and to reduce token cost
  const content = await callGroqAI(messages, 900);

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
        // Fallback: Generate a simple itinerary structure (in Vietnamese)
        parsed = generateFallbackItinerary(destinationName || (destination && destination.destination_name) || request.destination || 'điểm đến', days || 1, budget, request.preferences || request.interests || []);
      }
    }
  }

  // Validate required structure
  if (!parsed.days || !Array.isArray(parsed.days)) {
    throw new Error('Invalid itinerary structure: missing days array');
  }

  return parsed;
};

// Enhanced fallback itinerary generator when AI parsing fails
const generateFallbackItinerary = (destination, duration, budget, interests) => {
  const dailyBudget = Math.floor((budget || 0) / Math.max(1, duration));

  // Split destination into multiple locations if comma-separated
  const locations = (destination || 'điểm đến').toString().split(',').map(loc => loc.trim());
  const fallback = {
    title: `Khám phá ${locations.length > 1 ? locations.join(' & ') : destination}`,
    total_budget: budget || 0,
    days: []
  };

  // Calculate days per location
  const daysPerLocation = Math.floor(duration / locations.length);
  const extraDays = duration % locations.length;
  const locationDays = locations.map((_, index) =>
    daysPerLocation + (index < extraDays ? 1 : 0)
  );

  // Vietnamese activity templates
  const vietnameseActivities = {
    'culture': ['Thăm đền chùa cổ', 'Khám phá khu phố cổ', 'Thăm làng nghề truyền thống', 'Thăm các bảo tàng văn hóa'],
    'history': ['Tour di tích lịch sử', 'Thăm bảo tàng chiến tranh', 'Thăm thành cổ', 'Đi bộ tham quan di sản'],
    'food': ['Tour ẩm thực đường phố', 'Lớp học nấu ăn truyền thống', 'Nhà hàng địa phương', 'Thưởng thức món chợ địa phương'],
    'nature': ['Thăm vườn quốc gia', 'Du thuyền sông/biển', 'Khám phá hang động', 'Leo núi ngắm cảnh'],
    'adventure': ['Tour xe máy khám phá', 'Leo núi mạo hiểm', 'Chèo thuyền kayak', 'Trekking ngắn'],
    'entertainment': ['Xem múa rối nước', 'Chợ đêm', 'Quán bar trên mái nhà', 'Lễ hội địa phương'],
    'relaxation': ['Trải nghiệm spa', 'Suối khoáng nóng', 'Thời gian tắm biển', 'Tham gia lớp thiền'],
    'shopping': ['Chợ địa phương', 'Mua quà lưu niệm', 'Phòng trưng bày nghệ thuật', 'Cửa hàng thủ công'],
    'sightseeing': ['Địa danh thành phố', 'Điểm ngắm cảnh', 'Tham quan kiến trúc', 'Đi dạo chụp ảnh'],
    'transport': ['Đưa đón sân bay', 'Hành trình tàu/xe', 'Di chuyển bằng xe buýt địa phương', 'Thuê phương tiện địa phương']
  };

  const validTypes = ['food', 'transport', 'sightseeing', 'entertainment', 'accommodation', 'shopping', 'nature', 'culture', 'adventure', 'relaxation', 'history', 'leisure', 'other'];

  const mapInterestToValidType = (interest) => {
    if (!interest) return 'sightseeing';
    const normalizedInterest = interest.toString().toLowerCase();
    if (validTypes.includes(normalizedInterest)) return normalizedInterest;
    const mappings = {
      'cultural': 'culture',
      'historical': 'history',
      'outdoor': 'nature',
      'nightlife': 'entertainment',
      'dining': 'food',
      'recreational': 'leisure',
      'ẩm thực': 'food',
      'văn hóa': 'culture',
      'thiên nhiên': 'nature',
      'giải trí': 'entertainment',
      'nghỉ ngơi': 'relaxation',
      'du lịch': 'sightseeing'
    };
    return mappings[normalizedInterest] || 'sightseeing';
  }; const timeSlots = ['08:00', '11:30', '14:30', '17:30'];

  for (let day = 1; day <= duration; day++) {
    const currentLocation = locations[(day - 1) % locations.length] || locations[0];
    const dayActivities = [];

    // Morning
    const morningType = mapInterestToValidType(interests[0] || 'culture');
    const morningOptions = vietnameseActivities[morningType] || vietnameseActivities['culture'];
    dayActivities.push({
      activity_name: `${morningOptions[Math.floor(Math.random() * morningOptions.length)]} tại ${currentLocation}`,
      poi_id: null,
      start_time: timeSlots[0],
      duration_hours: 2.5,
      description: `Hoạt động buổi sáng ở ${currentLocation} phù hợp với sở thích ${interests[0] || 'văn hóa'}`,
      cost: Math.floor(dailyBudget * 0.25),
      optional: false
    });

    // Lunch
    dayActivities.push({
      activity_name: `Ăn trưa món Việt tại nhà hàng địa phương ở ${currentLocation}`,
      poi_id: null,
      start_time: '12:00',
      duration_hours: 1.5,
      description: `Thưởng thức ẩm thực địa phương tại ${currentLocation}`,
      cost: Math.floor(dailyBudget * 0.15),
      optional: false
    });

    // Afternoon
    const afternoonType = mapInterestToValidType(interests[1] || interests[0] || 'nature');
    const afternoonOptions = vietnameseActivities[afternoonType] || vietnameseActivities['nature'];
    dayActivities.push({
      activity_name: `${afternoonOptions[Math.floor(Math.random() * afternoonOptions.length)]} gần ${currentLocation}`,
      poi_id: null,
      start_time: timeSlots[2],
      duration_hours: 3,
      description: `Hoạt động buổi chiều tại ${currentLocation}`,
      cost: Math.floor(dailyBudget * 0.35),
      optional: false
    });

    // Evening
    const eveningType = mapInterestToValidType(interests[2] || 'food');
    const eveningOptions = vietnameseActivities[eveningType] || vietnameseActivities['food'];
    dayActivities.push({
      activity_name: `${eveningOptions[Math.floor(Math.random() * eveningOptions.length)]} buổi tối tại ${currentLocation}`,
      poi_id: null,
      start_time: '18:30',
      duration_hours: 2,
      description: `Buổi tối thư giãn tại ${currentLocation}`,
      cost: Math.floor(dailyBudget * 0.25),
      optional: false
    });

    const dayTotal = dayActivities.reduce((s, a) => s + (a.cost || 0), 0);

    fallback.days.push({
      day_number: day,
      title: `Ngày ${day} - ${currentLocation}`,
      description: `Gợi ý hoạt động cho Ngày ${day} tại ${currentLocation}`,
      activities: dayActivities,
      day_total: dayTotal
    });
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
