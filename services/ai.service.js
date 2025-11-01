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
exports.generateItinerary = async (requestData) => {
  // Extract data with simplified structure
  const {
    destination,     // String có thể chứa nhiều địa điểm cách nhau bằng dấu ,
    duration = 3,    // Số ngày
    budget = 5000000, // Ngân sách
    interests = [],   // Sở thích
    travelStyle = "balanced", // relaxed, balanced, active
    participant_number = 2,
    user_id
  } = requestData;

  // Ultra-specific prompt to force valid JSON output
  const system = `You must return ONLY a valid JSON object. No markdown, no explanations, no additional text. Just pure JSON.`;

  const user = `Generate ${duration}-day Vietnam travel itinerary:
- Destinations: ${destination}
- Budget: ${budget.toLocaleString()} VND (${participant_number} people)  
- Interests: ${interests.join(', ')}
- Style: ${travelStyle}

Return exactly this JSON structure with real activities:

JSON format:
{
  "title": "Trip title",
  "total_budget": ${budget},
  "days": [
    {
      "day": 1,
      "theme": "Day theme",
      "activities": [
        {
          "time": "08:00",
          "activity": "Activity name",
          "location": "Location name", 
          "cost": 200000,
          "duration": "2 hours",
          "type": "sightseeing|food|transport|accommodation"
        }
      ],
      "day_total": 800000
    }
  ]
}`;

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

      // Fallback: Generate a simple itinerary structure
      console.log('🔄 Generating fallback itinerary...');
      parsed = generateFallbackItinerary(destination, duration, budget, interests);
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
    'shopping': ['Local markets', 'Souvenir shopping', 'Art galleries', 'Handicraft stores']
  };

  const timeSlots = ['08:00', '10:30', '12:30', '15:00', '18:30'];
  const mealTimes = ['breakfast', 'lunch', 'dinner'];

  for (let day = 1; day <= duration; day++) {
    const dayActivities = [];
    let dayTotal = 0;
    const currentLocation = locations[(day - 1) % locations.length];

    // Morning activity
    const morningInterest = interests[0] || 'culture';
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
    const afternoonInterest = interests[1] || interests[0] || 'nature';
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
    const eveningInterest = interests[2] || 'food';
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
