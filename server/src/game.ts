import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { nastyPrompts, nastyAnswers } from './nastyPrompts';
import { autismQuizQuestions, generateCertificateSVG, generateMostAutisticCertificateSVG } from './autismQuiz';
import { generateWordOptions, isCloseGuess, isCorrectGuess, generateWordHint } from './scribbleWords';
import { generatePromptSetFromTemplate, getUnusedTemplateIndex, TEMPLATE_COUNT } from './sssPrompts';

type GameId = 'nasty-libs' | 'dubiously-patented' | 'autism-assessment' | 'scribble-scrabble' | 'card-calamity' | 'scribble-scrabble-scrambled';

// Card Calamity types
type CCColor = 'red' | 'blue' | 'green' | 'yellow';
type CCCardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

interface CCCard {
  id: string;
  color: CCColor | null; // null for wild cards
  type: CCCardType;
  value?: number; // 0-9 for number cards
}

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
  createdAt: number;
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
    | 'SC_WORD_PICK'
    | 'SC_DRAWING'
    | 'SC_ROUND_RESULTS'
    | 'CC_PLAYING'
    | 'CC_PICK_COLOR'
    | 'CC_RESULTS'
    | 'SSS_DRAWING'
    | 'SSS_VOTING'
    | 'SSS_RESULTS'
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
  aqAnswers?: Record<string, Record<number, boolean | 'neutral' | 'timeout'>>; // playerId -> questionId -> agreed
  aqScores?: Record<string, number>; // playerId -> score
  aqShuffledQuestions?: typeof autismQuizQuestions; // Shuffled questions for this game
  // Scribble Scrabble fields
  scDrawerId?: string; // Current drawer's player ID
  scWord?: string; // Current word to draw
  scRevealedIndices?: number[]; // Indices of revealed hint letters
  scRoundTime?: number; // Seconds remaining in current round
  scRoundDuration?: number; // Round duration setting (60/90/120/150)
  scRoundsPerPlayer?: number; // How many times each player draws (1/2/3)
  scCorrectGuessers?: string[]; // Player IDs who guessed correctly (in order)
  scWordOptions?: string[]; // 3 word choices for drawer
  scDrawingStrokes?: { points: { x: number; y: number }[]; color: string; width: number }[]; // Stored strokes
  scCurrentRound?: number; // Current round number
  scTotalRounds?: number; // Total rounds (players * roundsPerPlayer)
  scDrawerOrder?: string[]; // Order of drawer player IDs
  scScores?: Record<string, number>; // playerId -> score
  scGuessChat?: { playerId: string; playerName: string; guess: string; isCorrect: boolean; isClose: boolean; timestamp: number }[];
  // Card Calamity fields
  ccDeck?: CCCard[];
  ccDiscardPile?: CCCard[];
  ccPlayerHands?: Record<string, CCCard[]>; // playerId -> cards
  ccCurrentPlayerId?: string;
  ccDirection?: 1 | -1; // 1 = clockwise, -1 = counter-clockwise
  ccDrawStack?: number; // Accumulated +2/+4 cards to draw
  ccActiveColor?: CCColor; // Current active color (for wilds)
  ccTurnOrder?: string[]; // Order of players
  ccWinnerId?: string;
  ccStackingEnabled?: boolean; // Option to allow stacking +2/+4
  ccLastAction?: { type: string; playerId: string; playerName: string; card?: CCCard; color?: CCColor };
  ccPendingWildPlayerId?: string; // Player who needs to pick a color
  // Scribble Scrabble: Scrambled fields
  sssRealPrompt?: string; // The real prompt for this round
  sssAllPrompts?: Record<string, string>; // playerId -> their assigned prompt
  sssDrawings?: Record<string, string>; // playerId -> base64 drawing data
  sssVotes?: Record<string, string>; // voterId -> votedForPlayerId
  sssRealDrawerId?: string; // Player who has the real prompt this round
  sssRound?: number; // Current round number
  sssScores?: Record<string, number>; // playerId -> total score
  sssDrawTime?: 60 | 90; // Drawing time in seconds
  sssDoubleRounds?: boolean; // If true, play 2x rounds (each player is real drawer twice)
  sssRealDrawerOrder?: string[]; // Shuffled player IDs for fair rotation
  sssActivePlayerIds?: string[]; // Players active at round start (for late-join handling)
  sssUsedTemplateIndices?: number[]; // Template indices used to avoid repeats
  sssRoundScores?: Record<string, { tricked: number; correct: boolean }>; // Per-round breakdown
  answers: { playerId: string; answer: string }[];
  votes: Record<string, number>; // answerIndex -> count
  votedBy?: Record<string, boolean>;
}

export class GameManager {
  private io: Server;
  private rooms: Map<string, Room> = new Map();
  private socketRoomMap: Map<string, string> = new Map(); // socketId -> roomCode
  private botRun: Map<string, { running: boolean; pending: boolean }> = new Map();
  private aqTimers: Map<string, NodeJS.Timeout> = new Map(); // roomCode -> timer
  private scTimers: Map<string, NodeJS.Timeout> = new Map(); // roomCode -> timer (Scribble Scrabble)
  private sssTimers: Map<string, NodeJS.Timeout> = new Map(); // roomCode -> timer (Scribble Scrabble: Scrambled)
  private ccTimers: Map<string, NodeJS.Timeout> = new Map(); // roomCode -> timer (Card Calamity)
  private recentlyClosed: Map<string, NodeJS.Timeout> = new Map(); // roomCode -> timeout that prevents immediate reuse
  private hostDisconnectTimers: Map<string, NodeJS.Timeout> = new Map(); // roomCode -> timeout for auto-close on host disconnect
  private ROOM_REUSE_DELAY_MS: number = 5000;
  private HOST_DISCONNECT_TIMEOUT_MS: number = 0; // 0 = disabled

