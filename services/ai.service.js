const fetch = global.fetch || require('node-fetch');

const callOpenAI = async (messages, maxTokens = 1200) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
      max_tokens: maxTokens
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${txt}`);
  }

  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return content;
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

  const content = await callOpenAI(messages, 500);

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
 * generateItinerary: sends request + DB data to AI and expects structured JSON response.
 * If OPENAI_API_KEY is not present, this service will throw and caller should fallback.
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

  const content = await callOpenAI(messages, 2000);

  // Try to parse JSON from the response (AI should return JSON)
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    // Try to extract JSON substring
    const m = content && content.match(/\{[\s\S]*\}$/);
    if (m) parsed = JSON.parse(m[0]);
    else throw new Error('Failed to parse AI response as JSON');
  }

  return parsed;
};

// Export a helper that gracefully falls back to throwing when no API key
exports.callAIOrThrow = async (opts) => {
  return exports.generateItinerary(opts);
};
