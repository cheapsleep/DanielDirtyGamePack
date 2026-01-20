"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const game_1 = require("./game");
const session_1 = __importDefault(require("./session"));
const auth_1 = __importDefault(require("./routes/auth"));
const debug_1 = __importDefault(require("./routes/debug"));
const stats_1 = __importDefault(require("./routes/stats"));
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || process.env.APP_URL || 'http://localhost:5173';
const corsOptions = {
    origin: CLIENT_ORIGIN,
    credentials: true,
};
const app = (0, express_1.default)();
// Behind a single proxy (cloudflared) — trust one proxy hop so req.ip is correct
// Use a numeric value (1) rather than `true` to avoid permissive-trust-proxy errors
app.set('trust proxy', 1);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// session must be used before routes that depend on it
app.use(session_1.default);
// general rate limiter for auth-related endpoints (slightly higher to reduce accidental 429s)
const authLimiter = (0, express_rate_limit_1.default)({ windowMs: 60 * 1000, max: 30 });
// route-specific limiter for password-reset requests to prevent abuse (hourly window)
const resetLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: { error: 'Too many password reset requests, try again later' }
});
// apply resetLimiter for the specific endpoint path before mounting the general auth router
app.use('/api/auth/request-password-reset', resetLimiter);
app.use('/api/auth', authLimiter, auth_1.default);
// Player stats endpoints
app.use('/api/stats', stats_1.default);
// Debug routes (send test email) — protected by DEBUG_EMAIL_SECRET header/body
app.use('/api/debug', debug_1.default);
app.get('/', (_req, res) => {
    res.status(200).send('DanielBox server is running. Try GET /health.');
});
app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
});
// Generic error handler to log stack traces for debugging (helps identify 500 causes)
// Keep this after all routes are mounted.
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err && err.stack ? err.stack : err);
    try {
        res.status(500).json({ error: 'server error' });
    }
    catch (_a) {
        // ignore
    }
});
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: corsOptions
});
// attach session to socket handshake
io.use((socket, next) => {
    const req = socket.request;
    (0, session_1.default)(req, {}, next);
});
const gameManager = new game_1.GameManager(io);
io.on('connection', (socket) => {
    var _a;
    console.log('A user connected:', socket.id);
    // attach userId from session if available
    try {
        // @ts-ignore
        const userId = (_a = socket.request.session) === null || _a === void 0 ? void 0 : _a.userId;
        if (userId)
            socket.data.userId = userId;
    }
    catch (e) {
        // ignore
    }
    // Handle joining a room
    socket.on('join_room', (data) => {
        gameManager.handleJoin(socket, data);
    });
    // Handle creating a room (host only)
    socket.on('create_room', (data) => {
        gameManager.handleCreateRoom(socket, data === null || data === void 0 ? void 0 : data.gameId);
    });
    socket.on('close_room', () => {
        gameManager.handleCloseRoom(socket);
    });
    // Handle game actions
    socket.on('game_action', (data) => {
        gameManager.handleGameAction(socket, data);
    });
    // Allow clients to request a nickname change for their player in the current room
    socket.on('change_nickname', (newName) => {
        try {
            gameManager.handleChangeNickname(socket, String(newName !== null && newName !== void 0 ? newName : ''));
        }
        catch (e) {
            // ignore
        }
    });
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        gameManager.handleDisconnect(socket);
    });
});
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
