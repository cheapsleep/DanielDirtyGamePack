import express from 'express'
import { prisma } from '../db'
import * as argon2 from 'argon2'
import crypto from 'crypto'
import { sendVerificationEmail, sendPasswordResetEmail } from '../email'

const router = express.Router()

function makeToken() {
  return crypto.randomBytes(32).toString('hex')
}

router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body
    if (!email || !username || !password) return res.status(400).json({ error: 'missing fields' })

    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } })
    if (existing) return res.status(409).json({ error: 'email or username already exists' })

    const passwordHash = await argon2.hash(password)
    const user = await prisma.user.create({ data: { email, username, passwordHash } })

    const token = makeToken()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24h
    await prisma.token.create({ data: { userId: user.id, token, type: 'VERIFICATION', expiresAt } })

    try {
      await sendVerificationEmail(email, token)
    } catch (e) {
      console.warn('Failed to send verification email', e)
    }

    res.status(201).json({ id: user.id, email: user.email, username: user.username, nickname: user.nickname ?? null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

router.get('/verify', async (req, res) => {
  try {
    const token = String(req.query.token || '')
    if (!token) return res.status(400).send('missing token')

    const t = await prisma.token.findUnique({ where: { token } , include: { user: true } })
    if (!t || t.type !== 'VERIFICATION' || t.expiresAt < new Date()) return res.status(400).send('invalid or expired token')

    await prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } })
    await prisma.token.delete({ where: { id: t.id } })

    // redirect to client or send success
    res.redirect(process.env.APP_URL || '/')
  } catch (err) {
    console.error(err)
    res.status(500).send('server error')
  }
})

// POST /verify: accepts a token in body and returns JSON (used by SPA)
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ error: 'missing token' })

    const t = await prisma.token.findUnique({ where: { token } , include: { user: true } })
    if (!t || t.type !== 'VERIFICATION' || t.expiresAt < new Date()) return res.status(400).json({ error: 'invalid or expired token' })

    await prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } })
    await prisma.token.delete({ where: { id: t.id } })

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body
    if (!emailOrUsername || !password) return res.status(400).json({ error: 'missing fields' })

    const user = await prisma.user.findFirst({ where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] } })
    if (!user) return res.status(401).json({ error: 'invalid credentials' })

    const ok = await argon2.verify(user.passwordHash, password)
    if (!ok) return res.status(401).json({ error: 'invalid credentials' })

    // attach to session
    // @ts-ignore
    req.session.userId = user.id
    await prisma.user.update({ where: { id: user.id }, data: { updatedAt: new Date() } })

    res.json({ id: user.id, email: user.email, username: user.username, nickname: user.nickname ?? null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

router.post('/logout', (req, res) => {
  // destroy session
  req.session.destroy((err) => {
    if (err) {
      console.error('Failed to destroy session', err)
      return res.status(500).json({ error: 'failed to logout' })
    }
    res.clearCookie('sid')
    res.json({ ok: true })
  })
})

router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'missing email' })
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(200).json({ ok: true }) // don't reveal

    const token = makeToken()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1h
    await prisma.token.create({ data: { userId: user.id, token, type: 'PASSWORD_RESET', expiresAt } })

    try {
      await sendPasswordResetEmail(email, token)
    } catch (e) {
      console.warn('Failed to send password reset email', e)
    }

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

// Resend verification: if session present, resend for current user; otherwise accept { email }
router.post('/resend-verification', async (req, res) => {
  try {
    // @ts-ignore
    const sessionUserId = req.session?.userId
    let user = null

    if (sessionUserId) {
      user = await prisma.user.findUnique({ where: { id: sessionUserId } })
    } else {
      const { email } = req.body
      if (!email) return res.status(200).json({ ok: true }) // don't reveal
      user = await prisma.user.findUnique({ where: { email } })
    }

    if (!user) return res.status(200).json({ ok: true })
    if (user.emailVerifiedAt) return res.status(200).json({ ok: true })

    // create a new token and send verification
    const token = makeToken()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24h
    await prisma.token.create({ data: { userId: user.id, token, type: 'VERIFICATION', expiresAt } })
    try {
      await sendVerificationEmail(user.email, token)
    } catch (e) {
      console.warn('Failed to resend verification email', e)
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'server error' })
  }
})

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword) return res.status(400).json({ error: 'missing fields' })

    const t = await prisma.token.findUnique({ where: { token } })
    if (!t || t.type !== 'PASSWORD_RESET' || t.expiresAt < new Date()) return res.status(400).json({ error: 'invalid or expired token' })

    const passwordHash = await argon2.hash(newPassword)
    await prisma.user.update({ where: { id: t.userId }, data: { passwordHash } })
    await prisma.token.delete({ where: { id: t.id } })

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

router.get('/me', async (req, res) => {
  try {
    // @ts-ignore
    const userId = req.session?.userId
    if (!userId) return res.status(401).json({ error: 'unauthenticated' })

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, username: true, nickname: true, emailVerifiedAt: true } })
    res.json(user)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

// update nickname for current user
router.patch('/nickname', async (req, res) => {
  try {
    // @ts-ignore
    const userId = req.session?.userId
    if (!userId) return res.status(401).json({ error: 'unauthenticated' })
    const { nickname } = req.body
    if (typeof nickname !== 'string') return res.status(400).json({ error: 'invalid nickname' })
    const trimmed = nickname.trim().slice(0, 24)
    const updated = await prisma.user.update({ where: { id: userId }, data: { nickname: trimmed } })
    res.json({ id: updated.id, nickname: updated.nickname })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

export default router
