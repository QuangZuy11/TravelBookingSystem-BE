const mongoose = require('mongoose');

// Get MongoDB URI from .env file
require('dotenv').config();
const mongoUri = process.env.MONGO_URI;

async function verifyHotelDestination() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB successfully');

        const hotelId = '690af45ac51765077e033ba2';

        // Get collections
        const Hotels = mongoose.connection.collection('HOTELS');
        const Destinations = mongoose.connection.collection('DESTINATIONS');

        // Find hotel
        const hotel = await Hotels.findOne({ _id: new mongoose.Types.ObjectId(hotelId) });
        console.log('Found hotel:', JSON.stringify(hotel, null, 2));

        if (hotel && hotel.destination_id) {
            // Find destination
            const destination = await Destinations.findOne({ _id: hotel.destination_id });
            console.log('\nFound destination:', JSON.stringify(destination, null, 2));
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.connection.close();
    }
}

verifyHotelDestination();