const cron = require('node-cron');
const mongoose = require('mongoose');
const HotelBooking = require('../models/hotel-booking.model');
const Room = require('../models/room.model');

/**
 * Service để tự động cleanup các booking hết hạn
 * Chạy mỗi 1 phút để kiểm tra và hủy các booking 'reserved' đã quá 5 phút
 */
class BookingCleanupService {
    constructor() {
        this.cronTask = null;
    }

    /**
     * Helper: Retry logic cho write conflicts
     * @param {Function} operation - Operation cần retry
     * @param {Number} maxRetries - Số lần retry tối đa
     * @param {Number} delay - Delay giữa các lần retry (ms)
     */
    async retryOperation(operation, maxRetries = 3, delay = 500) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                const isWriteConflict = error.message.includes('Write conflict') ||
                    error.message.includes('WriteConflict') ||
                    error.message.includes('plan execution and yielding');

                if (isWriteConflict && attempt < maxRetries) {
                    console.log(`⏳ Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw error;
            }
        }
    }

    /**
     * Bắt đầu cron job
     */
    start() {
        console.log('🚀 Starting Booking Cleanup Service...');

        // Chạy mỗi 1 phút
        this.cronTask = cron.schedule('*/1 * * * *', async () => {
            await this.cleanupExpiredBookings();
        });

        console.log('✅ Booking Cleanup Service started - Running every 1 minute');
    }

    /**
     * Dừng cron job
     */
    stop() {
        if (this.cronTask) {
            this.cronTask.stop();
            console.log('⏹️ Booking Cleanup Service stopped');
        }
    }

    /**
     * Cleanup các booking đã hết hạn
     */
    async cleanupExpiredBookings() {
        try {
            const now = new Date();

            console.log(`[${now.toISOString()}] 🔍 Checking for expired bookings...`);

            // Tìm tất cả booking có status 'reserved' và đã hết hạn
            const expiredBookings = await HotelBooking.find({
                booking_status: 'reserved',
                reserve_expire_time: { $lte: now }
            }).populate('hotel_room_id');

            if (expiredBookings.length === 0) {
                console.log('✓ No expired bookings found');
                return;
            }

            console.log(`⚠️ Found ${expiredBookings.length} expired booking(s)`);

            let successCount = 0;
            let errorCount = 0;

            // Xử lý từng booking hết hạn với retry logic
            for (const booking of expiredBookings) {
                try {
                    console.log(`🔄 Cancelling expired booking: ${booking._id}`);

                    await this.retryOperation(async () => {
                        await this.cancelExpiredBooking(booking);
                    }, 3, 500);

                    successCount++;
                    console.log(`✅ Booking ${booking._id} cancelled successfully`);
                } catch (error) {
                    console.error(`❌ Error cancelling booking ${booking._id}:`, error.message);
                    errorCount++;
                }
            }

            console.log(`✅ Cleanup completed: ${successCount} cancelled, ${errorCount} errors`);

        } catch (error) {
            console.error('❌ Error in cleanupExpiredBookings:', error);
        }
    }

    /**
     * Hủy một booking đã hết hạn (sử dụng atomic operations thay vì transaction)
     * @param {Object} booking - Booking object
     */
    async cancelExpiredBooking(booking) {
        try {
            // 1. Cập nhật booking status từ 'reserved' → 'cancelled'
            await HotelBooking.findByIdAndUpdate(
                booking._id,
                {
                    booking_status: 'cancelled',
                    cancelled_at: new Date()
                },
                { new: true }
            );

            // 2. Trả room về trạng thái 'available' (atomic operation)
            if (booking.hotel_room_id) {
                await Room.findByIdAndUpdate(
                    booking.hotel_room_id._id,
                    {
                        status: 'available',
                        $pull: {
                            bookings: { bookingId: booking._id }
                        }
                    },
                    { new: true }
                );

                console.log(`✓ Room ${booking.hotel_room_id.roomNumber} released back to available`);
            }

        } catch (error) {
            throw error;
        }
    }

    /**
     * Chạy cleanup ngay lập tức (không chờ cron)
     * Useful cho testing hoặc manual cleanup
     */
    async runNow() {
        console.log('🔄 Running manual cleanup...');
        await this.cleanupExpiredBookings();
    }
}

// Export singleton instance
const bookingCleanupService = new BookingCleanupService();

module.exports = bookingCleanupService;
