const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testUpdateActivity() {
    try {
        console.log('🧪 Testing Update Activity Endpoint\n');

        // Step 1: Login
        console.log('1️⃣ Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'traveler@gmail.com',
            password: 'traveler@gmail.com'
        });

        const token = loginRes.data.data.token;
        const userId = loginRes.data.data.id;
        console.log(`✅ Logged in. UserId: ${userId}\n`);

        // Step 2: Get user's itineraries
        console.log('2️⃣ Getting user itineraries...');
        const itinerariesRes = await axios.get(
            `${BASE_URL}/api/ai-itineraries/user/${userId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        let firstItinerary;

        if (!itinerariesRes.data.data.itineraries || itinerariesRes.data.data.itineraries.length === 0) {
            console.log('⚠️  No itineraries found. Generating one...\n');

            // Generate a test itinerary
            console.log('2B️⃣ Generating test itinerary...');
            const genRes = await axios.post(
                `${BASE_URL}/api/ai-itineraries/generate`,
                {
                    user_id: userId,
                    destination: 'Hanoi',
                    duration_days: 2,
                    budget_level: 'medium',
                    preferences: ['culture', 'history']
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            firstItinerary = genRes.data.data;
            console.log(`✅ Generated itinerary: ${firstItinerary._id}\n`);
        } else {
            firstItinerary = itinerariesRes.data.data.itineraries[0];
            console.log(`✅ Found itinerary: ${firstItinerary._id}\n`);
        }

        // Step 3: Get itinerary details
        console.log('3️⃣ Getting itinerary details...');
        const detailRes = await axios.get(
            `${BASE_URL}/api/ai-itineraries/${firstItinerary._id}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const itineraryDays = detailRes.data.data.itinerary_data || detailRes.data.data.itineraries;
        if (!itineraryDays || itineraryDays.length === 0) {
            console.log('❌ No itinerary days found.');
            return;
        }

        const firstDay = itineraryDays[0];
        if (!firstDay.activities || firstDay.activities.length === 0) {
            console.log('❌ No activities found in first day.');
            return;
        }

        const firstActivity = firstDay.activities[0];
        console.log(`✅ Found activity to update:`);
        console.log(`   ID: ${firstActivity._id}`);
        console.log(`   Name: ${firstActivity.activity_name}`);
        console.log(`   Time: ${firstActivity.start_time} - ${firstActivity.end_time}`);
        console.log(`   Cost: ${firstActivity.cost}\n`);

        // Step 4: Update activity
        console.log('4️⃣ Updating activity...');
        const updateData = {
            activity_name: firstActivity.activity_name + ' (UPDATED)',
            start_time: '10:30',
            end_time: '12:30',
            cost: 999999,
            description: 'This activity has been updated by test script'
        };

        console.log('Update data:', updateData);

        const updateRes = await axios.put(
            `${BASE_URL}/api/ai-itineraries/activity/${firstActivity._id}`,
            updateData,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log(`✅ Update response:`, updateRes.data);
        console.log('\n');

        // Step 5: Verify update by fetching again
        console.log('5️⃣ Verifying update...');
        const verifyRes = await axios.get(
            `${BASE_URL}/api/ai-itineraries/${firstItinerary._id}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const verifiedDays = verifyRes.data.data.itinerary_data || verifyRes.data.data.itineraries;
        const verifiedActivity = verifiedDays[0].activities.find(
            a => a._id.toString() === firstActivity._id.toString()
        );

        console.log('🔍 Activity after update:');
        console.log(`   Name: ${verifiedActivity.activity_name}`);
        console.log(`   Time: ${verifiedActivity.start_time} - ${verifiedActivity.end_time}`);
        console.log(`   Cost: ${verifiedActivity.cost}`);
        console.log(`   Description: ${verifiedActivity.description}`);

        // Check if changes persisted
        const isNameUpdated = verifiedActivity.activity_name.includes('(UPDATED)');
        const isTimeUpdated = verifiedActivity.start_time === '10:30';
        const isCostUpdated = verifiedActivity.cost === 999999;

        console.log('\n📊 Verification Results:');
        console.log(`   Name updated: ${isNameUpdated ? '✅' : '❌'}`);
        console.log(`   Time updated: ${isTimeUpdated ? '✅' : '❌'}`);
        console.log(`   Cost updated: ${isCostUpdated ? '✅' : '❌'}`);

        if (isNameUpdated && isTimeUpdated && isCostUpdated) {
            console.log('\n✅ TEST PASSED: All changes persisted correctly!');
        } else {
            console.log('\n❌ TEST FAILED: Some changes did not persist!');
        }

    } catch (err) {
        console.error('❌ Error:', err.response?.data || err.message);
    }
}

testUpdateActivity();
