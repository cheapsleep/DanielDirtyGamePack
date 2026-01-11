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
class GameManager {
    constructor(io) {
        this.rooms = new Map();
        this.socketRoomMap = new Map(); // socketId -> roomCode
        this.botRun = new Map();
        this.io = io;
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
            votedBy: {}
        };
        this.rooms.set(roomCode, newRoom);
        this.socketRoomMap.set(socket.id, roomCode);
        socket.join(roomCode);
        socket.emit('room_created', { roomCode, hostKey });
        this.io.to(roomCode).emit('room_update', this.getRoomPublicState(newRoom));
        console.log(`Room created: ${roomCode} by ${socket.id}`);
    }
    handleJoin(socket, data) {
        var _a, _b;
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
        this.io.to(roomCode).emit('room_closed');
        this.rooms.delete(roomCode);
        for (const [socketId, code] of this.socketRoomMap.entries()) {
            if (code === roomCode)
                this.socketRoomMap.delete(socketId);
        }
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
            case 'SUBMIT_VOTE':
                this.handleVote(room, socket.id, data.voteIndex);
                break;
            case 'NEXT_ROUND':
                if (this.isControllerSocket(room, socket.id)) {
                    this.nextRound(room);
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
                    // Optionally close room or wait for reconnect
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
        const botCount = room.players.filter(p => p.isBot).length;
        const id = (0, uuid_1.v4)();
        const bot = {
            id,
            name: `CPU ${botCount + 1}`,
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
    runBots(room) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
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
                    const choices = (_j = (_h = room.dpChoicesByPlayer) === null || _h === void 0 ? void 0 : _h[bot.id]) !== null && _j !== void 0 ? _j : [];
                    const pick = choices[Math.floor(Math.random() * choices.length)];
                    if (!pick)
                        continue;
                    this.handleSelectProblem(room, bot.socketId, pick);
                }
            }
            if (room.state === 'DP_ANSWER') {
                for (const bot of bots) {
                    if (room.state !== 'DP_ANSWER')
                        break;
                    const already = room.answers.some(a => a.playerId === bot.id);
                    if (already)
                        continue;
                    const problem = (_l = (_k = room.dpSelectedByPlayer) === null || _k === void 0 ? void 0 : _k[bot.id]) !== null && _l !== void 0 ? _l : 'A problem.';
                    const answer = yield this.generateBotPrompt('dp_answer', problem);
                    this.handleAnswer(room, bot.socketId, answer);
                }
            }
            if (room.state === 'DP_VOTING') {
                for (const bot of bots) {
                    if (room.state !== 'DP_VOTING')
                        break;
                    const already = (_m = room.votedBy) === null || _m === void 0 ? void 0 : _m[bot.socketId];
                    if (already)
                        continue;
                    const ownIndex = room.answers.findIndex(a => a.playerId === bot.id);
                    const options = room.answers.map((_, idx) => idx).filter(i => i !== ownIndex);
                    if (options.length === 0)
                        continue;
                    const pick = options[Math.floor(Math.random() * options.length)];
                    this.handleVote(room, bot.socketId, pick);
                }
            }
        });
    }
    generateBotPrompt(kind, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const fromApi = yield this.tryBotApi(kind, context);
            if (fromApi)
                return fromApi;
            if (kind === 'nasty_prompt') {
                const templates = [
                    'The worst thing to say at a wedding is ____.',
                    'My new job title is officially “____.”',
                    'I knew it was a bad idea when the label said “____.”',
                    'Tonight’s dinner: ____ with a side of ____.',
                    'The first rule of my secret club is ____.'
                ];
                return templates[Math.floor(Math.random() * templates.length)];
            }
            if (kind === 'dp_problem') {
                const templates = [
                    'I can’t stop losing my keys.',
                    'My group chats never stop buzzing.',
                    'My socks keep disappearing in the laundry.',
                    'I always spill drinks at the worst time.',
                    'I can’t remember why I walked into a room.'
                ];
                return templates[Math.floor(Math.random() * templates.length)];
            }
            if (kind === 'nasty_answer') {
                const templates = ['a tactical nap', 'too much confidence', 'my evil twin', 'free samples', 'the vibe check'];
                return templates[Math.floor(Math.random() * templates.length)];
            }
            const templates = [
                `Introducing the ${this.pick(['Auto', 'Mega', 'Ultra', 'Pocket', 'Turbo'])}${this.pick(['Buddy', 'Gizmo', 'Helper', 'Pal', 'Wizard'])}: it fixes it instantly, probably.`,
                `Behold my invention: a wearable solution that handles it while you pretend you meant to.`,
                `My invention solves it by politely asking it to stop. Somehow it works.`
            ];
            return templates[Math.floor(Math.random() * templates.length)];
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
    startGame(room) {
        const activePlayers = this.getActivePlayers(room);
        if (activePlayers.length < 3) {
            this.io.to(room.hostSocketId).emit('error', { message: 'At least 3 players required' });
            return;
        }
        room.answers = [];
        room.votes = {};
        room.votedBy = {};
        if (room.gameId === 'nasty-libs') {
            room.totalRounds = 5;
            room.currentRound = 1;
            this.startNastyRound(room);
            return;
        }
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
        var _a, _b;
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
        const selected = room.nastyPromptSubmissions[Math.floor(Math.random() * room.nastyPromptSubmissions.length)];
        room.promptText = selected.prompt;
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
            while (choices.length < 3) {
                const next = source[Math.floor(Math.random() * source.length)];
                if (!next)
                    break;
                if (!choices.includes(next) || source.length < 3)
                    choices.push(next);
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
        room.state = 'DP_ANSWER';
        room.answers = [];
        room.votes = {};
        room.votedBy = {};
        for (const p of activePlayers) {
            const prompt = room.dpSelectedByPlayer[p.id];
            if (prompt && p.socketId) {
                this.io.to(p.socketId).emit('new_prompt', {
                    prompt,
                    gameId: room.gameId,
                    round: room.currentRound,
                    timeLimit: 90
                });
            }
        }
        this.io.to(room.hostSocketId).emit('new_prompt', {
            prompt: 'Players are pitching inventions...',
            gameId: room.gameId,
            round: room.currentRound,
            timeLimit: 90
        });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.scheduleBotRun(room);
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
        if (room.state !== 'DP_ANSWER')
            return;
        if (room.answers.some(a => a.playerId === player.id))
            return;
        room.answers.push({ playerId: player.id, answer });
        const activePlayers = this.getActivePlayers(room);
        if (room.answers.length < activePlayers.length)
            return;
        room.state = 'DP_VOTING';
        room.votes = {};
        room.votedBy = {};
        this.io.to(room.code).emit('start_voting', {
            answers: room.answers.map(a => a.answer),
            timeLimit: 30
        });
        this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
        this.scheduleBotRun(room);
    }
    handleVote(room, socketId, voteIndex) {
        var _a, _b;
        if (room.state !== 'NL_VOTING' && room.state !== 'DP_VOTING')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return;
        (_a = room.votedBy) !== null && _a !== void 0 ? _a : (room.votedBy = {});
        if (room.votedBy[socketId])
            return;
        const index = Number(voteIndex);
        if (!Number.isFinite(index))
            return;
        if (index < 0 || index >= room.answers.length)
            return;
        if (((_b = room.answers[index]) === null || _b === void 0 ? void 0 : _b.playerId) === player.id)
            return;
        room.votedBy[socketId] = true;
        room.votes[index] = (room.votes[index] || 0) + 1;
        const activePlayers = this.getActivePlayers(room);
        const totalVotes = Object.values(room.votes).reduce((a, b) => a + b, 0);
        if (totalVotes < activePlayers.length)
            return;
        this.showResults(room);
    }
    showResults(room) {
        if (room.state !== 'NL_VOTING' && room.state !== 'DP_VOTING')
            return;
        room.state = room.gameId === 'nasty-libs' ? 'NL_RESULTS' : 'DP_RESULTS';
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
        for (let attempt = 0; attempt < 20; attempt++) {
            const code = this.generateRoomCode();
            if (!this.rooms.has(code))
                return code;
        }
        return (0, uuid_1.v4)().slice(0, 4).toUpperCase();
    }
    getRoomPublicState(room) {
        var _a, _b, _c;
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
            selectionsMade: room.dpSelectedByPlayer ? Object.keys(room.dpSelectedByPlayer).length : 0
        };
    }
}
exports.GameManager = GameManager;
