// Script to create proper indexes for FlightClass collection
const mongoose = require('mongoose');
require('dotenv').config();

async function createIndexes() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Load the FlightClass model with proper schema
        const FlightClass = require('./models/FlightClass');
        
        console.log('🔧 Creating indexes for FlightClass...');
        
        // This will create all indexes defined in the schema
        await FlightClass.createIndexes();
        
        console.log('✅ Indexes created successfully\n');
        
        // Verify indexes
        const indexes = await FlightClass.collection.getIndexes();
        console.log('📋 Current indexes on FlightClass collection:');
        console.log(JSON.stringify(indexes, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    }
}

createIndexes();
