const { sendMail } = require("./email.service");

/**
 * Generate HTML email template for hotel booking confirmation
 */
function generateHotelBookingEmailHTML({
  customerName,
  bookingId,
  hotelName,
  hotelAddress,
  roomNumber,
  roomType,
  checkInDate,
  checkOutDate,
  nights,
  totalAmount,
  paymentMethod,
  contactInfo,
}) {
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("vi-VN").format(price) + " VNĐ";
  };

  const formatRoomType = (type) => {
    const typeMap = {
      single: "Phòng Đơn",
      double: "Phòng Đôi",
      twin: "Phòng 2 Giường",
      suite: "Phòng Suite",
      deluxe: "Phòng Deluxe",
      family: "Phòng Gia Đình",
    };
    return typeMap[type] || "Phòng Tiêu Chuẩn";
  };

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xác nhận đặt phòng</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎉 Đặt phòng thành công!</h1>
    </div>
    
    <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px; margin-bottom: 20px;">
            Xin chào <strong>${customerName || "Quý khách"}</strong>,
        </p>
        
        <p style="font-size: 16px; margin-bottom: 30px;">
            Cảm ơn bạn đã đặt phòng tại hệ thống của chúng tôi! Đặt phòng của bạn đã được xác nhận và thanh toán thành công.
        </p>
        
        <div style="background-color: #f0f9f4; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #2d6a4f;">
            <h2 style="color: #2d6a4f; margin-top: 0; margin-bottom: 20px; font-size: 20px;">📋 Thông tin đặt phòng</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666; width: 40%;">Mã booking:</td>
                    <td style="padding: 8px 0; color: #333;">${bookingId}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Khách sạn:</td>
                    <td style="padding: 8px 0; color: #333;">${hotelName || "N/A"}</td>
                </tr>
                ${hotelAddress ? `
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Địa chỉ:</td>
                    <td style="padding: 8px 0; color: #333;">${hotelAddress}</td>
                </tr>
                ` : ''}
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Phòng:</td>
                    <td style="padding: 8px 0; color: #333;">
                        ${roomNumber ? `Phòng #${roomNumber}` : ""} 
                        ${roomType ? ` - ${formatRoomType(roomType)}` : ""}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Ngày nhận phòng:</td>
                    <td style="padding: 8px 0; color: #333;">${formatDate(checkInDate)} (Từ 14:00)</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Ngày trả phòng:</td>
                    <td style="padding: 8px 0; color: #333;">${formatDate(checkOutDate)} (Trước 12:00)</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Số đêm:</td>
                    <td style="padding: 8px 0; color: #333;">${nights} đêm</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Tổng tiền:</td>
                    <td style="padding: 8px 0; color: #2d6a4f; font-size: 18px; font-weight: bold;">${formatPrice(totalAmount)}</td>
                </tr>
                ${paymentMethod ? `
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Phương thức thanh toán:</td>
                    <td style="padding: 8px 0; color: #333;">${paymentMethod}</td>
                </tr>
                ` : ''}
            </table>
        </div>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ffc107;">
            <h3 style="color: #856404; margin-top: 0; font-size: 16px;">⚠️ Lưu ý quan trọng</h3>
            <ul style="margin: 0; padding-left: 20px; color: #856404;">
                <li>Vui lòng đến khách sạn đúng giờ check-in (từ 14:00)</li>
                <li>Mang theo giấy tờ tùy thân khi check-in</li>
                <li>Thời gian check-out là trước 12:00</li>
                <li>Nếu có thay đổi, vui lòng liên hệ với khách sạn trước 24 giờ</li>
            </ul>
        </div>
        
        ${contactInfo ? `
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #2196f3;">
            <h3 style="color: #1565c0; margin-top: 0; font-size: 16px;">📞 Thông tin liên hệ</h3>
            <p style="margin: 5px 0; color: #1565c0;">
                ${contactInfo.phone ? `Điện thoại: ${contactInfo.phone}<br>` : ''}
                ${contactInfo.email ? `Email: ${contactInfo.email}` : ''}
            </p>
        </div>
        ` : ''}
        
        <p style="font-size: 16px; margin-top: 30px; margin-bottom: 10px;">
            Chúc bạn có một kỳ nghỉ tuyệt vời! 🏨✨
        </p>
        
        <p style="font-size: 14px; color: #666; margin-top: 20px;">
            Trân trọng,<br>
            <strong>Đội ngũ hỗ trợ khách hàng</strong><br>
            Hệ thống đặt phòng khách sạn
        </p>
    </div>
    
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 12px; color: #999; margin: 0;">
            Email này được gửi tự động, vui lòng không trả lời trực tiếp.<br>
            Nếu bạn có thắc mắc, vui lòng liên hệ với chúng tôi qua email hoặc điện thoại.
        </p>
    </div>
