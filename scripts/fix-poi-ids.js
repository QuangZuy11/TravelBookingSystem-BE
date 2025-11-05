const mongoose = require('mongoose');

// Get MongoDB URI from .env file
require('dotenv').config();
const mongoUri = process.env.MONGO_URI;

async function fixPoiIds() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB successfully');

        // Get collections
        const POIs = mongoose.connection.collection('POINTS_OF_INTEREST');
        
        // Get all POIs
        const pois = await POIs.find({}).toArray();
        console.log(`Found ${pois.length} POIs to check`);
        
        // Keep track of changes
        let updatedCount = 0;
        let destinationIdUpdatedCount = 0;
        
        // Process each POI
        for (const poi of pois) {
            let needsUpdate = false;
            let updatedPoi = { ...poi };

            // Check if _id is string
            if (typeof poi._id === 'string') {
                try {
                    updatedPoi._id = new mongoose.Types.ObjectId(poi._id);
                    needsUpdate = true;
                } catch (err) {
                    console.error(`Failed to convert _id for POI ${poi._id}:`, err.message);
                    continue; // Skip this POI if _id can't be converted
                }
            }

            // Check if destinationId is string
            if (typeof poi.destinationId === 'string') {
                try {
                    updatedPoi.destinationId = new mongoose.Types.ObjectId(poi.destinationId);
                    needsUpdate = true;
                    destinationIdUpdatedCount++;
                } catch (err) {
                    console.error(`Failed to convert destinationId for POI ${poi._id}:`, err.message);
                }
            }

            if (needsUpdate) {
                try {
                    // Delete old document
                    await POIs.deleteOne({ _id: poi._id });
                    
                    // Insert updated document
                    const result = await POIs.insertOne(updatedPoi);
                    
                    if (result.acknowledged) {
                        console.log(`Updated POI ${poi._id}`);
                        updatedCount++;
                    }
                } catch (err) {
                    console.error(`Failed to update POI ${poi._id}:`, err.message);
                }
            }
        }
        
        console.log(`\nUpdate complete:`);
        console.log(`- Updated ${updatedCount} POIs total`);
        console.log(`- Converted ${destinationIdUpdatedCount} destinationIds to ObjectId`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.connection.close();
    }
}

fixPoiIds();