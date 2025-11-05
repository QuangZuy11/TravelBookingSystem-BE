const aiService = require('../services/ai.service');

/**
 * Tạo lịch trình AI nhanh - không cần check destination database
 * POST /api/ai-itineraries/generate-fast
 */
exports.generateFastItinerary = async (req, res) => {
    try {
        const {
            destination,        // String: "Da Nang, Hoi An" hoặc "Hanoi"
            duration = 3,       // Số ngày
            budget = 5000000,   // Ngân sách VND
            interests = [],     // Array: ["beach", "culture", "food"]
            travelStyle = "balanced", // "relaxed", "balanced", "active"
            participant_number = 2,
            user_id
        } = req.body;

        // Validation đơn giản
        if (!destination || !user_id) {
            return res.status(400).json({
                success: false,
                message: 'Destination and user_id are required'
            });
        }

        if (duration < 1 || duration > 30) {
            return res.status(400).json({
                success: false,
                message: 'Duration must be between 1 and 30 days'
            });
        }

        console.log(`🚀 Generating fast itinerary for ${destination}, ${duration} days`);

        // Gọi AI service tối ưu
        const itinerary = await aiService.generateItinerary({
            destination,
            duration,
            budget,
            interests,
            travelStyle,
            participant_number,
            user_id
        });

        // Thêm metadata
        const result = {
            success: true,
            message: 'Itinerary generated successfully',
            data: {
                ...itinerary,
                request_info: {
                    destination,
                    duration,
                    budget,
                    interests,
                    travelStyle,
                    participant_number,
                    user_id,
                    generated_at: new Date(),
                    ai_model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
                }
            }
        };

        res.json(result);

    } catch (error) {
        console.error('❌ Error generating fast itinerary:', error.message);

        res.status(500).json({
            success: false,
            message: 'Failed to generate itinerary',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Test AI connection
 * GET /api/ai-itineraries/test
 */
exports.testAI = async (req, res) => {
    try {
        const result = await aiService.testGroqConnection();

        res.json({
            success: result.success,
            message: result.message,
            model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
            timestamp: new Date(),
            ...(result.response && { response: result.response }),
            ...(result.error && { error: result.error })
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to test AI connection',
            error: error.message
        });
    }
};

/**
 * Generate simple text itinerary (no JSON structure)
 * POST /api/ai-itineraries/generate-text
 */
exports.generateTextItinerary = async (req, res) => {
    try {
        const { destination, duration = 3, budget, interests = [], travelStyle = "balanced" } = req.body;

        if (!destination) {
            return res.status(400).json({
                success: false,
                message: 'Destination is required'
            });
        }

        const messages = [
            {
                role: 'system',
                content: 'You are a helpful travel assistant. Create a concise travel itinerary in simple text format.'
            },
            {
                role: 'user',
                content: `Create a ${duration}-day travel itinerary for ${destination}. Budget: ${budget ? budget.toLocaleString() + ' VND' : 'flexible'}. Interests: ${interests.join(', ') || 'general sightseeing'}. Travel style: ${travelStyle}. Keep it brief and practical.`
            }
        ];

        // Use the callGroqAI function from ai service
        const response = await aiService.callGroqAI(messages, 800);

        res.json({
            success: true,
            message: 'Text itinerary generated',
            data: {
                destination,
                duration,
                budget,
                interests,
                travelStyle,
                itinerary_text: response,
                generated_at: new Date()
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate text itinerary',
            error: error.message
        });
    }
};

module.exports = exports;