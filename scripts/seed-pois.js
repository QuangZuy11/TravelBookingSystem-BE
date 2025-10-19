const mongoose = require('mongoose');
require('dotenv').config();

const PointOfInterest = require('../models/point-of-interest.model');
const Destination = require('../models/destination.model');

async function seedPOIs() {
    try {
        console.log('🌱 Starting POI seeding...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected\n');

        // Check if destination exists
        const destinationId = '68f38b5f15fb205c26997e4a';
        let destination = await Destination.findById(destinationId);

        if (!destination) {
            console.log('⚠️  Destination not found, creating Hanoi...');
            destination = await Destination.create({
                _id: destinationId,
                name: 'Hanoi',
                country: 'Vietnam',
                description: 'Capital city of Vietnam with rich history and culture'
            });
            console.log('✅ Created destination:', destination.name);
        } else {
            console.log('✅ Found destination:', destination.name);
        }

        console.log('\n📍 Creating POIs for Hanoi...\n');

        // POIs to seed
        const pois = [
            {
                destinationId: destinationId,
                name: 'Old Quarter Walking Tour',
                description: 'Explore the historic Old Quarter with 36 ancient streets, each named after the goods once sold there',
                type: 'cultural',
                location: {
                    address: 'Old Quarter, Hoan Kiem District, Hanoi',
                    coordinates: { latitude: 21.0341, longitude: 105.8516 }
                },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.5, count: 1000 },
                status: 'active'
            },
            {
                destinationId: destinationId,
                name: 'Imperial Citadel of Thang Long',
                description: 'UNESCO World Heritage Site - ancient royal fortress with 1000 years of history',
                type: 'historical',
                location: {
                    address: '9C Hoàng Diệu, Hanoi',
                    coordinates: { latitude: 21.0340, longitude: 105.8372 }
                },
                entryFee: { adult: 30000, child: 15000, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 30 },
                ratings: { average: 4.7, count: 850 },
                status: 'active'
            },
            {
                destinationId: destinationId,
                name: 'Hoan Kiem Lake',
                description: 'Iconic lake in the heart of Hanoi with Turtle Tower and Ngoc Son Temple',
                type: 'natural',
                location: {
                    address: 'Hoan Kiem District, Hanoi',
                    coordinates: { latitude: 21.0288, longitude: 105.8525 }
                },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.6, count: 2500 },
                status: 'active'
            },
            {
                destinationId: destinationId,
                name: 'Vietnam Museum of Ethnology',
                description: 'Comprehensive museum showcasing 54 ethnic groups of Vietnam',
                type: 'cultural',
                location: {
                    address: 'Nguyen Van Huyen, Cau Giay, Hanoi',
                    coordinates: { latitude: 21.0387, longitude: 105.7807 }
                },
                entryFee: { adult: 40000, child: 20000, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.8, count: 1200 },
                status: 'active'
            },
            {
                destinationId: destinationId,
                name: 'Tran Quoc Pagoda',
                description: 'Oldest Buddhist temple in Hanoi, located on an island in West Lake',
                type: 'religious',
                location: {
                    address: 'Thanh Nien, Tay Ho, Hanoi',
                    coordinates: { latitude: 21.0465, longitude: 105.8361 }
                },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 0, minutes: 45 },
                ratings: { average: 4.4, count: 680 },
                status: 'active'
            },
            {
                destinationId: destinationId,
                name: 'Ho Chi Minh Mausoleum',
                description: "Final resting place of Ho Chi Minh, Vietnam's revolutionary leader",
                type: 'historical',
                location: {
                    address: '2 Hung Vuong, Ba Dinh, Hanoi',
                    coordinates: { latitude: 21.0369, longitude: 105.8348 }
                },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.5, count: 3000 },
                status: 'active'
            },
            {
                destinationId: destinationId,
                name: 'Temple of Literature',
                description: "Vietnam's first national university, built in 1070, dedicated to Confucius",
                type: 'historical',
                location: {
                    address: '58 Quoc Tu Giam, Dong Da, Hanoi',
                    coordinates: { latitude: 21.0279, longitude: 105.8352 }
                },
                entryFee: { adult: 30000, child: 15000, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.6, count: 1800 },
                status: 'active'
            },
            {
                destinationId: destinationId,
                name: 'Water Puppet Theatre',
                description: 'Traditional Vietnamese art form with puppets performing on water',
                type: 'entertainment',
                location: {
                    address: '57B Dinh Tien Hoang, Hoan Kiem, Hanoi',
                    coordinates: { latitude: 21.0291, longitude: 105.8524 }
                },
                entryFee: { adult: 100000, child: 50000, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.3, count: 950 },
                status: 'active'
            }
        ];

        // Clear existing POIs for this destination
        const deleted = await PointOfInterest.deleteMany({ destinationId });
        console.log(`🗑️  Deleted ${deleted.deletedCount} existing POIs\n`);

        // Insert new POIs
        const created = await PointOfInterest.insertMany(pois);
        console.log(`✅ Created ${created.length} POIs:\n`);

        created.forEach((poi, index) => {
            console.log(`   ${index + 1}. ${poi.name}`);
            console.log(`      Type: ${poi.type}`);
            console.log(`      Duration: ${poi.recommendedDuration.hours}h ${poi.recommendedDuration.minutes}m`);
            console.log(`      Rating: ${poi.ratings.average} ⭐ (${poi.ratings.count} reviews)`);
            console.log(`      Fee: ${poi.entryFee.adult} ${poi.entryFee.currency}`);
            console.log('');
        });

        console.log('🎉 POI seeding completed!\n');
        console.log('Test with:');
        console.log(`  curl http://localhost:3000/api/poi/destination/${destinationId}`);

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error seeding POIs:', error);
        process.exit(1);
    }
}

seedPOIs();
