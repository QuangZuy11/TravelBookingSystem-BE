require('dotenv').config();
const mongoose = require('mongoose');

// Load all required models
require('./models/user.model');
require('./models/service-provider.model');
require('./models/ai_generated_itineraries.model');
const AiItineraryBooking = require('./models/ai-itinerary-booking.model');

async function checkBookingStatus() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const bookingId = process.argv[2];

        if (!bookingId) {
            console.log('Usage: node check-booking-status.js <booking_id>');
            console.log('Example: node check-booking-status.js 6915edff962f6fce4834e045');
            process.exit(1);
        }

        const booking = await AiItineraryBooking.findById(bookingId)
            .populate('user_id', 'email fullname')
            .populate('provider_id', 'company_name')
            .populate('ai_itinerary_id', 'title destination');

        if (!booking) {
            console.log('❌ Booking not found');
            process.exit(1);
        }

        console.log('='.repeat(70));
        console.log('📋 BOOKING STATUS INFORMATION');
        console.log('='.repeat(70));

        console.log('\n🔑 Basic Info:');
        console.log(`   ID: ${booking._id}`);
        console.log(`   Destination: ${booking.destination}`);
        console.log(`   Duration: ${booking.duration_days} days`);
        console.log(`   Participants: ${booking.participant_number}`);
        console.log(`   Start Date: ${booking.start_date.toLocaleDateString()}`);

        console.log('\n📊 Status Flow:');
        console.log(`   Current Status: ${booking.status.toUpperCase()} ⭐`);
        console.log(`   Can be approved: ${booking.canBeApproved() ? '✅' : '❌'}`);
        console.log(`   Can be rejected: ${booking.canBeRejected() ? '✅' : '❌'}`);
        console.log(`   Can be completed: ${booking.canBeCompleted() ? '✅' : '❌'}`);
        console.log(`   Can be cancelled: ${booking.canBeCancelled() ? '✅' : '❌'}`);

        console.log('\n📅 Timestamps:');
        console.log(`   Created: ${booking.created_at?.toLocaleString() || 'N/A'}`);
        console.log(`   Approved: ${booking.approved_at?.toLocaleString() || 'N/A'}`);
        console.log(`   Confirmed: ${booking.confirmed_at?.toLocaleString() || 'N/A'}`);
        console.log(`   Completed: ${booking.completed_at?.toLocaleString() || 'N/A'}`);
        console.log(`   Rejected: ${booking.rejected_at?.toLocaleString() || 'N/A'}`);
        console.log(`   Cancelled: ${booking.cancelled_at?.toLocaleString() || 'N/A'}`);

        console.log('\n👥 Parties:');
        console.log(`   Traveler: ${booking.user_id?.fullname || booking.user_id?.email || 'N/A'}`);
        console.log(`   Provider: ${booking.provider_id?.company_name || 'Not assigned'}`);

        console.log('\n💰 Financial:');
        console.log(`   Total Budget: ${(booking.total_budget || 0).toLocaleString()} VND`);
        console.log(`   Quoted Price: ${booking.quoted_price ? booking.quoted_price.toLocaleString() + ' VND' : 'Not quoted'}`);

        console.log('\n📝 Notes:');
        console.log(`   Special Requests: ${booking.special_requests || 'None'}`);
        console.log(`   Provider Notes: ${booking.provider_notes || 'None'}`);
        console.log(`   Completion Notes: ${booking.completion_notes || 'None'}`);

        console.log('\n🎯 Next Actions:');
        if (booking.status === 'pending') {
            console.log('   → Provider should APPROVE or REJECT this booking');
        } else if (booking.status === 'approved') {
            console.log('   → Traveler can CONFIRM (payment)');
            console.log('   → OR Provider can directly COMPLETE (if no payment needed)');
        } else if (booking.status === 'confirmed') {
            console.log('   → Provider should COMPLETE this booking after trip');
        } else if (booking.status === 'completed') {
            console.log('   ✅ Booking is COMPLETED - No further actions needed');
        } else if (booking.status === 'rejected' || booking.status === 'cancelled') {
            console.log('   ❌ Booking is closed - No further actions possible');
        }

        console.log('\n' + '='.repeat(70));

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

checkBookingStatus();
