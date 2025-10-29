const nodemailer = require('nodemailer');

function hasSmtp() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
if (hasSmtp()) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

exports.sendMail = async ({ to, subject, html, text }) => {
  if (!hasSmtp()) {
    console.log('[MAIL/DEV] To:', to);
    console.log('[MAIL/DEV] Subject:', subject);
    console.log('[MAIL/DEV] Text:', text || html);
    return { dev: true };
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'No Reply <no-reply@example.com>',
    to,
    subject,
    html,
    text,
  });
  return { dev: false };
};