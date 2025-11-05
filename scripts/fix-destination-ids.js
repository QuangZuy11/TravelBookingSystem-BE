const mongoose = require('mongoose');

// Get MongoDB URI from .env file
require('dotenv').config();
const mongoUri = process.env.MONGO_URI;

async function fixDestinationIds() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB successfully');

        // Get collections
        const Destinations = mongoose.connection.collection('DESTINATIONS');

        // Get all destinations
        const destinations = await Destinations.find({}).toArray();
        console.log(`Found ${destinations.length} destinations to check`);

        // Keep track of changes
        let updatedCount = 0;

        // Process each destination
        for (const destination of destinations) {
            if (typeof destination._id === 'string') {
                try {
                    // Try to convert string ID to ObjectId
                    const newId = new mongoose.Types.ObjectId(destination._id);

                    // Delete old document
                    await Destinations.deleteOne({ _id: destination._id });

                    // Insert new document with ObjectId
                    const result = await Destinations.insertOne({
                        ...destination,
                        _id: newId
                    });

                    if (result.acknowledged) {
                        console.log(`Updated destination ${destination._id} to ObjectId`);
                        updatedCount++;
                    }
                } catch (err) {
                    console.error(`Failed to update destination ${destination._id}:`, err.message);
                }
            }
        }

        console.log(`\nUpdate complete. Updated ${updatedCount} destinations to use ObjectId`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.connection.close();
    }
}

fixDestinationIds();