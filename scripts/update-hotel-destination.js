require('dotenv').config();
const mongoose = require('mongoose');
const Hotel = require('../models/hotel.model');
const Destination = require('../models/destination.model');

async function main() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/travelbooking');
        console.log('Connected to MongoDB');

        // Get hotel
        const hotelId = '690af45ac51765077e033ba2';
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) {
            console.log('Hotel not found');
            return;
        }

        // Get destination for Ho Chi Minh City
        const destination = await Destination.findOne({
            'location.city': { $regex: new RegExp('ho chi minh', 'i') }
        });

        if (!destination) {
            console.log('No destination found for Ho Chi Minh City');

            // Create new destination
            const newDestination = await Destination.create({
                name: 'Ho Chi Minh City',
                description: 'The largest city in Vietnam, known for its vibrant culture and history.',
                location: {
                    city: 'Ho Chi Minh City',
                    country: 'Vietnam',
                    coordinates: {
                        latitude: 10.7769,
                        longitude: 106.7009
                    }
                },
                type: 'city',
                languages: ['Vietnamese', 'English'],
                timeZone: 'GMT+7',
                localCurrency: 'VND'
            });

            console.log('Created new destination:', newDestination._id);

            // Update hotel
            hotel.destination_id = newDestination._id;
            await hotel.save();

            console.log('Updated hotel with new destination');
        } else {
            // Update hotel with existing destination
            hotel.destination_id = destination._id;
            await hotel.save();

            console.log('Updated hotel with existing destination:', destination._id);
        }

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();