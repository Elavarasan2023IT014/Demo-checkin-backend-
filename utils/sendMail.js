const nodemailer = require('nodemailer');

const sendMail = async (to, subject, html, text) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true', // Use true for 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const fromName = process.env.FROM_NAME || 'Your Company';
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text: text || '', // Fallback if HTML fails
    html: html || `<p>${text}</p>` // Fallback if only text provided
  };

  try {
    await transporter.verify();
    console.log('✅ SMTP server ready to send messages.');

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to} | Message ID: ${info.messageId}`);
  } catch (error) {
    console.error('❌ Failed to send email:', error?.response || error);
  }
};

module.exports = sendMail;
