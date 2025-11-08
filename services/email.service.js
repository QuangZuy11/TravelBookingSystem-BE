const nodemailer = require("nodemailer");

function hasSmtp() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

let transporter = null;
if (hasSmtp()) {
  console.log("✅ SMTP Configuration loaded:");
  console.log("   Host:", process.env.SMTP_HOST);
  console.log("   Port:", process.env.SMTP_PORT || 587);
  console.log("   User:", process.env.SMTP_USER);
  console.log(
    "   From:",
    process.env.EMAIL_FROM || "No Reply <no-reply@example.com>"
  );

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false, // true for 465, false for other ports
    requireTLS: true, // Gmail requires TLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      // Do not fail on invalid certs
      rejectUnauthorized: false,
    },
  });

  // Verify transporter configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.error("❌ SMTP Verification failed:", error);
    } else {
      console.log("✅ SMTP Server is ready to send emails");
    }
  });
} else {
  console.log(
    "⚠️  SMTP not configured - emails will be logged to console only"
  );
  console.log("   To enable email sending, configure SMTP in .env:");
  console.log("      SMTP_HOST=smtp.gmail.com");
  console.log("      SMTP_PORT=587");
  console.log("      SMTP_USER=your-email@gmail.com");
  console.log("      SMTP_PASS=your-app-password");
}

exports.sendMail = async ({ to, subject, html, text }) => {
  try {
    if (!hasSmtp()) {
      console.log("📧 [MAIL/DEV MODE] Email would be sent:");
      console.log("   To:", to);
      console.log("   Subject:", subject);
      console.log("   HTML length:", html?.length || 0);
      console.log("   Text preview:", (text || html || "").substring(0, 200));
      return { success: true, dev: true };
    }

    console.log("📧 [MAIL/PROD] Sending email to:", to);
    console.log("   Subject:", subject);

    // Clean up EMAIL_FROM - remove quotes if present
    let emailFrom = process.env.EMAIL_FROM || "No Reply <no-reply@example.com>";
    if (emailFrom.startsWith('"') && emailFrom.endsWith('"')) {
      emailFrom = emailFrom.slice(1, -1);
    }

    const info = await transporter.sendMail({
      from: emailFrom,
      to,
      subject,
      html,
      text,
    });

    console.log("✅ [MAIL/PROD] Email sent successfully!");
    console.log("   Message ID:", info.messageId);
    return { success: true, dev: false, messageId: info.messageId };
  } catch (error) {
    console.error("❌ [MAIL] Error sending email:", error);
    console.error("   Error message:", error.message);
    console.error("   Error code:", error.code);
    throw error; // Re-throw để caller có thể handle
  }
};
