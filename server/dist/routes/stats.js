"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const router = express_1.default.Router();
function requireAuth(req, res, next) {
    // @ts-ignore
    if (!req.session || !req.session.userId)
        return res.status(401).json({ error: 'unauthenticated' });
    next();
}
// report stats for a finished game
router.post('/report', requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // @ts-ignore
        const userId = req.session.userId;
        const { game, score = 0, won = false, metadata = null } = req.body;
        if (!game)
            return res.status(400).json({ error: 'missing game' });
        const existing = yield db_1.prisma.playerStats.findFirst({ where: { userId, game } });
        if (!existing) {
            const created = yield db_1.prisma.playerStats.create({ data: {
                    userId,
                    game,
                    sessions: 1,
                    wins: won ? 1 : 0,
                    totalScore: score || 0,
                    bestScore: score || 0,
                    metadata
                } });
            return res.json(created);
        }
        const updatedData = {
            sessions: existing.sessions + 1,
            wins: existing.wins + (won ? 1 : 0),
            totalScore: existing.totalScore + (score || 0),
            // preserve existing best unless new score is higher
            bestScore: Math.max(existing.bestScore || 0, score || 0),
            metadata: metadata !== null && metadata !== void 0 ? metadata : existing.metadata
        };
        const updated = yield db_1.prisma.playerStats.update({ where: { id: existing.id }, data: updatedData });
        return res.json(updated);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'server error' });
    }
}));
// get current user's stats
router.get('/me', requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // @ts-ignore
        const userId = req.session.userId;
        const stats = yield db_1.prisma.playerStats.findMany({ where: { userId } });
        return res.json(stats);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'server error' });
    }
}));
// public: get stats for a username
router.get('/:username', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const username = String(req.params.username || '');
        if (!username)
            return res.status(400).json({ error: 'missing username' });
        const user = yield db_1.prisma.user.findUnique({ where: { username } });
        if (!user)
            return res.status(404).json({ error: 'not found' });
        const stats = yield db_1.prisma.playerStats.findMany({ where: { userId: user.id } });
        return res.json({ user: { id: user.id, username: user.username }, stats });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'server error' });
    }
}));
exports.default = router;
