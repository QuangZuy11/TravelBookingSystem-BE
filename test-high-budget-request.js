/**
 * Test high budget AI itinerary request to verify premium POI filtering
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AIItineraryRequest = require('./models/ai_itinerary_request.model');
const PointOfInterest = require('./models/point-of-interest.model');
const Destination = require('./models/destination.model');

async function testHighBudgetRequest() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find Hà Nội destination
        const hanoi = await Destination.findOne({ destination_name: /hà nội/i });
        if (!hanoi) {
            console.log('❌ Hà Nội destination not found');
            return;
        }

        console.log(`📍 Destination: ${hanoi.destination_name} (${hanoi._id})\n`);

        // Test the EXACT query logic from controller
        console.log('=== TEST 1: HIGH BUDGET QUERY ===');
        const budget_level = 'high';
        const budget_total = 15000000; // 15M VND

        let query = { destinationId: hanoi._id };

        console.log(`Budget Level: ${budget_level}`);
        console.log(`Budget Total: ${budget_total.toLocaleString()} VND`);

        if (budget_level === 'high' || budget_total >= 10000000) {
            query['entryFee.adult'] = { $gte: 1000000 };
            console.log('Filter: PREMIUM (>= 1M VND)\n');
        }

        const pois = await PointOfInterest.find(query)
            .sort({ 'entryFee.adult': -1, 'ratings.average': -1 })
            .limit(15);

        console.log(`✅ Found ${pois.length} POIs\n`);

        if (pois.length > 0) {
            console.log('Top POIs:');
            pois.forEach((poi, i) => {
                const fee = poi.entryFee?.adult || 0;
                const rating = poi.ratings?.average || 0;
                console.log(`${i + 1}. ${poi.name}`);
                console.log(`   Entry Fee: ${fee.toLocaleString()} VND`);
                console.log(`   Rating: ${rating.toFixed(1)} ⭐`);
            });
        } else {
            console.log('⚠️  No POIs found with this filter!');
            console.log('Testing fallback logic...\n');

            const fallbackPois = await PointOfInterest.find({ destinationId: hanoi._id })
                .sort({ 'entryFee.adult': -1, 'ratings.average': -1 })
                .limit(15);

            console.log(`Fallback found ${fallbackPois.length} POIs`);
            if (fallbackPois.length > 0) {
                console.log('\nFallback POIs (sorted by price):');
                fallbackPois.slice(0, 5).forEach((poi, i) => {
                    const fee = poi.entryFee?.adult || 0;
                    console.log(`${i + 1}. ${poi.name} - ${fee.toLocaleString()} VND`);
                });
            }
        }

        console.log('\n=== TEST 2: LOW BUDGET QUERY ===');
        let lowQuery = { destinationId: hanoi._id };
        lowQuery['entryFee.adult'] = { $lt: 500000 };

        const lowBudgetPois = await PointOfInterest.find(lowQuery)
            .sort({ 'entryFee.adult': -1, 'ratings.average': -1 })
            .limit(15);

        console.log(`Budget: LOW (< 500K VND)`);
        console.log(`Found: ${lowBudgetPois.length} POIs\n`);

        console.log('\n=== SUMMARY ===');
        const allPois = await PointOfInterest.find({ destinationId: hanoi._id });
        const premium = allPois.filter(p => (p.entryFee?.adult || 0) >= 1000000);
        const budget = allPois.filter(p => (p.entryFee?.adult || 0) < 500000);
        const medium = allPois.filter(p => {
            const fee = p.entryFee?.adult || 0;
            return fee >= 500000 && fee < 1000000;
        });

        console.log(`Total POIs in Hà Nội: ${allPois.length}`);
        console.log(`Premium (>= 1M): ${premium.length} (${(premium.length / allPois.length * 100).toFixed(1)}%)`);
        console.log(`Medium (500K-1M): ${medium.length} (${(medium.length / allPois.length * 100).toFixed(1)}%)`);
        console.log(`Budget (< 500K): ${budget.length} (${(budget.length / allPois.length * 100).toFixed(1)}%)`);

        if (premium.length >= 3) {
            console.log('\n✅ Algorithm should work correctly for high budget');
        } else {
            console.log('\n⚠️  Too few premium POIs, fallback will likely activate');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testHighBudgetRequest();
