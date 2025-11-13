require('dotenv').config();
const mongoose = require('mongoose');
const Destination = require('../models/destination.model');

async function getDestinations() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const destinations = await Destination.find({}).select('_id destination_name country region');

        console.log('\n=== DESTINATIONS IN DATABASE ===\n');
        destinations.forEach(dest => {
            console.log(`ID: ${dest._id}`);
            console.log(`Name: ${dest.destination_name}`);
            console.log(`Country: ${dest.country}`);
            console.log(`Region: ${dest.region}`);
            console.log('---');
        });

        console.log(`\nTotal destinations: ${destinations.length}`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

getDestinations();
