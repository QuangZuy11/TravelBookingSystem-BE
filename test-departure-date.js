/**
 * Test script for nullable departure_date functionality
 * Run with: node test-departure-date.js
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

const Tour = require('./models/tour.model');

const testDepartureDateFunctionality = async () => {
    console.log('\n🧪 Testing nullable departure_date functionality...\n');

    try {
        // Test 1: Create tour with null departure_date
        console.log('📝 Test 1: Creating tour with null departure_date');
        const tourWithNullDate = await Tour.create({
            title: 'Flexible Tour - No Fixed Date',
            description: 'A tour with flexible scheduling',
            provider_id: new mongoose.Types.ObjectId(),
            destination_id: [new mongoose.Types.ObjectId()],
            price: 500000,
            duration: '1 day',
            image: 'test-image.jpg',
            departure_date: null, // Explicitly null
            available_dates: [{
                date: new Date('2024-12-25'),
                available_slots: 10,
                price: 500000
            }]
        });
        console.log('✅ Successfully created tour with null departure_date:', {
            id: tourWithNullDate._id,
            title: tourWithNullDate.title,
            departure_date: tourWithNullDate.departure_date
        });

        // Test 2: Create tour with valid departure_date
        console.log('\n📝 Test 2: Creating tour with valid departure_date');
        const tourWithDate = await Tour.create({
            title: 'Fixed Date Tour',
            description: 'A tour with fixed departure date',
            provider_id: new mongoose.Types.ObjectId(),
            destination_id: [new mongoose.Types.ObjectId()],
            price: 750000,
            duration: '2 days',
            image: 'test-image2.jpg',
            departure_date: new Date('2024-12-30'), // Valid date
        });
        console.log('✅ Successfully created tour with valid departure_date:', {
            id: tourWithDate._id,
            title: tourWithDate.title,
            departure_date: tourWithDate.departure_date
        });

        // Test 3: Update tour to set departure_date to null
        console.log('\n📝 Test 3: Updating tour to set departure_date to null');
        const updatedTour = await Tour.findByIdAndUpdate(
            tourWithDate._id,
            { departure_date: null },
            { new: true }
        );
        console.log('✅ Successfully updated tour departure_date to null:', {
            id: updatedTour._id,
            title: updatedTour.title,
            departure_date: updatedTour.departure_date
        });

        // Test 4: Query tours with null departure_date
        console.log('\n📝 Test 4: Querying tours with null departure_date');
        const nullDateTours = await Tour.find({ departure_date: null });
        console.log('✅ Found tours with null departure_date:', nullDateTours.length);

        // Test 5: Query tours with non-null departure_date
        console.log('\n📝 Test 5: Querying tours with non-null departure_date');
        const nonNullDateTours = await Tour.find({ departure_date: { $ne: null } });
        console.log('✅ Found tours with non-null departure_date:', nonNullDateTours.length);

        // Test 6: Validate advanced fields
        console.log('\n📝 Test 6: Testing advanced fields');
        const advancedTour = await Tour.create({
            title: 'Advanced Features Tour',
            description: 'A tour showcasing all advanced features',
            provider_id: new mongoose.Types.ObjectId(),
            destination_id: [new mongoose.Types.ObjectId()],
            price: 1200000,
            duration: '3 days',
            image: 'advanced-tour.jpg',
            difficulty: 'moderate',
            meeting_point: 'Hotel Lobby at 8:00 AM',
            capacity: 15,
            departure_date: new Date('2025-01-15'),
            available_dates: [
                {
                    date: new Date('2025-01-15'),
                    available_slots: 15,
                    price: 1200000
                }
            ],
            status: 'active',
            included_services: ['Transport', 'Meals', 'Guide', 'Insurance']
        });
        console.log('✅ Successfully created tour with advanced fields:', {
            id: advancedTour._id,
            title: advancedTour.title,
            difficulty: advancedTour.difficulty,
            meeting_point: advancedTour.meeting_point,
            capacity: advancedTour.capacity,
            departure_date: advancedTour.departure_date,
            available_dates_count: advancedTour.available_dates.length,
            status: advancedTour.status,
            included_services: advancedTour.included_services
        });

        // Cleanup test data
        console.log('\n🧹 Cleaning up test data...');
        await Tour.findByIdAndDelete(tourWithNullDate._id);
        await Tour.findByIdAndDelete(tourWithDate._id);
        await Tour.findByIdAndDelete(advancedTour._id);
        console.log('✅ Test data cleaned up');

        console.log('\n🎉 All tests passed! Nullable departure_date functionality working correctly.');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
};

const runTests = async () => {
    await connectDB();
    await testDepartureDateFunctionality();
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
};

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = { testDepartureDateFunctionality };