const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAutoMatchDestinationId() {
    try {
        console.log('🧪 Testing auto-match destination_id by name\n');

        // Step 1: Login
        console.log('1️⃣ Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'traveler@gmail.com',
            password: 'traveler@gmail.com'
        });

        const token = loginRes.data.data.token;
        const userId = loginRes.data.data.id;
        console.log(`✅ Logged in. UserId: ${userId}\n`);

        // Step 2: Generate itinerary WITHOUT destination_id (only destination name)
        console.log('2️⃣ Generating itinerary with only destination name...');
        const genRes = await axios.post(
            `${BASE_URL}/api/ai-itineraries/generate`,
            {
                user_id: userId,
                destination: 'Hanoi',  // Only name, no ID
                duration_days: 2,
                budget_level: 'medium',
                preferences: ['culture']
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const itineraryId = genRes.data.data._id;
        const destinationIdInResponse = genRes.data.data.destination_id;

        console.log(`✅ Generated itinerary: ${itineraryId}`);
        console.log(`   destination_id: ${destinationIdInResponse || 'NOT FOUND'}\n`);

        // Step 3: Fetch details
        console.log('3️⃣ Fetching itinerary details...');
        const detailRes = await axios.get(
            `${BASE_URL}/api/ai-itineraries/${itineraryId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const fetchedDestinationId = detailRes.data.data.destination_id;
        console.log(`✅ Fetched itinerary`);
        console.log(`   destination_id: ${fetchedDestinationId || 'NOT FOUND'}\n`);

        // Verification
        console.log('📊 Verification:');
        if (fetchedDestinationId) {
            console.log(`   ✅ Auto-matched destination_id: ${fetchedDestinationId}`);
            console.log(`   ✅ Expected Hanoi ID: 68f38b5f15fb205c26997e4a`);
            console.log(`   ✅ Match: ${fetchedDestinationId === '68f38b5f15fb205c26997e4a'}`);

            if (fetchedDestinationId === '68f38b5f15fb205c26997e4a') {
                console.log('\n✅ TEST PASSED: destination_id auto-matched correctly!');
            } else {
                console.log('\n⚠️  TEST WARNING: destination_id present but unexpected value');
            }
        } else {
            console.log('   ❌ destination_id not found!');
            console.log('\n❌ TEST FAILED: Auto-match did not work');
        }

    } catch (err) {
        console.error('❌ Error:', err.response?.data || err.message);
    }
}

testAutoMatchDestinationId();