  constructor(io: Server) {
    this.io = io;
    // Allow overrides via environment
    try {
      this.ROOM_REUSE_DELAY_MS = Number(process.env.ROOM_REUSE_DELAY_MS ?? String(this.ROOM_REUSE_DELAY_MS));
    } catch (_) {}
    try {
      // Accept either milliseconds or seconds via HOST_DISCONNECT_TIMEOUT (seconds)
      const raw = process.env.HOST_DISCONNECT_TIMEOUT_MS ?? process.env.HOST_DISCONNECT_TIMEOUT;
      if (raw) {
        const asNum = Number(raw);
        // If value looks small (< 1000) assume seconds
        this.HOST_DISCONNECT_TIMEOUT_MS = asNum > 1000 ? asNum : asNum * 1000;
      }
    } catch (_) {}
  }

  private startAQTimer(room: Room) {
    // Clear any existing timer
    this.clearAQTimer(room.code);
    
    const questionNum = room.aqCurrentQuestion ?? 1;
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
  
  private clearAQTimer(roomCode: string) {
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
  
  private handleAQTimeout(roomCode: string, questionNum: number) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    if (room.state !== 'AQ_QUESTION') return;
    if (room.aqCurrentQuestion !== questionNum) return; // Question already moved on
    
    const activePlayers = this.getActivePlayers(room);
    const currentQ = room.aqCurrentQuestion ?? 1;
    
    // Find players who didn't answer and penalize them
    for (const player of activePlayers) {
      if (room.aqAnswers?.[player.id]?.[currentQ] === undefined) {
        // Player didn't answer - mark as timed out with penalty
        room.aqAnswers ??= {};
        room.aqAnswers[player.id] ??= {};
        // Store special 'timeout' marker - we'll give them a penalty point during scoring
        room.aqAnswers[player.id][currentQ] = 'timeout';
      }
    }
    
    // Move to next question or results
    this.advanceAQQuestion(room);
  }
  
  private advanceAQQuestion(room: Room) {
    const currentQ = room.aqCurrentQuestion ?? 1;
    const activePlayers = this.getActivePlayers(room);
    
    if (currentQ >= 20) {
      // Calculate final scores
      this.clearAQTimer(room.code);
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
      const loser = rankings[rankings.length - 1];
      const certificate = generateCertificateSVG(winner.name, rankings);
      const certificateDataUrl = `data:image/svg+xml;base64,${Buffer.from(certificate).toString('base64')}`;
      const loserCertificate = generateMostAutisticCertificateSVG(loser.name, rankings);
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
    } else {
      // Next question
      room.aqCurrentQuestion = currentQ + 1;
      room.currentRound = currentQ + 1;
      const questions = room.aqShuffledQuestions ?? autismQuizQuestions;
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
      // Clear any pending host-disconnect auto-close timer
      try {
        const pending = this.hostDisconnectTimers.get(room.code);
        if (pending) { clearTimeout(pending); this.hostDisconnectTimers.delete(room.code); }
      } catch (_) {}

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

    // If game is in AQ_QUESTION state, send the current question to the joining player
    if (room.state === 'AQ_QUESTION' && room.aqCurrentQuestion) {
      const questionIndex = room.aqCurrentQuestion - 1;
      const questions = room.aqShuffledQuestions ?? autismQuizQuestions;
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
          const player = room.players.find(p => p.id === playerId);
          return { id: playerId, name: player?.name ?? 'Unknown', score };
        })
        .sort((a, b) => a.score - b.score);
      const winner = rankings[0];
      socket.emit('aq_results', {
        rankings,
        winnerId: winner?.id ?? '',
        winnerName: winner?.name ?? '',
        certificate: generateCertificateSVG(winner?.name ?? 'Unknown', rankings)
      });
    }
  }

  handleCloseRoom(socket: Socket) {
    const roomCode = this.socketRoomMap.get(socket.id);
    if (!roomCode) return;
    const room = this.rooms.get(roomCode);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;

    // Use centralized close logic to ensure thorough cleanup
    this.closeRoom(roomCode, { initiatedBy: 'host', initiatorSocketId: socket.id });
  }

  private closeRoom(roomCode: string, opts?: { initiatedBy?: string; initiatorSocketId?: string }) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    // 1) Clear all timers for this room
    try { this.clearAQTimer(roomCode); } catch (_) {}
    try { this.clearSCTimer(roomCode); } catch (_) {}
    try { this.clearSSSTimer(roomCode); } catch (_) {}
    try { this.clearCCTimer(roomCode); } catch (_) {}

    // Ensure any bot run state cleared
    try { this.botRun.delete(roomCode); } catch (_) {}

    // 2) Emit a payloaded room_closed event for clients
    try { this.io.to(roomCode).emit('room_closed', { roomCode }); } catch (_) {}

    // 3) Force member sockets to leave and clear socketRoomMap entries
    for (const [socketId, code] of Array.from(this.socketRoomMap.entries())) {
      if (code === roomCode) {
        const s = this.io.sockets.sockets.get(socketId as string);
        if (s) {
          try { s.leave(roomCode); } catch (_) {}
          try { s.emit('room_closed', { roomCode }); } catch (_) {}
        }
        this.socketRoomMap.delete(socketId);
      }
    }

