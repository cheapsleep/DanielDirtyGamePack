"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const game_1 = require("./game");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.get('/', (_req, res) => {
    res.status(200).send('DanielBox server is running. Try GET /health.');
});
app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
});
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*", // Allow all origins for dev
        methods: ["GET", "POST"]
    }
});
const gameManager = new game_1.GameManager(io);
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
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
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        gameManager.handleDisconnect(socket);
    });
});
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
