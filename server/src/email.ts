import nodemailer from 'nodemailer'

const smtpHost = process.env.SMTP_HOST
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10)
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS
const appUrl = process.env.APP_URL || 'http://localhost:3000'

if (!smtpHost || !smtpUser || !smtpPass) {
  console.warn('SMTP not fully configured — verification emails will fail until configured')
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for other ports
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
})

export async function sendVerificationEmail(email: string, token: string) {
  // Link to client-side verification page which will call the API
  const url = `${appUrl}/verify?token=${encodeURIComponent(token)}`
  const info = await transporter.sendMail({
    from: `"Daniel's Dirty Game Pack" <no-reply@${new URL(appUrl).hostname}>`,
    to: email,
    subject: 'Verify your email',
    text: `Please verify your email by visiting: ${url}`,
    html: `<p>Please verify your email by clicking <a href="${url}">this link</a>.</p>`
  })
  return info
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`
  const info = await transporter.sendMail({
    from: `"Daniel's Dirty Game Pack" <no-reply@${new URL(appUrl).hostname}>`,
    to: email,
    subject: 'Password reset',
    text: `Reset your password: ${url}`,
    html: `<p>Reset your password by clicking <a href="${url}">this link</a>.</p>`
  })
  return info
}
