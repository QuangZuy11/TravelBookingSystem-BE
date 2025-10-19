const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testReorderActivities() {
    try {
        console.log('🧪 Testing Reorder Activities Endpoint\n');

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

        if (!itinerariesRes.data.data.itineraries || itinerariesRes.data.data.itineraries.length === 0) {
            console.log('❌ No itineraries found. Please generate one first.');
            return;
        }

        const firstItinerary = itinerariesRes.data.data.itineraries[0];
        console.log(`✅ Found itinerary: ${firstItinerary._id}\n`);

        // Step 3: Get itinerary details
        console.log('3️⃣ Getting itinerary details...');
        const detailRes = await axios.get(
            `${BASE_URL}/api/ai-itineraries/${firstItinerary._id}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const itineraryDays = detailRes.data.data.itinerary_data;
        if (!itineraryDays || itineraryDays.length === 0) {
            console.log('❌ No itinerary days found.');
            return;
        }

        // Find a day with multiple activities
        let dayWithMultipleActivities = null;
        for (const day of itineraryDays) {
            if (day.activities && day.activities.length >= 2) {
                dayWithMultipleActivities = day;
                break;
            }
        }

        if (!dayWithMultipleActivities) {
            console.log('❌ No day with multiple activities found.');
            return;
        }

        const dayId = dayWithMultipleActivities.itinerary._id;
        const originalOrder = dayWithMultipleActivities.activities.map(a => a._id);

        console.log(`✅ Found day with ${originalOrder.length} activities:`);
        console.log(`   Day ID: ${dayId}`);
        console.log(`   Original order:`);
        dayWithMultipleActivities.activities.forEach((act, idx) => {
            console.log(`     ${idx + 1}. ${act.activity_name} (${act._id})`);
        });
        console.log('');

        // Step 4: Reverse the order
        console.log('4️⃣ Reversing activity order...');
        const reversedOrder = [...originalOrder].reverse();

        console.log('   New order (reversed):');
        reversedOrder.forEach((id, idx) => {
            const act = dayWithMultipleActivities.activities.find(a => a._id === id);
            console.log(`     ${idx + 1}. ${act.activity_name} (${id})`);
        });
        console.log('');

        const reorderRes = await axios.put(
            `${BASE_URL}/api/ai-itineraries/day/${dayId}/reorder`,
            { activityIds: reversedOrder },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log(`✅ Reorder response:`, reorderRes.data);
        console.log(`   Activities array in response:`, reorderRes.data.data.activities);
        console.log('');

        // Step 5: Verify by fetching again
        console.log('5️⃣ Verifying reorder...');
        const verifyRes = await axios.get(
            `${BASE_URL}/api/ai-itineraries/${firstItinerary._id}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const verifiedDay = verifyRes.data.data.itinerary_data.find(
            d => d.itinerary._id === dayId
        );

        console.log('🔍 Activities after reorder:');
        verifiedDay.activities.forEach((act, idx) => {
            console.log(`   ${idx + 1}. ${act.activity_name} (${act._id})`);
        });
        console.log('');

        // Check if order changed
        const verifiedOrder = verifiedDay.activities.map(a => a._id);
        const isReordered = JSON.stringify(verifiedOrder) === JSON.stringify(reversedOrder);
        const isReverted = JSON.stringify(verifiedOrder) === JSON.stringify(originalOrder);

        console.log('📊 Verification Results:');
        console.log(`   Original order: [${originalOrder.join(', ')}]`);
        console.log(`   Expected order: [${reversedOrder.join(', ')}]`);
        console.log(`   Actual order:   [${verifiedOrder.join(', ')}]`);
        console.log('');
        console.log(`   Order changed: ${!isReverted ? '✅' : '❌'}`);
        console.log(`   Order matches expected: ${isReordered ? '✅' : '❌'}`);

        // Check if times were recalculated
        console.log('\n⏰ Time Recalculation Check:');
        verifiedDay.activities.forEach((act, idx) => {
            console.log(`   ${idx + 1}. ${act.activity_name}`);
            console.log(`      Time: ${act.start_time} - ${act.end_time} (${act.duration_hours}h)`);
        });

        // Verify times are sequential with gaps
        let timesAreSequential = true;
        for (let i = 0; i < verifiedDay.activities.length - 1; i++) {
            const currentEnd = verifiedDay.activities[i].end_time;
            const nextStart = verifiedDay.activities[i + 1].start_time;

            if (currentEnd >= nextStart) {
                timesAreSequential = false;
                console.log(`   ❌ Overlap detected: Activity ${i + 1} ends at ${currentEnd}, Activity ${i + 2} starts at ${nextStart}`);
            }
        }

        if (timesAreSequential) {
            console.log('\n   ✅ Times are sequential with proper gaps');
        }

        if (isReordered && timesAreSequential) {
            console.log('\n✅ TEST PASSED: Activities reordered successfully and times recalculated!');
        } else if (isReverted) {
            console.log('\n❌ TEST FAILED: Order not saved - still in original order!');
        } else if (!timesAreSequential) {
            console.log('\n⚠️  TEST WARNING: Order changed but times have overlaps!');
        } else {
            console.log('\n⚠️  TEST INCONCLUSIVE: Order changed but not as expected!');
        }

    } catch (err) {
        console.error('❌ Error:', err.response?.data || err.message);
        if (err.response?.data) {
            console.error('Full error:', JSON.stringify(err.response.data, null, 2));
        }
    }
}

testReorderActivities();
