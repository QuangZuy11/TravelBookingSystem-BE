/**
 * Script để migrate và chuẩn hóa amenities trong database
 * Chuyển đổi tất cả amenities về định dạng chuẩn
 * 
 * Usage: node scripts/migrate-amenities.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Hotel = require('../models/hotel.model');
const { normalizeAmenity, STANDARD_AMENITIES } = require('../constants/amenities.constants');

const migrateAmenities = async () => {
    try {
        console.log('🔄 Đang kết nối MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Đã kết nối MongoDB');

        console.log('\n📊 Đang lấy danh sách hotels...');
        const hotels = await Hotel.find({});
        console.log(`✅ Tìm thấy ${hotels.length} hotels`);

        let updatedCount = 0;
        let unchangedCount = 0;
        let errorCount = 0;

        console.log('\n🔄 Bắt đầu migrate amenities...\n');

        for (const hotel of hotels) {
            try {
                const originalAmenities = hotel.amenities || [];
                const normalizedAmenities = [];
                const removedAmenities = [];

                // Normalize từng amenity
                originalAmenities.forEach(amenity => {
                    const normalized = normalizeAmenity(amenity);
                    if (normalized && !normalizedAmenities.includes(normalized)) {
                        normalizedAmenities.push(normalized);
                    } else if (!normalized) {
                        removedAmenities.push(amenity);
                    }
                });

                // Kiểm tra xem có thay đổi không
                const hasChanged = JSON.stringify(originalAmenities.sort()) !== JSON.stringify(normalizedAmenities.sort());

                if (hasChanged) {
                    hotel.amenities = normalizedAmenities;
                    await hotel.save();
                    updatedCount++;

                    console.log(`✅ Hotel: ${hotel.name}`);
                    console.log(`   Trước: [${originalAmenities.join(', ')}]`);
                    console.log(`   Sau:  [${normalizedAmenities.join(', ')}]`);
                    if (removedAmenities.length > 0) {
                        console.log(`   ⚠️  Đã loại bỏ: [${removedAmenities.join(', ')}]`);
                    }
                    console.log('');
                } else {
                    unchangedCount++;
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ Lỗi khi migrate hotel ${hotel.name}:`, error.message);
            }
        }

        console.log('\n📊 KẾT QUẢ MIGRATION:');
        console.log(`✅ Đã cập nhật: ${updatedCount} hotels`);
        console.log(`➡️  Không thay đổi: ${unchangedCount} hotels`);
        console.log(`❌ Lỗi: ${errorCount} hotels`);

        console.log('\n📋 DANH SÁCH AMENITIES CHUẨN:');
        STANDARD_AMENITIES.forEach((amenity, index) => {
            console.log(`   ${index + 1}. ${amenity}`);
        });

        console.log('\n✅ Migration hoàn tất!');

    } catch (error) {
        console.error('❌ Lỗi migration:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Đã ngắt kết nối MongoDB');
        process.exit(0);
    }
};

// Chạy migration
migrateAmenities();
