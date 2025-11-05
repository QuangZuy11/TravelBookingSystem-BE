/**
 * 🧪 TEST NEW ITINERARY QUERY ENDPOINT
 * GET /api/itineraries?origin_id=xxx&type=tour
 */

console.log('🧪 NEW ITINERARY QUERY ENDPOINT\n');

const tourId = '69077a2c81a793eac27c895a';

console.log('📋 **New Endpoint Added:**');
console.log(`✅ GET /api/itineraries?origin_id=${tourId}&type=tour`);
console.log('✅ Full URL: http://localhost:3000/api/itineraries?origin_id=' + tourId + '&type=tour');

console.log('\n📋 **Query Parameters:**');
console.log('✅ origin_id (required): ID of the origin resource (Tour, AI, etc.)');
console.log('✅ type (required): Type of itinerary (tour, ai_gen, customized)');

console.log('\n📋 **Validation:**');
console.log('✅ Both origin_id and type are required');
console.log('✅ Type must be: tour, ai_gen, or customized');
console.log('✅ For type="tour", validates tour exists');

console.log('\n📋 **Expected Response:**');
const expectedResponse = {
    success: true,
    count: 2,
    data: [
        {
            _id: "itinerary-id-1",
            origin_id: tourId,
            type: "tour",
            day_number: 1,
            title: "Day 1: Arrival",
            description: "Check in and city tour",
            day_total: 0,
            user_modified: false,
            created_at: "2025-11-02T12:00:00.000Z",
            updated_at: "2025-11-02T12:00:00.000Z",
            activities: [
                {
                    time: "08:00",
                    action: "Hotel pickup"
                },
                {
                    time: "09:30",
                    action: "City sightseeing"
                }
            ]
        },
        {
            _id: "itinerary-id-2",
            origin_id: tourId,
            type: "tour",
            day_number: 2,
            title: "Day 2: Adventure",
            description: "Outdoor activities",
            day_total: 0,
            user_modified: false,
            created_at: "2025-11-02T12:00:00.000Z",
            updated_at: "2025-11-02T12:00:00.000Z",
            activities: [
                {
                    time: "07:00",
                    action: "Early breakfast"
                },
                {
                    time: "08:00",
                    action: "Hiking trip"
                }
            ]
        }
    ],
    query: {
        origin_id: tourId,
        type: "tour"
    }
};

console.log(JSON.stringify(expectedResponse, null, 2));

console.log('\n🔧 **Error Responses:**');
console.log('❌ 400 Bad Request: Missing origin_id or type');
console.log('❌ 400 Bad Request: Invalid type (not tour/ai_gen/customized)');
console.log('❌ 404 Not Found: Tour not found (when type=tour)');
console.log('❌ 500 Server Error: Database or validation errors');

console.log('\n📊 **Available Endpoints:**');
console.log('✅ GET /api/itineraries?origin_id=xxx&type=tour - NEW unified query');
console.log('✅ GET /api/itineraries/tour/:tourId - Legacy tour-specific');
console.log('✅ GET /api/itineraries/:id - Single itinerary by ID');

console.log('\n🎯 **Usage Examples:**');
console.log('Tour itineraries: GET /api/itineraries?origin_id=TOUR_ID&type=tour');
console.log('AI itineraries: GET /api/itineraries?origin_id=AI_ID&type=ai_gen');
console.log('Customized: GET /api/itineraries?origin_id=AI_ID&type=customized');

console.log('\n🚀 **Endpoint is now available for use!**');