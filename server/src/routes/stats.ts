import express from 'express'
import { prisma } from '../db'

const router = express.Router()

function requireAuth(req: any, res: any, next: any) {
  // @ts-ignore
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'unauthenticated' })
  next()
}

// report stats for a finished game
router.post('/report', requireAuth, async (req, res) => {
  try {
    // @ts-ignore
    const userId: string = req.session.userId
    const { game, score = 0, won = false, metadata = null } = req.body
    if (!game) return res.status(400).json({ error: 'missing game' })

    const existing = await prisma.playerStats.findFirst({ where: { userId, game } })

    if (!existing) {
      const created = await prisma.playerStats.create({ data: {
        userId,
        game,
        sessions: 1,
        wins: won ? 1 : 0,
        totalScore: score || 0,
        bestScore: score || 0,
        metadata
      }})
      return res.json(created)
    }

    const updatedData: any = {
      sessions: existing.sessions + 1,
      wins: existing.wins + (won ? 1 : 0),
      totalScore: existing.totalScore + (score || 0),
      // preserve existing best unless new score is higher
      bestScore: Math.max(existing.bestScore || 0, score || 0),
      metadata: metadata ?? existing.metadata
    }

    const updated = await prisma.playerStats.update({ where: { id: existing.id }, data: updatedData })
    return res.json(updated)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'server error' })
  }
})

// get current user's stats
router.get('/me', requireAuth, async (req, res) => {
  try {
    // @ts-ignore
    const userId: string = req.session.userId
    const stats = await prisma.playerStats.findMany({ where: { userId } })
    return res.json(stats)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'server error' })
  }
})

// public: get stats for a username
router.get('/:username', async (req, res) => {
  try {
    const username = String(req.params.username || '')
    if (!username) return res.status(400).json({ error: 'missing username' })
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) return res.status(404).json({ error: 'not found' })
    const stats = await prisma.playerStats.findMany({ where: { userId: user.id } })
    return res.json({ user: { id: user.id, username: user.username }, stats })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'server error' })
  }
})

export default router
