const mongoose = require('mongoose');

// Get MongoDB URI from .env file
require('dotenv').config();
const mongoUri = process.env.MONGO_URI;

async function checkDestination() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB successfully');

        const destinationId = '268370832bb8a04f630d40dc';

        // Get the Destinations collection
        const Destinations = mongoose.connection.collection('DESTINATIONS');

        try {
            // Try to find destination by ID
            const destination = await Destinations.findOne({ _id: new mongoose.Types.ObjectId(destinationId) });
            console.log('Found destination:', destination);
        } catch (err) {
            console.error('Error when searching by ID:', err.message);

            // If ID is invalid, try searching as string
            const destinationByString = await Destinations.findOne({ _id: destinationId });
            console.log('Found destination by string ID:', destinationByString);
        }

        // List first few destinations to verify collection is accessible
        const sampleDestinations = await Destinations.find().limit(3).toArray();
        console.log('\nSample destinations:', sampleDestinations);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.connection.close();
    }
}

checkDestination();