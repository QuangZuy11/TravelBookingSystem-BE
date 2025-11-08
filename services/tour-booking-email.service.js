const { sendMail } = require("./email.service");

/**
 * Generate HTML email template for tour booking confirmation
 */
function generateTourBookingEmailHTML({
  customerName,
  bookingNumber,
  tourTitle,
  tourDate,
  participants,
  totalAmount,
  meetingPoint,
  itineraries,
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
    return new Intl.NumberFormat("vi-VN").format(price) + " ₫";
  };

  // Generate itinerary HTML
  let itineraryHTML = "";
  if (itineraries && itineraries.length > 0) {
    itineraryHTML = itineraries
      .map((day) => {
        const activitiesHTML = day.activities
          ? day.activities
              .map((activity) => {
                const activityText =
                  activity.time && activity.action
                    ? `${activity.time}: ${activity.action}`
                    : activity.activity_name
                    ? `${activity.start_time || ""} - ${
                        activity.end_time || ""
                      }: ${activity.activity_name}`
                    : activity;
                return `<li style="margin-bottom: 8px; color: #4b5563;">${activityText}</li>`;
              })
              .join("")
          : "";

        return `
          <div style="margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #06b6d4;">
            <h3 style="margin: 0 0 12px 0; color: #06b6d4; font-size: 18px; font-weight: 600;">
              Ngày ${day.day || day.day_number}${
          day.title ? ` - ${day.title}` : ""
        }
            </h3>
            ${
              day.description
                ? `<p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">${day.description}</p>`
                : ""
            }
            ${
              activitiesHTML
                ? `<ul style="margin: 0; padding-left: 20px;">${activitiesHTML}</ul>`
                : ""
            }
          </div>
        `;
      })
      .join("");
  } else {
    itineraryHTML =
      '<p style="color: #6b7280;">Lịch trình đang được cập nhật</p>';
  }

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận đặt tour</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6; padding: 20px;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                ✈️ Xác nhận đặt tour thành công!
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 20px 0; color: #111827; font-size: 16px; line-height: 1.6;">
                Chào <strong>${customerName || "Quý khách"}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                Cảm ơn bạn đã đặt tour với chúng tôi! Đơn đặt tour của bạn đã được xác nhận thành công.
              </p>

              <!-- Booking Info Card -->
              <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #06b6d4;">
                <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">
                  Thông tin đặt tour
                </h2>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">Mã đặt tour:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${bookingNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Tour:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${tourTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Ngày khởi hành:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px;">${formatDate(
                      tourDate
                    )}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Số khách:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px;">${participants} người</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Tổng tiền:</td>
                    <td style="padding: 8px 0; color: #06b6d4; font-size: 16px; font-weight: 700;">${formatPrice(
                      totalAmount
                    )}</td>
                  </tr>
                </table>
              </div>

              <!-- Meeting Point Card -->
              ${
                meetingPoint &&
                (meetingPoint.address || meetingPoint.instructions)
                  ? `
              <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #10b981;">
                <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">
                  📍 Điểm tập trung
                </h2>
                ${
                  meetingPoint.address
                    ? `
                  <div style="margin-bottom: 12px;">
                    <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px; font-weight: 500;">Địa chỉ:</p>
                    <p style="margin: 0; color: #111827; font-size: 15px; line-height: 1.6;">${meetingPoint.address}</p>
                  </div>
                `
                    : ""
                }
                ${
                  meetingPoint.instructions
                    ? `
                  <div style="margin-top: 12px; padding: 12px; background: #ffffff; border-radius: 6px;">
                    <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px; font-weight: 500;">Hướng dẫn:</p>
                    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">${meetingPoint.instructions}</p>
                  </div>
                `
                    : ""
                }
              </div>
              `
                  : ""
              }

              <!-- Itinerary Card -->
              <div style="background: #faf5ff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #8b5cf6;">
                <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">
                  📅 Lịch trình tour
                </h2>
                ${itineraryHTML}
              </div>

              <!-- Contact Info -->
              ${
                contactInfo
                  ? `
              <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
                <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">
                  📞 Thông tin liên hệ
                </h2>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${
                    contactInfo.email
                      ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;">Email:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px;">${contactInfo.email}</td>
                  </tr>
                  `
                      : ""
                  }
                  ${
                    contactInfo.phone
                      ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Điện thoại:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px;">${contactInfo.phone}</td>
                  </tr>
                  `
                      : ""
                  }
                </table>
              </div>
              `
                  : ""
              }

              <!-- Footer Message -->
              <div style="background: #f9fafb; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0 0 12px 0; color: #374151; font-size: 14px; line-height: 1.6;">
                  Chúng tôi rất vui được phục vụ bạn trong chuyến đi sắp tới!
                </p>
                <p style="margin: 0; color: #6b7280; font-size: 13px;">
                  Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua email hoặc điện thoại.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                © ${new Date().getFullYear()} Travel Booking System. Tất cả quyền được bảo lưu.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Send tour booking confirmation email
 */
async function sendTourBookingConfirmationEmail({
  customerEmail,
  customerName,
  bookingNumber,
  tourTitle,
  tourDate,
  participants,
  totalAmount,
  meetingPoint,
  itineraries,
  contactInfo,
}) {
  try {
    const html = generateTourBookingEmailHTML({
      customerName,
      bookingNumber,
      tourTitle,
      tourDate,
      participants,
      totalAmount,
      meetingPoint,
      itineraries,
      contactInfo,
    });

    const text = `
Xác nhận đặt tour thành công!

Chào ${customerName || "Quý khách"},

Cảm ơn bạn đã đặt tour với chúng tôi!

Thông tin đặt tour:
- Mã đặt tour: ${bookingNumber}
- Tour: ${tourTitle}
- Ngày khởi hành: ${new Date(tourDate).toLocaleDateString("vi-VN")}
- Số khách: ${participants} người
- Tổng tiền: ${new Intl.NumberFormat("vi-VN").format(totalAmount)} ₫

${
  meetingPoint && meetingPoint.address
    ? `Điểm tập trung: ${meetingPoint.address}`
    : ""
}
${
  meetingPoint && meetingPoint.instructions
    ? `Hướng dẫn: ${meetingPoint.instructions}`
    : ""
}

Chúng tôi rất vui được phục vụ bạn trong chuyến đi sắp tới!
    `.trim();

    console.log(`📧 Attempting to send email to: ${customerEmail}`);
    console.log(
      `   Subject: Xác nhận đặt tour: ${tourTitle} - ${bookingNumber}`
    );

    const mailResult = await sendMail({
      to: customerEmail,
      subject: `Xác nhận đặt tour: ${tourTitle} - ${bookingNumber}`,
      html,
      text,
    });

    if (mailResult.success) {
      if (mailResult.dev) {
        console.log(
          `✅ [DEV MODE] Tour booking confirmation email logged to console`
        );
        console.log(`   Email would be sent to: ${customerEmail}`);
      } else {
        console.log(
          `✅ Tour booking confirmation email sent successfully to: ${customerEmail}`
        );
        console.log(`   Message ID: ${mailResult.messageId}`);
      }
      return { success: true, dev: mailResult.dev };
    } else {
      throw new Error("Email service returned unsuccessful result");
    }
  } catch (error) {
    console.error("❌ Error sending tour booking confirmation email:", error);
    console.error("   Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendTourBookingConfirmationEmail,
  generateTourBookingEmailHTML,
};
