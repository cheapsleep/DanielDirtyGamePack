"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const argon2 = __importStar(require("argon2"));
const crypto_1 = __importDefault(require("crypto"));
const email_1 = require("../email");
const router = express_1.default.Router();
function makeToken() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { email, username, password } = req.body;
        if (!email || !username || !password)
            return res.status(400).json({ error: 'missing fields' });
        const existing = yield db_1.prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
        if (existing)
            return res.status(409).json({ error: 'email or username already exists' });
        const passwordHash = yield argon2.hash(password);
        const user = yield db_1.prisma.user.create({ data: { email, username, passwordHash } });
        const token = makeToken();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
        yield db_1.prisma.token.create({ data: { userId: user.id, token, type: 'VERIFICATION', expiresAt } });
        try {
            yield (0, email_1.sendVerificationEmail)(email, token);
        }
        catch (e) {
            console.warn('Failed to send verification email', e);
        }
        res.status(201).json({ id: user.id, email: user.email, username: user.username, nickname: (_a = user.nickname) !== null && _a !== void 0 ? _a : null, profileIcon: (_b = user.profileIcon) !== null && _b !== void 0 ? _b : null });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
}));
router.get('/verify', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = String(req.query.token || '');
        if (!token)
            return res.status(400).send('missing token');
        const t = yield db_1.prisma.token.findUnique({ where: { token }, include: { user: true } });
        if (!t || t.type !== 'VERIFICATION' || t.expiresAt < new Date())
            return res.status(400).send('invalid or expired token');
        yield db_1.prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } });
        yield db_1.prisma.token.delete({ where: { id: t.id } });
        // redirect to client or send success
        res.redirect(process.env.APP_URL || '/');
    }
    catch (err) {
        console.error(err);
        res.status(500).send('server error');
    }
}));
// POST /verify: accepts a token in body and returns JSON (used by SPA)
router.post('/verify', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { token } = req.body;
        if (!token)
            return res.status(400).json({ error: 'missing token' });
        const t = yield db_1.prisma.token.findUnique({ where: { token }, include: { user: true } });
        if (!t || t.type !== 'VERIFICATION' || t.expiresAt < new Date())
            return res.status(400).json({ error: 'invalid or expired token' });
        yield db_1.prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } });
        yield db_1.prisma.token.delete({ where: { id: t.id } });
        res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
}));
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { emailOrUsername, password } = req.body;
        if (!emailOrUsername || !password)
            return res.status(400).json({ error: 'missing fields' });
        const user = yield db_1.prisma.user.findFirst({ where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] } });
        if (!user)
            return res.status(401).json({ error: 'invalid credentials' });
        const ok = yield argon2.verify(user.passwordHash, password);
        if (!ok)
            return res.status(401).json({ error: 'invalid credentials' });
        // attach to session
        // @ts-ignore
        req.session.userId = user.id;
        yield db_1.prisma.user.update({ where: { id: user.id }, data: { updatedAt: new Date() } });
        res.json({ id: user.id, email: user.email, username: user.username, nickname: (_a = user.nickname) !== null && _a !== void 0 ? _a : null, profileIcon: (_b = user.profileIcon) !== null && _b !== void 0 ? _b : null });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
}));
router.post('/logout', (req, res) => {
    // destroy session
    req.session.destroy((err) => {
        if (err) {
            console.error('Failed to destroy session', err);
            return res.status(500).json({ error: 'failed to logout' });
        }
        res.clearCookie('sid');
        res.json({ ok: true });
    });
});
router.post('/request-password-reset', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ error: 'missing email' });
        const user = yield db_1.prisma.user.findUnique({ where: { email } });
        if (!user)
            return res.status(200).json({ ok: true }); // don't reveal
        const token = makeToken();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1h
        yield db_1.prisma.token.create({ data: { userId: user.id, token, type: 'PASSWORD_RESET', expiresAt } });
        try {
            yield (0, email_1.sendPasswordResetEmail)(email, token);
        }
        catch (e) {
            console.warn('Failed to send password reset email', e);
        }
        res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
}));
// Resend verification: if session present, resend for current user; otherwise accept { email }
router.post('/resend-verification', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // @ts-ignore
        const sessionUserId = (_a = req.session) === null || _a === void 0 ? void 0 : _a.userId;
        let user = null;
        if (sessionUserId) {
            user = yield db_1.prisma.user.findUnique({ where: { id: sessionUserId } });
        }
        else {
            const { email } = req.body;
            if (!email)
                return res.status(200).json({ ok: true }); // don't reveal
            user = yield db_1.prisma.user.findUnique({ where: { email } });
        }
        if (!user)
            return res.status(200).json({ ok: true });
        if (user.emailVerifiedAt)
            return res.status(200).json({ ok: true });
        // create a new token and send verification
        const token = makeToken();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
        yield db_1.prisma.token.create({ data: { userId: user.id, token, type: 'VERIFICATION', expiresAt } });
        try {
            yield (0, email_1.sendVerificationEmail)(user.email, token);
        }
        catch (e) {
            console.warn('Failed to resend verification email', e);
        }
        return res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'server error' });
    }
}));
router.post('/reset-password', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword)
            return res.status(400).json({ error: 'missing fields' });
        const t = yield db_1.prisma.token.findUnique({ where: { token } });
        if (!t || t.type !== 'PASSWORD_RESET' || t.expiresAt < new Date())
            return res.status(400).json({ error: 'invalid or expired token' });
        const passwordHash = yield argon2.hash(newPassword);
        yield db_1.prisma.user.update({ where: { id: t.userId }, data: { passwordHash } });
        yield db_1.prisma.token.delete({ where: { id: t.id } });
        res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
}));
router.get('/me', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // @ts-ignore
        const userId = (_a = req.session) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId)
            return res.status(401).json({ error: 'unauthenticated' });
        const user = yield db_1.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, username: true, nickname: true, emailVerifiedAt: true, profileIcon: true } });
        res.json(user);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
}));
// update nickname for current user
router.patch('/nickname', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // @ts-ignore
        const userId = (_a = req.session) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId)
            return res.status(401).json({ error: 'unauthenticated' });
        const { nickname } = req.body;
        if (typeof nickname !== 'string')
            return res.status(400).json({ error: 'invalid nickname' });
        const trimmed = nickname.trim().slice(0, 24);
        const updated = yield db_1.prisma.user.update({ where: { id: userId }, data: { nickname: trimmed } });
        res.json({ id: updated.id, nickname: updated.nickname });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
}));
// update profile (e.g., profileIcon)
router.patch('/profile', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        // @ts-ignore
        const userId = (_a = req.session) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId)
            return res.status(401).json({ error: 'unauthenticated' });
        const { profileIcon } = req.body;
        if (profileIcon != null && typeof profileIcon !== 'string')
            return res.status(400).json({ error: 'invalid profileIcon' });
        const updated = yield db_1.prisma.user.update({ where: { id: userId }, data: { profileIcon: profileIcon !== null && profileIcon !== void 0 ? profileIcon : null } });
        res.json({ id: updated.id, profileIcon: (_b = updated.profileIcon) !== null && _b !== void 0 ? _b : null });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'server error' });
    }
}));
exports.default = router;
