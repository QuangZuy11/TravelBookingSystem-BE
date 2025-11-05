#!/usr/bin/env node
require('dotenv').config();

const mongoose = require('mongoose');
const path = require('path');

// Ensure models load using project relative paths
const root = path.resolve(__dirname, '..');
const AiGeneratedItinerary = require(path.join(root, 'models', 'ai_generated_itineraries.model'));
const Itinerary = require(path.join(root, 'models', 'itinerary.model'));

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || '';

async function main() {
    if (!MONGO_URI) {
        console.error('Missing MONGO_URI environment variable. Set MONGO_URI and re-run.');
        console.error('Example (bash):\n  export MONGO_URI="mongodb://user:pass@localhost:27017/dbname"\n  node scripts/fetch_ai_itineraries.js');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('✅ Connected to MongoDB');

        if (process.argv[2]) {
            // If an ID argument is provided, fetch that specific AiGeneratedItinerary and print raw itinerary_data
            const id = process.argv[2];
            const doc = await AiGeneratedItinerary.findById(id).lean();
            if (!doc) {
                console.error('No AiGeneratedItinerary found for id', id);
                process.exit(2);
            }

            console.log('Raw AiGeneratedItinerary document (partial):');
            console.log(JSON.stringify({
                _id: doc._id,
                status: doc.status,
                destination: doc.destination,
                duration_days: doc.duration_days,
                itinerary_data_preview: Array.isArray(doc.itinerary_data) ? doc.itinerary_data.map(d => ({ itinerary_id: d.itinerary?._id || d.itinerary, origin_id: d.itinerary?._id ? undefined : d.itinerary?.origin_id })) : doc.itinerary_data
            }, null, 2));

            // Also print the linked Itinerary docs for origin_id and for customized versions
            const linkedByOrigin = await Itinerary.find({ origin_id: doc._id }).sort({ day_number: 1 }).lean();
            console.log(`\nItineraries with origin_id = ${doc._id}: ${linkedByOrigin.length}`);
            for (const day of linkedByOrigin) {
                console.log(`  [origin] Day ${day.day_number} - id: ${day._id} | type: ${day.type} | title: ${day.title}`);
            }

            // If this is a customized record, also show itineraries pointing to the original AI record (if available in itinerary_data)
            if (doc.status === 'custom') {
                const referencedOriginalIds = new Set();
                if (Array.isArray(doc.itinerary_data)) {
                    for (const item of doc.itinerary_data) {
                        if (item.itinerary && item.itinerary._id) referencedOriginalIds.add(String(item.itinerary._id));
                    }
                }

                if (referencedOriginalIds.size > 0) {
                    console.log('\nReferenced original itinerary IDs found in itinerary_data:');
                    for (const rid of referencedOriginalIds) console.log('  -', rid);

                    // Fetch those original docs
                    const originals = await Itinerary.find({ _id: { $in: Array.from(referencedOriginalIds) } }).lean();
                    console.log(`\nFetched ${originals.length} original Itinerary docs from referenced IDs:`);
                    for (const o of originals) console.log(`  [referenced] Day ${o.day_number} id:${o._id} origin_id:${o.origin_id} type:${o.type}`);
                }
            }

            process.exit(0);
        }

        const docs = await AiGeneratedItinerary.find({}).sort({ created_at: -1 }).limit(10).lean();
        console.log(`Found ${docs.length} AiGeneratedItinerary documents`);

        for (const d of docs) {
            console.log('\n---');
            console.log(`_id: ${d._id}`);
            console.log(`status: ${d.status} | destination: ${d.destination} | duration_days: ${d.duration_days} | participant_number: ${d.participant_number || 'N/A'}`);
            console.log(`summary: ${d.summary || ''}`);

            // Find linked Itinerary day documents
            const days = await Itinerary.find({ origin_id: d._id }).sort({ day_number: 1 }).lean();
            console.log(`  linked Itineraries: ${days.length}`);
            for (const day of days) {
                console.log(`    Day ${day.day_number} - id: ${day._id} | title: ${day.title} | activities: ${day.activities?.length || 0} | day_total: ${day.day_total || 0}`);
            }
        }

        await mongoose.disconnect();
        console.log('\n✅ Done');
        process.exit(0);
    } catch (err) {
        console.error('Error fetching itineraries:', err);
        try { await mongoose.disconnect(); } catch (e) { }
        process.exit(1);
    }
}

main();
