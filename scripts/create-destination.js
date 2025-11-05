require('dotenv').config();
const mongoose = require('mongoose');
const Hotel = require('../models/hotel.model');
const Destination = require('../models/destination.model');

async function main() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Get hotel
        const hotel = await Hotel.findById('690af45ac51765077e033ba2');
        if (!hotel) {
            console.log('Hotel not found');
            return;
        }

        // Create new destination for Ho Chi Minh City
        const hcmDestination = new Destination({
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

        // Save destination
        const savedDestination = await hcmDestination.save();
        console.log('Created new destination:', savedDestination._id);

        // Update hotel with new destination_id
        hotel.destination_id = savedDestination._id;
        await hotel.save();

        console.log('Updated hotel with new destination');

        // Verify the update
        const updatedHotel = await Hotel.findById(hotel._id).populate('destination_id');
        console.log('Updated hotel destination:', updatedHotel.destination_id);

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();