import nodemailer from 'nodemailer';

function getMailerConfig() {
  return {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  };
}

export async function sendDocumentEmail({ recipients, subject, text, attachments }) {
  const config = getMailerConfig();
  if (!config.host || !config.user || !config.pass) {
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });

  const info = await transporter.sendMail({
    from: config.from,
    to: recipients.join(', '),
    subject,
    text,
    attachments,
  });

  return { sent: true, messageId: info.messageId };
}
