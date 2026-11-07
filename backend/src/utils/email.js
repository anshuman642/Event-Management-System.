import nodemailer from 'nodemailer'

let transporter
function getTransporter() {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn('Email delivery is disabled: configure EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD.')
    return null
  }
  transporter ||= nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
  })
  return transporter
}

export async function sendEmail({ to, subject, html }) {
  const mailTransport = getTransporter()
  if (!mailTransport) return false
  await mailTransport.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    html,
  })
  return true
}