</body>
</html>
  `.trim();
}

/**
 * Send hotel booking confirmation email
 */
async function sendHotelBookingConfirmationEmail({
  customerEmail,
  customerName,
  bookingId,
  hotelName,
  hotelAddress,
  roomNumber,
  roomType,
  checkInDate,
  checkOutDate,
  nights,
  totalAmount,
  paymentMethod = "PayOS",
  contactInfo,
}) {
  try {
    const html = generateHotelBookingEmailHTML({
      customerName,
      bookingId,
      hotelName,
      hotelAddress,
      roomNumber,
      roomType,
      checkInDate,
      checkOutDate,
      nights,
      totalAmount,
      paymentMethod,
      contactInfo,
    });

    const formatDate = (dateString) => {
      if (!dateString) return "";
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const formatRoomType = (type) => {
      const typeMap = {
        single: "Phòng Đơn",
        double: "Phòng Đôi",
        twin: "Phòng 2 Giường",
        suite: "Phòng Suite",
        deluxe: "Phòng Deluxe",
        family: "Phòng Gia Đình",
      };
      return typeMap[type] || "Phòng Tiêu Chuẩn";
    };

    const text = `
Xác nhận đặt phòng thành công!

Chào ${customerName || "Quý khách"},

Cảm ơn bạn đã đặt phòng tại hệ thống của chúng tôi! Đặt phòng của bạn đã được xác nhận và thanh toán thành công.

Thông tin đặt phòng:
- Mã booking: ${bookingId}
- Khách sạn: ${hotelName || "N/A"}
${hotelAddress ? `- Địa chỉ: ${hotelAddress}\n` : ""}
- Phòng: ${roomNumber ? `Phòng #${roomNumber}` : ""}${roomType ? ` - ${formatRoomType(roomType)}` : ""}
- Ngày nhận phòng: ${formatDate(checkInDate)} (Từ 14:00)
- Ngày trả phòng: ${formatDate(checkOutDate)} (Trước 12:00)
- Số đêm: ${nights} đêm
- Tổng tiền: ${new Intl.NumberFormat("vi-VN").format(totalAmount)} VNĐ
${paymentMethod ? `- Phương thức thanh toán: ${paymentMethod}\n` : ""}

Lưu ý quan trọng:
- Vui lòng đến khách sạn đúng giờ check-in (từ 14:00)
- Mang theo giấy tờ tùy thân khi check-in
- Thời gian check-out là trước 12:00
- Nếu có thay đổi, vui lòng liên hệ với khách sạn trước 24 giờ

${contactInfo ? `
Thông tin liên hệ:
${contactInfo.phone ? `- Điện thoại: ${contactInfo.phone}\n` : ""}${contactInfo.email ? `- Email: ${contactInfo.email}\n` : ""}
` : ""}

Chúc bạn có một kỳ nghỉ tuyệt vời!

Trân trọng,
Đội ngũ hỗ trợ khách hàng
Hệ thống đặt phòng khách sạn
    `.trim();

    console.log(`📧 [HOTEL BOOKING] Attempting to send email to: ${customerEmail}`);
    console.log(`   Subject: Xác nhận đặt phòng thành công - ${bookingId}`);
    console.log(`   Booking ID: ${bookingId}`);
    console.log(`   Hotel: ${hotelName}`);

    const mailResult = await sendMail({
      to: customerEmail,
      subject: `Xác nhận đặt phòng thành công - ${bookingId}`,
      html,
      text,
    });

    if (mailResult.success) {
      if (mailResult.dev) {
        console.log(
          `✅ [DEV MODE] Hotel booking confirmation email logged to console`
        );
        console.log(`   Email would be sent to: ${customerEmail}`);
      } else {
        console.log(
          `✅ [HOTEL BOOKING] Confirmation email sent successfully to: ${customerEmail}`
        );
        console.log(`   Message ID: ${mailResult.messageId}`);
      }
      return { success: true, dev: mailResult.dev };
    } else {
      throw new Error("Email service returned unsuccessful result");
    }
  } catch (error) {
    console.error("❌ [HOTEL BOOKING] Error sending confirmation email:", error);
    console.error("   Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendHotelBookingConfirmationEmail,
  generateHotelBookingEmailHTML,
};

