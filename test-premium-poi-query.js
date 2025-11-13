require('dotenv').config();
const mongoose = require('mongoose');

// Load models
require('./models/user.model');
const Destination = require('./models/destination.model');
const PointOfInterest = require('./models/point-of-interest.model');

async function testPremiumPOIQuery() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const destination = 'Hà Nội';

        // Find destination
        const dest = await Destination.findOne({
            destination_name: new RegExp('^' + destination + '$', 'i')
        });

        if (!dest) {
            console.log('❌ Destination not found');
            process.exit(1);
        }

        console.log('='.repeat(80));
        console.log('🔍 TEST PREMIUM POI QUERY');
        console.log('='.repeat(80));
        console.log(`\n📍 Destination: ${dest.destination_name} (ID: ${dest._id})\n`);

        // Test 1: All POIs (no filter)
        console.log('1️⃣  ALL POIs (No filter):');
        console.log('-'.repeat(80));
        const allPois = await PointOfInterest.find({ destinationId: dest._id })
            .sort({ 'ratings.average': -1 })
            .limit(10);

        allPois.forEach((poi, index) => {
            const fee = poi.entryFee?.adult || 0;
            const feeText = fee >= 1000000 ? `${(fee / 1000000).toFixed(1)}M VND 💎` :
                fee > 0 ? `${(fee / 1000).toFixed(0)}K VND` : 'FREE 🆓';
            console.log(`   ${index + 1}. ${poi.name}`);
            console.log(`      Type: ${poi.type} | Fee: ${feeText} | Rating: ${poi.ratings?.average || 0}`);
        });

        // Test 2: HIGH BUDGET (>= 1M VND)
        console.log('\n2️⃣  HIGH BUDGET POIs (>= 1,000,000 VND):');
        console.log('-'.repeat(80));
        const highBudgetQuery = {
            destinationId: dest._id,
            'entryFee.adult': { $gte: 1000000 }
        };
        const premiumPois = await PointOfInterest.find(highBudgetQuery)
            .sort({ 'entryFee.adult': -1, 'ratings.average': -1 })
            .limit(10);

        if (premiumPois.length === 0) {
            console.log('   ❌ NO PREMIUM POIs FOUND!');
            console.log('   → Algorithm will fall back to all POIs');
        } else {
            premiumPois.forEach((poi, index) => {
                const fee = poi.entryFee?.adult || 0;
                console.log(`   ${index + 1}. ${poi.name}`);
                console.log(`      Fee: ${(fee / 1000000).toFixed(1)}M VND 💎 | Type: ${poi.type} | Rating: ${poi.ratings?.average || 0}`);
            });
        }

        // Test 3: LOW BUDGET (< 500K VND)
        console.log('\n3️⃣  LOW BUDGET POIs (< 500,000 VND):');
        console.log('-'.repeat(80));
        const lowBudgetQuery = {
            destinationId: dest._id,
            'entryFee.adult': { $lt: 500000 }
        };
        const budgetPois = await PointOfInterest.find(lowBudgetQuery)
            .sort({ 'entryFee.adult': -1, 'ratings.average': -1 })
            .limit(10);

        budgetPois.forEach((poi, index) => {
            const fee = poi.entryFee?.adult || 0;
            const feeText = fee > 0 ? `${(fee / 1000).toFixed(0)}K VND` : 'FREE 🆓';
            console.log(`   ${index + 1}. ${poi.name}`);
            console.log(`      Fee: ${feeText} | Type: ${poi.type} | Rating: ${poi.ratings?.average || 0}`);
        });

        // Statistics
        console.log('\n📊 STATISTICS:');
        console.log('-'.repeat(80));
        const stats = await PointOfInterest.aggregate([
            { $match: { destinationId: dest._id } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    premium: {
                        $sum: {
                            $cond: [{ $gte: ['$entryFee.adult', 1000000] }, 1, 0]
                        }
                    },
                    midRange: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ['$entryFee.adult', 500000] },
                                        { $lt: ['$entryFee.adult', 1000000] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    budget: {
                        $sum: {
                            $cond: [{ $lt: ['$entryFee.adult', 500000] }, 1, 0]
                        }
                    },
                    avgFee: { $avg: '$entryFee.adult' },
                    maxFee: { $max: '$entryFee.adult' },
                    minFee: { $min: '$entryFee.adult' }
                }
            }
        ]);

        if (stats.length > 0) {
            const s = stats[0];
            console.log(`   Total POIs: ${s.total}`);
            console.log(`   Premium (>= 1M): ${s.premium} (${((s.premium / s.total) * 100).toFixed(1)}%)`);
            console.log(`   Mid-range (500K-1M): ${s.midRange} (${((s.midRange / s.total) * 100).toFixed(1)}%)`);
            console.log(`   Budget (< 500K): ${s.budget} (${((s.budget / s.total) * 100).toFixed(1)}%)`);
            console.log(`   Avg Fee: ${(s.avgFee / 1000).toFixed(0)}K VND`);
            console.log(`   Max Fee: ${(s.maxFee / 1000000).toFixed(1)}M VND`);
            console.log(`   Min Fee: ${s.minFee} VND`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('💡 RECOMMENDATIONS:');
        console.log('='.repeat(80));

        if (premiumPois.length === 0) {
            console.log('❌ PROBLEM: No premium POIs (>= 1M VND) in database!');
            console.log('   → When budget_level = "high", query returns EMPTY');
            console.log('   → Algorithm falls back to ALL POIs (including FREE ones)');
            console.log('\n✅ SOLUTION: Check if premium POIs were seeded correctly');
        } else {
            console.log('✅ Premium POIs exist in database');
            console.log(`   Found ${premiumPois.length} premium POIs`);
            console.log('   → Algorithm should work correctly for high budget');
        }

        console.log('='.repeat(80));

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

testPremiumPOIQuery();
