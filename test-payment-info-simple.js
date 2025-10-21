/**
 * Test Script - Hotel Booking Payment Info API
 * 
 * CÁCH DÙNG:
 * 1. Thay đổi EMAIL, PASSWORD, BOOKING_ID bên dưới
 * 2. Chạy: node test-payment-info-simple.js
 */

const axios = require('axios');

// ============= CẤU HÌNH - THAY ĐỔI TẠI ĐÂY =============
const BASE_URL = 'http://localhost:3000';
const EMAIL = 'user@example.com';              // ⬅️ THAY EMAIL CỦA BẠN
const PASSWORD = 'password123';                 // ⬅️ THAY PASSWORD CỦA BẠN
const BOOKING_ID = '68f7b990ccbb8708998ad854'; // ⬅️ THAY BOOKING ID CỦA BẠN
// ========================================================

console.log('\n╔════════════════════════════════════════════╗');
console.log('║  Hotel Booking Payment Info API Test       ║');
console.log('╚════════════════════════════════════════════╝\n');

async function testPaymentInfo() {
  try {
    // ============= BƯỚC 1: LOGIN =============
    console.log('📍 Step 1: Login to get JWT token');
    console.log('   URL:', `${BASE_URL}/api/auth/login`);
    console.log('   Email:', EMAIL);
    console.log('   Password:', '*'.repeat(PASSWORD.length));
    
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });

    if (!loginResponse.data.token) {
      console.log('\n❌ ERROR: No token in login response!');
      console.log('Response:', loginResponse.data);
      return;
    }

    const token = loginResponse.data.token;
    console.log('   ✅ Login successful!');
    console.log('   Token:', token.substring(0, 30) + '...');
    console.log('');

    // ============= BƯỚC 2: GET PAYMENT INFO =============
    console.log('📍 Step 2: Get Payment Info');
    console.log('   URL:', `${BASE_URL}/api/traveler/bookings/${BOOKING_ID}/payment-info`);
    console.log('   Booking ID:', BOOKING_ID);
    console.log('   Authorization: Bearer', token.substring(0, 20) + '...');
    
    const paymentResponse = await axios.get(
      `${BASE_URL}/api/traveler/bookings/${BOOKING_ID}/payment-info`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('   ✅ Success!\n');

    // ============= HIỂN THỊ KẾT QUẢ =============
    const data = paymentResponse.data.data;

    console.log('╔════════════════════════════════════════════╗');
    console.log('║           PAYMENT INFORMATION              ║');
    console.log('╚════════════════════════════════════════════╝\n');

    console.log('🏨 HOTEL:');
    console.log('   Name:', data.hotel.name);
    console.log('   Address:', data.hotel.address);
    console.log('');

    console.log('🛏️  ROOM:');
    console.log('   Type:', data.room.type);
    console.log('   Number:', data.room.roomNumber);
    console.log('   Floor:', data.room.floor);
    console.log('   Area:', data.room.area, 'm²');
    console.log('   Capacity:', data.room.capacity, 'people');
    console.log('   Price/Night:', data.room.pricePerNight.toLocaleString('vi-VN'), 'VNĐ');
    console.log('');

    console.log('👤 GUEST:');
    console.log('   Name:', data.guest.name);
    console.log('   Email:', data.guest.email);
    console.log('   Phone:', data.guest.phone);
    console.log('');

    console.log('📅 BOOKING:');
    console.log('   Booking ID:', data.booking.bookingId);
    console.log('   Check-in:', new Date(data.booking.checkInDate).toLocaleDateString('vi-VN'));
    console.log('   Check-out:', new Date(data.booking.checkOutDate).toLocaleDateString('vi-VN'));
    console.log('   Nights:', data.booking.nights);
    console.log('   Booking Date:', new Date(data.booking.bookingDate).toLocaleString('vi-VN'));
    console.log('   Booking Status:', data.booking.bookingStatus);
    console.log('   Payment Status:', data.booking.paymentStatus);
    console.log('');

    console.log('💰 PRICING:');
    console.log('   Price/Night:', data.pricing.pricePerNight.toLocaleString('vi-VN'), 'VNĐ');
    console.log('   Nights:', data.pricing.nights);
    console.log('   Calculation:', data.pricing.calculation);
    console.log('   ─────────────────────────────────────');
    console.log('   TOTAL:', data.pricing.totalAmount.toLocaleString('vi-VN'), 'VNĐ');
    console.log('');

    console.log('╔════════════════════════════════════════════╗');
    console.log('║              TEST PASSED ✅                 ║');
    console.log('╚════════════════════════════════════════════╝\n');

  } catch (error) {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║              TEST FAILED ❌                 ║');
    console.log('╚════════════════════════════════════════════╝\n');

    if (error.response) {
      // Server responded with error
      console.log('❌ ERROR RESPONSE:');
      console.log('   Status:', error.response.status);
      console.log('   Message:', error.response.data.message || error.response.data);
      console.log('');
      console.log('Full Error:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // Request made but no response
      console.log('❌ NO RESPONSE FROM SERVER');
      console.log('   Make sure the server is running at:', BASE_URL);
      console.log('   Run: npm run dev');
    } else {
      // Something else happened
      console.log('❌ ERROR:', error.message);
    }

    console.log('\n💡 TROUBLESHOOTING:');
    console.log('   1. Check if server is running (npm run dev)');
    console.log('   2. Verify EMAIL and PASSWORD are correct');
    console.log('   3. Make sure BOOKING_ID exists in database');
    console.log('   4. Ensure the booking belongs to the logged-in user');
    console.log('');
  }
}

// Kiểm tra xem đã config chưa
if (EMAIL === 'user@example.com' || PASSWORD === 'password123') {
  console.log('⚠️  WARNING: Please update EMAIL and PASSWORD in this file!');
  console.log('   Open:', __filename);
  console.log('   Edit lines 11-13 with your actual credentials\n');
}

if (BOOKING_ID === '68f7b990ccbb8708998ad854') {
  console.log('⚠️  WARNING: Please update BOOKING_ID in this file!');
  console.log('   Use a real booking ID from your database\n');
}

// Run the test
testPaymentInfo();
