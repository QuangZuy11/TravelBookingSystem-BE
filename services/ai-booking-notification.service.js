const { sendMail } = require('./email.service');
const ServiceProvider = require('../models/service-provider.model');

/**
 * Format date for Vietnamese locale
 */
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format price in VND
 */
function formatPrice(price) {
    if (!price) return '0 VNĐ';
    return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
}

/**
 * Send notification to available tour providers about new booking request
 */
exports.sendBookingNotificationToProviders = async (booking) => {
    try {
        // Find all verified tour providers
        const providers = await ServiceProvider.find({
            type: 'tour',
            admin_verified: true,
            'licenses.verification_status': 'verified'
        }).limit(20); // Limit to avoid spam

        if (!providers || providers.length === 0) {
            console.log('No verified tour providers found to notify');
            return;
        }

        const emailPromises = providers.map(async (provider) => {
            const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yêu cầu đặt tour mới</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #0066cc 0%, #004a99 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🌏 Yêu cầu đặt tour mới!</h1>
    </div>
    
    <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px; margin-bottom: 20px;">
            Xin chào <strong>${provider.company_name}</strong>,
        </p>
        
        <p style="font-size: 16px; margin-bottom: 30px;">
            Một khách hàng vừa yêu cầu đặt tour AI Itinerary. Đây là cơ hội để bạn cung cấp dịch vụ!
        </p>
        
        <div style="background-color: #f0f8ff; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #0066cc;">
            <h2 style="color: #0066cc; margin-top: 0; margin-bottom: 20px; font-size: 20px;">📋 Thông tin tour</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666; width: 40%;">Mã booking:</td>
                    <td style="padding: 8px 0; color: #333;">${booking._id}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Điểm đến:</td>
                    <td style="padding: 8px 0; color: #333;">${booking.destination}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Số ngày:</td>
                    <td style="padding: 8px 0; color: #333;">${booking.duration_days} ngày</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Ngày bắt đầu:</td>
                    <td style="padding: 8px 0; color: #333;">${formatDate(booking.start_date)}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Số người:</td>
                    <td style="padding: 8px 0; color: #333;">${booking.participant_number} người</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Ngân sách:</td>
                    <td style="padding: 8px 0; color: #333; font-size: 18px; font-weight: bold; color: #0066cc;">${formatPrice(booking.total_budget)}</td>
                </tr>
            </table>
        </div>
        
        ${booking.special_requests ? `
        <div style="background-color: #fff8e1; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ffc107;">
            <h3 style="color: #f57c00; margin-top: 0; margin-bottom: 10px; font-size: 16px;">📝 Yêu cầu đặc biệt</h3>
            <p style="margin: 0; color: #666;">${booking.special_requests}</p>
        </div>
        ` : ''}
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px; font-size: 16px;">👤 Thông tin liên hệ khách hàng</h3>
            <p style="margin: 5px 0; color: #666;">
                <strong>Tên:</strong> ${booking.contact_info.name}<br>
                <strong>Email:</strong> ${booking.contact_info.email}<br>
                <strong>Điện thoại:</strong> ${booking.contact_info.phone}
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                Vui lòng đăng nhập vào hệ thống để xem chi tiết và phản hồi yêu cầu đặt tour này.
            </p>
            <a href="${process.env.PROVIDER_PORTAL_URL || 'http://localhost:3000'}/provider/ai-bookings" 
               style="display: inline-block; background-color: #0066cc; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 5px; font-weight: bold; font-size: 16px;">
                Xem chi tiết booking
            </a>
        </div>
    </div>
    
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; margin-top: 0;">
        <p style="margin: 0; font-size: 12px; color: #666;">
            Email này được gửi tự động từ hệ thống Travel Booking System<br>
            Vui lòng không trả lời trực tiếp email này
        </p>
    </div>
</body>
</html>
      `;

            return sendMail({
                to: provider.email,
                subject: `🌏 Yêu cầu đặt tour mới - ${booking.destination} (${booking.duration_days} ngày)`,
                html
            });
        });

        await Promise.allSettled(emailPromises);
        console.log(`✅ Sent booking notification to ${providers.length} tour providers`);

    } catch (error) {
        console.error('Error sending booking notification to providers:', error);
        throw error;
    }
};

/**
 * Send booking approval email to traveler
 */
exports.sendBookingApprovalToTraveler = async (booking, provider) => {
    try {
        const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tour của bạn đã được chấp nhận</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">✅ Tour đã được chấp nhận!</h1>
    </div>
    
    <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px; margin-bottom: 20px;">
            Xin chào <strong>${booking.contact_info.name}</strong>,
        </p>
        
        <p style="font-size: 16px; margin-bottom: 30px;">
            Tin vui! Yêu cầu đặt tour của bạn đã được <strong>${provider.company_name}</strong> chấp nhận với báo giá chi tiết.
        </p>
        
        <div style="background-color: #f1f8e9; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #4caf50;">
            <h2 style="color: #2e7d32; margin-top: 0; margin-bottom: 20px; font-size: 20px;">📋 Thông tin tour</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666; width: 40%;">Mã booking:</td>
                    <td style="padding: 8px 0; color: #333;">${booking._id}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Nhà cung cấp:</td>
                    <td style="padding: 8px 0; color: #333;">${provider.company_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Điểm đến:</td>
                    <td style="padding: 8px 0; color: #333;">${booking.destination}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Thời gian:</td>
                    <td style="padding: 8px 0; color: #333;">${booking.duration_days} ngày, bắt đầu ${formatDate(booking.start_date)}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Số người:</td>
                    <td style="padding: 8px 0; color: #333;">${booking.participant_number} người</td>
                </tr>
                <tr style="background-color: #fff9c4;">
                    <td style="padding: 12px 0; font-weight: bold; color: #666; font-size: 16px;">💰 Giá tour:</td>
                    <td style="padding: 12px 0; color: #f57c00; font-size: 22px; font-weight: bold;">${formatPrice(booking.quoted_price)}</td>
                </tr>
            </table>
        </div>
        
        ${booking.provider_notes ? `
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2196f3;">
            <h3 style="color: #1976d2; margin-top: 0; margin-bottom: 10px; font-size: 16px;">📝 Ghi chú từ nhà cung cấp</h3>
            <p style="margin: 0; color: #666;">${booking.provider_notes}</p>
        </div>
        ` : ''}
        
        ${booking.included_services && booking.included_services.length > 0 ? `
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px; font-size: 16px;">✅ Dịch vụ bao gồm</h3>
            <ul style="margin: 0; padding-left: 20px; color: #666;">
                ${booking.included_services.map(service => `<li style="margin-bottom: 8px;">${service}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        ${booking.excluded_services && booking.excluded_services.length > 0 ? `
        <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #c62828; margin-top: 0; margin-bottom: 15px; font-size: 16px;">❌ Dịch vụ không bao gồm</h3>
            <ul style="margin: 0; padding-left: 20px; color: #666;">
                ${booking.excluded_services.map(service => `<li style="margin-bottom: 8px;">${service}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #e65100; margin-top: 0; margin-bottom: 15px; font-size: 16px;">👤 Thông tin liên hệ nhà cung cấp</h3>
            <p style="margin: 5px 0; color: #666;">
                <strong>Công ty:</strong> ${provider.company_name}<br>
                <strong>Email:</strong> ${provider.email}<br>
                <strong>Điện thoại:</strong> ${provider.phone}
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                Vui lòng đăng nhập để xem chi tiết và thanh toán để xác nhận booking.
            </p>
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/my-bookings/${booking._id}" 
               style="display: inline-block; background-color: #4caf50; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 5px; font-weight: bold; font-size: 16px;">
                Xem chi tiết & Thanh toán
            </a>
        </div>
    </div>
    
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; margin-top: 0;">
        <p style="margin: 0; font-size: 12px; color: #666;">
            Email này được gửi tự động từ hệ thống Travel Booking System<br>
            Nếu có thắc mắc, vui lòng liên hệ trực tiếp với nhà cung cấp tour
        </p>
    </div>
</body>
</html>
    `;

        await sendMail({
            to: booking.contact_info.email,
            subject: `✅ Tour ${booking.destination} đã được chấp nhận - ${provider.company_name}`,
            html
        });

        console.log(`✅ Sent approval email to traveler: ${booking.contact_info.email}`);

    } catch (error) {
        console.error('Error sending approval email to traveler:', error);
        throw error;
    }
};

/**
 * Send booking rejection email to traveler
 */
exports.sendBookingRejectionToTraveler = async (booking, provider) => {
    try {
        const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thông báo về yêu cầu đặt tour</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">📋 Thông báo về yêu cầu đặt tour</h1>
    </div>
    
    <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px; margin-bottom: 20px;">
            Xin chào <strong>${booking.contact_info.name}</strong>,
        </p>
        
        <p style="font-size: 16px; margin-bottom: 30px;">
            Rất tiếc, <strong>${provider.company_name}</strong> không thể đáp ứng yêu cầu đặt tour của bạn vào thời điểm này.
        </p>
        
        <div style="background-color: #fff3e0; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ff9800;">
            <h2 style="color: #e65100; margin-top: 0; margin-bottom: 20px; font-size: 20px;">📋 Thông tin booking</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666; width: 40%;">Mã booking:</td>
                    <td style="padding: 8px 0; color: #333;">${booking._id}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Điểm đến:</td>
                    <td style="padding: 8px 0; color: #333;">${booking.destination}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Thời gian:</td>
                    <td style="padding: 8px 0; color: #333;">${booking.duration_days} ngày, bắt đầu ${formatDate(booking.start_date)}</td>
                </tr>
            </table>
        </div>
        
        ${booking.rejection_reason ? `
        <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #f44336;">
            <h3 style="color: #c62828; margin-top: 0; margin-bottom: 10px; font-size: 16px;">💬 Lý do</h3>
            <p style="margin: 0; color: #666;">${booking.rejection_reason}</p>
        </div>
        ` : ''}
        
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #1976d2; margin-top: 0; margin-bottom: 15px; font-size: 16px;">💡 Gợi ý</h3>
            <p style="margin: 0; color: #666;">
                • Bạn có thể chỉnh sửa thời gian hoặc yêu cầu của mình<br>
                • Hệ thống sẽ gửi yêu cầu đến các nhà cung cấp khác<br>
                • Liên hệ trực tiếp với chúng tôi để được hỗ trợ tốt nhất
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                Chúng tôi rất tiếc vì sự bất tiện này. Vui lòng thử lại hoặc liên hệ support để được hỗ trợ.
            </p>
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/ai-itinerary" 
               style="display: inline-block; background-color: #ff9800; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 5px; font-weight: bold; font-size: 16px;">
                Tạo yêu cầu mới
            </a>
        </div>
    </div>
    
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; margin-top: 0;">
        <p style="margin: 0; font-size: 12px; color: #666;">
            Email này được gửi tự động từ hệ thống Travel Booking System<br>
            Nếu cần hỗ trợ, vui lòng liên hệ support@travelbooking.com
        </p>
    </div>
</body>
</html>
    `;

        await sendMail({
            to: booking.contact_info.email,
            subject: `📋 Thông báo về yêu cầu đặt tour ${booking.destination}`,
            html
        });

        console.log(`✅ Sent rejection email to traveler: ${booking.contact_info.email}`);

    } catch (error) {
        console.error('Error sending rejection email to traveler:', error);
        throw error;
    }
};

/**
 * Send booking cancellation notification
 */
exports.sendBookingCancellationNotification = async (booking) => {
    try {
        if (!booking.provider_id) {
            console.log('No provider assigned, skipping cancellation notification');
            return;
        }

        const provider = await ServiceProvider.findById(booking.provider_id);
        if (!provider) {
            console.log('Provider not found, skipping cancellation notification');
            return;
        }

        const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking bị hủy</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #f44336 0%, #c62828 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">❌ Booking đã bị hủy</h1>
    </div>
    
    <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px; margin-bottom: 20px;">
            Xin chào <strong>${provider.company_name}</strong>,
        </p>
        
        <p style="font-size: 16px; margin-bottom: 30px;">
            Khách hàng <strong>${booking.contact_info.name}</strong> đã hủy booking tour.
        </p>
        
        <div style="background-color: #ffebee; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #f44336;">
            <h2 style="color: #c62828; margin-top: 0; margin-bottom: 20px; font-size: 20px;">📋 Thông tin booking</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666; width: 40%;">Mã booking:</td>
                    <td style="padding: 8px 0; color: #333;">${booking._id}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Điểm đến:</td>
                    <td style="padding: 8px 0; color: #333;">${booking.destination}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Thời gian:</td>
                    <td style="padding: 8px 0; color: #333;">${booking.duration_days} ngày, bắt đầu ${formatDate(booking.start_date)}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Khách hàng:</td>
                    <td style="padding: 8px 0; color: #333;">${booking.contact_info.name}</td>
                </tr>
            </table>
        </div>
        
        ${booking.cancellation_reason ? `
        <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ff9800;">
            <h3 style="color: #e65100; margin-top: 0; margin-bottom: 10px; font-size: 16px;">💬 Lý do hủy</h3>
            <p style="margin: 0; color: #666;">${booking.cancellation_reason}</p>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 14px; color: #666;">
                Nếu có thắc mắc, vui lòng liên hệ với hệ thống hỗ trợ.
            </p>
        </div>
    </div>
    
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; margin-top: 0;">
        <p style="margin: 0; font-size: 12px; color: #666;">
            Email này được gửi tự động từ hệ thống Travel Booking System
        </p>
    </div>
</body>
</html>
    `;

        await sendMail({
            to: provider.email,
            subject: `❌ Booking bị hủy - ${booking.destination}`,
            html
        });

        console.log(`✅ Sent cancellation notification to provider: ${provider.email}`);

    } catch (error) {
        console.error('Error sending cancellation notification:', error);
        throw error;
    }
};
