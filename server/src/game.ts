import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { nastyPrompts, nastyAnswers } from './nastyPrompts';
import { autismQuizQuestions, generateCertificateSVG } from './autismQuiz';

type GameId = 'nasty-libs' | 'dubiously-patented' | 'autism-assessment';

interface Player {
  id: string;
  name: string;
  socketId: string;
  score: number;
  isConnected: boolean;
  isBot?: boolean;
  answers: Record<string, string>; // round -> answer
}

interface Room {
  code: string;
  gameId: GameId;
  hostSocketId: string;
  hostKey: string;
  hostConnected: boolean;
  controllerPlayerId?: string;
  players: Player[];
  state:
    | 'LOBBY'
    | 'NL_PROMPT_SUBMIT'
    | 'NL_ANSWER'
    | 'NL_VOTING'
    | 'NL_RESULTS'
    | 'DP_PROBLEM_SUBMIT'
    | 'DP_PICK'
    | 'DP_DRAWING'
    | 'DP_PRESENTING'
    | 'DP_INVESTING'
    | 'DP_RESULTS'
    | 'AQ_QUESTION'
    | 'AQ_RESULTS'
    | 'END';
  currentRound: number;
  totalRounds: number;
  promptText?: string;
  nastyContestantIds?: string[];
  nastyPromptSubmissions?: { playerId: string; prompt: string }[];
  dpProblemsByPlayer?: Record<string, string[]>;
  dpAllProblems?: { playerId: string; text: string }[];
  dpChoicesByPlayer?: Record<string, string[]>;
  dpSelectedByPlayer?: Record<string, string>;
  dpDrawings?: Record<string, string>; // playerId -> base64
  presentationOrder?: string[];
  currentPresenterId?: string;
  currentInvestments?: Record<string, number>; // playerId -> amount
  // Autism Quiz fields
  aqCurrentQuestion?: number;
  aqAnswers?: Record<string, Record<number, boolean>>; // playerId -> questionId -> agreed
  aqScores?: Record<string, number>; // playerId -> score
  answers: { playerId: string; answer: string }[];
  votes: Record<string, number>; // answerIndex -> count
  votedBy?: Record<string, boolean>;
}

export class GameManager {
  private io: Server;
  private rooms: Map<string, Room> = new Map();
  private socketRoomMap: Map<string, string> = new Map(); // socketId -> roomCode
  private botRun: Map<string, { running: boolean; pending: boolean }> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  handleCreateRoom(socket: Socket, gameId?: GameId) {
    const resolvedGameId: GameId = gameId ?? 'nasty-libs';
    const roomCode = this.generateUniqueRoomCode();
    const hostKey = uuidv4();
    const newRoom: Room = {
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

  handleJoin(
    socket: Socket,
    data: { roomCode?: string; playerName?: string; isHost?: boolean; playerId?: string; hostKey?: string }
  ) {
    const roomCode = String(data?.roomCode ?? '').trim().toUpperCase();
    const playerName = String(data?.playerName ?? '').trim();
    const isHost = Boolean(data?.isHost);
    const playerId = data?.playerId ? String(data.playerId) : undefined;
    const hostKey = data?.hostKey ? String(data.hostKey) : undefined;

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
    } else {
      // Player join
      if (!playerName) {
        socket.emit('error', { message: 'Name is required' });
        return;
      }

      const existingById = playerId ? room.players.find(p => p.id === playerId) : undefined;
      if (existingById) {
        existingById.socketId = socket.id;
        existingById.isConnected = true;
        if (!room.controllerPlayerId && !existingById.isBot) room.controllerPlayerId = existingById.id;
        socket.emit('joined', { roomCode: room.code, playerId: existingById.id, gameId: room.gameId });
      } else {
        const existingByName = room.players.find(p => p.name === playerName);
        if (existingByName && existingByName.isConnected && !existingByName.isBot) {
          socket.emit('error', { message: 'That name is already taken in this room' });
          return;
        }

        if (existingByName && !existingByName.isConnected && !existingByName.isBot) {
          existingByName.socketId = socket.id;
          existingByName.isConnected = true;
          if (!room.controllerPlayerId) room.controllerPlayerId = existingByName.id;
          socket.emit('joined', { roomCode: room.code, playerId: existingByName.id, gameId: room.gameId });
        } else {
          const newPlayer: Player = {
            id: uuidv4(),
            name: playerName,
            socketId: socket.id,
            score: 0,
            isConnected: true,
            answers: {}
          };
          room.players.push(newPlayer);
          if (!room.controllerPlayerId) room.controllerPlayerId = newPlayer.id;
          socket.emit('joined', { roomCode: room.code, playerId: newPlayer.id, gameId: room.gameId });
        }
      }
    }

    this.socketRoomMap.set(socket.id, roomCode);
    socket.join(roomCode);

    // Notify everyone in the room
    this.io.to(roomCode).emit('room_update', this.getRoomPublicState(room));
  }

  handleCloseRoom(socket: Socket) {
    const roomCode = this.socketRoomMap.get(socket.id);
    if (!roomCode) return;
    const room = this.rooms.get(roomCode);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;

    this.io.to(roomCode).emit('room_closed');
    this.rooms.delete(roomCode);

    for (const [socketId, code] of this.socketRoomMap.entries()) {
      if (code === roomCode) this.socketRoomMap.delete(socketId);
    }
  }

  handleGameAction(socket: Socket, data: any) {
    const roomCode = this.socketRoomMap.get(socket.id);
    if (!roomCode) return;
    const room = this.rooms.get(roomCode);
    if (!room) return;

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
      case 'NEXT_ROUND':
        if (this.isControllerSocket(room, socket.id)) {
            this.nextRound(room);
        }
        break;
    }
  }

