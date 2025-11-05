const mongoose = require('mongoose');

// Get MongoDB URI from .env file
require('dotenv').config();
const mongoUri = process.env.MONGO_URI;

async function listCollections() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB successfully');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections in database:', collections.map(c => c.name));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.connection.close();
    }
}

listCollections();