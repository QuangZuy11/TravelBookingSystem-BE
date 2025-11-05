const mongoose = require('mongoose');

// Get MongoDB URI from .env file
require('dotenv').config();
const mongoUri = process.env.MONGO_URI;

async function checkHotel() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB successfully');

        const hotelId = '690af45ac51765077e033ba2';

        // Get the Hotels collection
        const Hotels = mongoose.connection.collection('HOTELS');

        // Find hotel
        const hotel = await Hotels.findOne({ _id: new mongoose.Types.ObjectId(hotelId) });
        console.log('Found hotel:', hotel);

        if (hotel && hotel.destination_id) {
            const Destinations = mongoose.connection.collection('DESTINATIONS');

            // Try to find destination by ID
            const destination = await Destinations.findOne({ _id: hotel.destination_id });
            console.log('\nDestination for this hotel:', destination);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.connection.close();
    }
}

checkHotel();