import express from 'express'
import { sendTestEmail } from '../email'

const router = express.Router()

router.post('/send-test-email', async (req, res) => {
  // Protect this endpoint with a secret in env to avoid open relay
  const secret = process.env.DEBUG_EMAIL_SECRET
  const provided = req.headers['x-debug-secret'] || req.body?.secret
  if (!secret || String(provided) !== String(secret)) {
    return res.status(403).json({ error: 'forbidden' })
  }

  const { to } = req.body
  if (!to) return res.status(400).json({ error: 'missing to' })

  try {
    const info = await sendTestEmail(String(to))
    res.json({ ok: true, info })
  } catch (err: any) {
    console.error('Test email failed', err)
    res.status(500).json({ error: 'failed', detail: err?.message || String(err) })
  }
})

export default router
