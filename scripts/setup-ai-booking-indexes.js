/**
 * Database Setup Script for AI Itinerary Bookings
 * 
 * This script creates necessary indexes for optimal query performance
 * Run this script after deploying the AI Itinerary Booking feature
 * 
 * Usage:
 * node scripts/setup-ai-booking-indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AiItineraryBooking = require('../models/ai-itinerary-booking.model');

async function setupIndexes() {
    try {
        console.log('🔧 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n📊 Creating indexes for AI_ITINERARY_BOOKINGS collection...');

        const collection = mongoose.connection.db.collection('AI_ITINERARY_BOOKINGS');

        // Drop existing indexes (except _id)
        console.log('\n🗑️  Dropping existing indexes...');
        try {
            const existingIndexes = await collection.indexes();
            console.log('Existing indexes:', existingIndexes.map(i => i.name).join(', '));

            for (const index of existingIndexes) {
                if (index.name !== '_id_') {
                    await collection.dropIndex(index.name);
                    console.log(`  ✓ Dropped index: ${index.name}`);
                }
            }
        } catch (error) {
            console.log('  ⚠️  No indexes to drop or error:', error.message);
        }

        // Create compound indexes for performance
        console.log('\n🔨 Creating compound indexes...');

        // 1. User bookings with status and date
        await collection.createIndex(
            { user_id: 1, status: 1, created_at: -1 },
            { name: 'user_status_date_idx' }
        );
        console.log('  ✓ Created: user_status_date_idx');

        // 2. Provider bookings with status and start date
        await collection.createIndex(
            { provider_id: 1, status: 1, start_date: 1 },
            { name: 'provider_status_startdate_idx' }
        );
        console.log('  ✓ Created: provider_status_startdate_idx');

        // 3. Status with created date (for admin dashboard)
        await collection.createIndex(
            { status: 1, created_at: -1 },
            { name: 'status_created_idx' }
        );
        console.log('  ✓ Created: status_created_idx');

        // Create single field indexes
        console.log('\n🔨 Creating single field indexes...');

        // 4. AI Itinerary reference
        await collection.createIndex(
            { ai_itinerary_id: 1 },
            { name: 'ai_itinerary_idx' }
        );
        console.log('  ✓ Created: ai_itinerary_idx');

        // 5. User ID
        await collection.createIndex(
            { user_id: 1 },
            { name: 'user_idx' }
        );
        console.log('  ✓ Created: user_idx');

        // 6. Provider ID
        await collection.createIndex(
            { provider_id: 1 },
            { name: 'provider_idx', sparse: true } // sparse because provider_id can be null
        );
        console.log('  ✓ Created: provider_idx (sparse)');

        // 7. Destination
        await collection.createIndex(
            { destination: 1 },
            { name: 'destination_idx' }
        );
        console.log('  ✓ Created: destination_idx');

        // 8. Start date
        await collection.createIndex(
            { start_date: 1 },
            { name: 'start_date_idx' }
        );
        console.log('  ✓ Created: start_date_idx');

        // 9. Status
        await collection.createIndex(
            { status: 1 },
            { name: 'status_idx' }
        );
        console.log('  ✓ Created: status_idx');

        // Create text index for search
        console.log('\n🔨 Creating text search index...');
        await collection.createIndex(
            {
                'contact_info.name': 'text',
                'contact_info.email': 'text',
                destination: 'text'
            },
            {
                name: 'search_text_idx',
                weights: {
                    'contact_info.name': 10,
                    'contact_info.email': 5,
                    destination: 8
                }
            }
        );
        console.log('  ✓ Created: search_text_idx');

        // Verify all indexes
        console.log('\n✅ Verifying created indexes...');
        const indexes = await collection.indexes();
        console.log(`\n📊 Total indexes: ${indexes.length}`);
        indexes.forEach(index => {
            console.log(`  • ${index.name}: ${JSON.stringify(index.key)}`);
        });

        // Get collection stats
        console.log('\n📈 Collection statistics:');
        const stats = await collection.stats();
        console.log(`  • Document count: ${stats.count}`);
        console.log(`  • Storage size: ${(stats.storageSize / 1024).toFixed(2)} KB`);
        console.log(`  • Total index size: ${(stats.totalIndexSize / 1024).toFixed(2)} KB`);

        console.log('\n✅ Index setup completed successfully!');
        console.log('\n💡 Tips:');
        console.log('  • Run db.AI_ITINERARY_BOOKINGS.getIndexes() in MongoDB shell to verify');
        console.log('  • Use .explain() on queries to check if indexes are being used');
        console.log('  • Monitor query performance using MongoDB profiler');

    } catch (error) {
        console.error('\n❌ Error setting up indexes:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the setup
if (require.main === module) {
    setupIndexes()
        .then(() => {
            console.log('\n🎉 Setup completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Setup failed:', error);
            process.exit(1);
        });
}

module.exports = setupIndexes;
