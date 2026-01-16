import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'

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

// Verify transporter on startup and log result
transporter.verify()
  .then(() => {
    console.log('SMTP transporter verified')
  })
  .catch((err) => {
    console.warn('SMTP transporter verification failed:', err && (err as any).message ? (err as any).message : err)
    try {
      const logDir = path.resolve(process.cwd(), 'server', 'logs')
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
      fs.appendFileSync(path.join(logDir, 'emails.log'), `${new Date().toISOString()} SMTP verify failed: ${String(err)}\n`)
    } catch (_) {}
  })

export async function sendVerificationEmail(email: string, token: string) {
  // Link to client-side verification page which will call the API
  const url = `${appUrl}/verify?token=${encodeURIComponent(token)}`
  const fromDomain = process.env.SMTP_FROM ? process.env.SMTP_FROM : `no-reply@${new URL(appUrl).hostname.replace(/^www\./, '')}`
  const mail = {
    from: `"Daniel's Dirty Game Pack" <${fromDomain}>`,
    to: email,
    subject: 'Verify your email',
    text: `Please verify your email by visiting: ${url}`,
    html: `<p>Please verify your email by clicking <a href="${url}">this link</a>.</p>`
  }
  try {
    const info = await transporter.sendMail(mail)
    return info
  } catch (err) {
    console.warn('Failed to send verification email:', err)
    try {
      const logDir = path.resolve(process.cwd(), 'server', 'logs')
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
      fs.appendFileSync(path.join(logDir, 'emails.log'), `${new Date().toISOString()} VERIFICATION to=${email} token=${token} ERROR=${String(err)}\n`)
      fs.appendFileSync(path.join(logDir, 'emails.log'), `MAIL_CONTENT: ${JSON.stringify(mail)}\n`)
    } catch (_) {}
    throw err
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`
  const fromDomain = process.env.SMTP_FROM ? process.env.SMTP_FROM : `no-reply@${new URL(appUrl).hostname.replace(/^www\./, '')}`
  const mail = {
    from: `"Daniel's Dirty Game Pack" <${fromDomain}>`,
    to: email,
    subject: 'Password reset',
    text: `Reset your password: ${url}`,
    html: `<p>Reset your password by clicking <a href="${url}">this link</a>.</p>`
  }
  try {
    const info = await transporter.sendMail(mail)
    return info
  } catch (err) {
    console.warn('Failed to send password reset email:', err)
    try {
      const logDir = path.resolve(process.cwd(), 'server', 'logs')
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
      fs.appendFileSync(path.join(logDir, 'emails.log'), `${new Date().toISOString()} RESET to=${email} token=${token} ERROR=${String(err)}\n`)
      fs.appendFileSync(path.join(logDir, 'emails.log'), `MAIL_CONTENT: ${JSON.stringify(mail)}\n`)
    } catch (_) {}
    throw err
  }
}

export async function sendTestEmail(to: string) {
  const fromDomain = process.env.SMTP_FROM ? process.env.SMTP_FROM : `no-reply@${new URL(appUrl).hostname.replace(/^www\./, '')}`
  const mail = {
    from: `"Daniel's Dirty Game Pack" <${fromDomain}>`,
    to,
    subject: 'Test email from DanielBox',
    text: 'This is a test email to verify SMTP configuration.'
  }
  return transporter.sendMail(mail)
}