    // 4) Delete the room
    this.rooms.delete(roomCode);

    // 5) Prevent immediate reuse by marking recently closed and scheduling deletion
    try {
      const existing = this.recentlyClosed.get(roomCode);
      if (existing) { clearTimeout(existing); }
      const t = setTimeout(() => {
        this.recentlyClosed.delete(roomCode);
      }, this.ROOM_REUSE_DELAY_MS);
      this.recentlyClosed.set(roomCode, t);
    } catch (_) {}

    // 6) Clear any host-disconnect timer for this room
    try {
      const h = this.hostDisconnectTimers.get(roomCode);
      if (h) { clearTimeout(h); this.hostDisconnectTimers.delete(roomCode); }
    } catch (_) {}
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

  handleDisconnect(socket: Socket) {
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
                if (existing) { clearTimeout(existing); }
                const t = setTimeout(() => {
                  const latest = this.rooms.get(roomCode);
                  if (latest && !latest.hostConnected) {
                    this.closeRoom(roomCode, { initiatedBy: 'host-disconnect-timeout' });
                  }
                }, this.HOST_DISCONNECT_TIMEOUT_MS);
                this.hostDisconnectTimers.set(roomCode, t);
              } catch (_) {}
            }
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

    // Autism Assessment - bots answer questions
    if (room.state === 'AQ_QUESTION') {
      const currentQ = room.aqCurrentQuestion ?? 1;
      for (const bot of bots) {
        if (room.state !== 'AQ_QUESTION') break;
        
        // Check if bot already answered this question
        const already = room.aqAnswers?.[bot.id]?.[currentQ] !== undefined;
        if (already) continue;
        
        // Human-like delay - "reading" and "thinking" about the question
        await this.humanDelay(1500, 5000);
        if (room.state !== 'AQ_QUESTION') break;
        
        // Random answer - bots are unpredictable (can also pick neutral)
        const rand = Math.random();
        const agreed: boolean | 'neutral' = rand < 0.33 ? true : rand < 0.66 ? false : 'neutral';
        this.handleAQAnswer(room, bot.socketId, currentQ, agreed);
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

  private resetToLobby(room: Room) {
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

  private createNewLobby(room: Room, socket: Socket) {
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
          try { s.leave(room.code); } catch (_) {}
          try { s.emit('lobby_closed', { roomCode: room.code }); } catch (_) {}
        }
        this.socketRoomMap.delete(player.socketId);
      }
    }

    // Also clean any stray mappings that reference the old code
    for (const [socketId, code] of Array.from(this.socketRoomMap.entries())) {
      if (code === room.code) this.socketRoomMap.delete(socketId);
    }

    const oldCode = room.code;
    const preservedGameId = room.gameId ?? 'nasty-libs';

    // Delete old room
    this.rooms.delete(oldCode);

    // Create a new room with a new unique code and preserved gameId
    const newCode = this.generateUniqueRoomCode();
    const newRoom: Room = {
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
        try { hostSocket.leave(oldCode); } catch (_) {}
        try { hostSocket.join(newCode); } catch (_) {}
        this.socketRoomMap.set(hostSocket.id, newCode);
        hostSocket.emit('new_lobby_created', { oldCode, newCode, gameId: preservedGameId });
      }
    }

    // Prevent immediate reuse of the old code
    try {
      const existing = this.recentlyClosed.get(oldCode);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => this.recentlyClosed.delete(oldCode), this.ROOM_REUSE_DELAY_MS);
      this.recentlyClosed.set(oldCode, t);
    } catch (_) {}
  }

  private startGame(room: Room) {
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
      const shuffled = [...autismQuizQuestions].sort(() => Math.random() - 0.5);
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
      let attempts = 0;
      while (choices.length < 3 && attempts < 100) {
        attempts++;
        const next = source[Math.floor(Math.random() * source.length)];
        if (!next) break;
        if (!choices.includes(next)) choices.push(next);
        // If we've tried many times and source doesn't have enough unique items, allow duplicates
        if (attempts > 20 && choices.length < 3) {
          choices.push(next);
        }
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

  private handleAQAnswer(room: Room, socketId: string, questionId: number, agreed: boolean | 'neutral') {
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
    
    // Everyone answered - clear timer and advance
    this.clearAQTimer(room.code);
    this.advanceAQQuestion(room);
  }
  
  private calculateAQScores(room: Room) {
    room.aqScores = {};
    const activePlayers = this.getActivePlayers(room);
    const questions = room.aqShuffledQuestions ?? autismQuizQuestions;
    
    for (const player of activePlayers) {
      let score = 0;
      const answers = room.aqAnswers?.[player.id] ?? {};
      
      // Iterate through questions by their position (1-20), matching the questionId we sent
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const questionId = i + 1; // We use 1-based questionIds
        const agreed = answers[questionId];
        if (agreed === undefined) continue;
        
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

    if (room.gameId === 'autism-assessment') {
      if (room.state !== 'AQ_RESULTS') return;
      this.endGame(room);
      return;
    }

    if (room.gameId === 'scribble-scrabble') {
      if (room.state !== 'SC_ROUND_RESULTS') return;
      this.advanceSCRound(room);
      return;
    }

    if (room.gameId === 'scribble-scrabble-scrambled') {
      if (room.state !== 'SSS_RESULTS') return;
      this.advanceSSSRound(room);
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
    for (let attempt = 0; attempt < 50; attempt++) {
      const code = this.generateRoomCode();
      if (!this.rooms.has(code) && !this.recentlyClosed.has(code)) return code;
    }
    // Fallback: use UUID-derived code (still check recentlyClosed)
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = uuidv4().slice(0, 4).toUpperCase();
      if (!this.rooms.has(code) && !this.recentlyClosed.has(code)) return code;
    }
    // Last resort, return any non-existing or just random
    return uuidv4().slice(0, 4).toUpperCase();
  }

  // ==================== SCRIBBLE SCRABBLE METHODS ====================

  private startScribbleScrabble(room: Room) {
    const activePlayers = this.getActivePlayers(room);
    
    // Initialize settings with defaults if not set in lobby
    room.scRoundsPerPlayer = room.scRoundsPerPlayer ?? 1;
    room.scRoundDuration = room.scRoundDuration ?? 60;
    
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

  private startSCRound(room: Room) {
    const roundIndex = (room.scCurrentRound ?? 1) - 1;
    const drawerId = room.scDrawerOrder?.[roundIndex];
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
    room.scWordOptions = generateWordOptions();
    room.state = 'SC_WORD_PICK';
    
    // Send word options only to the drawer
    const drawer = room.players.find(p => p.id === drawerId);
    if (drawer) {
      this.io.to(drawer.socketId).emit('sc_word_options', { words: room.scWordOptions });
    }
    
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
  }

  private handleSCPickWord(room: Room, socketId: string, word: string) {
    if (room.gameId !== 'scribble-scrabble') return;
    if (room.state !== 'SC_WORD_PICK') return;
    
    const player = room.players.find(p => p.socketId === socketId);
    if (!player || player.id !== room.scDrawerId) return;
    
    // Validate word is one of the options
    if (!room.scWordOptions?.includes(word)) return;
    
    room.scWord = word;
    room.scRoundTime = room.scRoundDuration ?? 60;
    room.state = 'SC_DRAWING';
    
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    this.startSCTimer(room);
  }

  private handleSCGuess(room: Room, socketId: string, guess: string) {
    if (room.gameId !== 'scribble-scrabble') return;
    if (room.state !== 'SC_DRAWING') return;
    if (!room.scWord) return;
    
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;
    
    // Drawer can't guess
    if (player.id === room.scDrawerId) return;
    
    // Can't guess if already got it correct
    if (room.scCorrectGuessers?.includes(player.id)) return;
    
    const correct = isCorrectGuess(guess, room.scWord);
    const close = !correct && isCloseGuess(guess, room.scWord);
    
    // Add to chat
    room.scGuessChat = room.scGuessChat ?? [];
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
      room.scCorrectGuessers = room.scCorrectGuessers ?? [];
      room.scCorrectGuessers.push(player.id);
      
      // Calculate points based on order and time remaining
      const timeRemaining = room.scRoundTime ?? 0;
      const position = room.scCorrectGuessers.length;
      const activePlayers = this.getActivePlayers(room);
      const maxPoints = 1000;
      
      // Points: faster = more, earlier position = more
      const timeBonus = Math.floor((timeRemaining / (room.scRoundDuration ?? 60)) * 500);
      const positionMultiplier = Math.max(0.2, 1 - (position - 1) * 0.2);
      const guesserPoints = Math.floor((maxPoints * positionMultiplier) + timeBonus);
      
      // Drawer gets points for each correct guess
      const drawerPoints = 100;
      
      room.scScores = room.scScores ?? {};
      room.scScores[player.id] = (room.scScores[player.id] ?? 0) + guesserPoints;
      if (room.scDrawerId) {
        room.scScores[room.scDrawerId] = (room.scScores[room.scDrawerId] ?? 0) + drawerPoints;
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

  private handleSCDrawStroke(room: Room, socketId: string, stroke: { points: { x: number; y: number }[]; color: string; width: number }) {
    if (room.gameId !== 'scribble-scrabble') return;
    if (room.state !== 'SC_DRAWING') return;
    
    const player = room.players.find(p => p.socketId === socketId);
    if (!player || player.id !== room.scDrawerId) return;
    
    // Store stroke for late joiners/reconnects
    room.scDrawingStrokes = room.scDrawingStrokes ?? [];
    room.scDrawingStrokes.push(stroke);
    
    // Broadcast stroke to all clients immediately (real-time)
    this.io.to(room.code).emit('sc_stroke_data', { stroke });
  }

  private handleSCClearCanvas(room: Room, socketId: string) {
    if (room.gameId !== 'scribble-scrabble') return;
    if (room.state !== 'SC_DRAWING') return;
    
    const player = room.players.find(p => p.socketId === socketId);
    if (!player || player.id !== room.scDrawerId) return;
    
    room.scDrawingStrokes = [];
    this.io.to(room.code).emit('sc_clear_canvas');
  }

  private handleSCRevealHint(room: Room, socketId: string) {
    if (room.gameId !== 'scribble-scrabble') return;
    if (room.state !== 'SC_DRAWING') return;
    if (!room.scWord) return;
    
    const player = room.players.find(p => p.socketId === socketId);
    if (!player || player.id !== room.scDrawerId) return;
    
    room.scRevealedIndices = room.scRevealedIndices ?? [];
    
    // Find unrevealed letter indices (skip spaces)
    const unrevealedIndices = room.scWord
      .split('')
      .map((char, i) => ({ char, i }))
      .filter(({ char, i }) => char !== ' ' && !room.scRevealedIndices!.includes(i))
      .map(({ i }) => i);
    
    if (unrevealedIndices.length === 0) return;
    
    // Reveal a random letter
    const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
    room.scRevealedIndices.push(randomIndex);
    
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
  }

  private startSCTimer(room: Room) {
    this.clearSCTimer(room.code);
    
    const startTime = Date.now();
    const duration = room.scRoundDuration ?? 60;
    
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      room.scRoundTime = Math.max(0, duration - elapsed);
      
      // Broadcast time update
      this.io.to(room.code).emit('sc_timer', { timeLeft: room.scRoundTime });
      
      if (room.scRoundTime <= 0) {
        this.clearSCTimer(room.code);
        this.endSCRound(room);
      } else {
        this.scTimers.set(room.code, setTimeout(tick, 1000));
      }
    };
    
    this.scTimers.set(room.code, setTimeout(tick, 1000));
  }

  private clearSCTimer(roomCode: string) {
    const timer = this.scTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.scTimers.delete(roomCode);
    }
  }

  private endSCRound(room: Room) {
    room.state = 'SC_ROUND_RESULTS';
    
    // Reveal the word to everyone
    this.io.to(room.code).emit('sc_round_end', {
      word: room.scWord,
      correctGuessers: room.scCorrectGuessers,
      scores: room.scScores
    });
    
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
  }

  private advanceSCRound(room: Room) {
    room.scCurrentRound = (room.scCurrentRound ?? 1) + 1;
    
    if (room.scCurrentRound > (room.scTotalRounds ?? 1)) {
      this.endScribbleScrabble(room);
    } else {
      this.startSCRound(room);
    }
  }

  private endScribbleScrabble(room: Room) {
    room.state = 'END';
    this.clearSCTimer(room.code);
    
    // Calculate final rankings
    const rankings = Object.entries(room.scScores ?? {})
      .map(([playerId, score]) => ({
        playerId,
        name: room.players.find(p => p.id === playerId)?.name ?? 'Unknown',
        score
      }))
      .sort((a, b) => b.score - a.score);
    
    this.io.to(room.code).emit('sc_game_end', { rankings });
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
  }

  // ==================== END SCRIBBLE SCRABBLE METHODS ====================

  // ==================== CARD CALAMITY METHODS ====================

  private createCCDeck(numDecks: number = 1): CCCard[] {
    const deck: CCCard[] = [];
    const colors: CCColor[] = ['red', 'blue', 'green', 'yellow'];
    
    for (let d = 0; d < numDecks; d++) {
      for (const color of colors) {
        // One 0 card per color per deck
        deck.push({ id: uuidv4(), color, type: 'number', value: 0 });
        
        // Two of each 1-9 per color per deck
        for (let i = 1; i <= 9; i++) {
          deck.push({ id: uuidv4(), color, type: 'number', value: i });
          deck.push({ id: uuidv4(), color, type: 'number', value: i });
        }
        
        // Two Skip, Reverse, Draw2 per color per deck
        for (let i = 0; i < 2; i++) {
          deck.push({ id: uuidv4(), color, type: 'skip' });
          deck.push({ id: uuidv4(), color, type: 'reverse' });
          deck.push({ id: uuidv4(), color, type: 'draw2' });
        }
      }
      
      // 4 Wild cards per deck
      for (let i = 0; i < 4; i++) {
        deck.push({ id: uuidv4(), color: null, type: 'wild' });
      }
      
      // 4 Wild Draw Four cards per deck
      for (let i = 0; i < 4; i++) {
        deck.push({ id: uuidv4(), color: null, type: 'wild4' });
      }
    }
    
    return deck;
  }

  private shuffleDeck<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private startCardCalamity(room: Room) {
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
    room.ccStackingEnabled = room.ccStackingEnabled ?? false;
    
    // Create turn order
    room.ccTurnOrder = activePlayers.map(p => p.id);
    
    // Deal 7 cards to each player
    for (const player of activePlayers) {
      room.ccPlayerHands[player.id] = room.ccDeck.splice(0, 7);
    }
    
    // Flip first card (keep flipping if it's a wild4)
    let firstCard = room.ccDeck.shift()!;
    while (firstCard.type === 'wild4') {
      room.ccDeck.push(firstCard);
      room.ccDeck = this.shuffleDeck(room.ccDeck);
      firstCard = room.ccDeck.shift()!;
    }
    room.ccDiscardPile.push(firstCard);
    
    // Set active color
    room.ccActiveColor = firstCard.color ?? 'red';
    
    // Pick first player
    room.ccCurrentPlayerId = room.ccTurnOrder[0];
    
    // Handle first card effects
    if (firstCard.type === 'skip') {
      // Skip first player
      room.ccCurrentPlayerId = this.getNextCCPlayer(room);
    } else if (firstCard.type === 'reverse') {
      // Reverse direction
      room.ccDirection = -1;
      // In 2-player, reverse acts like skip
      if (activePlayers.length === 2) {
        room.ccCurrentPlayerId = this.getNextCCPlayer(room);
      }
    } else if (firstCard.type === 'draw2') {
      // First player must draw 2
      room.ccDrawStack = 2;
    } else if (firstCard.type === 'wild') {
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

  private sendCCHands(room: Room) {
    if (!room.ccPlayerHands) return;
    
    for (const player of room.players) {
      if (!player.isBot && player.isConnected) {
        const hand = room.ccPlayerHands[player.id] ?? [];
        this.io.to(player.socketId).emit('cc_hand', { cards: hand });
      }
    }
  }

  private getNextCCPlayer(room: Room, skip = false): string {
    if (!room.ccTurnOrder || !room.ccCurrentPlayerId) return room.ccCurrentPlayerId ?? '';
    
    const currentIndex = room.ccTurnOrder.indexOf(room.ccCurrentPlayerId);
    let nextIndex = (currentIndex + room.ccDirection! + room.ccTurnOrder.length) % room.ccTurnOrder.length;
    
    if (skip) {
      nextIndex = (nextIndex + room.ccDirection! + room.ccTurnOrder.length) % room.ccTurnOrder.length;
    }
    
    return room.ccTurnOrder[nextIndex];
  }

  private isValidCCPlay(room: Room, card: CCCard, playerId: string): boolean {
    if (!room.ccDiscardPile?.length || !room.ccActiveColor) return false;
    
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

  private handleCCPlayCard(room: Room, socketId: string, cardId: string) {
    if (room.gameId !== 'card-calamity') return;
    if (room.state !== 'CC_PLAYING') return;
    
    const player = room.players.find(p => p.socketId === socketId);
    if (!player || player.id !== room.ccCurrentPlayerId) return;
    
    const hand = room.ccPlayerHands?.[player.id];
    if (!hand) return;
    
    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
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
    room.ccDiscardPile!.push(card);
    
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
        room.ccDrawStack = (room.ccDrawStack ?? 0) + 4;
      }
      
      room.state = 'CC_PICK_COLOR';
      this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
      this.sendCCHands(room);
      this.startCCTimer(room);
      return;
    }
    
    // Set active color
    room.ccActiveColor = card.color!;
    
    // Handle action cards
    let skipNext = false;
    if (card.type === 'skip') {
      skipNext = true;
    } else if (card.type === 'reverse') {
      room.ccDirection = room.ccDirection === 1 ? -1 : 1;
      // In 2-player, reverse acts like skip
      if (room.ccTurnOrder!.length === 2) {
        skipNext = true;
      }
    } else if (card.type === 'draw2') {
      room.ccDrawStack = (room.ccDrawStack ?? 0) + 2;
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

  private handleCCDrawCard(room: Room, socketId: string) {
    if (room.gameId !== 'card-calamity') return;
    if (room.state !== 'CC_PLAYING') return;
    
    const player = room.players.find(p => p.socketId === socketId);
    if (!player || player.id !== room.ccCurrentPlayerId) return;
    
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

  private drawCCCards(room: Room, playerId: string, count: number) {
    if (!room.ccDeck || !room.ccPlayerHands) return;
    
    const hand = room.ccPlayerHands[playerId] ?? [];
    
    for (let i = 0; i < count; i++) {
      // Reshuffle discard pile if deck is empty
      if (room.ccDeck.length === 0) {
        if (room.ccDiscardPile && room.ccDiscardPile.length > 1) {
          const topCard = room.ccDiscardPile.pop()!;
          room.ccDeck = this.shuffleDeck(room.ccDiscardPile);
          room.ccDiscardPile = [topCard];
          // Notify clients about the shuffle
          this.io.to(room.code).emit('cc_deck_shuffled');
        } else {
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

  private handleCCPickColor(room: Room, socketId: string, color: CCColor) {
    if (room.gameId !== 'card-calamity') return;
    if (room.state !== 'CC_PICK_COLOR') return;
    
    const player = room.players.find(p => p.socketId === socketId);
    if (!player || player.id !== room.ccPendingWildPlayerId) return;
    
    const validColors: CCColor[] = ['red', 'blue', 'green', 'yellow'];
    if (!validColors.includes(color)) return;
    
    this.clearCCTimer(room.code);
    
    room.ccActiveColor = color;
    room.ccPendingWildPlayerId = undefined;
    
    room.ccLastAction = {
      ...room.ccLastAction!,
      color
    };
    
    // Check for win (if the wild was played and hand is empty)
    const hand = room.ccPlayerHands?.[player.id];
    if (hand && hand.length === 0) {
      this.endCardCalamity(room, player.id);
      return;
    }
    
    // Move to next player (skip if it was a +4)
    const topCard = room.ccDiscardPile?.[room.ccDiscardPile.length - 1];
    const skipNext = false; // +4 doesn't skip, next player must draw
    
    room.ccCurrentPlayerId = this.getNextCCPlayer(room, skipNext);
    room.state = 'CC_PLAYING';
    
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    this.sendCCHands(room);
    this.startCCTimer(room);
  }

  private startCCTimer(room: Room) {
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

  private clearCCTimer(roomCode: string) {
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

  private handleCCTimeout(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    if (room.gameId !== 'card-calamity') return;
    
    const currentPlayer = room.players.find(p => p.id === room.ccCurrentPlayerId);
    if (!currentPlayer) return;
    
    if (room.state === 'CC_PICK_COLOR') {
      // Auto-pick a random color
      const colors: CCColor[] = ['red', 'blue', 'green', 'yellow'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      room.ccActiveColor = randomColor;
      room.ccPendingWildPlayerId = undefined;
      
      room.ccLastAction = {
        ...room.ccLastAction!,
        color: randomColor
      };
      
      room.ccCurrentPlayerId = this.getNextCCPlayer(room);
      room.state = 'CC_PLAYING';
      
      this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
      this.sendCCHands(room);
      this.startCCTimer(room);
      return;
    }
    
    if (room.state !== 'CC_PLAYING') return;
    
    // Player timed out - draw 2 penalty cards
    const drawCount = Math.max(room.ccDrawStack ?? 0, 2);
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

  private endCardCalamity(room: Room, winnerId: string) {
    this.clearCCTimer(room.code);
    
    room.state = 'CC_RESULTS';
    room.ccWinnerId = winnerId;
    
    // Calculate scores (cards left in hand = points for winner)
    const scores: Record<string, number> = {};
    for (const [playerId, hand] of Object.entries(room.ccPlayerHands ?? {})) {
      let points = 0;
      for (const card of hand) {
        if (card.type === 'number') {
          points += card.value ?? 0;
        } else if (card.type === 'skip' || card.type === 'reverse' || card.type === 'draw2') {
          points += 20;
        } else if (card.type === 'wild' || card.type === 'wild4') {
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
      p.score = p.id === winnerId ? winnerScore : scores[p.id] ?? 0;
    });
    
    this.io.to(room.code).emit('cc_game_end', {
      winnerId,
      winnerName: room.players.find(p => p.id === winnerId)?.name,
      scores
    });
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    this.sendCCHands(room);
  }

  // ==================== END CARD CALAMITY METHODS ====================

  // ==================== SCRIBBLE SCRABBLE: SCRAMBLED METHODS ====================

  private startScribbleScrabbleScrambled(room: Room) {
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
    room.sssDrawTime = room.sssDrawTime ?? 60;
    
    this.io.to(room.code).emit('game_started');
    
    // Start first round
    this.startSSSRound(room);
  }

  private startSSSRound(room: Room) {
    const activePlayers = this.getActivePlayers(room);
    
    room.sssRound = (room.sssRound ?? 0) + 1;
    room.currentRound = room.sssRound;
    
    // Get the real drawer for this round
    const realDrawerIndex = (room.sssRound - 1) % room.sssRealDrawerOrder!.length;
    room.sssRealDrawerId = room.sssRealDrawerOrder![realDrawerIndex];
    
    // Track active players for this round (late-joiners spectate)
    room.sssActivePlayerIds = activePlayers.map(p => p.id);
    
    // Generate prompts, avoiding used templates
    const usedIndices = new Set(room.sssUsedTemplateIndices ?? []);
    const templateIndex = getUnusedTemplateIndex(usedIndices);
    room.sssUsedTemplateIndices = [...(room.sssUsedTemplateIndices ?? []), templateIndex];
    
    const promptSet = generatePromptSetFromTemplate(templateIndex, activePlayers.length);
    room.sssRealPrompt = promptSet.realPrompt;
    
    // Assign prompts to players
    room.sssAllPrompts = {};
    const shuffledVariants = [...promptSet.variants].sort(() => Math.random() - 0.5);
    let variantIndex = 0;
    
    for (const player of activePlayers) {
      if (player.id === room.sssRealDrawerId) {
        room.sssAllPrompts[player.id] = promptSet.realPrompt;
      } else {
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

  private startSSSTimer(room: Room) {
    this.clearSSSTimer(room.code);
    
    const duration = (room.sssDrawTime ?? 60) * 1000;
    const startTime = Date.now();
    
    // Emit timer start
    this.io.to(room.code).emit('sss_timer', { timeLeft: room.sssDrawTime ?? 60 });
    
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

  private clearSSSTimer(roomCode: string) {
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

  private handleSSSDrawingTimeout(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room || room.state !== 'SSS_DRAWING') return;
    
    // Auto-submit empty drawings for players who didn't submit
    const activePlayers = room.sssActivePlayerIds ?? [];
    for (const playerId of activePlayers) {
      if (!room.sssDrawings?.[playerId]) {
        room.sssDrawings = room.sssDrawings ?? {};
        room.sssDrawings[playerId] = ''; // Empty drawing
      }
    }
    
    // Move to voting
    this.advanceToSSSVoting(room);
  }

  private handleSSSSubmitDrawing(room: Room, socketId: string, drawing: string) {
    if (room.gameId !== 'scribble-scrabble-scrambled') return;
    if (room.state !== 'SSS_DRAWING') return;
    
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;
    
    // Only active players can submit
    if (!room.sssActivePlayerIds?.includes(player.id)) return;
    
    // Already submitted
    if (room.sssDrawings?.[player.id]) return;
    
    room.sssDrawings = room.sssDrawings ?? {};
    room.sssDrawings[player.id] = drawing;
    
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    
    // Check if all players have submitted
    const activeCount = room.sssActivePlayerIds?.length ?? 0;
    const submittedCount = Object.keys(room.sssDrawings).length;
    
    if (submittedCount >= activeCount) {
      this.clearSSSTimer(room.code);
      this.advanceToSSSVoting(room);
    }
  }

  private advanceToSSSVoting(room: Room) {
    room.state = 'SSS_VOTING';
    room.sssVotes = {};
    
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
  }

  private handleSSSVote(room: Room, socketId: string, votedForPlayerId: string) {
    if (room.gameId !== 'scribble-scrabble-scrambled') return;
    if (room.state !== 'SSS_VOTING') return;
    
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;
    
    // Only active players can vote
    if (!room.sssActivePlayerIds?.includes(player.id)) return;
    
    // Can't vote for yourself
    if (votedForPlayerId === player.id) return;
    
    // Can't vote for someone not playing
    if (!room.sssActivePlayerIds?.includes(votedForPlayerId)) return;
    
    // Already voted
    if (room.sssVotes?.[player.id]) return;
    
    room.sssVotes = room.sssVotes ?? {};
    room.sssVotes[player.id] = votedForPlayerId;
    
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
    
    // Check if all players have voted (everyone except the real drawer can vote)
    const voterCount = (room.sssActivePlayerIds?.length ?? 0);
    const votedCount = Object.keys(room.sssVotes).length;
    
    // Everyone votes (including real drawer to throw others off)
    if (votedCount >= voterCount) {
      this.calculateSSSScores(room);
    }
  }

  private calculateSSSScores(room: Room) {
    const realDrawerId = room.sssRealDrawerId!;
    const votes = room.sssVotes ?? {};
    
    // Calculate how many people voted for each player
    const votesByTarget: Record<string, string[]> = {};
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
    room.sssScores = room.sssScores ?? {};
    
    for (const playerId of room.sssActivePlayerIds ?? []) {
      room.sssRoundScores[playerId] = { tricked: 0, correct: false };
    }
    
    // Award points
    for (const [voterId, targetId] of Object.entries(votes)) {
      if (targetId === realDrawerId) {
        // Correct guess! +2 points
        room.sssScores[voterId] = (room.sssScores[voterId] ?? 0) + 2;
        room.sssRoundScores[voterId].correct = true;
      } else {
        // Wrong guess - the person they voted for tricked them (+1 for that person)
        room.sssScores[targetId] = (room.sssScores[targetId] ?? 0) + 1;
        room.sssRoundScores[targetId].tricked += 1;
      }
    }
    
    // Update player scores in the player list
    for (const player of room.players) {
      player.score = room.sssScores[player.id] ?? 0;
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

  private advanceSSSRound(room: Room) {
    const currentRound = room.sssRound ?? 0;
    const totalRounds = room.totalRounds;
    
    if (currentRound >= totalRounds) {
      // Game over
      this.endScribbleScrabbleScrambled(room);
    } else {
      // Next round
      this.startSSSRound(room);
    }
  }

  private endScribbleScrabbleScrambled(room: Room) {
    room.state = 'END';
    
    // Find winner(s)
    const scores = room.sssScores ?? {};
    const maxScore = Math.max(...Object.values(scores));
    const winners = room.players.filter(p => scores[p.id] === maxScore);
    
    this.io.to(room.code).emit('sss_game_end', {
      scores,
      winnerId: winners[0]?.id,
      winnerName: winners[0]?.name,
      winners: winners.map(w => ({ id: w.id, name: w.name, score: scores[w.id] }))
    });
    this.io.to(room.code).emit('room_update', this.getRoomPublicState(room));
  }

  // ==================== END SCRIBBLE SCRABBLE: SCRAMBLED METHODS ====================

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
      aqScores: room.aqScores,
      // Scribble Scrabble fields
      scDrawerId: room.scDrawerId,
      scDrawerName: room.scDrawerId ? room.players.find(p => p.id === room.scDrawerId)?.name : undefined,
      scWordHint: room.scWord ? generateWordHint(room.scWord, room.scRevealedIndices ?? []) : undefined,
      scRoundTime: room.scRoundTime,
      scRoundDuration: room.scRoundDuration ?? 60,
      scRoundsPerPlayer: room.scRoundsPerPlayer ?? 1,
      scCurrentRound: room.scCurrentRound,
      scTotalRounds: room.scTotalRounds,
      scCorrectGuessers: room.scCorrectGuessers,
      scScores: room.scScores,
      scGuessChat: room.scGuessChat,
      scDrawingStrokes: room.scDrawingStrokes,
      // Card Calamity fields
      ccCurrentPlayerId: room.ccCurrentPlayerId,
      ccCurrentPlayerName: room.ccCurrentPlayerId ? room.players.find(p => p.id === room.ccCurrentPlayerId)?.name : undefined,
      ccDirection: room.ccDirection,
      ccDrawStack: room.ccDrawStack,
      ccActiveColor: room.ccActiveColor,
      ccTopCard: room.ccDiscardPile?.length ? room.ccDiscardPile[room.ccDiscardPile.length - 1] : undefined,
      ccHandCounts: room.ccPlayerHands ? Object.fromEntries(
        Object.entries(room.ccPlayerHands).map(([id, cards]) => [id, cards.length])
      ) : undefined,
      ccTurnOrder: room.ccTurnOrder,
      ccStackingEnabled: room.ccStackingEnabled ?? false,
      ccLastAction: room.ccLastAction,
      ccWinnerId: room.ccWinnerId,
      ccWinnerName: room.ccWinnerId ? room.players.find(p => p.id === room.ccWinnerId)?.name : undefined,
      ccPendingWildPlayerId: room.ccPendingWildPlayerId,
      // Scribble Scrabble: Scrambled fields
      sssRound: room.sssRound,
      sssDrawTime: room.sssDrawTime ?? 60,
      sssDoubleRounds: room.sssDoubleRounds ?? false,
      sssDrawingsSubmitted: room.sssDrawings ? Object.keys(room.sssDrawings).length : 0,
      sssVotesSubmitted: room.sssVotes ? Object.keys(room.sssVotes).length : 0,
      sssActivePlayerCount: room.sssActivePlayerIds?.length ?? 0,
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
  private escapeXml(input: string) {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
