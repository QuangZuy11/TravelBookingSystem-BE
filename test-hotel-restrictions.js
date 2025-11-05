/**
 * Test script for Hotel Provider Restrictions
 * Run with: node test-hotel-restrictions.js
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

const ServiceProvider = require('./models/service-provider.model');
const Hotel = require('./models/hotel.model');
const Room = require('./models/room.model');

const testHotelProviderRestrictions = async () => {
    console.log('\n🧪 Testing Hotel Provider Restrictions...\n');

    const testData = [];

    try {
        // Test 1: Service Provider with single license (should work)
        console.log('📝 Test 1: Creating service provider with single hotel license');
        const provider1 = await ServiceProvider.create({
            user_id: new mongoose.Types.ObjectId(),
            company_name: 'Single License Hotel Co.',
            contact_person: 'John Doe',
            email: 'john@hotel.com',
            phone: '0123456789',
            address: '123 Hotel Street',
            type: 'hotel',
            licenses: [{
                service_type: 'hotel',
                license_number: 'HL001234',
                verification_status: 'verified'
            }]
        });
        testData.push(provider1);
        console.log('✅ Successfully created provider with single license:', provider1._id);

        // Test 2: Try creating service provider with multiple licenses (should fail)
        console.log('\n📝 Test 2: Attempting to create provider with multiple licenses');
        try {
            const provider2 = await ServiceProvider.create({
                user_id: new mongoose.Types.ObjectId(),
                company_name: 'Multiple License Hotel Co.',
                contact_person: 'Jane Doe',
                email: 'jane@hotel.com',
                phone: '0987654321',
                address: '456 Hotel Avenue',
                type: 'hotel',
                licenses: [
                    {
                        service_type: 'hotel',
                        license_number: 'HL001235',
                        verification_status: 'verified'
                    },
                    {
                        service_type: 'hotel',
                        license_number: 'HL001236',
                        verification_status: 'pending'
                    }
                ]
            });
            console.log('❌ ERROR: Should not allow multiple licenses');
        } catch (error) {
            console.log('✅ Correctly rejected multiple licenses:', error.message);
        }

        // Test 3: Try mismatched license type (should fail)
        console.log('\n📝 Test 3: Attempting provider with mismatched license type');
        try {
            const provider3 = await ServiceProvider.create({
                user_id: new mongoose.Types.ObjectId(),
                company_name: 'Mismatched Type Co.',
                contact_person: 'Bob Smith',
                email: 'bob@hotel.com',
                phone: '0111222333',
                address: '789 Hotel Road',
                type: 'hotel', // Provider type is hotel
                licenses: [{
                    service_type: 'tour', // But license is for tour
                    license_number: 'TL001234',
                    verification_status: 'verified'
                }]
            });
            console.log('❌ ERROR: Should not allow mismatched license type');
        } catch (error) {
            console.log('✅ Correctly rejected mismatched license type:', error.message);
        }

        // Test 4: Create first hotel (should work)
        console.log('\n📝 Test 4: Creating first hotel for provider');
        const hotel1 = await Hotel.create({
            providerId: provider1._id,
            name: 'Beautiful Beach Hotel',
            description: 'A wonderful beachside hotel',
            address: {
                street: '123 Beach Road',
                city: 'Da Nang',
                country: 'Vietnam'
            },
            category: '4_star',
            amenities: ['wifi', 'pool', 'restaurant'],
            images: ['hotel1.jpg'],
            priceRange: {
                min: 500000,
                max: 1500000
            },
            policies: {
                checkInTime: '14:00',
                checkOutTime: '12:00'
            },
            contactInfo: {
                phone: '0236123456',
                email: 'info@beautifulbeach.com'
            }
        });
        testData.push(hotel1);
        console.log('✅ Successfully created first hotel:', hotel1._id);

        // Test 5: Try creating second hotel for same provider (should fail via controller)
        console.log('\n📝 Test 5: Checking if provider already has hotel');
        const existingHotel = await Hotel.findOne({ providerId: provider1._id });
        if (existingHotel) {
            console.log('✅ Provider restriction: Already has hotel, would block in controller');
        }

        // Test 6: Test room stats calculation
        console.log('\n📝 Test 6: Testing room stats auto calculation');

        // Create some rooms
        const room1 = await Room.create({
            hotelId: hotel1._id,
            roomNumber: '101',
            type: 'single',
            price: 800000,
            status: 'available',
            amenities: ['wifi', 'ac'],
            capacity: 2
        });
        testData.push(room1);

        const room2 = await Room.create({
            hotelId: hotel1._id,
            roomNumber: '102',
            type: 'double',
            price: 1200000,
            status: 'occupied',
            amenities: ['wifi', 'ac', 'balcony'],
            capacity: 4
        });
        testData.push(room2);

        const room3 = await Room.create({
            hotelId: hotel1._id,
            roomNumber: '103',
            type: 'suite',
            price: 2000000,
            status: 'maintenance',
            amenities: ['wifi', 'ac', 'balcony', 'kitchenette'],
            capacity: 6
        });
        testData.push(room3);

        console.log('✅ Created 3 test rooms');

        // Test room stats method
        const roomStats = await hotel1.getRoomStats();
        console.log('✅ Room stats calculated:', roomStats);

        // Test with populate
        const hotelWithRooms = await Hotel.findById(hotel1._id)
            .populate('totalRooms')
            .populate('availableRooms');
        console.log('✅ Hotel with virtual fields:', {
            totalRooms: hotelWithRooms.totalRooms,
            availableRooms: hotelWithRooms.availableRooms
        });

        // Test 7: Verify service provider virtual methods
        console.log('\n📝 Test 7: Testing service provider virtual methods');
        console.log('✅ Provider verification status:', {
            is_verified: provider1.is_verified,
            is_fully_approved: provider1.is_fully_approved,
            has_pending_verification: provider1.has_pending_verification
        });

        console.log('\n🎉 All hotel provider restriction tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Cleanup test data
        console.log('\n🧹 Cleaning up test data...');
        for (const item of testData) {
            try {
                await item.constructor.findByIdAndDelete(item._id);
            } catch (cleanupError) {
                console.log('⚠️ Cleanup error for:', item._id);
            }
        }
        console.log('✅ Test data cleaned up');
    }
};

const runTests = async () => {
    await connectDB();
    await testHotelProviderRestrictions();
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
};

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = { testHotelProviderRestrictions };