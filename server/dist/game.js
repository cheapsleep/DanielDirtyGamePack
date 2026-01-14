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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameManager = void 0;
const uuid_1 = require("uuid");
const nastyPrompts_1 = require("./nastyPrompts");
const autismQuiz_1 = require("./autismQuiz");
const scribbleWords_1 = require("./scribbleWords");
const sssPrompts_1 = require("./sssPrompts");
class GameManager {
    constructor(io) {
        var _a, _b;
        this.rooms = new Map();
        this.socketRoomMap = new Map(); // socketId -> roomCode
        this.botRun = new Map();
        this.aqTimers = new Map(); // roomCode -> timer
        this.scTimers = new Map(); // roomCode -> timer (Scribble Scrabble)
        this.sssTimers = new Map(); // roomCode -> timer (Scribble Scrabble: Scrambled)
        this.ccTimers = new Map(); // roomCode -> timer (Card Calamity)
        this.recentlyClosed = new Map(); // roomCode -> timeout that prevents immediate reuse
        this.hostDisconnectTimers = new Map(); // roomCode -> timeout for auto-close on host disconnect
        this.ROOM_REUSE_DELAY_MS = 5000;
        this.HOST_DISCONNECT_TIMEOUT_MS = 0; // 0 = disabled
        this.io = io;
        // Allow overrides via environment
        try {
            this.ROOM_REUSE_DELAY_MS = Number((_a = process.env.ROOM_REUSE_DELAY_MS) !== null && _a !== void 0 ? _a : String(this.ROOM_REUSE_DELAY_MS));
        }
        catch (_) { }
        try {
            // Accept either milliseconds or seconds via HOST_DISCONNECT_TIMEOUT (seconds)
            const raw = (_b = process.env.HOST_DISCONNECT_TIMEOUT_MS) !== null && _b !== void 0 ? _b : process.env.HOST_DISCONNECT_TIMEOUT;
            if (raw) {
                const asNum = Number(raw);
                // If value looks small (< 1000) assume seconds
                this.HOST_DISCONNECT_TIMEOUT_MS = asNum > 1000 ? asNum : asNum * 1000;
            }
        }
        catch (_) { }
    }
    startAQTimer(room) {
        var _a;
        // Clear any existing timer
        this.clearAQTimer(room.code);
        const questionNum = (_a = room.aqCurrentQuestion) !== null && _a !== void 0 ? _a : 1;
        const startTime = Date.now();
        const duration = 30000; // 30 seconds
        // Emit timer start to clients
        this.io.to(room.code).emit('aq_timer', { timeLeft: 30, questionNumber: questionNum });
        // Set up countdown updates every second
        const countdownInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
            this.io.to(room.code).emit('aq_timer', { timeLeft: remaining, questionNumber: questionNum });
        }, 1000);
        // Set the main timer
        const timer = setTimeout(() => {
            clearInterval(countdownInterval);
            this.handleAQTimeout(room.code, questionNum);
        }, duration);
        // Store both timer and interval for cleanup
        this.aqTimers.set(room.code, timer);
        this.aqTimers.set(`${room.code}_interval`, countdownInterval);
    }
    clearAQTimer(roomCode) {
        const timer = this.aqTimers.get(roomCode);
        if (timer) {
            clearTimeout(timer);
            this.aqTimers.delete(roomCode);
        }
        const interval = this.aqTimers.get(`${roomCode}_interval`);
        if (interval) {
            clearInterval(interval);
            this.aqTimers.delete(`${roomCode}_interval`);
        }
    }
    handleAQTimeout(roomCode, questionNum) {
        var _a, _b, _c, _d, _e;
        var _f, _g;
        const room = this.rooms.get(roomCode);
        if (!room)
            return;
        if (room.state !== 'AQ_QUESTION')
            return;
        if (room.aqCurrentQuestion !== questionNum)
            return; // Question already moved on
        const activePlayers = this.getActivePlayers(room);
        const currentQ = (_a = room.aqCurrentQuestion) !== null && _a !== void 0 ? _a : 1;
        // Find players who didn't answer and penalize them
        for (const player of activePlayers) {
            if (((_c = (_b = room.aqAnswers) === null || _b === void 0 ? void 0 : _b[player.id]) === null || _c === void 0 ? void 0 : _c[currentQ]) === undefined) {
                // Player didn't answer - mark as timed out with penalty
                (_d = room.aqAnswers) !== null && _d !== void 0 ? _d : (room.aqAnswers = {});
                (_e = (_f = room.aqAnswers)[_g = player.id]) !== null && _e !== void 0 ? _e : (_f[_g] = {});
                // Store special 'timeout' marker - we'll give them a penalty point during scoring
                room.aqAnswers[player.id][currentQ] = 'timeout';
            }
        }
        // Move to next question or results
        this.advanceAQQuestion(room);
    }
    advanceAQQuestion(room) {
        var _a, _b;
        const currentQ = (_a = room.aqCurrentQuestion) !== null && _a !== void 0 ? _a : 1;
        const activePlayers = this.getActivePlayers(room);
        if (currentQ >= 20) {
            // Calculate final scores
            this.clearAQTimer(room.code);
            this.calculateAQScores(room);
            room.state = 'AQ_RESULTS';
            // Generate rankings
            const rankings = activePlayers
                .map(p => {
                var _a, _b;
                return ({
                    id: p.id,
                    name: p.name,
                    score: (_b = (_a = room.aqScores) === null || _a === void 0 ? void 0 : _a[p.id]) !== null && _b !== void 0 ? _b : 0
                });
            })
                .sort((a, b) => a.score - b.score); // Lower score = less autistic = winner
            const winner = rankings[0];
            const loser = rankings[rankings.length - 1];
            const certificate = (0, autismQuiz_1.generateCertificateSVG)(winner.name, rankings);
            const certificateDataUrl = `data:image/svg+xml;base64,${Buffer.from(certificate).toString('base64')}`;
            const loserCertificate = (0, autismQuiz_1.generateMostAutisticCertificateSVG)(loser.name, rankings);
            const loserCertificateDataUrl = `data:image/svg+xml;base64,${Buffer.from(loserCertificate).toString('base64')}`;
            this.io.to(room.code).emit('aq_results', {
                rankings,
                winnerId: winner.id,
                winnerName: winner.name,
                certificate: certificateDataUrl,
                loserId: loser.id,
                loserName: loser.name,
                loserCertificate: loserCertificateDataUrl
            });
            this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        }
        else {
            // Next question
            room.aqCurrentQuestion = currentQ + 1;
            room.currentRound = currentQ + 1;
            const questions = (_b = room.aqShuffledQuestions) !== null && _b !== void 0 ? _b : autismQuiz_1.autismQuizQuestions;
            const nextQuestion = questions[currentQ]; // 0-indexed, currentQ is already the next index
            this.io.to(room.code).emit('aq_question', {
                questionId: currentQ + 1,
                questionText: nextQuestion.text,
                questionNumber: currentQ + 1,
                totalQuestions: 20
            });
            this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
            this.startAQTimer(room);
            this.scheduleBotRun(room);
        }
    }
    handleCreateRoom(socket, gameId) {
        const resolvedGameId = gameId !== null && gameId !== void 0 ? gameId : 'nasty-libs';
        const roomCode = this.generateUniqueRoomCode();
        const hostKey = (0, uuid_1.v4)();
        const newRoom = {
            code: roomCode,
            gameId: resolvedGameId,
            hostSocketId: socket.id,
            hostKey,
            hostConnected: true,
            players: [],
            state: 'LOBBY',
            currentRound: 0,
            totalRounds: 0,
            answers: [],
            votes: {},
            votedBy: {},
            createdAt: Date.now()
        };
        this.rooms.set(roomCode, newRoom);
        this.socketRoomMap.set(socket.id, roomCode);
        socket.join(roomCode);
        socket.emit('room_created', { roomCode, hostKey });
        this.io.to(roomCode).emit('room_update', this.getRoomPublicState(newRoom));
        console.log(`Room created: ${roomCode} by ${socket.id}`);
    }
    handleJoin(socket, data) {
        var _a, _b, _c, _d, _e, _f;
        const roomCode = String((_a = data === null || data === void 0 ? void 0 : data.roomCode) !== null && _a !== void 0 ? _a : '').trim().toUpperCase();
        const playerName = String((_b = data === null || data === void 0 ? void 0 : data.playerName) !== null && _b !== void 0 ? _b : '').trim();
        const isHost = Boolean(data === null || data === void 0 ? void 0 : data.isHost);
        const playerId = (data === null || data === void 0 ? void 0 : data.playerId) ? String(data.playerId) : undefined;
        const hostKey = (data === null || data === void 0 ? void 0 : data.hostKey) ? String(data.hostKey) : undefined;
        if (!roomCode) {
            socket.emit('error', { message: 'Room code is required' });
            return;
        }
        const room = this.rooms.get(roomCode);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        if (!isHost && socket.id === room.hostSocketId) {
            socket.emit('error', { message: 'Host cannot join as a player' });
            return;
        }
        if (isHost) {
            if (!hostKey || hostKey !== room.hostKey) {
                socket.emit('error', { message: 'Invalid host key' });
                return;
            }
            room.hostSocketId = socket.id;
            room.hostConnected = true;
            // Clear any pending host-disconnect auto-close timer
            try {
                const pending = this.hostDisconnectTimers.get(room.code);
                if (pending) {
                    clearTimeout(pending);
                    this.hostDisconnectTimers.delete(room.code);
                }
            }
            catch (_) { }
            socket.emit('host_joined', { roomCode: room.code, gameId: room.gameId });
        }
        else {
            // Player join
            if (!playerName) {
                socket.emit('error', { message: 'Name is required' });
                return;
            }
            const existingById = playerId ? room.players.find(p => p.id === playerId) : undefined;
            if (existingById) {
                existingById.socketId = socket.id;
                existingById.isConnected = true;
                if (!room.controllerPlayerId && !existingById.isBot)
                    room.controllerPlayerId = existingById.id;
                socket.emit('joined', { roomCode: room.code, playerId: existingById.id, gameId: room.gameId });
            }
            else {
                const existingByName = room.players.find(p => p.name === playerName);
                if (existingByName && existingByName.isConnected && !existingByName.isBot) {
                    socket.emit('error', { message: 'That name is already taken in this room' });
                    return;
                }
                if (existingByName && !existingByName.isConnected && !existingByName.isBot) {
                    existingByName.socketId = socket.id;
                    existingByName.isConnected = true;
                    if (!room.controllerPlayerId)
                        room.controllerPlayerId = existingByName.id;
                    socket.emit('joined', { roomCode: room.code, playerId: existingByName.id, gameId: room.gameId });
                }
                else {
                    const newPlayer = {
                        id: (0, uuid_1.v4)(),
                        name: playerName,
                        socketId: socket.id,
                        score: 0,
                        isConnected: true,
                        answers: {}
                    };
                    room.players.push(newPlayer);
                    if (!room.controllerPlayerId)
                        room.controllerPlayerId = newPlayer.id;
                    socket.emit('joined', { roomCode: room.code, playerId: newPlayer.id, gameId: room.gameId });
                }
            }
        }
        this.socketRoomMap.set(socket.id, roomCode);
        socket.join(roomCode);
        // Notify everyone in the room
        this.io.to(roomCode).emit('room_update', this.getRoomPublicState(room));
        // If game is in AQ_QUESTION state, send the current question to the joining player
        if (room.state === 'AQ_QUESTION' && room.aqCurrentQuestion) {
            const questionIndex = room.aqCurrentQuestion - 1;
            const questions = (_c = room.aqShuffledQuestions) !== null && _c !== void 0 ? _c : autismQuiz_1.autismQuizQuestions;
            if (questionIndex >= 0 && questionIndex < questions.length) {
                socket.emit('aq_question', {
                    questionId: room.aqCurrentQuestion,
                    questionText: questions[questionIndex].text,
                    questionNumber: room.aqCurrentQuestion,
                    totalQuestions: 20
                });
            }
        }
        // If game is in AQ_RESULTS state, send the results to the joining player
        if (room.state === 'AQ_RESULTS' && room.aqScores) {
            const rankings = Object.entries(room.aqScores)
                .map(([playerId, score]) => {
                var _a;
                const player = room.players.find(p => p.id === playerId);
                return { id: playerId, name: (_a = player === null || player === void 0 ? void 0 : player.name) !== null && _a !== void 0 ? _a : 'Unknown', score };
            })
                .sort((a, b) => a.score - b.score);
            const winner = rankings[0];
            socket.emit('aq_results', {
                rankings,
                winnerId: (_d = winner === null || winner === void 0 ? void 0 : winner.id) !== null && _d !== void 0 ? _d : '',
                winnerName: (_e = winner === null || winner === void 0 ? void 0 : winner.name) !== null && _e !== void 0 ? _e : '',
                certificate: (0, autismQuiz_1.generateCertificateSVG)((_f = winner === null || winner === void 0 ? void 0 : winner.name) !== null && _f !== void 0 ? _f : 'Unknown', rankings)
            });
        }
    }
    handleCloseRoom(socket) {
        const roomCode = this.socketRoomMap.get(socket.id);
        if (!roomCode)
            return;
        const room = this.rooms.get(roomCode);
        if (!room)
            return;
        if (room.hostSocketId !== socket.id)
            return;
        // Use centralized close logic to ensure thorough cleanup
        this.closeRoom(roomCode, { initiatedBy: 'host', initiatorSocketId: socket.id });
    }
    closeRoom(roomCode, opts) {
        const room = this.rooms.get(roomCode);
        if (!room)
            return;
        // 1) Clear all timers for this room
        try {
            this.clearAQTimer(roomCode);
        }
        catch (_) { }
        try {
            this.clearSCTimer(roomCode);
        }
        catch (_) { }
        try {
            this.clearSSSTimer(roomCode);
        }
        catch (_) { }
        try {
            this.clearCCTimer(roomCode);
        }
        catch (_) { }
        // Ensure any bot run state cleared
        try {
            this.botRun.delete(roomCode);
        }
        catch (_) { }
        // 2) Emit a payloaded room_closed event for clients
        try {
            this.io.to(roomCode).emit('room_closed', { roomCode });
        }
        catch (_) { }
        // 3) Force member sockets to leave and clear socketRoomMap entries
        for (const [socketId, code] of Array.from(this.socketRoomMap.entries())) {
            if (code === roomCode) {
                const s = this.io.sockets.sockets.get(socketId);
                if (s) {
                    try {
                        s.leave(roomCode);
                    }
                    catch (_) { }
                    try {
                        s.emit('room_closed', { roomCode });
                    }
                    catch (_) { }
                }
                this.socketRoomMap.delete(socketId);
            }
        }
        // 4) Delete the room
        this.rooms.delete(roomCode);
        // 5) Prevent immediate reuse by marking recently closed and scheduling deletion
        try {
            const existing = this.recentlyClosed.get(roomCode);
            if (existing) {
                clearTimeout(existing);
            }
            const t = setTimeout(() => {
                this.recentlyClosed.delete(roomCode);
            }, this.ROOM_REUSE_DELAY_MS);
            this.recentlyClosed.set(roomCode, t);
        }
        catch (_) { }
        // 6) Clear any host-disconnect timer for this room
        try {
            const h = this.hostDisconnectTimers.get(roomCode);
            if (h) {
                clearTimeout(h);
                this.hostDisconnectTimers.delete(roomCode);
            }
        }
        catch (_) { }
    }
    handleGameAction(socket, data) {
        const roomCode = this.socketRoomMap.get(socket.id);
        if (!roomCode)
            return;
        const room = this.rooms.get(roomCode);
        if (!room)
            return;
        switch (data.action) {
            case 'START_GAME':
                if (this.isControllerSocket(room, socket.id)) {
                    this.startGame(room);
                }
                break;
            case 'ADD_BOT':
                if (this.isControllerSocket(room, socket.id)) {
                    this.addBot(room);
                }
                break;
            case 'REMOVE_BOT':
                if (this.isControllerSocket(room, socket.id)) {
                    this.removeBot(room);
                }
                break;
            case 'SUBMIT_PROMPT':
                this.handleSubmitPrompt(room, socket.id, data.prompt);
                break;
            case 'SUBMIT_PROBLEMS':
                this.handleSubmitProblems(room, socket.id, data.problems);
                break;
            case 'SELECT_PROBLEM':
                this.handleSelectProblem(room, socket.id, data.problem);
                break;
            case 'SUBMIT_ANSWER':
                this.handleAnswer(room, socket.id, data.answer);
                break;
            case 'SUBMIT_DRAWING':
                this.handleSubmitDrawing(room, socket.id, data.drawing, data.title);
                break;
            case 'INVEST':
                this.handleInvest(room, socket.id, data.amount);
                break;
            case 'SUBMIT_VOTE':
                this.handleVote(room, socket.id, data.voteIndex);
                break;
            case 'AQ_ANSWER':
                this.handleAQAnswer(room, socket.id, data.questionId, data.agreed);
                break;
            case 'SC_SET_ROUNDS':
                if (this.isControllerSocket(room, socket.id) && room.state === 'LOBBY') {
                    room.scRoundsPerPlayer = Math.min(3, Math.max(1, data.rounds || 1));
                    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
                }
                break;
            case 'SC_SET_TIMER':
                if (this.isControllerSocket(room, socket.id) && room.state === 'LOBBY') {
                    const validDurations = [60, 90, 120, 150];
                    room.scRoundDuration = validDurations.includes(data.duration) ? data.duration : 60;
                    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
                }
                break;
            case 'SC_PICK_WORD':
                this.handleSCPickWord(room, socket.id, data.word);
                break;
            case 'SC_GUESS':
                this.handleSCGuess(room, socket.id, data.guess);
                break;
            case 'SC_DRAW_STROKE':
                this.handleSCDrawStroke(room, socket.id, data.stroke);
                break;
            case 'SC_CLEAR_CANVAS':
                this.handleSCClearCanvas(room, socket.id);
                break;
            case 'SC_REVEAL_HINT':
                this.handleSCRevealHint(room, socket.id);
                break;
            case 'CC_TOGGLE_STACKING':
                if (this.isControllerSocket(room, socket.id) && room.state === 'LOBBY') {
                    room.ccStackingEnabled = !room.ccStackingEnabled;
                    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
                }
                break;
            case 'CC_PLAY_CARD':
                this.handleCCPlayCard(room, socket.id, data.cardId);
                break;
            case 'CC_DRAW_CARD':
                this.handleCCDrawCard(room, socket.id);
                break;
            case 'CC_PICK_COLOR':
                this.handleCCPickColor(room, socket.id, data.color);
                break;
            // Scribble Scrabble: Scrambled actions
            case 'SSS_SET_DRAW_TIME':
                if (this.isControllerSocket(room, socket.id) && room.state === 'LOBBY') {
                    room.sssDrawTime = data.time === 90 ? 90 : 60;
                    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
                }
                break;
            case 'SSS_SET_DOUBLE_ROUNDS':
                if (this.isControllerSocket(room, socket.id) && room.state === 'LOBBY') {
                    room.sssDoubleRounds = !!data.enabled;
                    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
                }
                break;
            case 'SSS_SUBMIT_DRAWING':
                this.handleSSSSubmitDrawing(room, socket.id, data.drawing);
                break;
            case 'SSS_VOTE':
                this.handleSSSVote(room, socket.id, data.votedForPlayerId);
                break;
            case 'NEXT_ROUND':
                if (this.isControllerSocket(room, socket.id)) {
                    this.nextRound(room);
                }
                break;
            case 'PLAY_AGAIN':
                // Return to lobby with same players
                if (this.isControllerSocket(room, socket.id)) {
                    this.resetToLobby(room);
                }
                break;
            case 'NEW_LOBBY':
                // Create a brand new lobby (players need to rejoin)
                if (this.isControllerSocket(room, socket.id)) {
                    this.createNewLobby(room, socket);
                }
                break;
        }
    }
    handleDisconnect(socket) {
        const roomCode = this.socketRoomMap.get(socket.id);
        if (roomCode) {
            const room = this.rooms.get(roomCode);
            if (room) {
                if (socket.id === room.hostSocketId) {
                    // Host disconnected
                    console.log('Host disconnected from room ' + roomCode);
                    room.hostConnected = false;
                    // Optionally schedule auto-close of orphaned room
                    if (this.HOST_DISCONNECT_TIMEOUT_MS && this.HOST_DISCONNECT_TIMEOUT_MS > 0) {
                        try {
                            const existing = this.hostDisconnectTimers.get(roomCode);
                            if (existing) {
                                clearTimeout(existing);
                            }
                            const t = setTimeout(() => {
                                const latest = this.rooms.get(roomCode);
                                if (latest && !latest.hostConnected) {
                                    this.closeRoom(roomCode, { initiatedBy: 'host-disconnect-timeout' });
                                }
                            }, this.HOST_DISCONNECT_TIMEOUT_MS);
                            this.hostDisconnectTimers.set(roomCode, t);
                        }
                        catch (_) { }
                    }
                }
                else {
                    const player = room.players.find(p => p.socketId === socket.id);
                    if (player) {
                        player.isConnected = false;
                        if (room.controllerPlayerId === player.id) {
                            const nextController = room.players.find(p => !p.isBot && p.isConnected);
                            room.controllerPlayerId = nextController === null || nextController === void 0 ? void 0 : nextController.id;
                        }
                        this.io.to(roomCode).emit('room_update', this.getRoomPublicState(room));
                    }
                }
            }
            this.socketRoomMap.delete(socket.id);
        }
    }
    getActivePlayers(room) {
        return room.players.filter(p => p.isConnected || p.isBot);
    }
    isControllerSocket(room, socketId) {
        if (!room.controllerPlayerId)
            return false;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return false;
        return player.id === room.controllerPlayerId;
    }
    addBot(room) {
        if (room.state !== 'LOBBY')
            return;
        // Scribble Scrabble doesn't support bots
        if (room.gameId === 'scribble-scrabble') {
            const controller = room.players.find(p => p.id === room.controllerPlayerId);
            if (controller) {
                this.io.to(controller.socketId).emit('error_message', { message: 'Scribble Scrabble does not support bots — humans only!' });
            }
            return;
        }
        // Scribble Scrabble: Scrambled doesn't support bots
        if (room.gameId === 'scribble-scrabble-scrambled') {
            const controller = room.players.find(p => p.id === room.controllerPlayerId);
            if (controller) {
                this.io.to(controller.socketId).emit('error_message', { message: 'Scribble Scrabble: Scrambled does not support bots — humans only!' });
            }
            return;
        }
        const botCount = room.players.filter(p => p.isBot).length;
        const id = (0, uuid_1.v4)();
        const adj = ['Turbo', 'Mega', 'Silly', 'Quantum', 'Pocket', 'Mystic', 'Zippy', 'Wacky', 'Glitchy', 'Jolly'];
        const noun = ['Toaster', 'Gizmo', 'Widget', 'Pal', 'Duck', 'Monkey', 'Gadget', 'Noodle', 'Wombat', 'Sprout'];
        const name = `${this.pick(adj)} ${this.pick(noun)} (CPU)`;
        const bot = {
            id,
            name,
            socketId: `bot:${id}`,
            score: 0,
            isConnected: true,
            isBot: true,
            answers: {}
        };
        room.players.push(bot);
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
    removeBot(room) {
        if (room.state !== 'LOBBY')
            return;
        const idx = [...room.players].reverse().findIndex(p => p.isBot);
        if (idx === -1)
            return;
        const realIndex = room.players.length - 1 - idx;
        room.players.splice(realIndex, 1);
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
    scheduleBotRun(room) {
        var _a;
        const key = room.code;
        const entry = (_a = this.botRun.get(key)) !== null && _a !== void 0 ? _a : { running: false, pending: false };
        if (entry.running) {
            entry.pending = true;
            this.botRun.set(key, entry);
            return;
        }
        entry.running = true;
        entry.pending = false;
        this.botRun.set(key, entry);
        void this.runBots(room).finally(() => {
            const next = this.botRun.get(key);
            if (!next)
                return;
            next.running = false;
            this.botRun.set(key, next);
            if (next.pending) {
                next.pending = false;
                this.botRun.set(key, next);
                const current = this.rooms.get(key);
                if (current)
                    this.scheduleBotRun(current);
            }
        });
    }
    // Helper to add human-like random delay (1-5 seconds)
    humanDelay() {
        return __awaiter(this, arguments, void 0, function* (minMs = 1000, maxMs = 5000) {
            const delay = minMs + Math.random() * (maxMs - minMs);
            return new Promise(resolve => setTimeout(resolve, delay));
        });
    }
    runBots(room) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            const bots = this.getActivePlayers(room).filter(p => p.isBot);
            if (bots.length === 0)
                return;
            if (room.gameId === 'nasty-libs') {
                if (room.state === 'NL_PROMPT_SUBMIT') {
                    for (const bot of bots) {
                        if (room.state !== 'NL_PROMPT_SUBMIT')
                            break;
                        if ((_a = room.nastyContestantIds) === null || _a === void 0 ? void 0 : _a.includes(bot.id))
                            continue;
                        const already = (_b = room.nastyPromptSubmissions) === null || _b === void 0 ? void 0 : _b.some(p => p.playerId === bot.id);
                        if (already)
                            continue;
                        // Human-like delay before submitting
                        yield this.humanDelay(2000, 8000);
                        if (room.state !== 'NL_PROMPT_SUBMIT')
                            break;
                        const prompt = yield this.generateBotPrompt('nasty_prompt');
                        this.handleSubmitPrompt(room, bot.socketId, prompt);
                    }
                }
                if (room.state === 'NL_ANSWER') {
                    const contestants = new Set((_c = room.nastyContestantIds) !== null && _c !== void 0 ? _c : []);
                    for (const bot of bots) {
                        if (room.state !== 'NL_ANSWER')
                            break;
                        if (!contestants.has(bot.id))
                            continue;
                        const already = room.answers.some(a => a.playerId === bot.id);
                        if (already)
                            continue;
                        // Human-like delay - "thinking" of a funny answer
                        yield this.humanDelay(3000, 12000);
                        if (room.state !== 'NL_ANSWER')
                            break;
                        const answer = yield this.generateBotPrompt('nasty_answer', (_d = room.promptText) !== null && _d !== void 0 ? _d : '');
                        this.handleAnswer(room, bot.socketId, answer);
                    }
                }
                if (room.state === 'NL_VOTING') {
                    for (const bot of bots) {
                        if (room.state !== 'NL_VOTING')
                            break;
                        const already = (_e = room.votedBy) === null || _e === void 0 ? void 0 : _e[bot.socketId];
                        if (already)
                            continue;
                        // Human-like delay - reading options
                        yield this.humanDelay(2000, 6000);
                        if (room.state !== 'NL_VOTING')
                            break;
                        const ownIndex = room.answers.findIndex(a => a.playerId === bot.id);
                        const options = room.answers.map((_, idx) => idx).filter(i => i !== ownIndex);
                        if (options.length === 0)
                            continue;
                        const pick = options[Math.floor(Math.random() * options.length)];
                        this.handleVote(room, bot.socketId, pick);
                    }
                }
                return;
            }
            if (room.state === 'DP_PROBLEM_SUBMIT') {
                for (const bot of bots) {
                    if (room.state !== 'DP_PROBLEM_SUBMIT')
                        break;
                    const already = Boolean((_f = room.dpProblemsByPlayer) === null || _f === void 0 ? void 0 : _f[bot.id]);
                    if (already)
                        continue;
                    // Human-like delay - thinking of problems
                    yield this.humanDelay(3000, 10000);
                    if (room.state !== 'DP_PROBLEM_SUBMIT')
                        break;
                    const p1 = yield this.generateBotPrompt('dp_problem');
                    const p2 = yield this.generateBotPrompt('dp_problem');
                    const p3 = yield this.generateBotPrompt('dp_problem');
                    this.handleSubmitProblems(room, bot.socketId, [p1, p2, p3]);
                }
            }
            if (room.state === 'DP_PICK') {
                for (const bot of bots) {
                    if (room.state !== 'DP_PICK')
                        break;
                    const already = Boolean((_g = room.dpSelectedByPlayer) === null || _g === void 0 ? void 0 : _g[bot.id]);
                    if (already)
                        continue;
                    // Human-like delay - reading choices
                    yield this.humanDelay(2000, 5000);
                    if (room.state !== 'DP_PICK')
                        break;
                    const choices = (_j = (_h = room.dpChoicesByPlayer) === null || _h === void 0 ? void 0 : _h[bot.id]) !== null && _j !== void 0 ? _j : [];
                    const pick = choices[Math.floor(Math.random() * choices.length)];
                    if (!pick)
                        continue;
                    this.handleSelectProblem(room, bot.socketId, pick);
                }
            }
            if (room.state === 'DP_DRAWING') {
                for (const bot of bots) {
                    if (room.state !== 'DP_DRAWING')
                        break;
                    const already = (_k = room.dpDrawings) === null || _k === void 0 ? void 0 : _k[bot.id];
                    if (already)
                        continue;
                    // Human-like delay - "drawing" takes time
                    yield this.humanDelay(5000, 15000);
                    if (room.state !== 'DP_DRAWING')
                        break;
                    const problem = (_m = (_l = room.dpSelectedByPlayer) === null || _l === void 0 ? void 0 : _l[bot.id]) !== null && _m !== void 0 ? _m : 'A problem.';
                    const title = yield this.generateBotPrompt('dp_answer', problem);
                    // Generate a visible SVG placeholder with shapes and bot info
                    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
          <rect width="100%" height="100%" fill="#fff8e1"/>
          <rect x="50" y="80" width="500" height="200" fill="#e0e0e0" stroke="#333" stroke-width="3" rx="20"/>
          <circle cx="150" cy="180" r="50" fill="#4CAF50"/>
          <circle cx="300" cy="180" r="50" fill="#2196F3"/>
          <circle cx="450" cy="180" r="50" fill="#FF9800"/>
          <line x1="150" y1="180" x2="300" y2="180" stroke="#333" stroke-width="4"/>
          <line x1="300" y1="180" x2="450" y2="180" stroke="#333" stroke-width="4"/>
          <text x="300" y="320" text-anchor="middle" font-size="22" font-weight="bold" fill="#333">${this.escapeXml(title.slice(0, 45))}</text>
          <text x="300" y="360" text-anchor="middle" font-size="16" fill="#666">by ${this.escapeXml(bot.name)}</text>
        </svg>`;
                    const drawing = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
                    this.handleSubmitDrawing(room, bot.socketId, drawing, title);
                }
            }
            if (room.state === 'DP_INVESTING') {
                for (const bot of bots) {
                    if (room.state !== 'DP_INVESTING')
                        break;
                    if (bot.id === room.currentPresenterId)
                        continue;
                    const already = (_o = room.currentInvestments) === null || _o === void 0 ? void 0 : _o[bot.id];
                    if (already !== undefined)
                        continue;
                    // Human-like delay - "considering" the investment
                    yield this.humanDelay(2000, 8000);
                    if (room.state !== 'DP_INVESTING')
                        break;
                    // Smarter investing - invest more on earlier presentations, less on later ones
                    // Also add some randomness to feel more human
                    const max = bot.score;
                    const basePercent = 0.1 + Math.random() * 0.4; // 10-50% base
                    const amount = Math.floor(max * basePercent);
                    this.handleInvest(room, bot.socketId, amount);
                }
            }
            // Autism Assessment - bots answer questions
            if (room.state === 'AQ_QUESTION') {
                const currentQ = (_p = room.aqCurrentQuestion) !== null && _p !== void 0 ? _p : 1;
                for (const bot of bots) {
                    if (room.state !== 'AQ_QUESTION')
                        break;
                    // Check if bot already answered this question
                    const already = ((_r = (_q = room.aqAnswers) === null || _q === void 0 ? void 0 : _q[bot.id]) === null || _r === void 0 ? void 0 : _r[currentQ]) !== undefined;
                    if (already)
                        continue;
                    // Human-like delay - "reading" and "thinking" about the question
                    yield this.humanDelay(1500, 5000);
                    if (room.state !== 'AQ_QUESTION')
                        break;
                    // Random answer - bots are unpredictable (can also pick neutral)
                    const rand = Math.random();
                    const agreed = rand < 0.33 ? true : rand < 0.66 ? false : 'neutral';
                    this.handleAQAnswer(room, bot.socketId, currentQ, agreed);
                }
            }
        });
    }
    generateBotPrompt(kind, context) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const fromApi = yield this.tryBotApi(kind, context);
            if (fromApi)
                return fromApi;
            if (kind === 'nasty_prompt') {
                // Use the imported nasty prompts list
                return this.pick(nastyPrompts_1.nastyPrompts);
            }
            if (kind === 'dp_problem') {
                const templates = [
                    "I can't stop losing my keys.",
                    "My group chats never stop buzzing.",
                    "My socks keep disappearing in the laundry.",
                    "I always spill drinks at the worst time.",
                    "I can't remember why I walked into a room.",
                    "My neighbor plays loud music at 3am.",
                    "I always forget people's names immediately.",
                    "My phone battery dies at the worst moments.",
                    "I can never find matching Tupperware lids.",
                    "I keep getting spam calls during meetings."
                ];
                return this.pick(templates);
            }
            if (kind === 'nasty_answer') {
                // Use the imported nasty answers list
                return this.pick(nastyPrompts_1.nastyAnswers);
            }
            // dp_answer - invention titles for Dubiously Patented
            const prefix = this.pick(['The', 'My', 'Introducing:', 'Behold!', 'Patent Pending:', '']);
            const adj = this.pick(['Turbo', 'Mega', 'Ultra', 'Quantum', 'Pocket', 'Self-Aware', 'Artisanal', 'Blockchain', 'AI-Powered', 'Organic', 'Military-Grade', 'Sentient', 'Tactical', 'Moisturized', 'Forbidden']);
            const noun = this.pick(['Buddy', 'Gizmo', '3000', 'Pro Max', 'Deluxe', 'Helper', 'Solution', '-Matic', 'Blaster', 'Eliminator', 'Wizard', 'Master', 'Destroyer']);
            const core = this.pick([
                `${adj} Problem ${noun}`,
                `${adj} ${noun}`,
                `${adj} Life ${noun}`,
                `${this.pick(['Auto', 'Robo', 'Smart', 'E-'])}${this.pick(['Fix', 'Solve', 'Helper', 'Buddy'])} ${noun}`,
                `The "${(_a = context === null || context === void 0 ? void 0 : context.slice(0, 20)) !== null && _a !== void 0 ? _a : 'Problem'}" ${noun}`
            ]);
            const suffix = this.pick([
                ' - It just works!',
                ' (patent pending)',
                ' - Problem solved!',
                ' - Trust me bro.',
                ' - What could go wrong?',
                '',
                ' - As seen on TV!',
                ' - Now with extra features!'
            ]);
            return `${prefix} ${core}${suffix}`.replace(/\s+/g, ' ').trim();
        });
    }
    pick(items) {
        return items[Math.floor(Math.random() * items.length)];
    }
    tryBotApi(kind, context) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const apiKey = process.env.BOT_API_KEY;
            const apiUrl = (_a = process.env.BOT_API_URL) !== null && _a !== void 0 ? _a : 'https://api.openai.com/v1/chat/completions';
            const model = (_b = process.env.BOT_MODEL) !== null && _b !== void 0 ? _b : 'gpt-4o-mini';
            if (!apiKey)
                return null;
            const system = kind === 'nasty_prompt'
                ? 'Write one funny party-game prompt with a blank (____). Max 90 chars. No profanity.'
                : kind === 'nasty_answer'
                    ? 'Write one short funny answer. Max 80 chars. No profanity.'
                    : kind === 'dp_problem'
                        ? 'Write one short everyday problem for silly inventions. Max 80 chars. No profanity.'
                        : 'Pitch a silly invention in 1-2 sentences. No bullet points. No profanity.';
            const user = kind === 'nasty_answer'
                ? `Prompt: ${context !== null && context !== void 0 ? context : ''}`
                : kind === 'dp_answer'
                    ? `Problem: ${context !== null && context !== void 0 ? context : ''}`
                    : 'Go.';
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            try {
                const res = yield fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model,
                        messages: [
                            { role: 'system', content: system },
                            { role: 'user', content: user }
                        ],
                        temperature: 0.9,
                        max_tokens: 80
                    }),
                    signal: controller.signal
                });
                if (!res.ok)
                    return null;
                const json = yield res.json();
                const text = String((_f = (_e = (_d = (_c = json === null || json === void 0 ? void 0 : json.choices) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.content) !== null && _f !== void 0 ? _f : '').trim();
                if (!text)
                    return null;
                return text.split('\n').filter(Boolean)[0].trim();
            }
            catch (_g) {
                return null;
            }
            finally {
                clearTimeout(timeout);
            }
        });
    }
    resetToLobby(room) {
        // Reset room to lobby state, keeping all players
        room.state = 'LOBBY';
        room.currentRound = 0;
        room.totalRounds = 0;
        room.answers = [];
        room.votes = {};
        room.votedBy = {};
        // Reset all player scores
        for (const player of room.players) {
            player.score = 0;
        }
        // Clear game-specific state
        // Nasty Libs
        room.nastyContestantIds = undefined;
        room.nastyPromptSubmissions = undefined;
        room.promptText = undefined;
        // Dubiously Patented
        room.dpProblemsByPlayer = undefined;
        room.dpAllProblems = undefined;
        room.dpChoicesByPlayer = undefined;
        room.dpSelectedByPlayer = undefined;
        room.dpDrawings = undefined;
        room.presentationOrder = undefined;
        room.currentPresenterId = undefined;
        room.currentInvestments = undefined;
        // Autism Quiz
        room.aqCurrentQuestion = undefined;
        room.aqAnswers = undefined;
        room.aqScores = undefined;
        room.aqShuffledQuestions = undefined;
        // Scribble Scrabble
        room.scDrawerId = undefined;
        room.scWord = undefined;
        room.scRevealedIndices = undefined;
        room.scCorrectGuessers = undefined;
        room.scScores = undefined;
        room.scDrawerOrder = undefined;
        room.scWordOptions = undefined;
        room.scDrawingStrokes = undefined;
        room.scCurrentRound = undefined;
        room.scTotalRounds = undefined;
        room.scRoundTime = undefined;
        room.scGuessChat = undefined;
        // Card Calamity
        room.ccDeck = undefined;
        room.ccDiscardPile = undefined;
        room.ccPlayerHands = undefined;
        room.ccCurrentPlayerId = undefined;
        room.ccDirection = undefined;
        room.ccDrawStack = undefined;
        room.ccActiveColor = undefined;
        room.ccTurnOrder = undefined;
        room.ccLastAction = undefined;
        room.ccPendingWildPlayerId = undefined;
        room.ccWinnerId = undefined;
        // Clear any running timers using the timer maps
        this.clearAQTimer(room.code);
        this.clearSCTimer(room.code);
        this.clearCCTimer(room.code);
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
    createNewLobby(room, socket) {
        var _a;
        // Clear all timers before closing
        this.clearAQTimer(room.code);
        this.clearSCTimer(room.code);
        this.clearSSSTimer(room.code);
        this.clearCCTimer(room.code);
        // Notify players that the lobby is closed
        this.io.to(room.code).emit('lobby_closed', { roomCode: room.code });
        // Make sure any mapped sockets leave and remove mappings
        for (const player of room.players) {
            if (player.socketId) {
                const s = this.io.sockets.sockets.get(player.socketId);
                if (s) {
                    try {
                        s.leave(room.code);
                    }
                    catch (_) { }
                    try {
                        s.emit('lobby_closed', { roomCode: room.code });
                    }
                    catch (_) { }
                }
                this.socketRoomMap.delete(player.socketId);
            }
        }
        // Also clean any stray mappings that reference the old code
        for (const [socketId, code] of Array.from(this.socketRoomMap.entries())) {
            if (code === room.code)
                this.socketRoomMap.delete(socketId);
        }
        const oldCode = room.code;
        const preservedGameId = (_a = room.gameId) !== null && _a !== void 0 ? _a : 'nasty-libs';
        // Delete old room
        this.rooms.delete(oldCode);
        // Create a new room with a new unique code and preserved gameId
        const newCode = this.generateUniqueRoomCode();
        const newRoom = {
            code: newCode,
            gameId: preservedGameId,
            hostSocketId: room.hostSocketId,
            hostKey: room.hostKey,
            hostConnected: room.hostConnected,
            players: [],
            state: 'LOBBY',
            currentRound: 0,
            totalRounds: 0,
            answers: [],
            votes: {},
            votedBy: {},
            createdAt: Date.now(),
        };
        this.rooms.set(newCode, newRoom);
        // Move host socket into new room and notify host
        if (room.hostSocketId) {
            const hostSocket = this.io.sockets.sockets.get(room.hostSocketId);
            if (hostSocket) {
                try {
                    hostSocket.leave(oldCode);
                }
                catch (_) { }
                try {
                    hostSocket.join(newCode);
                }
                catch (_) { }
                this.socketRoomMap.set(hostSocket.id, newCode);
                hostSocket.emit('new_lobby_created', { oldCode, newCode, gameId: preservedGameId });
            }
        }
        // Prevent immediate reuse of the old code
        try {
            const existing = this.recentlyClosed.get(oldCode);
            if (existing)
                clearTimeout(existing);
            const t = setTimeout(() => this.recentlyClosed.delete(oldCode), this.ROOM_REUSE_DELAY_MS);
            this.recentlyClosed.set(oldCode, t);
        }
        catch (_) { }
    }
    startGame(room) {
        const activePlayers = this.getActivePlayers(room);
        room.answers = [];
        room.votes = {};
        room.votedBy = {};
        if (room.gameId === 'nasty-libs') {
            room.totalRounds = 5;
            room.currentRound = 1;
            this.startNastyRound(room);
            return;
        }
        if (room.gameId === 'autism-assessment') {
            room.totalRounds = 20; // 20 questions
            room.currentRound = 1;
            room.aqCurrentQuestion = 1;
            room.aqAnswers = {};
            room.aqScores = {};
            // Shuffle all questions and pick the first 20 for this game (no duplicates possible)
            const shuffled = [...autismQuiz_1.autismQuizQuestions].sort(() => Math.random() - 0.5);
            room.aqShuffledQuestions = shuffled.slice(0, 20);
            // Initialize answer tracking for all players
            for (const p of activePlayers) {
                room.aqAnswers[p.id] = {};
            }
            room.state = 'AQ_QUESTION';
            this.io.to(room.code).emit('game_started');
            this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
            this.io.to(room.code).emit('aq_question', {
                questionId: 1,
                questionText: room.aqShuffledQuestions[0].text,
                questionNumber: 1,
                totalQuestions: 20
            });
            this.startAQTimer(room);
            this.scheduleBotRun(room);
            return;
        }
        if (room.gameId === 'scribble-scrabble') {
            this.startScribbleScrabble(room);
            return;
        }
        if (room.gameId === 'card-calamity') {
            this.startCardCalamity(room);
            return;
        }
        if (room.gameId === 'scribble-scrabble-scrambled') {
            this.startScribbleScrabbleScrambled(room);
            return;
        }
        // Initialize money for Dubiously Patented
        room.players.forEach(p => { p.score = 1000; });
        room.totalRounds = 1;
        room.currentRound = 1;
        room.state = 'DP_PROBLEM_SUBMIT';
        room.dpProblemsByPlayer = {};
        room.dpAllProblems = [];
        room.dpChoicesByPlayer = {};
        room.dpSelectedByPlayer = {};
        this.io.to(room.code).emit('game_started');
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.scheduleBotRun(room);
    }
    startNastyRound(room) {
        const activePlayers = this.getActivePlayers(room);
        const n = activePlayers.length;
        const i1 = (room.currentRound - 1) % n;
        const i2 = room.currentRound % n;
        const p1 = activePlayers[i1];
        const p2 = activePlayers[i2];
        room.state = 'NL_PROMPT_SUBMIT';
        room.promptText = undefined;
        room.nastyContestantIds = [p1.id, p2.id];
        room.nastyPromptSubmissions = [];
        room.answers = [];
        room.votes = {};
        room.votedBy = {};
        this.io.to(room.code).emit('game_started');
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.scheduleBotRun(room);
    }
    handleSubmitPrompt(room, socketId, promptText) {
        var _a, _b, _c;
        if (room.gameId !== 'nasty-libs')
            return;
        if (room.state !== 'NL_PROMPT_SUBMIT')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return;
        if ((_a = room.nastyContestantIds) === null || _a === void 0 ? void 0 : _a.includes(player.id))
            return;
        const prompt = String(promptText !== null && promptText !== void 0 ? promptText : '').trim();
        if (!prompt)
            return;
        (_b = room.nastyPromptSubmissions) !== null && _b !== void 0 ? _b : (room.nastyPromptSubmissions = []);
        if (room.nastyPromptSubmissions.some(p => p.playerId === player.id))
            return;
        room.nastyPromptSubmissions.push({ playerId: player.id, prompt });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        const activePlayers = this.getActivePlayers(room);
        const audienceCount = Math.max(0, activePlayers.length - 2);
        if (room.nastyPromptSubmissions.length < audienceCount)
            return;
        // Mix audience-submitted prompts with default prompts, then select randomly
        const pool = [
            ...(((_c = room.nastyPromptSubmissions) !== null && _c !== void 0 ? _c : []).map(p => p.prompt)),
            ...nastyPrompts_1.nastyPrompts.slice(0, 10) // Include some default prompts
        ];
        const selectedPrompt = pool[Math.floor(Math.random() * pool.length)];
        room.promptText = selectedPrompt;
        room.state = 'NL_ANSWER';
        room.answers = [];
        room.votes = {};
        room.votedBy = {};
        this.io.to(room.code).emit('new_prompt', {
            prompt: room.promptText,
            gameId: room.gameId,
            round: room.currentRound,
            timeLimit: 60
        });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.scheduleBotRun(room);
    }
    handleSubmitProblems(room, socketId, problems) {
        var _a;
        if (room.gameId !== 'dubiously-patented')
            return;
        if (room.state !== 'DP_PROBLEM_SUBMIT')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return;
        const raw = Array.isArray(problems) ? problems : [];
        const sanitized = raw
            .map(p => String(p !== null && p !== void 0 ? p : '').trim())
            .filter(Boolean)
            .slice(0, 3);
        (_a = room.dpProblemsByPlayer) !== null && _a !== void 0 ? _a : (room.dpProblemsByPlayer = {});
        if (room.dpProblemsByPlayer[player.id])
            return;
        room.dpProblemsByPlayer[player.id] = sanitized;
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        const activePlayers = this.getActivePlayers(room);
        if (Object.keys(room.dpProblemsByPlayer).length < activePlayers.length)
            return;
        const all = [];
        for (const [playerId, items] of Object.entries(room.dpProblemsByPlayer)) {
            for (const text of items)
                all.push({ playerId, text });
        }
        if (all.length === 0) {
            all.push({ playerId: 'system', text: 'People keep losing their keys.' }, { playerId: 'system', text: 'Too many group chats.' }, { playerId: 'system', text: 'Crumbs in bed.' }, { playerId: 'system', text: 'Nobody reads the instructions.' }, { playerId: 'system', text: 'Your neighbor is always loud.' });
        }
        room.dpAllProblems = all.sort(() => 0.5 - Math.random());
        room.dpChoicesByPlayer = {};
        room.dpSelectedByPlayer = {};
        room.state = 'DP_PICK';
        for (const p of activePlayers) {
            const pool = room.dpAllProblems.filter(x => x.playerId !== p.id).map(x => x.text);
            const fallbackPool = room.dpAllProblems.map(x => x.text);
            const choices = [];
            const source = pool.length > 0 ? pool : fallbackPool;
            let attempts = 0;
            while (choices.length < 3 && attempts < 100) {
                attempts++;
                const next = source[Math.floor(Math.random() * source.length)];
                if (!next)
                    break;
                if (!choices.includes(next))
                    choices.push(next);
                // If we've tried many times and source doesn't have enough unique items, allow duplicates
                if (attempts > 20 && choices.length < 3) {
                    choices.push(next);
                }
            }
            room.dpChoicesByPlayer[p.id] = choices;
            if (p.socketId && !p.isBot)
                this.io.to(p.socketId).emit('dp_choices', { choices });
        }
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.scheduleBotRun(room);
    }
    handleSelectProblem(room, socketId, problem) {
        var _a, _b, _c;
        if (room.gameId !== 'dubiously-patented')
            return;
        if (room.state !== 'DP_PICK')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return;
        const selected = String(problem !== null && problem !== void 0 ? problem : '').trim();
        if (!selected)
            return;
        (_a = room.dpChoicesByPlayer) !== null && _a !== void 0 ? _a : (room.dpChoicesByPlayer = {});
        const choices = (_b = room.dpChoicesByPlayer[player.id]) !== null && _b !== void 0 ? _b : [];
        if (!choices.includes(selected))
            return;
        (_c = room.dpSelectedByPlayer) !== null && _c !== void 0 ? _c : (room.dpSelectedByPlayer = {});
        if (room.dpSelectedByPlayer[player.id])
            return;
        room.dpSelectedByPlayer[player.id] = selected;
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        const activePlayers = this.getActivePlayers(room);
        if (Object.keys(room.dpSelectedByPlayer).length < activePlayers.length)
            return;
        room.state = 'DP_DRAWING';
        room.answers = []; // Used for titles
        room.dpDrawings = {};
        for (const p of activePlayers) {
            const prompt = room.dpSelectedByPlayer[p.id];
            if (prompt && p.socketId) {
                this.io.to(p.socketId).emit('new_prompt', {
                    prompt,
                    gameId: room.gameId,
                    round: room.currentRound,
                    timeLimit: 180 // More time for drawing
                });
            }
        }
        this.io.to(room.hostSocketId).emit('new_prompt', {
            prompt: 'Players are drawing their inventions...',
            gameId: room.gameId,
            round: room.currentRound,
            timeLimit: 180
        });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.scheduleBotRun(room);
    }
    handleSubmitDrawing(room, socketId, drawing, title) {
        var _a, _b;
        if (room.gameId !== 'dubiously-patented')
            return;
        if (room.state !== 'DP_DRAWING')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return;
        (_a = room.dpDrawings) !== null && _a !== void 0 ? _a : (room.dpDrawings = {});
        if (room.dpDrawings[player.id])
            return; // Already submitted
        // Debug logging
        console.log(`[DP] Storing drawing for ${player.name} (${player.id}), isBot: ${player.isBot}`);
        console.log(`[DP] Drawing length: ${(_b = drawing === null || drawing === void 0 ? void 0 : drawing.length) !== null && _b !== void 0 ? _b : 0}, starts with: ${drawing === null || drawing === void 0 ? void 0 : drawing.substring(0, 50)}`);
        room.dpDrawings[player.id] = drawing || ''; // Base64 string
        // Store title as "answer" for consistency or separate field
        room.answers.push({ playerId: player.id, answer: title || 'Untitled Invention' });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        const activePlayers = this.getActivePlayers(room);
        if (Object.keys(room.dpDrawings).length < activePlayers.length)
            return;
        // Start presentations
        room.presentationOrder = activePlayers.map(p => p.id).sort(() => 0.5 - Math.random());
        this.startPresentation(room);
    }
    startPresentation(room) {
        var _a, _b;
        if (!room.presentationOrder || room.presentationOrder.length === 0) {
            this.showResults(room);
            return;
        }
        const nextId = room.presentationOrder.pop();
        room.currentPresenterId = nextId;
        room.state = 'DP_PRESENTING';
        room.currentInvestments = {};
        // Debug logging for presentation
        const presentationDrawing = room.dpDrawings ? room.dpDrawings[nextId || ''] : undefined;
        const presenter = room.players.find(p => p.id === nextId);
        console.log(`[DP] Starting presentation for ${presenter === null || presenter === void 0 ? void 0 : presenter.name} (${nextId}), isBot: ${presenter === null || presenter === void 0 ? void 0 : presenter.isBot}`);
        console.log(`[DP] Drawing available: ${!!presentationDrawing}, length: ${(_a = presentationDrawing === null || presentationDrawing === void 0 ? void 0 : presentationDrawing.length) !== null && _a !== void 0 ? _a : 0}`);
        this.io.to(room.code).emit('start_presentation', {
            presenterId: nextId,
            timeLimit: 60,
            drawing: presentationDrawing,
            answer: room.answers ? (_b = room.answers.find(a => a.playerId === nextId)) === null || _b === void 0 ? void 0 : _b.answer : undefined,
            prompt: room.dpSelectedByPlayer ? room.dpSelectedByPlayer[nextId || ''] : undefined
        });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        // Auto-advance after 60s (handled by client timer mostly, but good to have server enforcement if needed)
        // For now, rely on manual "Next" or just let the client timer run out and host triggers? 
        // Better: Set a timeout or let the host trigger "Next Phase". 
        // User said "have a minute each". 
        // Let's implement auto-transition to Investing after 60s.
        setTimeout(() => {
            if (room.state === 'DP_PRESENTING' && room.currentPresenterId === nextId) {
                this.startInvesting(room);
            }
        }, 60000);
    }
    startInvesting(room) {
        room.state = 'DP_INVESTING';
        this.io.to(room.code).emit('start_investing', {
            presenterId: room.currentPresenterId,
            timeLimit: 30
        });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.scheduleBotRun(room);
        // Capture the presenter at the time investing starts to avoid races
        const investingPresenter = room.currentPresenterId;
        setTimeout(() => {
            if (room.state === 'DP_INVESTING' && room.currentPresenterId === investingPresenter) {
                this.startPresentation(room);
            }
        }, 30000);
    }
    handleInvest(room, socketId, amount) {
        var _a;
        if (room.state !== 'DP_INVESTING')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return;
        if (player.id === room.currentPresenterId)
            return; // Can't invest in self (or maybe you can? User didn't say. Assuming no.)
        const investment = Math.max(0, Math.min(Number(amount) || 0, player.score));
        (_a = room.currentInvestments) !== null && _a !== void 0 ? _a : (room.currentInvestments = {});
        if (room.currentInvestments[player.id])
            return; // Already invested
        room.currentInvestments[player.id] = investment;
        // Deduct immediately or at end? 
        // "Other players can choose to invest a certain amount... whoever has most money wins"
        // If I invest 100, I lose 100. The presenter gains 100? 
        // Or is it a vote? "Invest" implies transfer.
        // Let's transfer immediately.
        player.score -= investment;
        const presenter = room.players.find(p => p.id === room.currentPresenterId);
        if (presenter) {
            presenter.score += investment;
        }
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        // Check if everyone (except presenter) has invested
        const activePlayers = this.getActivePlayers(room);
        const potentialInvestors = activePlayers.filter(p => p.id !== room.currentPresenterId).length;
        if (Object.keys(room.currentInvestments).length >= potentialInvestors) {
            // All investors have submitted — advance immediately to the next presentation
            this.startPresentation(room);
        }
    }
    handleAQAnswer(room, socketId, questionId, agreed) {
        var _a, _b, _c;
        var _d, _e;
        if (room.gameId !== 'autism-assessment')
            return;
        if (room.state !== 'AQ_QUESTION')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return;
        (_a = room.aqAnswers) !== null && _a !== void 0 ? _a : (room.aqAnswers = {});
        (_b = (_d = room.aqAnswers)[_e = player.id]) !== null && _b !== void 0 ? _b : (_d[_e] = {});
        // Don't allow re-answering same question
        if (room.aqAnswers[player.id][questionId] !== undefined)
            return;
        room.aqAnswers[player.id][questionId] = agreed;
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        // Check if all players have answered the current question
        const activePlayers = this.getActivePlayers(room);
        const currentQ = (_c = room.aqCurrentQuestion) !== null && _c !== void 0 ? _c : 1;
        const allAnswered = activePlayers.every(p => { var _a, _b; return ((_b = (_a = room.aqAnswers) === null || _a === void 0 ? void 0 : _a[p.id]) === null || _b === void 0 ? void 0 : _b[currentQ]) !== undefined; });
        if (!allAnswered)
            return;
        // Everyone answered - clear timer and advance
        this.clearAQTimer(room.code);
        this.advanceAQQuestion(room);
    }
    calculateAQScores(room) {
        var _a, _b, _c;
        room.aqScores = {};
        const activePlayers = this.getActivePlayers(room);
        const questions = (_a = room.aqShuffledQuestions) !== null && _a !== void 0 ? _a : autismQuiz_1.autismQuizQuestions;
        for (const player of activePlayers) {
            let score = 0;
            const answers = (_c = (_b = room.aqAnswers) === null || _b === void 0 ? void 0 : _b[player.id]) !== null && _c !== void 0 ? _c : {};
            // Iterate through questions by their position (1-20), matching the questionId we sent
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                const questionId = i + 1; // We use 1-based questionIds
                const agreed = answers[questionId];
                if (agreed === undefined)
                    continue;
                // Timeout penalty - counts as 1 point towards autism score
                if (agreed === 'timeout') {
                    score++;
                    continue;
                }
                // Neutral answer - half point
                if (agreed === 'neutral') {
                    score += 0.5;
                    continue;
                }
                // Score increases when answer matches the "autistic" pattern
                if ((agreed && question.agreeIsAutistic) || (!agreed && !question.agreeIsAutistic)) {
                    score++;
                }
            }
            room.aqScores[player.id] = score;
        }
    }
    handleAnswer(room, socketId, answerText) {
        var _a;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return;
        const answer = String(answerText !== null && answerText !== void 0 ? answerText : '').trim();
        if (!answer)
            return;
        if (room.gameId === 'nasty-libs') {
            if (room.state !== 'NL_ANSWER')
                return;
            if (!((_a = room.nastyContestantIds) === null || _a === void 0 ? void 0 : _a.includes(player.id)))
                return;
            if (room.answers.some(a => a.playerId === player.id))
                return;
            room.answers.push({ playerId: player.id, answer });
            if (room.answers.length < 2)
                return;
            room.state = 'NL_VOTING';
            room.votes = {};
            room.votedBy = {};
            this.io.to(room.code).emit('start_voting', {
                answers: room.answers.map(a => a.answer),
                timeLimit: 30
            });
            this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
            this.scheduleBotRun(room);
            return;
        }
    }
    handleVote(room, socketId, voteIndex) {
        var _a, _b, _c, _d, _e;
        if (room.state !== 'NL_VOTING')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return;
        // Fix: Nasty Libs contestants cannot vote
        if (room.gameId === 'nasty-libs' && ((_a = room.nastyContestantIds) === null || _a === void 0 ? void 0 : _a.includes(player.id))) {
            this.io.to(socketId).emit('error', { message: "You are a contestant and cannot vote!" });
            return;
        }
        (_b = room.votedBy) !== null && _b !== void 0 ? _b : (room.votedBy = {});
        if (room.votedBy[socketId])
            return;
        const index = Number(voteIndex);
        if (!Number.isFinite(index))
            return;
        if (index < 0 || index >= room.answers.length)
            return;
        // Prevent self-voting (redundant if contestants excluded, but good for safety)
        if (((_c = room.answers[index]) === null || _c === void 0 ? void 0 : _c.playerId) === player.id) {
            this.io.to(socketId).emit('error', { message: "You can't vote for yourself!", code: 'GAME_ERROR' });
            return;
        }
        room.votedBy[socketId] = true;
        room.votes[index] = (room.votes[index] || 0) + 1;
        const activePlayers = this.getActivePlayers(room);
        // In Nasty Libs, contestants don't vote. So total votes needed = players - 2.
        const expectedVotes = Math.max(0, activePlayers.length - ((_e = (_d = room.nastyContestantIds) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0));
        const totalVotes = Object.values(room.votes).reduce((a, b) => a + b, 0);
        if (totalVotes < expectedVotes)
            return;
        this.showResults(room);
    }
    showResults(room) {
        // For Dubiously Patented, end the game after presentations/investing
        if (room.gameId === 'dubiously-patented') {
            this.endGame(room);
            return;
        }
        if (room.state !== 'NL_VOTING' && room.state !== 'DP_PRESENTING')
            return;
        room.state = 'NL_RESULTS';
        const roundResults = room.answers.map((a, index) => {
            const votes = room.votes[index] || 0;
            const player = room.players.find(p => p.id === a.playerId);
            if (player)
                player.score += votes * 100;
            return {
                answer: a.answer,
                playerName: player ? player.name : 'Unknown',
                votes,
                points: votes * 100
            };
        });
        roundResults.sort((a, b) => b.votes - a.votes);
        this.io.to(room.code).emit('round_results', { results: roundResults });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
    nextRound(room) {
        if (room.gameId === 'nasty-libs') {
            if (room.state !== 'NL_RESULTS')
                return;
            room.currentRound++;
            if (room.currentRound > room.totalRounds) {
                this.endGame(room);
                return;
            }
            this.startNastyRound(room);
            return;
        }
        if (room.gameId === 'autism-assessment') {
            if (room.state !== 'AQ_RESULTS')
                return;
            this.endGame(room);
            return;
        }
        if (room.gameId === 'scribble-scrabble') {
            if (room.state !== 'SC_ROUND_RESULTS')
                return;
            this.advanceSCRound(room);
            return;
        }
        if (room.gameId === 'scribble-scrabble-scrambled') {
            if (room.state !== 'SSS_RESULTS')
                return;
            this.advanceSSSRound(room);
            return;
        }
        if (room.state !== 'DP_RESULTS')
            return;
        this.endGame(room);
    }
    endGame(room) {
        room.state = 'END';
        this.io.to(room.code).emit('game_over', {
            finalScores: room.players
                .map(p => ({ name: p.name, score: p.score }))
                .sort((a, b) => b.score - a.score)
        });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
    generateRoomCode() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }
    generateUniqueRoomCode() {
        for (let attempt = 0; attempt < 50; attempt++) {
            const code = this.generateRoomCode();
            if (!this.rooms.has(code) && !this.recentlyClosed.has(code))
                return code;
        }
        // Fallback: use UUID-derived code (still check recentlyClosed)
        for (let attempt = 0; attempt < 10; attempt++) {
            const code = (0, uuid_1.v4)().slice(0, 4).toUpperCase();
            if (!this.rooms.has(code) && !this.recentlyClosed.has(code))
                return code;
        }
        // Last resort, return any non-existing or just random
        return (0, uuid_1.v4)().slice(0, 4).toUpperCase();
    }
    // ==================== SCRIBBLE SCRABBLE METHODS ====================
    startScribbleScrabble(room) {
        var _a, _b;
        const activePlayers = this.getActivePlayers(room);
        // Initialize settings with defaults if not set in lobby
        room.scRoundsPerPlayer = (_a = room.scRoundsPerPlayer) !== null && _a !== void 0 ? _a : 1;
        room.scRoundDuration = (_b = room.scRoundDuration) !== null && _b !== void 0 ? _b : 60;
        // Create drawer order (shuffle players, repeat for rounds per player)
        const shuffledPlayers = [...activePlayers].sort(() => Math.random() - 0.5);
        room.scDrawerOrder = [];
        for (let i = 0; i < room.scRoundsPerPlayer; i++) {
            room.scDrawerOrder.push(...shuffledPlayers.map(p => p.id));
        }
        room.scTotalRounds = room.scDrawerOrder.length;
        room.scCurrentRound = 1;
        room.scScores = {};
        // Initialize scores
        for (const p of activePlayers) {
            room.scScores[p.id] = 0;
        }
        this.io.to(room.code).emit('game_started');
        this.startSCRound(room);
    }
    startSCRound(room) {
        var _a, _b;
        const roundIndex = ((_a = room.scCurrentRound) !== null && _a !== void 0 ? _a : 1) - 1;
        const drawerId = (_b = room.scDrawerOrder) === null || _b === void 0 ? void 0 : _b[roundIndex];
        if (!drawerId) {
            this.endScribbleScrabble(room);
            return;
        }
        room.scDrawerId = drawerId;
        room.scWord = undefined;
        room.scRevealedIndices = [];
        room.scCorrectGuessers = [];
        room.scDrawingStrokes = [];
        room.scGuessChat = [];
        room.scWordOptions = (0, scribbleWords_1.generateWordOptions)();
        room.state = 'SC_WORD_PICK';
        // Send word options only to the drawer
        const drawer = room.players.find(p => p.id === drawerId);
        if (drawer) {
            this.io.to(drawer.socketId).emit('sc_word_options', { words: room.scWordOptions });
        }
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
    handleSCPickWord(room, socketId, word) {
        var _a, _b;
        if (room.gameId !== 'scribble-scrabble')
            return;
        if (room.state !== 'SC_WORD_PICK')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player || player.id !== room.scDrawerId)
            return;
        // Validate word is one of the options
        if (!((_a = room.scWordOptions) === null || _a === void 0 ? void 0 : _a.includes(word)))
            return;
        room.scWord = word;
        room.scRoundTime = (_b = room.scRoundDuration) !== null && _b !== void 0 ? _b : 60;
        room.state = 'SC_DRAWING';
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.startSCTimer(room);
    }
    handleSCGuess(room, socketId, guess) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (room.gameId !== 'scribble-scrabble')
            return;
        if (room.state !== 'SC_DRAWING')
            return;
        if (!room.scWord)
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return;
        // Drawer can't guess
        if (player.id === room.scDrawerId)
            return;
        // Can't guess if already got it correct
        if ((_a = room.scCorrectGuessers) === null || _a === void 0 ? void 0 : _a.includes(player.id))
            return;
        const correct = (0, scribbleWords_1.isCorrectGuess)(guess, room.scWord);
        const close = !correct && (0, scribbleWords_1.isCloseGuess)(guess, room.scWord);
        // Add to chat
        room.scGuessChat = (_b = room.scGuessChat) !== null && _b !== void 0 ? _b : [];
        room.scGuessChat.push({
            playerId: player.id,
            playerName: player.name,
            guess: correct ? '✓ Got it!' : guess, // Hide the actual word if correct
            isCorrect: correct,
            isClose: close,
            timestamp: Date.now()
        });
        // Broadcast guess to everyone
        this.io.to(room.code).emit('sc_guess_chat', {
            playerId: player.id,
            playerName: player.name,
            guess: correct ? '✓ Got it!' : guess,
            isCorrect: correct,
            isClose: close
        });
        if (correct) {
            room.scCorrectGuessers = (_c = room.scCorrectGuessers) !== null && _c !== void 0 ? _c : [];
            room.scCorrectGuessers.push(player.id);
            // Calculate points based on order and time remaining
            const timeRemaining = (_d = room.scRoundTime) !== null && _d !== void 0 ? _d : 0;
            const position = room.scCorrectGuessers.length;
            const activePlayers = this.getActivePlayers(room);
            const maxPoints = 1000;
            // Points: faster = more, earlier position = more
            const timeBonus = Math.floor((timeRemaining / ((_e = room.scRoundDuration) !== null && _e !== void 0 ? _e : 60)) * 500);
            const positionMultiplier = Math.max(0.2, 1 - (position - 1) * 0.2);
            const guesserPoints = Math.floor((maxPoints * positionMultiplier) + timeBonus);
            // Drawer gets points for each correct guess
            const drawerPoints = 100;
            room.scScores = (_f = room.scScores) !== null && _f !== void 0 ? _f : {};
            room.scScores[player.id] = ((_g = room.scScores[player.id]) !== null && _g !== void 0 ? _g : 0) + guesserPoints;
            if (room.scDrawerId) {
                room.scScores[room.scDrawerId] = ((_h = room.scScores[room.scDrawerId]) !== null && _h !== void 0 ? _h : 0) + drawerPoints;
            }
            // Notify of correct guess
            this.io.to(room.code).emit('sc_correct_guess', {
                playerId: player.id,
                playerName: player.name,
                points: guesserPoints
            });
            // Check if everyone has guessed (except drawer)
            const nonDrawerPlayers = activePlayers.filter(p => p.id !== room.scDrawerId);
            if (room.scCorrectGuessers.length >= nonDrawerPlayers.length) {
                // Everyone guessed! End round early
                this.clearSCTimer(room.code);
                this.endSCRound(room);
            }
        }
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
    handleSCDrawStroke(room, socketId, stroke) {
        var _a;
        if (room.gameId !== 'scribble-scrabble')
            return;
        if (room.state !== 'SC_DRAWING')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player || player.id !== room.scDrawerId)
            return;
        // Store stroke for late joiners/reconnects
        room.scDrawingStrokes = (_a = room.scDrawingStrokes) !== null && _a !== void 0 ? _a : [];
        room.scDrawingStrokes.push(stroke);
        // Broadcast stroke to all clients immediately (real-time)
        this.io.to(room.code).emit('sc_stroke_data', { stroke });
    }
    handleSCClearCanvas(room, socketId) {
        if (room.gameId !== 'scribble-scrabble')
            return;
        if (room.state !== 'SC_DRAWING')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player || player.id !== room.scDrawerId)
            return;
        room.scDrawingStrokes = [];
        this.io.to(room.code).emit('sc_clear_canvas');
    }
    handleSCRevealHint(room, socketId) {
        var _a;
        if (room.gameId !== 'scribble-scrabble')
            return;
        if (room.state !== 'SC_DRAWING')
            return;
        if (!room.scWord)
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player || player.id !== room.scDrawerId)
            return;
        room.scRevealedIndices = (_a = room.scRevealedIndices) !== null && _a !== void 0 ? _a : [];
        // Find unrevealed letter indices (skip spaces)
        const unrevealedIndices = room.scWord
            .split('')
            .map((char, i) => ({ char, i }))
            .filter(({ char, i }) => char !== ' ' && !room.scRevealedIndices.includes(i))
            .map(({ i }) => i);
        if (unrevealedIndices.length === 0)
            return;
        // Reveal a random letter
        const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
        room.scRevealedIndices.push(randomIndex);
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
    startSCTimer(room) {
        var _a;
        this.clearSCTimer(room.code);
        const startTime = Date.now();
        const duration = (_a = room.scRoundDuration) !== null && _a !== void 0 ? _a : 60;
        const tick = () => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            room.scRoundTime = Math.max(0, duration - elapsed);
            // Broadcast time update
            this.io.to(room.code).emit('sc_timer', { timeLeft: room.scRoundTime });
            if (room.scRoundTime <= 0) {
                this.clearSCTimer(room.code);
                this.endSCRound(room);
            }
            else {
                this.scTimers.set(room.code, setTimeout(tick, 1000));
            }
        };
        this.scTimers.set(room.code, setTimeout(tick, 1000));
    }
    clearSCTimer(roomCode) {
        const timer = this.scTimers.get(roomCode);
        if (timer) {
            clearTimeout(timer);
            this.scTimers.delete(roomCode);
        }
    }
    endSCRound(room) {
        room.state = 'SC_ROUND_RESULTS';
        // Reveal the word to everyone
        this.io.to(room.code).emit('sc_round_end', {
            word: room.scWord,
            correctGuessers: room.scCorrectGuessers,
            scores: room.scScores
        });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
    advanceSCRound(room) {
        var _a, _b;
        room.scCurrentRound = ((_a = room.scCurrentRound) !== null && _a !== void 0 ? _a : 1) + 1;
        if (room.scCurrentRound > ((_b = room.scTotalRounds) !== null && _b !== void 0 ? _b : 1)) {
            this.endScribbleScrabble(room);
        }
        else {
            this.startSCRound(room);
        }
    }
    endScribbleScrabble(room) {
        var _a;
        room.state = 'END';
        this.clearSCTimer(room.code);
        // Calculate final rankings
        const rankings = Object.entries((_a = room.scScores) !== null && _a !== void 0 ? _a : {})
            .map(([playerId, score]) => {
            var _a, _b;
            return ({
                playerId,
                name: (_b = (_a = room.players.find(p => p.id === playerId)) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'Unknown',
                score
            });
        })
            .sort((a, b) => b.score - a.score);
        this.io.to(room.code).emit('sc_game_end', { rankings });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
    // ==================== END SCRIBBLE SCRABBLE METHODS ====================
    // ==================== CARD CALAMITY METHODS ====================
    createCCDeck(numDecks = 1) {
        const deck = [];
        const colors = ['red', 'blue', 'green', 'yellow'];
        for (let d = 0; d < numDecks; d++) {
            for (const color of colors) {
                // One 0 card per color per deck
                deck.push({ id: (0, uuid_1.v4)(), color, type: 'number', value: 0 });
                // Two of each 1-9 per color per deck
                for (let i = 1; i <= 9; i++) {
                    deck.push({ id: (0, uuid_1.v4)(), color, type: 'number', value: i });
                    deck.push({ id: (0, uuid_1.v4)(), color, type: 'number', value: i });
                }
                // Two Skip, Reverse, Draw2 per color per deck
                for (let i = 0; i < 2; i++) {
                    deck.push({ id: (0, uuid_1.v4)(), color, type: 'skip' });
                    deck.push({ id: (0, uuid_1.v4)(), color, type: 'reverse' });
                    deck.push({ id: (0, uuid_1.v4)(), color, type: 'draw2' });
                }
            }
            // 4 Wild cards per deck
            for (let i = 0; i < 4; i++) {
                deck.push({ id: (0, uuid_1.v4)(), color: null, type: 'wild' });
            }
            // 4 Wild Draw Four cards per deck
            for (let i = 0; i < 4; i++) {
                deck.push({ id: (0, uuid_1.v4)(), color: null, type: 'wild4' });
            }
        }
        return deck;
    }
    shuffleDeck(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    startCardCalamity(room) {
        var _a, _b;
        const activePlayers = this.getActivePlayers(room);
        // Emit game start event for dealing animation
        this.io.to(room.code).emit('cc_game_start', { playerCount: activePlayers.length });
        // Calculate number of decks: 1 deck for 2-3 players, 2 for 4-5, 3 for 6-7, etc.
        const numDecks = Math.max(1, Math.ceil(activePlayers.length / 2));
        // Create and shuffle deck
        room.ccDeck = this.shuffleDeck(this.createCCDeck(numDecks));
        room.ccDiscardPile = [];
        room.ccPlayerHands = {};
        room.ccDirection = 1;
        room.ccDrawStack = 0;
        room.ccStackingEnabled = (_a = room.ccStackingEnabled) !== null && _a !== void 0 ? _a : false;
        // Create turn order
        room.ccTurnOrder = activePlayers.map(p => p.id);
        // Deal 7 cards to each player
        for (const player of activePlayers) {
            room.ccPlayerHands[player.id] = room.ccDeck.splice(0, 7);
        }
        // Flip first card (keep flipping if it's a wild4)
        let firstCard = room.ccDeck.shift();
        while (firstCard.type === 'wild4') {
            room.ccDeck.push(firstCard);
            room.ccDeck = this.shuffleDeck(room.ccDeck);
            firstCard = room.ccDeck.shift();
        }
        room.ccDiscardPile.push(firstCard);
        // Set active color
        room.ccActiveColor = (_b = firstCard.color) !== null && _b !== void 0 ? _b : 'red';
        // Pick first player
        room.ccCurrentPlayerId = room.ccTurnOrder[0];
        // Handle first card effects
        if (firstCard.type === 'skip') {
            // Skip first player
            room.ccCurrentPlayerId = this.getNextCCPlayer(room);
        }
        else if (firstCard.type === 'reverse') {
            // Reverse direction
            room.ccDirection = -1;
            // In 2-player, reverse acts like skip
            if (activePlayers.length === 2) {
                room.ccCurrentPlayerId = this.getNextCCPlayer(room);
            }
        }
        else if (firstCard.type === 'draw2') {
            // First player must draw 2
            room.ccDrawStack = 2;
        }
        else if (firstCard.type === 'wild') {
            // First player picks color
            room.state = 'CC_PICK_COLOR';
            room.ccPendingWildPlayerId = room.ccCurrentPlayerId;
            this.io.to(room.code).emit('game_started');
            this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
            this.sendCCHands(room);
            this.startCCTimer(room);
            return;
        }
        room.state = 'CC_PLAYING';
        room.currentRound = 1;
        room.totalRounds = 1;
        this.io.to(room.code).emit('game_started');
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.sendCCHands(room);
        this.startCCTimer(room);
    }
    sendCCHands(room) {
        var _a;
        if (!room.ccPlayerHands)
            return;
        for (const player of room.players) {
            if (!player.isBot && player.isConnected) {
                const hand = (_a = room.ccPlayerHands[player.id]) !== null && _a !== void 0 ? _a : [];
                this.io.to(player.socketId).emit('cc_hand', { cards: hand });
            }
        }
    }
    getNextCCPlayer(room, skip = false) {
        var _a;
        if (!room.ccTurnOrder || !room.ccCurrentPlayerId)
            return (_a = room.ccCurrentPlayerId) !== null && _a !== void 0 ? _a : '';
        const currentIndex = room.ccTurnOrder.indexOf(room.ccCurrentPlayerId);
        let nextIndex = (currentIndex + room.ccDirection + room.ccTurnOrder.length) % room.ccTurnOrder.length;
        if (skip) {
            nextIndex = (nextIndex + room.ccDirection + room.ccTurnOrder.length) % room.ccTurnOrder.length;
        }
        return room.ccTurnOrder[nextIndex];
    }
    isValidCCPlay(room, card, playerId) {
        var _a;
        if (!((_a = room.ccDiscardPile) === null || _a === void 0 ? void 0 : _a.length) || !room.ccActiveColor)
            return false;
        const topCard = room.ccDiscardPile[room.ccDiscardPile.length - 1];
        // If there's a draw stack and stacking is enabled, only +2 or +4 can be played
        if (room.ccDrawStack && room.ccDrawStack > 0 && room.ccStackingEnabled) {
            if (topCard.type === 'draw2' && card.type === 'draw2') {
                return true; // Can stack +2 on +2
            }
            if (topCard.type === 'wild4' && card.type === 'wild4') {
                return true; // Can stack +4 on +4
            }
            // Can't play anything else when there's a stack
            return false;
        }
        // If draw stack and stacking disabled, can't play anything (must draw)
        if (room.ccDrawStack && room.ccDrawStack > 0 && !room.ccStackingEnabled) {
            return false;
        }
        // Wild cards can always be played
        if (card.type === 'wild' || card.type === 'wild4') {
            return true;
        }
        // Match color
        if (card.color === room.ccActiveColor) {
            return true;
        }
        // Match type/value
        if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) {
            return true;
        }
        if (card.type === topCard.type && card.type !== 'number') {
            return true;
        }
        return false;
    }
    handleCCPlayCard(room, socketId, cardId) {
        var _a, _b, _c;
        if (room.gameId !== 'card-calamity')
            return;
        if (room.state !== 'CC_PLAYING')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player || player.id !== room.ccCurrentPlayerId)
            return;
        const hand = (_a = room.ccPlayerHands) === null || _a === void 0 ? void 0 : _a[player.id];
        if (!hand)
            return;
        const cardIndex = hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1)
            return;
        const card = hand[cardIndex];
        if (!this.isValidCCPlay(room, card, player.id)) {
            // Invalid play - notify player
            this.io.to(socketId).emit('cc_invalid_play');
            return;
        }
        // Clear timer
        this.clearCCTimer(room.code);
        // Remove card from hand
        hand.splice(cardIndex, 1);
        // Add to discard pile
        room.ccDiscardPile.push(card);
        // Set action
        room.ccLastAction = {
            type: 'play',
            playerId: player.id,
            playerName: player.name,
            card
        };
        // Handle card effects
        if (card.type === 'wild' || card.type === 'wild4') {
            // Player needs to pick a color
            room.ccPendingWildPlayerId = player.id;
            if (card.type === 'wild4') {
                room.ccDrawStack = ((_b = room.ccDrawStack) !== null && _b !== void 0 ? _b : 0) + 4;
            }
            room.state = 'CC_PICK_COLOR';
            this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
            this.sendCCHands(room);
            this.startCCTimer(room);
            return;
        }
        // Set active color
        room.ccActiveColor = card.color;
        // Handle action cards
        let skipNext = false;
        if (card.type === 'skip') {
            skipNext = true;
        }
        else if (card.type === 'reverse') {
            room.ccDirection = room.ccDirection === 1 ? -1 : 1;
            // In 2-player, reverse acts like skip
            if (room.ccTurnOrder.length === 2) {
                skipNext = true;
            }
        }
        else if (card.type === 'draw2') {
            room.ccDrawStack = ((_c = room.ccDrawStack) !== null && _c !== void 0 ? _c : 0) + 2;
        }
        // Check for win
        if (hand.length === 0) {
            this.endCardCalamity(room, player.id);
            return;
        }
        // Move to next player
        room.ccCurrentPlayerId = this.getNextCCPlayer(room, skipNext);
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.sendCCHands(room);
        this.startCCTimer(room);
    }
    handleCCDrawCard(room, socketId) {
        if (room.gameId !== 'card-calamity')
            return;
        if (room.state !== 'CC_PLAYING')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player || player.id !== room.ccCurrentPlayerId)
            return;
        this.clearCCTimer(room.code);
        // Draw cards (either from draw stack or 1 card)
        const drawCount = room.ccDrawStack && room.ccDrawStack > 0 ? room.ccDrawStack : 1;
        this.drawCCCards(room, player.id, drawCount);
        room.ccDrawStack = 0;
        room.ccLastAction = {
            type: 'draw',
            playerId: player.id,
            playerName: player.name
        };
        // Move to next player
        room.ccCurrentPlayerId = this.getNextCCPlayer(room);
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.sendCCHands(room);
        this.startCCTimer(room);
    }
    drawCCCards(room, playerId, count) {
        var _a;
        if (!room.ccDeck || !room.ccPlayerHands)
            return;
        const hand = (_a = room.ccPlayerHands[playerId]) !== null && _a !== void 0 ? _a : [];
        for (let i = 0; i < count; i++) {
            // Reshuffle discard pile if deck is empty
            if (room.ccDeck.length === 0) {
                if (room.ccDiscardPile && room.ccDiscardPile.length > 1) {
                    const topCard = room.ccDiscardPile.pop();
                    room.ccDeck = this.shuffleDeck(room.ccDiscardPile);
                    room.ccDiscardPile = [topCard];
                    // Notify clients about the shuffle
                    this.io.to(room.code).emit('cc_deck_shuffled');
                }
                else {
                    // No cards left anywhere
                    break;
                }
            }
            const card = room.ccDeck.shift();
            if (card) {
                hand.push(card);
            }
        }
        room.ccPlayerHands[playerId] = hand;
    }
    handleCCPickColor(room, socketId, color) {
        var _a, _b;
        if (room.gameId !== 'card-calamity')
            return;
        if (room.state !== 'CC_PICK_COLOR')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player || player.id !== room.ccPendingWildPlayerId)
            return;
        const validColors = ['red', 'blue', 'green', 'yellow'];
        if (!validColors.includes(color))
            return;
        this.clearCCTimer(room.code);
        room.ccActiveColor = color;
        room.ccPendingWildPlayerId = undefined;
        room.ccLastAction = Object.assign(Object.assign({}, room.ccLastAction), { color });
        // Check for win (if the wild was played and hand is empty)
        const hand = (_a = room.ccPlayerHands) === null || _a === void 0 ? void 0 : _a[player.id];
        if (hand && hand.length === 0) {
            this.endCardCalamity(room, player.id);
            return;
        }
        // Move to next player (skip if it was a +4)
        const topCard = (_b = room.ccDiscardPile) === null || _b === void 0 ? void 0 : _b[room.ccDiscardPile.length - 1];
        const skipNext = false; // +4 doesn't skip, next player must draw
        room.ccCurrentPlayerId = this.getNextCCPlayer(room, skipNext);
        room.state = 'CC_PLAYING';
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.sendCCHands(room);
        this.startCCTimer(room);
    }
    startCCTimer(room) {
        this.clearCCTimer(room.code);
        const startTime = Date.now();
        const duration = 30000; // 30 seconds
        // Emit timer start
        this.io.to(room.code).emit('cc_timer', { timeLeft: 30 });
        // Countdown every second
        const countdownInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
            this.io.to(room.code).emit('cc_timer', { timeLeft: remaining });
        }, 1000);
        // Main timer
        const timer = setTimeout(() => {
            clearInterval(countdownInterval);
            this.handleCCTimeout(room.code);
        }, duration);
        this.ccTimers.set(room.code, timer);
        this.ccTimers.set(`${room.code}_interval`, countdownInterval);
    }
    clearCCTimer(roomCode) {
        const timer = this.ccTimers.get(roomCode);
        if (timer) {
            clearTimeout(timer);
            this.ccTimers.delete(roomCode);
        }
        const interval = this.ccTimers.get(`${roomCode}_interval`);
        if (interval) {
            clearInterval(interval);
            this.ccTimers.delete(`${roomCode}_interval`);
        }
    }
    handleCCTimeout(roomCode) {
        var _a;
        const room = this.rooms.get(roomCode);
        if (!room)
            return;
        if (room.gameId !== 'card-calamity')
            return;
        const currentPlayer = room.players.find(p => p.id === room.ccCurrentPlayerId);
        if (!currentPlayer)
            return;
        if (room.state === 'CC_PICK_COLOR') {
            // Auto-pick a random color
            const colors = ['red', 'blue', 'green', 'yellow'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            room.ccActiveColor = randomColor;
            room.ccPendingWildPlayerId = undefined;
            room.ccLastAction = Object.assign(Object.assign({}, room.ccLastAction), { color: randomColor });
            room.ccCurrentPlayerId = this.getNextCCPlayer(room);
            room.state = 'CC_PLAYING';
            this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
            this.sendCCHands(room);
            this.startCCTimer(room);
            return;
        }
        if (room.state !== 'CC_PLAYING')
            return;
        // Player timed out - draw 2 penalty cards
        const drawCount = Math.max((_a = room.ccDrawStack) !== null && _a !== void 0 ? _a : 0, 2);
        this.drawCCCards(room, currentPlayer.id, drawCount);
        room.ccDrawStack = 0;
        room.ccLastAction = {
            type: 'timeout',
            playerId: currentPlayer.id,
            playerName: currentPlayer.name
        };
        // Move to next player
        room.ccCurrentPlayerId = this.getNextCCPlayer(room);
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.sendCCHands(room);
        this.startCCTimer(room);
    }
    endCardCalamity(room, winnerId) {
        var _a, _b, _c;
        this.clearCCTimer(room.code);
        room.state = 'CC_RESULTS';
        room.ccWinnerId = winnerId;
        // Calculate scores (cards left in hand = points for winner)
        const scores = {};
        for (const [playerId, hand] of Object.entries((_a = room.ccPlayerHands) !== null && _a !== void 0 ? _a : {})) {
            let points = 0;
            for (const card of hand) {
                if (card.type === 'number') {
                    points += (_b = card.value) !== null && _b !== void 0 ? _b : 0;
                }
                else if (card.type === 'skip' || card.type === 'reverse' || card.type === 'draw2') {
                    points += 20;
                }
                else if (card.type === 'wild' || card.type === 'wild4') {
                    points += 50;
                }
            }
            scores[playerId] = points;
        }
        // Winner gets sum of all other players' points
        const winnerScore = Object.entries(scores)
            .filter(([id]) => id !== winnerId)
            .reduce((sum, [, pts]) => sum + pts, 0);
        room.players.forEach(p => {
            var _a;
            p.score = p.id === winnerId ? winnerScore : (_a = scores[p.id]) !== null && _a !== void 0 ? _a : 0;
        });
        this.io.to(room.code).emit('cc_game_end', {
            winnerId,
            winnerName: (_c = room.players.find(p => p.id === winnerId)) === null || _c === void 0 ? void 0 : _c.name,
            scores
        });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.sendCCHands(room);
    }
    // ==================== END CARD CALAMITY METHODS ====================
    // ==================== SCRIBBLE SCRABBLE: SCRAMBLED METHODS ====================
    startScribbleScrabbleScrambled(room) {
        var _a;
        const activePlayers = this.getActivePlayers(room);
        // Minimum 3 players required
        if (activePlayers.length < 3) {
            const controller = room.players.find(p => p.id === room.controllerPlayerId);
            if (controller) {
                this.io.to(controller.socketId).emit('error_message', {
                    message: 'Scribble Scrabble: Scrambled requires at least 3 players!'
                });
            }
            return;
        }
        // Initialize game state
        room.sssScores = {};
        for (const p of activePlayers) {
            room.sssScores[p.id] = 0;
        }
        // Shuffle player order for fair rotation of who gets real prompt
        room.sssRealDrawerOrder = [...activePlayers.map(p => p.id)].sort(() => Math.random() - 0.5);
        // If double rounds, duplicate the order
        if (room.sssDoubleRounds) {
            room.sssRealDrawerOrder = [...room.sssRealDrawerOrder, ...room.sssRealDrawerOrder.sort(() => Math.random() - 0.5)];
        }
        room.totalRounds = room.sssRealDrawerOrder.length;
        room.sssRound = 0;
        room.sssUsedTemplateIndices = [];
        room.sssDrawTime = (_a = room.sssDrawTime) !== null && _a !== void 0 ? _a : 60;
        this.io.to(room.code).emit('game_started');
        // Start first round
        this.startSSSRound(room);
    }
    startSSSRound(room) {
        var _a, _b, _c;
        const activePlayers = this.getActivePlayers(room);
        room.sssRound = ((_a = room.sssRound) !== null && _a !== void 0 ? _a : 0) + 1;
        room.currentRound = room.sssRound;
        // Get the real drawer for this round
        const realDrawerIndex = (room.sssRound - 1) % room.sssRealDrawerOrder.length;
        room.sssRealDrawerId = room.sssRealDrawerOrder[realDrawerIndex];
        // Track active players for this round (late-joiners spectate)
        room.sssActivePlayerIds = activePlayers.map(p => p.id);
        // Generate prompts, avoiding used templates
        const usedIndices = new Set((_b = room.sssUsedTemplateIndices) !== null && _b !== void 0 ? _b : []);
        const templateIndex = (0, sssPrompts_1.getUnusedTemplateIndex)(usedIndices);
        room.sssUsedTemplateIndices = [...((_c = room.sssUsedTemplateIndices) !== null && _c !== void 0 ? _c : []), templateIndex];
        const promptSet = (0, sssPrompts_1.generatePromptSetFromTemplate)(templateIndex, activePlayers.length);
        room.sssRealPrompt = promptSet.realPrompt;
        // Assign prompts to players
        room.sssAllPrompts = {};
        const shuffledVariants = [...promptSet.variants].sort(() => Math.random() - 0.5);
        let variantIndex = 0;
        for (const player of activePlayers) {
            if (player.id === room.sssRealDrawerId) {
                room.sssAllPrompts[player.id] = promptSet.realPrompt;
            }
            else {
                room.sssAllPrompts[player.id] = shuffledVariants[variantIndex];
                variantIndex++;
            }
        }
        // Clear drawings and votes
        room.sssDrawings = {};
        room.sssVotes = {};
        room.sssRoundScores = {};
        room.state = 'SSS_DRAWING';
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        // Send private prompts to each player
        for (const player of activePlayers) {
            const prompt = room.sssAllPrompts[player.id];
            const isReal = player.id === room.sssRealDrawerId;
            this.io.to(player.socketId).emit('sss_prompt', { prompt, isReal });
        }
        // Start drawing timer
        this.startSSSTimer(room);
    }
    startSSSTimer(room) {
        var _a, _b;
        this.clearSSSTimer(room.code);
        const duration = ((_a = room.sssDrawTime) !== null && _a !== void 0 ? _a : 60) * 1000;
        const startTime = Date.now();
        // Emit timer start
        this.io.to(room.code).emit('sss_timer', { timeLeft: (_b = room.sssDrawTime) !== null && _b !== void 0 ? _b : 60 });
        // Countdown every second
        const countdownInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
            this.io.to(room.code).emit('sss_timer', { timeLeft: remaining });
        }, 1000);
        // Main timer
        const timer = setTimeout(() => {
            clearInterval(countdownInterval);
            this.handleSSSDrawingTimeout(room.code);
        }, duration);
        this.sssTimers.set(room.code, timer);
        this.sssTimers.set(`${room.code}_interval`, countdownInterval);
    }
    clearSSSTimer(roomCode) {
        const timer = this.sssTimers.get(roomCode);
        if (timer) {
            clearTimeout(timer);
            this.sssTimers.delete(roomCode);
        }
        const interval = this.sssTimers.get(`${roomCode}_interval`);
        if (interval) {
            clearInterval(interval);
            this.sssTimers.delete(`${roomCode}_interval`);
        }
    }
    handleSSSDrawingTimeout(roomCode) {
        var _a, _b, _c;
        const room = this.rooms.get(roomCode);
        if (!room || room.state !== 'SSS_DRAWING')
            return;
        // Auto-submit empty drawings for players who didn't submit
        const activePlayers = (_a = room.sssActivePlayerIds) !== null && _a !== void 0 ? _a : [];
        for (const playerId of activePlayers) {
            if (!((_b = room.sssDrawings) === null || _b === void 0 ? void 0 : _b[playerId])) {
                room.sssDrawings = (_c = room.sssDrawings) !== null && _c !== void 0 ? _c : {};
                room.sssDrawings[playerId] = ''; // Empty drawing
            }
        }
        // Move to voting
        this.advanceToSSSVoting(room);
    }
    handleSSSSubmitDrawing(room, socketId, drawing) {
        var _a, _b, _c, _d, _e;
        if (room.gameId !== 'scribble-scrabble-scrambled')
            return;
        if (room.state !== 'SSS_DRAWING')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return;
        // Only active players can submit
        if (!((_a = room.sssActivePlayerIds) === null || _a === void 0 ? void 0 : _a.includes(player.id)))
            return;
        // Already submitted
        if ((_b = room.sssDrawings) === null || _b === void 0 ? void 0 : _b[player.id])
            return;
        room.sssDrawings = (_c = room.sssDrawings) !== null && _c !== void 0 ? _c : {};
        room.sssDrawings[player.id] = drawing;
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        // Check if all players have submitted
        const activeCount = (_e = (_d = room.sssActivePlayerIds) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0;
        const submittedCount = Object.keys(room.sssDrawings).length;
        if (submittedCount >= activeCount) {
            this.clearSSSTimer(room.code);
            this.advanceToSSSVoting(room);
        }
    }
    advanceToSSSVoting(room) {
        room.state = 'SSS_VOTING';
        room.sssVotes = {};
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
    handleSSSVote(room, socketId, votedForPlayerId) {
        var _a, _b, _c, _d, _e, _f;
        if (room.gameId !== 'scribble-scrabble-scrambled')
            return;
        if (room.state !== 'SSS_VOTING')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return;
        // Only active players can vote
        if (!((_a = room.sssActivePlayerIds) === null || _a === void 0 ? void 0 : _a.includes(player.id)))
            return;
        // Can't vote for yourself
        if (votedForPlayerId === player.id)
            return;
        // Can't vote for someone not playing
        if (!((_b = room.sssActivePlayerIds) === null || _b === void 0 ? void 0 : _b.includes(votedForPlayerId)))
            return;
        // Already voted
        if ((_c = room.sssVotes) === null || _c === void 0 ? void 0 : _c[player.id])
            return;
        room.sssVotes = (_d = room.sssVotes) !== null && _d !== void 0 ? _d : {};
        room.sssVotes[player.id] = votedForPlayerId;
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        // Check if all players have voted (everyone except the real drawer can vote)
        const voterCount = ((_f = (_e = room.sssActivePlayerIds) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0);
        const votedCount = Object.keys(room.sssVotes).length;
        // Everyone votes (including real drawer to throw others off)
        if (votedCount >= voterCount) {
            this.calculateSSSScores(room);
        }
    }
    calculateSSSScores(room) {
        var _a, _b, _c, _d, _e, _f;
        const realDrawerId = room.sssRealDrawerId;
        const votes = (_a = room.sssVotes) !== null && _a !== void 0 ? _a : {};
        // Calculate how many people voted for each player
        const votesByTarget = {};
        for (const [voterId, targetId] of Object.entries(votes)) {
            if (!votesByTarget[targetId]) {
                votesByTarget[targetId] = [];
            }
            votesByTarget[targetId].push(voterId);
        }
        // Count how many people the real drawer tricked (voted for them = wrong)
        // Actually, people who voted for the REAL drawer guessed correctly
        // People who voted for someone ELSE got tricked by that person
        room.sssRoundScores = {};
        room.sssScores = (_b = room.sssScores) !== null && _b !== void 0 ? _b : {};
        for (const playerId of (_c = room.sssActivePlayerIds) !== null && _c !== void 0 ? _c : []) {
            room.sssRoundScores[playerId] = { tricked: 0, correct: false };
        }
        // Award points
        for (const [voterId, targetId] of Object.entries(votes)) {
            if (targetId === realDrawerId) {
                // Correct guess! +2 points
                room.sssScores[voterId] = ((_d = room.sssScores[voterId]) !== null && _d !== void 0 ? _d : 0) + 2;
                room.sssRoundScores[voterId].correct = true;
            }
            else {
                // Wrong guess - the person they voted for tricked them (+1 for that person)
                room.sssScores[targetId] = ((_e = room.sssScores[targetId]) !== null && _e !== void 0 ? _e : 0) + 1;
                room.sssRoundScores[targetId].tricked += 1;
            }
        }
        // Update player scores in the player list
        for (const player of room.players) {
            player.score = (_f = room.sssScores[player.id]) !== null && _f !== void 0 ? _f : 0;
        }
        room.state = 'SSS_RESULTS';
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        // Send detailed results
        this.io.to(room.code).emit('sss_results', {
            realDrawerId,
            realPrompt: room.sssRealPrompt,
            allPrompts: room.sssAllPrompts,
            drawings: room.sssDrawings,
            votes: room.sssVotes,
            roundScores: room.sssRoundScores,
            totalScores: room.sssScores,
            votesByTarget
        });
    }
    advanceSSSRound(room) {
        var _a;
        const currentRound = (_a = room.sssRound) !== null && _a !== void 0 ? _a : 0;
        const totalRounds = room.totalRounds;
        if (currentRound >= totalRounds) {
            // Game over
            this.endScribbleScrabbleScrambled(room);
        }
        else {
            // Next round
            this.startSSSRound(room);
        }
    }
    endScribbleScrabbleScrambled(room) {
        var _a, _b, _c;
        room.state = 'END';
        // Find winner(s)
        const scores = (_a = room.sssScores) !== null && _a !== void 0 ? _a : {};
        const maxScore = Math.max(...Object.values(scores));
        const winners = room.players.filter(p => scores[p.id] === maxScore);
        this.io.to(room.code).emit('sss_game_end', {
            scores,
            winnerId: (_b = winners[0]) === null || _b === void 0 ? void 0 : _b.id,
            winnerName: (_c = winners[0]) === null || _c === void 0 ? void 0 : _c.name,
            winners: winners.map(w => ({ id: w.id, name: w.name, score: scores[w.id] }))
        });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
    // ==================== END SCRIBBLE SCRABBLE: SCRAMBLED METHODS ====================
    getRoomPublicState(room) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
        // Count how many players have answered the current AQ question
        const aqAnsweredCount = room.aqCurrentQuestion && room.aqAnswers
            ? Object.values(room.aqAnswers).filter(a => a[room.aqCurrentQuestion] !== undefined).length
            : 0;
        return {
            code: room.code,
            gameId: room.gameId,
            players: room.players.map(p => ({ name: p.name, score: p.score, isConnected: p.isConnected, id: p.id, isBot: p.isBot })),
            controllerPlayerId: room.controllerPlayerId,
            state: room.state,
            currentRound: room.currentRound,
            totalRounds: room.totalRounds,
            contestants: ((_a = room.nastyContestantIds) !== null && _a !== void 0 ? _a : []).map(id => {
                var _a;
                const p = room.players.find(x => x.id === id);
                return { id, name: (_a = p === null || p === void 0 ? void 0 : p.name) !== null && _a !== void 0 ? _a : 'Unknown' };
            }),
            promptSubmissions: (_c = (_b = room.nastyPromptSubmissions) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0,
            problemsSubmitted: room.dpProblemsByPlayer ? Object.keys(room.dpProblemsByPlayer).length : 0,
            problemsTotal: this.getActivePlayers(room).length,
            selectionsMade: room.dpSelectedByPlayer ? Object.keys(room.dpSelectedByPlayer).length : 0,
            drawingsSubmitted: room.dpDrawings ? Object.keys(room.dpDrawings).length : 0,
            currentPresenter: room.currentPresenterId ? (_d = room.players.find(p => p.id === room.currentPresenterId)) === null || _d === void 0 ? void 0 : _d.name : undefined,
            currentPresenterId: room.currentPresenterId,
            currentDrawing: room.currentPresenterId && room.dpDrawings ? room.dpDrawings[room.currentPresenterId] : undefined,
            currentTitle: room.currentPresenterId && room.answers ? (_e = room.answers.find(a => a.playerId === room.currentPresenterId)) === null || _e === void 0 ? void 0 : _e.answer : undefined,
            currentProblem: room.currentPresenterId && room.dpSelectedByPlayer ? room.dpSelectedByPlayer[room.currentPresenterId] : undefined,
            promptText: room.promptText,
            currentInvestments: (_f = room.currentInvestments) !== null && _f !== void 0 ? _f : {},
            // Autism Quiz fields
            aqCurrentQuestion: room.aqCurrentQuestion,
            aqAnsweredCount,
            aqScores: room.aqScores,
            // Scribble Scrabble fields
            scDrawerId: room.scDrawerId,
            scDrawerName: room.scDrawerId ? (_g = room.players.find(p => p.id === room.scDrawerId)) === null || _g === void 0 ? void 0 : _g.name : undefined,
            scWordHint: room.scWord ? (0, scribbleWords_1.generateWordHint)(room.scWord, (_h = room.scRevealedIndices) !== null && _h !== void 0 ? _h : []) : undefined,
            scRoundTime: room.scRoundTime,
            scRoundDuration: (_j = room.scRoundDuration) !== null && _j !== void 0 ? _j : 60,
            scRoundsPerPlayer: (_k = room.scRoundsPerPlayer) !== null && _k !== void 0 ? _k : 1,
            scCurrentRound: room.scCurrentRound,
            scTotalRounds: room.scTotalRounds,
            scCorrectGuessers: room.scCorrectGuessers,
            scScores: room.scScores,
            scGuessChat: room.scGuessChat,
            scDrawingStrokes: room.scDrawingStrokes,
            // Card Calamity fields
            ccCurrentPlayerId: room.ccCurrentPlayerId,
            ccCurrentPlayerName: room.ccCurrentPlayerId ? (_l = room.players.find(p => p.id === room.ccCurrentPlayerId)) === null || _l === void 0 ? void 0 : _l.name : undefined,
            ccDirection: room.ccDirection,
            ccDrawStack: room.ccDrawStack,
            ccActiveColor: room.ccActiveColor,
            ccTopCard: ((_m = room.ccDiscardPile) === null || _m === void 0 ? void 0 : _m.length) ? room.ccDiscardPile[room.ccDiscardPile.length - 1] : undefined,
            ccHandCounts: room.ccPlayerHands ? Object.fromEntries(Object.entries(room.ccPlayerHands).map(([id, cards]) => [id, cards.length])) : undefined,
            ccTurnOrder: room.ccTurnOrder,
            ccStackingEnabled: (_o = room.ccStackingEnabled) !== null && _o !== void 0 ? _o : false,
            ccLastAction: room.ccLastAction,
            ccWinnerId: room.ccWinnerId,
            ccWinnerName: room.ccWinnerId ? (_p = room.players.find(p => p.id === room.ccWinnerId)) === null || _p === void 0 ? void 0 : _p.name : undefined,
            ccPendingWildPlayerId: room.ccPendingWildPlayerId,
            // Scribble Scrabble: Scrambled fields
            sssRound: room.sssRound,
            sssDrawTime: (_q = room.sssDrawTime) !== null && _q !== void 0 ? _q : 60,
            sssDoubleRounds: (_r = room.sssDoubleRounds) !== null && _r !== void 0 ? _r : false,
            sssDrawingsSubmitted: room.sssDrawings ? Object.keys(room.sssDrawings).length : 0,
            sssVotesSubmitted: room.sssVotes ? Object.keys(room.sssVotes).length : 0,
            sssActivePlayerCount: (_t = (_s = room.sssActivePlayerIds) === null || _s === void 0 ? void 0 : _s.length) !== null && _t !== void 0 ? _t : 0,
            sssScores: room.sssScores,
            sssDrawings: room.sssDrawings, // Send drawings for voting/results
            sssRealDrawerId: room.state === 'SSS_RESULTS' ? room.sssRealDrawerId : undefined, // Only reveal after voting
            sssRealPrompt: room.state === 'SSS_RESULTS' ? room.sssRealPrompt : undefined,
            sssAllPrompts: room.state === 'SSS_RESULTS' ? room.sssAllPrompts : undefined,
            sssVotes: room.state === 'SSS_RESULTS' ? room.sssVotes : undefined,
            sssRoundScores: room.sssRoundScores
        };
    }
    // Escape XML to safely embed text in generated SVG
    escapeXml(input) {
        return String(input)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
exports.GameManager = GameManager;
