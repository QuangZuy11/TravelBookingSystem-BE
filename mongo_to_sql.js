const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");

const uri = "mongodb://localhost:27017";
const dbName = "DB_test";
const outputFile = "DB_test.sql";

// Map MongoDB field names to likely foreign key relationships
const KNOWN_RELATIONSHIPS = {
    'user_id': 'USERS',
    'userId': 'USERS',
    'traveler_id': 'TRAVELERS',
    'travelerId': 'TRAVELERS',
    'provider_id': 'SERVICE_PROVIDERS',
    'providerId': 'SERVICE_PROVIDERS',
    'hotel_id': 'HOTELS',
    'hotelId': 'HOTELS',
    'tour_id': 'TOURS',
    'tourId': 'TOURS',
    'room_id': 'ROOMS',
    'roomId': 'ROOMS',
    'booking_id': 'BOOKINGS',
    'bookingId': 'BOOKINGS',
    'destination_id': 'DESTINATIONS',
    'destinationId': 'DESTINATIONS',
    'poi_id': 'POI',
    'poiId': 'POI',
    'promotion_id': 'PROMOTIONS',
    'promotionId': 'PROMOTIONS',
    'payment_id': 'PAYMENTS',
    'paymentId': 'PAYMENTS',
    'admin_verified_by': 'USERS',
    'verified_by': 'USERS',
    'created_by': 'USERS',
    'updated_by': 'USERS'
};

