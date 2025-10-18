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

  const system = `You are a helpful itinerary generator. Return only JSON that conforms to the schema described.`;
  const user = `Input: request=${JSON.stringify({
    destination: request.destination,
    duration_days: days,
    participant_number: request.participant_number,
    budget_level: request.budget_level,
    preferences: request.preferences
  })},\nPOIs=${JSON.stringify(poiSummaries)}\n\nProduce a JSON object with shape:\n{
  "days": [
    {
      "day_number": 1,
      "title": "string",
      "activities": [
        { "activity_name": "string", "poi_id": "<poi id or null>", "start_time":"HH:MM","end_time":"HH:MM","duration_hours":float,"description":"string","cost":number,"optional":boolean }
      ]
    }
  ]
}\n
Make sure to reference POIs by their id in poi_id when possible. Keep output strictly valid JSON. Do not add extra commentary.`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];

  const content = await callOpenAI(messages);

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
