require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Print current database name
        console.log('\nCurrent database:', mongoose.connection.name);

        // Get the DESTINATIONS collection
        const destinations = mongoose.connection.db.collection('DESTINATIONS');

        console.log('\nAll destinations in DB:');
        const allDestinations = await destinations.find({}).toArray();
        console.log(JSON.stringify(allDestinations, null, 2));

        // Get the HOTELS collection
        const hotels = mongoose.connection.db.collection('HOTELS');

        console.log('\nLooking for hotel:');
        const hotel = await hotels.findOne({
            _id: new mongoose.Types.ObjectId('690af45ac51765077e033ba2')
        });
        console.log('Hotel:', JSON.stringify(hotel, null, 2));

        if (hotel && hotel.destination_id) {
            console.log('\nLooking for destination with ID:', hotel.destination_id);
            const destination = await destinations.findOne({
                _id: hotel.destination_id
            });
            console.log('Found destination:', destination);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();