  handleDisconnect(socket: Socket) {
    const roomCode = this.socketRoomMap.get(socket.id);
    if (roomCode) {
      const room = this.rooms.get(roomCode);
      if (room) {
        if (socket.id === room.hostSocketId) {
            // Host disconnected
            console.log('Host disconnected from room ' + roomCode);
            room.hostConnected = false;
            // Optionally close room or wait for reconnect
        } else {
            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                player.isConnected = false;
                if (room.controllerPlayerId === player.id) {
                  const nextController = room.players.find(p => !p.isBot && p.isConnected);
                  room.controllerPlayerId = nextController?.id;
                }
                this.io.to(roomCode).emit('room_update', this.getRoomPublicState(room));
            }
        }
      }
      this.socketRoomMap.delete(socket.id);
    }
  }

  private getActivePlayers(room: Room) {
    return room.players.filter(p => p.isConnected || p.isBot);
  }

  private isControllerSocket(room: Room, socketId: string) {
    if (!room.controllerPlayerId) return false;
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return false;
    return player.id === room.controllerPlayerId;
  }

  private addBot(room: Room) {
    if (room.state !== 'LOBBY') return;
    const botCount = room.players.filter(p => p.isBot).length;
    const id = uuidv4();
    const adj = ['Turbo','Mega','Silly','Quantum','Pocket','Mystic','Zippy','Wacky','Glitchy','Jolly'];
    const noun = ['Toaster','Gizmo','Widget','Pal','Duck','Monkey','Gadget','Noodle','Wombat','Sprout'];
    const name = `${this.pick(adj)} ${this.pick(noun)} (CPU)`;
    const bot: Player = {
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

  private removeBot(room: Room) {
    if (room.state !== 'LOBBY') return;
    const idx = [...room.players].reverse().findIndex(p => p.isBot);
    if (idx === -1) return;
    const realIndex = room.players.length - 1 - idx;
    room.players.splice(realIndex, 1);
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
  }

  private scheduleBotRun(room: Room) {
    const key = room.code;
    const entry = this.botRun.get(key) ?? { running: false, pending: false };
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
      if (!next) return;
      next.running = false;
      this.botRun.set(key, next);
      if (next.pending) {
        next.pending = false;
        this.botRun.set(key, next);
        const current = this.rooms.get(key);
        if (current) this.scheduleBotRun(current);
      }
    });
  }

  // Helper to add human-like random delay (1-5 seconds)
  private async humanDelay(minMs = 1000, maxMs = 5000): Promise<void> {
    const delay = minMs + Math.random() * (maxMs - minMs);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private async runBots(room: Room) {
    const bots = this.getActivePlayers(room).filter(p => p.isBot);
    if (bots.length === 0) return;

    if (room.gameId === 'nasty-libs') {
      if (room.state === 'NL_PROMPT_SUBMIT') {
        for (const bot of bots) {
          if (room.state !== 'NL_PROMPT_SUBMIT') break;
          if (room.nastyContestantIds?.includes(bot.id)) continue;
          const already = room.nastyPromptSubmissions?.some(p => p.playerId === bot.id);
          if (already) continue;
          // Human-like delay before submitting
          await this.humanDelay(2000, 8000);
          if (room.state !== 'NL_PROMPT_SUBMIT') break;
          const prompt = await this.generateBotPrompt('nasty_prompt');
          this.handleSubmitPrompt(room, bot.socketId, prompt);
        }
      }

      if (room.state === 'NL_ANSWER') {
        const contestants = new Set(room.nastyContestantIds ?? []);
        for (const bot of bots) {
          if (room.state !== 'NL_ANSWER') break;
          if (!contestants.has(bot.id)) continue;
          const already = room.answers.some(a => a.playerId === bot.id);
          if (already) continue;
          // Human-like delay - "thinking" of a funny answer
          await this.humanDelay(3000, 12000);
          if (room.state !== 'NL_ANSWER') break;
          const answer = await this.generateBotPrompt('nasty_answer', room.promptText ?? '');
          this.handleAnswer(room, bot.socketId, answer);
        }
      }

      if (room.state === 'NL_VOTING') {
        for (const bot of bots) {
          if (room.state !== 'NL_VOTING') break;
          const already = room.votedBy?.[bot.socketId];
          if (already) continue;
          // Human-like delay - reading options
          await this.humanDelay(2000, 6000);
          if (room.state !== 'NL_VOTING') break;
          const ownIndex = room.answers.findIndex(a => a.playerId === bot.id);
          const options = room.answers.map((_, idx) => idx).filter(i => i !== ownIndex);
          if (options.length === 0) continue;
          const pick = options[Math.floor(Math.random() * options.length)];
          this.handleVote(room, bot.socketId, pick);
        }
      }

      return;
    }

    if (room.state === 'DP_PROBLEM_SUBMIT') {
      for (const bot of bots) {
        if (room.state !== 'DP_PROBLEM_SUBMIT') break;
        const already = Boolean(room.dpProblemsByPlayer?.[bot.id]);
        if (already) continue;
        // Human-like delay - thinking of problems
        await this.humanDelay(3000, 10000);
        if (room.state !== 'DP_PROBLEM_SUBMIT') break;
        const p1 = await this.generateBotPrompt('dp_problem');
        const p2 = await this.generateBotPrompt('dp_problem');
        const p3 = await this.generateBotPrompt('dp_problem');
        this.handleSubmitProblems(room, bot.socketId, [p1, p2, p3]);
      }
    }

    if (room.state === 'DP_PICK') {
      for (const bot of bots) {
        if (room.state !== 'DP_PICK') break;
        const already = Boolean(room.dpSelectedByPlayer?.[bot.id]);
        if (already) continue;
        // Human-like delay - reading choices
        await this.humanDelay(2000, 5000);
        if (room.state !== 'DP_PICK') break;
        const choices = room.dpChoicesByPlayer?.[bot.id] ?? [];
        const pick = choices[Math.floor(Math.random() * choices.length)];
        if (!pick) continue;
        this.handleSelectProblem(room, bot.socketId, pick);
      }
    }

    if (room.state === 'DP_DRAWING') {
      for (const bot of bots) {
        if (room.state !== 'DP_DRAWING') break;
        const already = room.dpDrawings?.[bot.id];
        if (already) continue;
        
        // Human-like delay - "drawing" takes time
        await this.humanDelay(5000, 15000);
        if (room.state !== 'DP_DRAWING') break;
        
        const problem = room.dpSelectedByPlayer?.[bot.id] ?? 'A problem.';
        const title = await this.generateBotPrompt('dp_answer', problem);
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
        if (room.state !== 'DP_INVESTING') break;
        if (bot.id === room.currentPresenterId) continue;
        
        const already = room.currentInvestments?.[bot.id];
        if (already !== undefined) continue;
        
        // Human-like delay - "considering" the investment
        await this.humanDelay(2000, 8000);
        if (room.state !== 'DP_INVESTING') break;
        
        // Smarter investing - invest more on earlier presentations, less on later ones
        // Also add some randomness to feel more human
        const max = bot.score;
        const basePercent = 0.1 + Math.random() * 0.4; // 10-50% base
        const amount = Math.floor(max * basePercent);
        this.handleInvest(room, bot.socketId, amount);
      }
    }
  }

  private async generateBotPrompt(kind: 'nasty_prompt' | 'nasty_answer' | 'dp_problem' | 'dp_answer', context?: string) {
    const fromApi = await this.tryBotApi(kind, context);
    if (fromApi) return fromApi;

    if (kind === 'nasty_prompt') {
      // Use the imported nasty prompts list
      return this.pick(nastyPrompts);
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
      return this.pick(nastyAnswers);
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
      `The "${context?.slice(0, 20) ?? 'Problem'}" ${noun}`
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
  }

  private pick(items: string[]) {
    return items[Math.floor(Math.random() * items.length)];
  }

  private async tryBotApi(
    kind: 'nasty_prompt' | 'nasty_answer' | 'dp_problem' | 'dp_answer',
    context?: string
  ): Promise<string | null> {
    const apiKey = process.env.BOT_API_KEY;
    const apiUrl = process.env.BOT_API_URL ?? 'https://api.openai.com/v1/chat/completions';
    const model = process.env.BOT_MODEL ?? 'gpt-4o-mini';
    if (!apiKey) return null;

    const system =
      kind === 'nasty_prompt'
        ? 'Write one funny party-game prompt with a blank (____). Max 90 chars. No profanity.'
        : kind === 'nasty_answer'
          ? 'Write one short funny answer. Max 80 chars. No profanity.'
          : kind === 'dp_problem'
            ? 'Write one short everyday problem for silly inventions. Max 80 chars. No profanity.'
            : 'Pitch a silly invention in 1-2 sentences. No bullet points. No profanity.';

    const user =
      kind === 'nasty_answer'
        ? `Prompt: ${context ?? ''}`
        : kind === 'dp_answer'
          ? `Problem: ${context ?? ''}`
          : 'Go.';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(apiUrl, {
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
      if (!res.ok) return null;
      const json: any = await res.json();
      const text = String(json?.choices?.[0]?.message?.content ?? '').trim();
      if (!text) return null;
      return text.split('\n').filter(Boolean)[0].trim();
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private startGame(room: Room) {
    let activePlayers = this.getActivePlayers(room);
    
    // Auto-fill bots if less than 4 players (skip for autism quiz - no bots needed)
    if (room.gameId !== 'autism-assessment') {
      while (activePlayers.length < 4) {
        this.addBot(room);
        activePlayers = this.getActivePlayers(room);
      }
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

    if (room.gameId === 'autism-assessment') {
      room.totalRounds = 20; // 20 questions
      room.currentRound = 1;
      room.aqCurrentQuestion = 1;
      room.aqAnswers = {};
      room.aqScores = {};
      // Initialize answer tracking for all players
      for (const p of activePlayers) {
        room.aqAnswers[p.id] = {};
      }
      room.state = 'AQ_QUESTION';
      this.io.to(room.code).emit('game_started');
      this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
      this.io.to(room.code).emit('aq_question', {
        questionId: 1,
        questionText: autismQuizQuestions[0].text,
        questionNumber: 1,
        totalQuestions: 20
      });
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

  private startNastyRound(room: Room) {
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

  private handleSubmitPrompt(room: Room, socketId: string, promptText: string) {
    if (room.gameId !== 'nasty-libs') return;
    if (room.state !== 'NL_PROMPT_SUBMIT') return;
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;
    if (room.nastyContestantIds?.includes(player.id)) return;

    const prompt = String(promptText ?? '').trim();
    if (!prompt) return;

    room.nastyPromptSubmissions ??= [];
    if (room.nastyPromptSubmissions.some(p => p.playerId === player.id)) return;

    room.nastyPromptSubmissions.push({ playerId: player.id, prompt });
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));

    const activePlayers = this.getActivePlayers(room);
    const audienceCount = Math.max(0, activePlayers.length - 2);
    if (room.nastyPromptSubmissions.length < audienceCount) return;
    // Mix audience-submitted prompts with default prompts, then select randomly
    const pool = [
      ...((room.nastyPromptSubmissions ?? []).map(p => p.prompt)),
      ...nastyPrompts.slice(0, 10)  // Include some default prompts
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

  private handleSubmitProblems(room: Room, socketId: string, problems: unknown) {
    if (room.gameId !== 'dubiously-patented') return;
    if (room.state !== 'DP_PROBLEM_SUBMIT') return;
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;

    const raw = Array.isArray(problems) ? problems : [];
    const sanitized = raw
      .map(p => String(p ?? '').trim())
      .filter(Boolean)
      .slice(0, 3);

    room.dpProblemsByPlayer ??= {};
    if (room.dpProblemsByPlayer[player.id]) return;
    room.dpProblemsByPlayer[player.id] = sanitized;

    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));

    const activePlayers = this.getActivePlayers(room);
    if (Object.keys(room.dpProblemsByPlayer).length < activePlayers.length) return;

    const all: { playerId: string; text: string }[] = [];
    for (const [playerId, items] of Object.entries(room.dpProblemsByPlayer)) {
      for (const text of items) all.push({ playerId, text });
    }

    if (all.length === 0) {
      all.push(
        { playerId: 'system', text: 'People keep losing their keys.' },
        { playerId: 'system', text: 'Too many group chats.' },
        { playerId: 'system', text: 'Crumbs in bed.' },
        { playerId: 'system', text: 'Nobody reads the instructions.' },
        { playerId: 'system', text: 'Your neighbor is always loud.' }
      );
    }

    room.dpAllProblems = all.sort(() => 0.5 - Math.random());
    room.dpChoicesByPlayer = {};
    room.dpSelectedByPlayer = {};
    room.state = 'DP_PICK';

    for (const p of activePlayers) {
      const pool = room.dpAllProblems.filter(x => x.playerId !== p.id).map(x => x.text);
      const fallbackPool = room.dpAllProblems.map(x => x.text);
      const choices: string[] = [];
      const source = pool.length > 0 ? pool : fallbackPool;
      while (choices.length < 3) {
        const next = source[Math.floor(Math.random() * source.length)];
        if (!next) break;
        if (!choices.includes(next) || source.length < 3) choices.push(next);
      }
      room.dpChoicesByPlayer[p.id] = choices;
      if (p.socketId && !p.isBot) this.io.to(p.socketId).emit('dp_choices', { choices });
    }

    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    this.scheduleBotRun(room);
  }

  private handleSelectProblem(room: Room, socketId: string, problem: unknown) {
    if (room.gameId !== 'dubiously-patented') return;
    if (room.state !== 'DP_PICK') return;
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;

    const selected = String(problem ?? '').trim();
    if (!selected) return;

    room.dpChoicesByPlayer ??= {};
    const choices = room.dpChoicesByPlayer[player.id] ?? [];
    if (!choices.includes(selected)) return;

    room.dpSelectedByPlayer ??= {};
    if (room.dpSelectedByPlayer[player.id]) return;
    room.dpSelectedByPlayer[player.id] = selected;
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));

    const activePlayers = this.getActivePlayers(room);
    if (Object.keys(room.dpSelectedByPlayer).length < activePlayers.length) return;

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

  private handleSubmitDrawing(room: Room, socketId: string, drawing: string, title: string) {
    if (room.gameId !== 'dubiously-patented') return;
    if (room.state !== 'DP_DRAWING') return;
    
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;

    room.dpDrawings ??= {};
    if (room.dpDrawings[player.id]) return; // Already submitted

    // Debug logging
    console.log(`[DP] Storing drawing for ${player.name} (${player.id}), isBot: ${player.isBot}`);
    console.log(`[DP] Drawing length: ${drawing?.length ?? 0}, starts with: ${drawing?.substring(0, 50)}`);
    
    room.dpDrawings[player.id] = drawing || ''; // Base64 string
    
    // Store title as "answer" for consistency or separate field
    room.answers.push({ playerId: player.id, answer: title || 'Untitled Invention' });

    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));

    const activePlayers = this.getActivePlayers(room);
    if (Object.keys(room.dpDrawings).length < activePlayers.length) return;

    // Start presentations
    room.presentationOrder = activePlayers.map(p => p.id).sort(() => 0.5 - Math.random());
    this.startPresentation(room);
  }

  private startPresentation(room: Room) {
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
    console.log(`[DP] Starting presentation for ${presenter?.name} (${nextId}), isBot: ${presenter?.isBot}`);
    console.log(`[DP] Drawing available: ${!!presentationDrawing}, length: ${presentationDrawing?.length ?? 0}`);

    this.io.to(room.code).emit('start_presentation', {
      presenterId: nextId,
      timeLimit: 60,
      drawing: presentationDrawing,
      answer: room.answers ? room.answers.find(a => a.playerId === nextId)?.answer : undefined,
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

  private startInvesting(room: Room) {
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

  private handleInvest(room: Room, socketId: string, amount: number) {
    if (room.state !== 'DP_INVESTING') return;
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;
    if (player.id === room.currentPresenterId) return; // Can't invest in self (or maybe you can? User didn't say. Assuming no.)

    const investment = Math.max(0, Math.min(Number(amount) || 0, player.score));
    
    room.currentInvestments ??= {};
    if (room.currentInvestments[player.id]) return; // Already invested

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

  private handleAQAnswer(room: Room, socketId: string, questionId: number, agreed: boolean) {
    if (room.gameId !== 'autism-assessment') return;
    if (room.state !== 'AQ_QUESTION') return;
    
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;
    
    room.aqAnswers ??= {};
    room.aqAnswers[player.id] ??= {};
    
    // Don't allow re-answering same question
    if (room.aqAnswers[player.id][questionId] !== undefined) return;
    
    room.aqAnswers[player.id][questionId] = agreed;
    
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    
    // Check if all players have answered the current question
    const activePlayers = this.getActivePlayers(room);
    const currentQ = room.aqCurrentQuestion ?? 1;
    const allAnswered = activePlayers.every(p => 
      room.aqAnswers?.[p.id]?.[currentQ] !== undefined
    );
    
    if (!allAnswered) return;
    
    // Everyone answered - move to next question or show results
    if (currentQ >= 20) {
      // Calculate final scores
      this.calculateAQScores(room);
      room.state = 'AQ_RESULTS';
      
      // Generate rankings
      const rankings = activePlayers
        .map(p => ({ 
          id: p.id,
          name: p.name, 
          score: room.aqScores?.[p.id] ?? 0 
        }))
        .sort((a, b) => a.score - b.score); // Lower score = less autistic = winner
      
      const winner = rankings[0];
      const certificate = generateCertificateSVG(winner.name, rankings);
      const certificateDataUrl = `data:image/svg+xml;base64,${Buffer.from(certificate).toString('base64')}`;
      
      this.io.to(room.code).emit('aq_results', {
        rankings,
        winnerId: winner.id,
        winnerName: winner.name,
        certificate: certificateDataUrl
      });
      this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    } else {
      // Next question
      room.aqCurrentQuestion = currentQ + 1;
      room.currentRound = currentQ + 1;
      const nextQuestion = autismQuizQuestions[currentQ]; // 0-indexed, currentQ is already the next index
      
      this.io.to(room.code).emit('aq_question', {
        questionId: nextQuestion.id,
        questionText: nextQuestion.text,
        questionNumber: currentQ + 1,
        totalQuestions: 20
      });
      this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    }
  }
  
  private calculateAQScores(room: Room) {
    room.aqScores = {};
    const activePlayers = this.getActivePlayers(room);
    
    for (const player of activePlayers) {
      let score = 0;
      const answers = room.aqAnswers?.[player.id] ?? {};
      
      for (const question of autismQuizQuestions) {
        const agreed = answers[question.id];
        if (agreed === undefined) continue;
        
        // Score increases when answer matches the "autistic" pattern
        if ((agreed && question.agreeIsAutistic) || (!agreed && !question.agreeIsAutistic)) {
          score++;
        }
      }
      
      room.aqScores[player.id] = score;
    }
  }

  private handleAnswer(room: Room, socketId: string, answerText: string) {
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;
    const answer = String(answerText ?? '').trim();
    if (!answer) return;

    if (room.gameId === 'nasty-libs') {
      if (room.state !== 'NL_ANSWER') return;
      if (!room.nastyContestantIds?.includes(player.id)) return;
      if (room.answers.some(a => a.playerId === player.id)) return;
      room.answers.push({ playerId: player.id, answer });

      if (room.answers.length < 2) return;
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

  private handleVote(room: Room, socketId: string, voteIndex: number) {
    if (room.state !== 'NL_VOTING') return;
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;

    // Fix: Nasty Libs contestants cannot vote
    if (room.gameId === 'nasty-libs' && room.nastyContestantIds?.includes(player.id)) {
        this.io.to(socketId).emit('error', { message: "You are a contestant and cannot vote!" });
        return;
    }

    room.votedBy ??= {};
    if (room.votedBy[socketId]) return;

    const index = Number(voteIndex);
    if (!Number.isFinite(index)) return;
    if (index < 0 || index >= room.answers.length) return;
    
    // Prevent self-voting (redundant if contestants excluded, but good for safety)
    if (room.answers[index]?.playerId === player.id) {
        this.io.to(socketId).emit('error', { message: "You can't vote for yourself!", code: 'GAME_ERROR' });
        return;
    }

    room.votedBy[socketId] = true;
    room.votes[index] = (room.votes[index] || 0) + 1;

    const activePlayers = this.getActivePlayers(room);
    // In Nasty Libs, contestants don't vote. So total votes needed = players - 2.
    const expectedVotes = Math.max(0, activePlayers.length - (room.nastyContestantIds?.length ?? 0));
    
    const totalVotes = Object.values(room.votes).reduce((a, b) => a + b, 0);
    if (totalVotes < expectedVotes) return;

    this.showResults(room);
  }

  private showResults(room: Room) {
    // For Dubiously Patented, end the game after presentations/investing
    if (room.gameId === 'dubiously-patented') {
      this.endGame(room);
      return;
    }

    if (room.state !== 'NL_VOTING' && room.state !== 'DP_PRESENTING') return;

    room.state = 'NL_RESULTS';

    const roundResults = room.answers.map((a, index) => {
      const votes = room.votes[index] || 0;
      const player = room.players.find(p => p.id === a.playerId);
      if (player) player.score += votes * 100;
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

  private nextRound(room: Room) {
    if (room.gameId === 'nasty-libs') {
      if (room.state !== 'NL_RESULTS') return;
      room.currentRound++;
      if (room.currentRound > room.totalRounds) {
        this.endGame(room);
        return;
      }
      this.startNastyRound(room);
      return;
    }

    if (room.state !== 'DP_RESULTS') return;
    this.endGame(room);
  }

  private endGame(room: Room) {
    room.state = 'END';
    this.io.to(room.code).emit('game_over', {
      finalScores: room.players
        .map(p => ({ name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score)
    });
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
  }

  private generateRoomCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  private generateUniqueRoomCode(): string {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = this.generateRoomCode();
      if (!this.rooms.has(code)) return code;
    }
    return uuidv4().slice(0, 4).toUpperCase();
  }

  private getRoomPublicState(room: Room) {
    // Count how many players have answered the current AQ question
    const aqAnsweredCount = room.aqCurrentQuestion && room.aqAnswers
      ? Object.values(room.aqAnswers).filter(a => a[room.aqCurrentQuestion!] !== undefined).length
      : 0;
    
    return {
      code: room.code,
      gameId: room.gameId,
      players: room.players.map(p => ({ name: p.name, score: p.score, isConnected: p.isConnected, id: p.id, isBot: p.isBot })),
      controllerPlayerId: room.controllerPlayerId,
      state: room.state,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      contestants: (room.nastyContestantIds ?? []).map(id => {
        const p = room.players.find(x => x.id === id);
        return { id, name: p?.name ?? 'Unknown' };
      }),
      promptSubmissions: room.nastyPromptSubmissions?.length ?? 0,
      problemsSubmitted: room.dpProblemsByPlayer ? Object.keys(room.dpProblemsByPlayer).length : 0,
      problemsTotal: this.getActivePlayers(room).length,
      selectionsMade: room.dpSelectedByPlayer ? Object.keys(room.dpSelectedByPlayer).length : 0,
      drawingsSubmitted: room.dpDrawings ? Object.keys(room.dpDrawings).length : 0,
      currentPresenter: room.currentPresenterId ? room.players.find(p => p.id === room.currentPresenterId)?.name : undefined,
      currentPresenterId: room.currentPresenterId,
      currentDrawing: room.currentPresenterId && room.dpDrawings ? room.dpDrawings[room.currentPresenterId] : undefined,
      currentTitle: room.currentPresenterId && room.answers ? room.answers.find(a => a.playerId === room.currentPresenterId)?.answer : undefined,
      currentProblem: room.currentPresenterId && room.dpSelectedByPlayer ? room.dpSelectedByPlayer[room.currentPresenterId] : undefined
      ,
      promptText: room.promptText
      ,
      currentInvestments: room.currentInvestments ?? {},
      // Autism Quiz fields
      aqCurrentQuestion: room.aqCurrentQuestion,
      aqAnsweredCount,
      aqScores: room.aqScores
    };
  }

  // Escape XML to safely embed text in generated SVG
  private escapeXml(input: string) {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
