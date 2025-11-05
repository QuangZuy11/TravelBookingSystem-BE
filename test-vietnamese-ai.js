/**
 * Test script for Vietnamese AI Itinerary Generation
 * Run with: node test-vietnamese-ai.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/travelbooking');
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

const aiService = require('./services/ai.service');
const Destination = require('./models/destination.model');
const PointOfInterest = require('./models/point-of-interest.model');

const testVietnameseAIGeneration = async () => {
    console.log('\n🧪 Testing Vietnamese AI Itinerary Generation...\n');

    try {
        // Test 1: Destination Suggestion in Vietnamese
        console.log('📝 Test 1: Testing AI destination suggestion in Vietnamese');

        // Get some sample destinations
        const sampleDestinations = await Destination.find({}).limit(5);

        if (sampleDestinations.length > 0) {
            const mockRequest = {
                duration_days: 3,
                budget_total: 5000000,
                participant_number: 2,
                age_range: ['18-30'],
                preferences: ['văn hóa', 'ẩm thực', 'thiên nhiên']
            };

            try {
                const suggestion = await aiService.generateDestinationSuggestion({
                    request: mockRequest,
                    availableDestinations: sampleDestinations
                });

                console.log('✅ AI Destination Suggestion Response:', {
                    suggested_destination_id: suggestion.suggested_destination_id,
                    suggested_destination_name: suggestion.suggested_destination_name,
                    reason: suggestion.reason
                });

                // Check if reason is in Vietnamese
                const hasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(suggestion.reason);
                console.log(hasVietnamese ? '✅ Response contains Vietnamese characters' : '⚠️  Response may not be in Vietnamese');
            } catch (error) {
                console.log('⚠️  AI destination suggestion error:', error.message);
            }
        }

        // Test 2: Itinerary Generation in Vietnamese
        console.log('\n📝 Test 2: Testing AI itinerary generation in Vietnamese');

        // Get a sample destination with POIs
        const destination = await Destination.findOne({});
        let pois = [];

        if (destination) {
            pois = await PointOfInterest.find({ destinationId: destination._id }).limit(5);
        }

        if (destination && pois.length > 0) {
            const mockRequest = {
                duration_days: 2,
                budget_total: 3000000,
                participant_number: 2,
                age_range: ['25-35'],
                preferences: ['tham quan', 'ẩm thực', 'nghỉ dưỡng'],
                destination: destination.name
            };

            try {
                const itinerary = await aiService.generateItinerary({
                    request: mockRequest,
                    destination: destination,
                    pois: pois,
                    days: 2
                });

                console.log('✅ AI Itinerary Generation Response Structure:');
                console.log('- Days count:', itinerary.days?.length);

                if (itinerary.days && itinerary.days.length > 0) {
                    const firstDay = itinerary.days[0];
                    console.log('- First day structure:', {
                        day_number: firstDay.day_number,
                        title: firstDay.title,
                        description: firstDay.description,
                        activities_count: firstDay.activities?.length || 0
                    });

                    // Check Vietnamese content in titles and descriptions
                    const hasVietnameseTitle = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(firstDay.title || '');
                    const hasVietnameseDesc = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(firstDay.description || '');

                    console.log('✅ Title in Vietnamese:', hasVietnameseTitle ? 'Yes' : 'No');
                    console.log('✅ Description in Vietnamese:', hasVietnameseDesc ? 'Yes' : 'No');

                    // Check activities
                    if (firstDay.activities && firstDay.activities.length > 0) {
                        const firstActivity = firstDay.activities[0];
                        console.log('- First activity sample:', {
                            activity_name: firstActivity.activity_name,
                            start_time: firstActivity.start_time,
                            end_time: firstActivity.end_time,
                            description: firstActivity.description?.substring(0, 100) + '...'
                        });

                        const hasVietnameseActivity = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(firstActivity.activity_name || '');
                        console.log('✅ Activity name in Vietnamese:', hasVietnameseActivity ? 'Yes' : 'No');
                    }
                }
            } catch (error) {
                console.log('⚠️  AI itinerary generation error:', error.message);
            }
        } else {
            console.log('⚠️  No destination or POIs found for testing itinerary generation');
        }

        // Test 3: Mock expected Vietnamese response structure
        console.log('\n📝 Test 3: Expected Vietnamese response structure');
        const expectedStructure = {
            "days": [
                {
                    "day_number": 1,
                    "title": "Ngày 1 - Khám phá Phố Cổ Hà Nội",
                    "description": "Tham quan các di tích lịch sử và thưởng thức ẩm thực địa phương",
                    "activities": [
                        {
                            "activity_name": "Thăm Đền Ngọc Sơn",
                            "poi_id": "poi_id_123",
                            "start_time": "08:00",
                            "end_time": "10:00",
                            "duration_hours": 2,
                            "description": "Khám phá ngôi đền cổ kính nổi tiếng trên Hồ Hoàn Kiếm",
                            "cost": 30000,
                            "optional": false
                        }
                    ]
                }
            ]
        };

        console.log('✅ Expected Vietnamese structure sample:');
        console.log(JSON.stringify(expectedStructure, null, 2));

        console.log('\n🎉 Vietnamese AI generation tests completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
};

const runTests = async () => {
    await connectDB();
    await testVietnameseAIGeneration();
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
};

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = { testVietnameseAIGeneration };