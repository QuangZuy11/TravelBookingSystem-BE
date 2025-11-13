/**
 * Test provider bookings API to verify selected_activities are returned
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AiItineraryBooking = require('./models/ai-itinerary-booking.model');
const User = require('./models/user.model'); // ✅ Import User model for populate

async function testProviderBookings() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const providerId = '68f65d90e1edae4d08cf51fa';

        console.log('=== TEST: Provider Bookings Query ===');
        console.log(`Provider ID: ${providerId}\n`);

        // Simulate the exact query from controller
        const query = {
            $or: [
                { provider_id: providerId },
                { provider_id: null, status: 'pending' }
            ]
        };

        const bookings = await AiItineraryBooking.find(query)
            .populate({
                path: 'user_id',
                select: 'name email'
            })
            .sort({ created_at: -1 })
            .limit(10)
            .lean();

        console.log(`Found ${bookings.length} bookings\n`);

        if (bookings.length === 0) {
            console.log('⚠️  No bookings found for this provider');

            // Check if any bookings exist at all
            const totalBookings = await AiItineraryBooking.countDocuments();
            console.log(`Total bookings in database: ${totalBookings}`);

            if (totalBookings > 0) {
                console.log('\nSample booking data:');
                const sample = await AiItineraryBooking.findOne().lean();
                console.log('Fields:', Object.keys(sample));
                console.log('Provider ID:', sample.provider_id);
                console.log('Status:', sample.status);
                console.log('Selected Activities:', sample.selected_activities?.length || 0);
            }
        } else {
            bookings.forEach((booking, index) => {
                console.log(`${index + 1}. Booking ${booking._id}`);
                console.log(`   Destination: ${booking.destination}`);
                console.log(`   Status: ${booking.status}`);
                console.log(`   Duration: ${booking.duration_days} days`);
                console.log(`   Budget: ${(booking.total_budget || 0).toLocaleString()} VND`);
                console.log(`   Selected Activities: ${booking.selected_activities?.length || 0}`);

                if (booking.selected_activities && booking.selected_activities.length > 0) {
                    console.log(`   Activities:`);
                    booking.selected_activities.slice(0, 3).forEach((activity, i) => {
                        console.log(`     ${i + 1}. Day ${activity.day_number}: ${activity.activity_name}`);
                        console.log(`        Type: ${activity.activity_type}, Cost: ${(activity.cost || 0).toLocaleString()} VND`);
                    });
                    if (booking.selected_activities.length > 3) {
                        console.log(`     ... and ${booking.selected_activities.length - 3} more`);
                    }
                } else {
                    console.log(`   ⚠️  No activities found`);
                }

                if (booking.user_id) {
                    console.log(`   User: ${booking.user_id.name} (${booking.user_id.email})`);
                }
                console.log();
            });

            // Statistics
            const withActivities = bookings.filter(b => b.selected_activities?.length > 0).length;
            const withoutActivities = bookings.length - withActivities;

            console.log('=== SUMMARY ===');
            console.log(`Total bookings: ${bookings.length}`);
            console.log(`With activities: ${withActivities} (${(withActivities / bookings.length * 100).toFixed(1)}%)`);
            console.log(`Without activities: ${withoutActivities} (${(withoutActivities / bookings.length * 100).toFixed(1)}%)`);

            if (withActivities > 0) {
                console.log('\n✅ API response will include selected_activities');
            } else {
                console.log('\n⚠️  All bookings have empty selected_activities array');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testProviderBookings();
