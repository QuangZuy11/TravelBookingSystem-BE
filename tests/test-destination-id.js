const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testDestinationId() {
    try {
        console.log('🧪 Testing destination_id field\n');

        // Step 1: Login
        console.log('1️⃣ Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'traveler@gmail.com',
            password: 'traveler@gmail.com'
        });

        const token = loginRes.data.data.token;
        const userId = loginRes.data.data.id;
        console.log(`✅ Logged in. UserId: ${userId}\n`);

        // Step 2: Generate new itinerary with destination_id
        console.log('2️⃣ Generating new itinerary...');
        const genRes = await axios.post(
            `${BASE_URL}/api/ai-itineraries/generate`,
            {
                user_id: userId,
                destination: 'Hanoi',
                destination_id: '68f38b5f15fb205c26997e4a',  // Hanoi destination ID
                duration_days: 2,
                budget_level: 'medium',
                preferences: ['culture', 'history']
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const itineraryId = genRes.data.data._id;
        const destinationIdInResponse = genRes.data.data.destination_id;

        console.log(`✅ Generated itinerary: ${itineraryId}`);
        console.log(`   destination_id in response: ${destinationIdInResponse || 'NOT FOUND'}\n`);

        // Step 3: Fetch itinerary details
        console.log('3️⃣ Fetching itinerary details...');
        const detailRes = await axios.get(
            `${BASE_URL}/api/ai-itineraries/${itineraryId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const fetchedDestinationId = detailRes.data.data.destination_id;
        console.log(`✅ Fetched itinerary details`);
        console.log(`   destination_id: ${fetchedDestinationId || 'NOT FOUND'}\n`);

        // Verification
        console.log('📊 Verification:');
        if (fetchedDestinationId) {
            console.log(`   ✅ destination_id is present: ${fetchedDestinationId}`);
            console.log(`   ✅ Matches expected: ${fetchedDestinationId === '68f38b5f15fb205c26997e4a'}`);

            if (fetchedDestinationId === '68f38b5f15fb205c26997e4a') {
                console.log('\n✅ TEST PASSED: destination_id is correctly stored and returned!');
            } else {
                console.log('\n⚠️  TEST WARNING: destination_id present but value mismatch');
            }
        } else {
            console.log('   ❌ destination_id is missing!');
            console.log('\n❌ TEST FAILED: destination_id not found in response');
        }

        // Show full response structure
        console.log('\n🔍 Full response structure:');
        console.log(JSON.stringify(detailRes.data.data, null, 2).slice(0, 500));

    } catch (err) {
        console.error('❌ Error:', err.response?.data || err.message);
    }
}

testDestinationId();
