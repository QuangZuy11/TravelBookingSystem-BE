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
  const system = `You are a travel advisor. Suggest the BEST destination from the provided list based on the user's preferences, budget, and travel style. Return ONLY JSON without any additional commentary.`;

  const destinationList = availableDestinations.map(d => ({
    id: d._id,
    name: d.name,
    country: d.country,
    description: d.description,
    popular_activities: d.popular_activities || []
  }));

  const user = `User preferences:
- Duration: ${request.duration_days} days
- Budget: ${request.budget_total ? `${request.budget_total.toLocaleString()} VND` : request.budget_level}
- Participants: ${request.participant_number} people
- Age range: ${request.age_range.join(', ')}
- Interests: ${request.preferences.join(', ')}

Available destinations in Vietnam:
${JSON.stringify(destinationList, null, 2)}

Based on the user's preferences and budget, suggest ONE best destination.

Return ONLY this JSON format:
{
  "suggested_destination_id": "<destination id>",
  "suggested_destination_name": "<destination name>",
  "reason": "A brief explanation why this destination fits the user's needs (2-3 sentences)"
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

  const system = `You are a professional travel itinerary planner. Create a detailed day-by-day itinerary in JSON format based on the user's natural language request and available points of interest.`;

  const user = `Hãy tạo lịch trình chi tiết ${days} ngày cho chuyến đi đến ${destinationName} dành cho ${request.participant_number} người ${ageRangeText}, ngân sách ${budgetText}, ưu tiên ${preferencesText}.

Available Points of Interest:
${JSON.stringify(poiSummaries, null, 2)}

Create a ${days}-day itinerary that:
1. Matches the user's interests: ${preferencesText}
2. Fits the budget: ${budgetText}
3. Suitable for ${request.participant_number} people aged ${ageRangeText}
4. Includes meals, activities, and attractions
5. Realistic timing (8 AM - 6 PM daily, 30 min travel between locations)

Return ONLY valid JSON in this format:
{
  "days": [
    {
      "day_number": 1,
      "title": "Day 1 - [Theme/Area]",
      "description": "Brief overview of the day",
      "activities": [
        { 
          "activity_name": "Activity name", 
          "poi_id": "<poi id from list or null>", 
          "start_time": "HH:MM",
          "end_time": "HH:MM",
          "duration_hours": 2.5,
          "description": "What to do here",
          "cost": 100000,
          "optional": false
        }
      ]
    }
  ]
}

Do not add any text outside the JSON object.`;

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
