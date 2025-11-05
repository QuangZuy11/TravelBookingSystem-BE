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
    name: d.name,
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
  const poiSummaries = (pois || []).map(p => ({
    id: p._id,
    name: p.name, // Đổi từ poi_name sang name
    description: p.description || '',
    type: p.type || 'other',
    rating: p.ratings?.average || 0, // Đổi từ rating sang ratings.average
    entryFee: p.entryFee?.adult || 0, // Đổi từ price sang entryFee.adult
    recommendedDuration: p.recommendedDuration || { hours: 2, minutes: 0 }
  }));

  // Build natural language prompt
  const destinationName = destination?.name || request.destination || request.ai_suggested_destination;
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

  const user = `Hãy tạo lịch trình chi tiết ${days} ngày cho chuyến đi đến ${destinationName} dành cho ${request.participant_number} người ${ageRangeText}, ngân sách ${budgetText}, ưu tiên ${preferencesText}.

Các điểm tham quan có sẵn:
${JSON.stringify(poiSummaries, null, 2)}

Tạo lịch trình ${days} ngày với những yêu cầu sau:
1. Phù hợp với sở thích: ${preferencesText}
2. Phù hợp với ngân sách: ${budgetText}
3. Thích hợp cho ${request.participant_number} người độ tuổi ${ageRangeText}
4. Bao gồm ăn uống, hoạt động và điểm tham quan
5. Thời gian hợp lý (8:00 - 18:00 mỗi ngày, 30 phút di chuyển giữa các địa điểm)

**QUAN TRỌNG**: Tất cả nội dung phải bằng tiếng Việt, bao gồm tên hoạt động, mô tả, địa điểm.

Trả về CHỈ JSON hợp lệ theo định dạng này (toàn bộ bằng tiếng Việt):
{
  "title": "Trip title",
  "total_budget": ${budget},
  "days": [
    {
      "day_number": 1,
      "title": "Ngày 1 - [Chủ đề/Khu vực bằng tiếng Việt]",
      "description": "Tóm tắt ngắn gọn về ngày này bằng tiếng Việt",
      "activities": [
        { 
          "activity_name": "Tên hoạt động bằng tiếng Việt", 
          "poi_id": "<poi id từ danh sách hoặc null>", 
          "start_time": "HH:MM",
          "end_time": "HH:MM",
          "duration_hours": 2.5,
          "description": "Mô tả chi tiết hoạt động bằng tiếng Việt",
          "cost": 100000,
          "optional": false
        }
      ]
    }
  ]
}

Không thêm bất kỳ text nào bên ngoài JSON object. Toàn bộ nội dung phải bằng tiếng Việt.`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];

  // Use shorter max_tokens for faster response
  const content = await callGroqAI(messages, 1200);

  // Enhanced JSON parsing with error recovery
  let parsed = null;
  try {
    // Try direct parsing first
    parsed = JSON.parse(content);
  } catch (err) {
    console.log('❌ Direct JSON parsing failed, trying recovery methods...');
    console.log('Raw AI response length:', content.length);
    console.log('Raw AI response preview:', content.substring(0, 500) + '...');

    try {
      // Method 1: Extract JSON block between curly braces
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('🔧 Attempting to parse extracted JSON...');
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        // Method 2: Try to find JSON starting with {"title" or {"days"
        const titleMatch = content.match(/\{"title"[\s\S]*\}/);
        const daysMatch = content.match(/\{"days"[\s\S]*\}/);

        if (titleMatch) {
          console.log('🔧 Found title-based JSON, attempting parse...');
          parsed = JSON.parse(titleMatch[0]);
        } else if (daysMatch) {
          console.log('🔧 Found days-based JSON, attempting parse...');
          parsed = JSON.parse(daysMatch[0]);
        } else {
          throw new Error('No valid JSON pattern found in AI response');
        }
      }
    } catch (parseErr) {
      console.error('❌ All JSON parsing methods failed');
      console.error('Parse error:', parseErr.message);

      try {
        // Method 3: Try to fix common JSON issues
        console.log('🔧 Attempting JSON repair...');
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
        console.log('✅ JSON repair successful!');

      } catch (repairErr) {
        console.error('❌ JSON repair also failed');
        console.error('Repair error:', repairErr.message);

        // Fallback: Generate a simple itinerary structure
        console.log('🔄 Generating fallback itinerary...');
        parsed = generateFallbackItinerary(destination, duration, budget, requestData.preferences || requestData.interests || []);
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
  const dailyBudget = Math.floor(budget / duration);

  // Split destination into multiple locations if comma-separated
  const locations = destination.split(',').map(loc => loc.trim());
  const mainLocation = locations[0];

  const fallback = {
    title: `Discover ${locations.length > 1 ? locations.join(' & ') : destination}`,
    total_budget: budget,
    days: []
  };

  // Enhanced activity templates based on Vietnamese destinations
  const vietnameseActivities = {
    'culture': ['Visit ancient temples', 'Explore old quarter', 'Traditional craft villages', 'Cultural museums'],
    'history': ['Historical sites tour', 'War museums', 'Ancient citadel', 'Heritage walking tour'],
    'food': ['Street food tour', 'Local cooking class', 'Traditional restaurant', 'Market food tasting'],
    'nature': ['National park visit', 'Boat cruise', 'Cave exploration', 'Mountain hiking'],
    'adventure': ['Motorbike tour', 'Rock climbing', 'Kayaking', 'Trekking'],
    'entertainment': ['Water puppet show', 'Night market', 'Rooftop bars', 'Local festivals'],
    'relaxation': ['Spa treatment', 'Hot springs', 'Beach time', 'Meditation centers'],
    'shopping': ['Local markets', 'Souvenir shopping', 'Art galleries', 'Handicraft stores'],
    'sightseeing': ['City landmarks', 'Scenic viewpoints', 'Architecture tour', 'Photo walks'],
    'transport': ['Airport transfer', 'Train journey', 'Bus travel', 'Local transport']
  };

  // Valid activity types that match the controller validation
  const validTypes = ['food', 'transport', 'sightseeing', 'entertainment', 'accommodation',
    'shopping', 'nature', 'culture', 'adventure', 'relaxation', 'history', 'other'];

  // Map interests to valid types
  const mapInterestToValidType = (interest) => {
    const normalizedInterest = interest.toLowerCase();
    if (validTypes.includes(normalizedInterest)) {
      return normalizedInterest;
    }
    // Default mappings for common interests
    const mappings = {
      'cultural': 'culture',
      'historical': 'history',
      'outdoor': 'nature',
      'nightlife': 'entertainment',
      'dining': 'food'
    };
    return mappings[normalizedInterest] || 'sightseeing';
  };

  const timeSlots = ['08:00', '10:30', '12:30', '15:00', '18:30'];
  const mealTimes = ['breakfast', 'lunch', 'dinner'];

  for (let day = 1; day <= duration; day++) {
    const dayActivities = [];
    let dayTotal = 0;
    const currentLocation = locations[(day - 1) % locations.length];

    // Morning activity
    const morningInterest = mapInterestToValidType(interests[0] || 'culture');
    const morningActivities = vietnameseActivities[morningInterest] || vietnameseActivities['culture'];
    dayActivities.push({
      time: '08:00',
      activity: `${morningActivities[Math.floor(Math.random() * morningActivities.length)]} in ${currentLocation}`,
      location: currentLocation,
      cost: Math.floor(dailyBudget * 0.25),
      duration: '2.5 hours',
      type: morningInterest
    });

    // Lunch
    dayActivities.push({
      time: '12:00',
      activity: `Traditional Vietnamese lunch at local restaurant`,
      location: `${currentLocation} local restaurant`,
      cost: Math.floor(dailyBudget * 0.15),
      duration: '1.5 hours',
      type: 'food'
    });

    // Afternoon activity
    const afternoonInterest = mapInterestToValidType(interests[1] || interests[0] || 'nature');
    const afternoonActivities = vietnameseActivities[afternoonInterest] || vietnameseActivities['nature'];
    dayActivities.push({
      time: '14:30',
      activity: `${afternoonActivities[Math.floor(Math.random() * afternoonActivities.length)]} near ${currentLocation}`,
      location: currentLocation,
      cost: Math.floor(dailyBudget * 0.35),
      duration: '3 hours',
      type: afternoonInterest
    });

    // Evening activity/dinner
    const eveningInterest = mapInterestToValidType(interests[2] || 'food');
    const eveningActivities = vietnameseActivities[eveningInterest] || vietnameseActivities['food'];
    dayActivities.push({
      time: '18:30',
      activity: `${eveningActivities[Math.floor(Math.random() * eveningActivities.length)]} in ${currentLocation}`,
      location: currentLocation,
      cost: Math.floor(dailyBudget * 0.25),
      duration: '2 hours',
      type: eveningInterest
    });

    dayTotal = dayActivities.reduce((sum, act) => sum + act.cost, 0);

    fallback.days.push({
      day: day,
      theme: `Day ${day} - ${currentLocation} ${interests[0] || 'Culture'} & ${interests[1] || 'Nature'}`,
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
