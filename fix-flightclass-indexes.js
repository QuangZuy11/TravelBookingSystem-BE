// Script to check and drop old indexes from FlightClass collection
const mongoose = require('mongoose');
require('dotenv').config();

async function checkAndFixIndexes() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const FlightClass = mongoose.model('FlightClass', new mongoose.Schema({}));
        
        // Get all indexes
        const indexes = await FlightClass.collection.getIndexes();
        console.log('📋 Current indexes on FlightClass collection:');
        console.log(JSON.stringify(indexes, null, 2));
        
        // Check for name_1 index
        if (indexes.name_1) {
            console.log('\n⚠️  Found old "name_1" index!');
            console.log('🔧 Dropping "name_1" index...');
            
            await FlightClass.collection.dropIndex('name_1');
            console.log('✅ Successfully dropped "name_1" index');
            
            // Verify
            const newIndexes = await FlightClass.collection.getIndexes();
            console.log('\n📋 Updated indexes:');
            console.log(JSON.stringify(newIndexes, null, 2));
        } else {
            console.log('\n✅ No old "name_1" index found. Database is clean!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    }
}

checkAndFixIndexes();
