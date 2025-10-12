/**
 * Migration Script: Add admin verification fields to existing ServiceProviders
 * Run: node scripts/migrate-add-admin-verified-fields.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const ServiceProvider = require('../models/service-provider.model');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find all providers that don't have admin_verified field
        const providers = await ServiceProvider.find({
            admin_verified: { $exists: false }
        });

        console.log(`📊 Found ${providers.length} providers to migrate`);

        let updated = 0;
        for (const provider of providers) {
            // Add default values for new fields
            provider.admin_verified = false;
            provider.admin_verified_at = null;
            provider.admin_verified_by = null;
            provider.admin_rejection_reason = null;

            await provider.save();
            updated++;
            console.log(`✅ Updated: ${provider.company_name} (${provider._id})`);
        }

        console.log(`\n🎉 Migration completed: ${updated}/${providers.length} providers updated`);

        // Show summary
        const allProviders = await ServiceProvider.find();
        const verified = allProviders.filter(p => p.admin_verified).length;
        const pending = allProviders.filter(p => !p.admin_verified).length;

        console.log('\n📊 Summary:');
        console.log(`   Total providers: ${allProviders.length}`);
        console.log(`   Admin verified: ${verified}`);
        console.log(`   Pending admin verification: ${pending}`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    }
}

migrate();