(async () => {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();

    const output = fs.createWriteStream(outputFile, { flags: "w", encoding: "utf8" });
    console.log(`🔍 Found ${collections.length} collections`);

    output.write(`-- SQL Export from MongoDB database: ${dbName}\n`);
    output.write(`-- Generated on: ${new Date().toISOString()}\n\n`);
    output.write(`-- Set charset to UTF8MB4 to support emoji and special characters\n`);
    output.write(`SET NAMES utf8mb4;\n`);
    output.write(`SET CHARACTER SET utf8mb4;\n`);
    output.write(`SET FOREIGN_KEY_CHECKS = 0;\n\n`);

    const tableSchemas = new Map();
    const foreignKeys = [];

    // First pass: Create tables with proper types
    for (const col of collections) {
        const name = col.name;
        const docs = await db.collection(name).find({}).toArray();

        if (!docs.length) continue;

        console.log(`📋 Processing collection: ${name}`);

        // Detect ALL unique columns across ALL documents
        const allColumns = new Set();
        docs.forEach(doc => {
            Object.keys(doc).forEach(key => {
                if (key !== '_id') allColumns.add(key);
            });
        });

        const columns = Array.from(allColumns);
        const columnTypes = new Map();

        columns.forEach(colName => {
            // Check if it's a foreign key
            if (KNOWN_RELATIONSHIPS[colName]) {
                columnTypes.set(colName, 'VARCHAR(24)'); // ObjectId length
                foreignKeys.push({
                    table: name,
                    column: colName,
                    refTable: KNOWN_RELATIONSHIPS[colName],
                    refColumn: '_id'
                });
            } else {
                // Infer type from ALL documents that have this field
                let sampleValue = null;
                for (const doc of docs) {
                    if (doc[colName] !== null && doc[colName] !== undefined) {
                        sampleValue = doc[colName];
                        break;
                    }
                }

                if (!sampleValue) {
                    columnTypes.set(colName, 'TEXT'); // Default to TEXT if no sample
                } else if (sampleValue instanceof ObjectId || (typeof sampleValue === 'string' && sampleValue.match(/^[a-f0-9]{24}$/))) {
                    columnTypes.set(colName, 'VARCHAR(24)');
                } else if (typeof sampleValue === 'number') {
                    columnTypes.set(colName, Number.isInteger(sampleValue) ? 'INT' : 'DECIMAL(10,2)');
                } else if (typeof sampleValue === 'boolean') {
                    columnTypes.set(colName, 'BOOLEAN');
                } else if (sampleValue instanceof Date) {
                    columnTypes.set(colName, 'DATETIME');
                } else if (Array.isArray(sampleValue)) {
                    columnTypes.set(colName, 'JSON');
                } else if (typeof sampleValue === 'object') {
                    columnTypes.set(colName, 'JSON');
                } else {
                    columnTypes.set(colName, 'TEXT');
                }
            }
        });

        tableSchemas.set(name, { columns, columnTypes });

        // Create table with debug info
        console.log(`   📝 Columns (${columns.length}): ${columns.join(', ')}`);
        output.write(`-- Table: ${name} (${docs.length} documents, ${columns.length} columns)\n`);
        output.write(`DROP TABLE IF EXISTS \`${name}\`;\n`);
        output.write(`CREATE TABLE \`${name}\` (\n`);
        output.write(`  \`_id\` VARCHAR(24) PRIMARY KEY,\n`);

        columns.forEach((colName, idx) => {
            const type = columnTypes.get(colName);
            const comma = idx < columns.length - 1 ? ',' : '';
            output.write(`  \`${colName}\` ${type}${comma}\n`);
        });

        output.write(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`);
    }

    // Second pass: Insert data
    for (const col of collections) {
        const name = col.name;
        const docs = await db.collection(name).find({}).toArray();

        if (!docs.length) continue;

        const schema = tableSchemas.get(name);
        const { columns, columnTypes } = schema;

        output.write(`-- Data for table: ${name}\n`);

        for (const doc of docs) {
            const _id = doc._id.toString();
            const values = columns.map(c => {
                let val = doc[c];

                // Handle missing fields - return NULL instead of crash
                if (val === null || val === undefined) return "NULL";

                // Handle ObjectId
                if (val instanceof ObjectId) {
                    return `'${val.toString()}'`;
                }

                // Handle arrays and objects (convert to JSON)
                if (Array.isArray(val) || (typeof val === 'object' && !(val instanceof Date))) {
                    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
                    return `'${jsonStr}'`;
                }

                // Handle dates
                if (val instanceof Date) {
                    return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                }

                // Handle numbers
                if (typeof val === "number") return val;

                // Handle booleans
                if (typeof val === "boolean") return val ? 1 : 0;

                // Handle strings - escape single quotes
                val = String(val).replace(/'/g, "''");
                return `'${val}'`;
            });

            output.write(`INSERT INTO \`${name}\` (\`_id\`, ${columns.map(c => `\`${c}\``).join(", ")}) VALUES ('${_id}', ${values.join(", ")});\n`);
        }
        output.write("\n");
        console.log(`✅ Exported collection: ${name} (${docs.length} documents)`);
    }    // Third pass: Add foreign key constraints
    if (foreignKeys.length > 0) {
        output.write(`\n-- Add Foreign Key Constraints\n`);
        output.write(`SET FOREIGN_KEY_CHECKS = 1;\n\n`);

        foreignKeys.forEach((fk, idx) => {
            const constraintName = `fk_${fk.table}_${fk.column}_${idx}`;
            output.write(`ALTER TABLE \`${fk.table}\`\n`);
            output.write(`  ADD CONSTRAINT \`${constraintName}\`\n`);
            output.write(`  FOREIGN KEY (\`${fk.column}\`)\n`);
            output.write(`  REFERENCES \`${fk.refTable}\`(\`${fk.refColumn}\`)\n`);
            output.write(`  ON DELETE CASCADE ON UPDATE CASCADE;\n\n`);
            console.log(`🔗 Added FK: ${fk.table}.${fk.column} -> ${fk.refTable}.${fk.refColumn}`);
        });
    }

    await client.close();
    output.end();
    console.log(`\n🎉 Done! File created: ${outputFile}`);
    console.log(`📊 Summary:`);
    console.log(`   - ${collections.length} collections exported`);
    console.log(`   - ${foreignKeys.length} foreign key relationships created`);
})();
