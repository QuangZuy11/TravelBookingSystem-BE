/**
 * Test file để kiểm tra API lấy thông tin thanh toán booking
 * 
 * Cách chạy:
 * 1. Đảm bảo server đang chạy (npm run dev)
 * 2. Thay thế BOOKING_ID và JWT_TOKEN bằng giá trị thực
 * 3. Chạy: node tests/test-booking-payment-info.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BOOKING_ID = '6501234567890abcdef12345'; // Thay bằng booking ID thực
const JWT_TOKEN = 'your_jwt_token_here'; // Thay bằng token thực sau khi login

/**
 * Test 1: Lấy thông tin thanh toán booking
 */
async function testGetBookingPaymentInfo() {
    console.log('\n=== TEST 1: Get Booking Payment Info ===\n');
    
    try {
        const response = await axios.get(
            `${BASE_URL}/api/traveler/bookings/${BOOKING_ID}/payment-info`,
            {
                headers: {
                    'Authorization': `Bearer ${JWT_TOKEN}`
                }
            }
        );

        console.log('✅ Success!');
        console.log('Status:', response.status);
        console.log('\nResponse Data:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Kiểm tra cấu trúc dữ liệu
        const { data } = response.data;
        console.log('\n=== Verification ===');
        console.log('Hotel Name:', data.hotel?.name || '❌ Missing');
        console.log('Hotel Address:', data.hotel?.address || '❌ Missing');
        console.log('Room Type:', data.room?.type || '❌ Missing');
        console.log('Room Number:', data.room?.roomNumber || '❌ Missing');
        console.log('Guest Name:', data.guest?.name || '❌ Missing');
        console.log('Guest Email:', data.guest?.email || '❌ Missing');
        console.log('Guest Phone:', data.guest?.phone || '❌ Missing');
        console.log('Total Amount:', data.pricing?.totalAmount || '❌ Missing');
        console.log('Calculation:', data.pricing?.calculation || '❌ Missing');

    } catch (error) {
        console.log('❌ Error!');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
        }
    }
}

/**
 * Test 2: Lấy danh sách booking của user
 */
async function testGetUserBookings() {
    console.log('\n=== TEST 2: Get User Bookings ===\n');
    
    try {
        const response = await axios.get(
            `${BASE_URL}/api/traveler/bookings?page=1&limit=5`,
            {
                headers: {
                    'Authorization': `Bearer ${JWT_TOKEN}`
                }
            }
        );

        console.log('✅ Success!');
        console.log('Status:', response.status);
        console.log('\nTotal Bookings:', response.data.data.pagination.totalRecords);
        console.log('Current Page:', response.data.data.pagination.current);
        console.log('Total Pages:', response.data.data.pagination.total);
        console.log('\nBookings:');
        
        response.data.data.bookings.forEach((booking, index) => {
            console.log(`\n${index + 1}. Booking ID: ${booking._id}`);
            console.log(`   Status: ${booking.booking_status}`);
            console.log(`   Payment: ${booking.payment_status}`);
            console.log(`   Check-in: ${new Date(booking.check_in_date).toLocaleDateString()}`);
            console.log(`   Check-out: ${new Date(booking.check_out_date).toLocaleDateString()}`);
        });

    } catch (error) {
        console.log('❌ Error!');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
        }
    }
}

/**
 * Test 3: Lấy chi tiết một booking
 */
async function testGetBookingById() {
    console.log('\n=== TEST 3: Get Booking By ID ===\n');
    
    try {
        const response = await axios.get(
            `${BASE_URL}/api/traveler/bookings/${BOOKING_ID}`,
            {
                headers: {
                    'Authorization': `Bearer ${JWT_TOKEN}`
                }
            }
        );

        console.log('✅ Success!');
        console.log('Status:', response.status);
        console.log('\nBooking Details:');
        console.log(JSON.stringify(response.data.data, null, 2));

    } catch (error) {
        console.log('❌ Error!');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
        }
    }
}

/**
 * Test 4: Kiểm tra authorization (không có token)
 */
async function testUnauthorized() {
    console.log('\n=== TEST 4: Test Unauthorized Access ===\n');
    
    try {
        await axios.get(
            `${BASE_URL}/api/traveler/bookings/${BOOKING_ID}/payment-info`
            // Không gửi token
        );

        console.log('❌ Test failed - Should require authentication');

    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.log('✅ Correctly rejected unauthorized request');
            console.log('Status:', error.response.status);
            console.log('Message:', error.response.data.message);
        } else {
            console.log('❌ Unexpected error:', error.message);
        }
    }
}

/**
 * Test 5: Kiểm tra booking không tồn tại
 */
async function testBookingNotFound() {
    console.log('\n=== TEST 5: Test Booking Not Found ===\n');
    
    const fakeBookingId = '000000000000000000000000';
    
    try {
        await axios.get(
            `${BASE_URL}/api/traveler/bookings/${fakeBookingId}/payment-info`,
            {
                headers: {
                    'Authorization': `Bearer ${JWT_TOKEN}`
                }
            }
        );

        console.log('❌ Test failed - Should return 404');

    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log('✅ Correctly returned 404 for non-existent booking');
            console.log('Status:', error.response.status);
            console.log('Message:', error.response.data.message);
        } else {
            console.log('❌ Unexpected error:', error.message);
        }
    }
}

// Main test runner
async function runAllTests() {
    console.log('=================================');
    console.log('Hotel Booking Payment API Tests');
    console.log('=================================');
    console.log('Base URL:', BASE_URL);
    console.log('=================================');

    // Chạy các test
    await testGetBookingPaymentInfo();
    await testGetUserBookings();
    await testGetBookingById();
    await testUnauthorized();
    await testBookingNotFound();

    console.log('\n=================================');
    console.log('All tests completed!');
    console.log('=================================\n');
}

// Chạy test
if (require.main === module) {
    // Kiểm tra xem đã config JWT_TOKEN chưa
    if (JWT_TOKEN === 'your_jwt_token_here') {
        console.log('\n⚠️  WARNING: Please set JWT_TOKEN before running tests');
        console.log('Steps:');
        console.log('1. Login to get token: POST /api/auth/login');
        console.log('2. Replace JWT_TOKEN in this file with your actual token');
        console.log('3. Replace BOOKING_ID with an actual booking ID');
        console.log('4. Run: node tests/test-booking-payment-info.js\n');
    } else {
        runAllTests().catch(console.error);
    }
}

module.exports = {
    testGetBookingPaymentInfo,
    testGetUserBookings,
    testGetBookingById,
    testUnauthorized,
    testBookingNotFound
};
