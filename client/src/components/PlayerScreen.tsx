import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { socket, socketServerUrl } from '../socket';
import useAuth from '../hooks/useAuth'

import WoodenButton from './WoodenButton';
import AuthHeader from './AuthHeader';
import ScribbleCanvas, { DrawingCanvasHandle } from './DrawingCanvas';
import CardCalamityCard, { ColorPicker, ActiveColorIndicator, CCCard } from './CardCalamityCard';

// Simple drawing canvas (for Dubiously Patented)
function DrawingCanvas({ onChange }: { onChange: (data: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    
    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const start = (e: any) => {
    e.preventDefault(); // prevent scroll
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: any) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stop = () => {
    if (isDrawing) {
      setIsDrawing(false);
      onChange(canvasRef.current?.toDataURL() || '');
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL());
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="bg-white rounded-lg cursor-crosshair touch-none mx-auto"
        onMouseDown={start}
        onMouseMove={draw}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchMove={draw}
        onTouchEnd={stop}
      />
      <button 
        type="button" 
        onClick={clear}
        className="text-xs text-slate-400 underline"
      >
        Clear Drawing
      </button>
    </div>
  );
}

type GameState =
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

interface RoomPublicState {
  code: string;
  gameId?: string;
  state: GameState;
  currentRound: number;
  totalRounds: number;
  contestants?: { id: string; name: string }[];
  controllerPlayerId?: string;
  players?: { id: string; name: string; isConnected: boolean; isBot?: boolean; score: number }[];
  promptText?: string;
  aqCurrentQuestion?: number;
  aqAnsweredCount?: number;
  // Scribble Scrabble fields
  scDrawerId?: string;
  scDrawerName?: string;
  scWordHint?: string;
  scRoundTime?: number;
  scRoundDuration?: number;
  scRoundsPerPlayer?: number;
  scCurrentRound?: number;
  scTotalRounds?: number;
  scCorrectGuessers?: string[];
  scScores?: Record<string, number>;
  scGuessChat?: { playerId: string; playerName: string; guess: string; isCorrect: boolean; isClose: boolean }[];
  // Card Calamity fields
  ccCurrentPlayerId?: string;
  ccCurrentPlayerName?: string;
  ccDirection?: 1 | -1;
  ccDrawStack?: number;
  ccActiveColor?: 'red' | 'blue' | 'green' | 'yellow';
  ccTopCard?: CCCard;
  ccHandCounts?: Record<string, number>;
  ccTurnOrder?: string[];
  ccStackingEnabled?: boolean;
  ccLastAction?: { type: string; playerId: string; playerName: string; card?: any; color?: string };
  ccWinnerId?: string;
  ccWinnerName?: string;
  ccPendingWildPlayerId?: string;
  // Scribble Scrabble: Scrambled fields
  sssRound?: number;
  sssDrawTime?: number;
  sssDoubleRounds?: boolean;
  sssDrawingsSubmitted?: number;
  sssVotesSubmitted?: number;
  sssActivePlayerCount?: number;
  sssScores?: Record<string, number>;
  sssDrawings?: Record<string, string>;
  sssRealDrawerId?: string;
  sssRealPrompt?: string;
  sssAllPrompts?: Record<string, string>;
  sssVotes?: Record<string, string>;
  sssRoundScores?: Record<string, { tricked: number; correct: boolean }>;
}

export default function PlayerScreen() {
  const { user, fetchMe } = useAuth()
  const [joined, setJoined] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [gameId, setGameId] = useState<string>('nasty-libs');
  const [playerId, setPlayerId] = useState<string>('');
  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [prompt, setPrompt] = useState('');
  const [votingOptions, setVotingOptions] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');
  const [answerDraft, setAnswerDraft] = useState('');
  const [problemsDraft, setProblemsDraft] = useState<string[]>(['', '', '']);
  const [dpChoices, setDpChoices] = useState<string[]>([]);
  const [dpSelected, setDpSelected] = useState<string>('');
  const [drawingDraft, setDrawingDraft] = useState<string>('');
  const [investmentAmount, setInvestmentAmount] = useState<string>('');
  const [currentPresenterId, setCurrentPresenterId] = useState<string>('');
  // Autism Quiz state
  const [aqQuestion, setAqQuestion] = useState<{ questionId: number; questionText: string; questionNumber: number; totalQuestions: number } | null>(null);
  const [aqResults, setAqResults] = useState<{ rankings: { id: string; name: string; score: number }[]; winnerId: string; winnerName: string; certificate: string; loserId: string; loserName: string; loserCertificate: string } | null>(null);
  const [aqAnswered, setAqAnswered] = useState(false);
  const [aqTimeLeft, setAqTimeLeft] = useState(30);
  // Scribble Scrabble state
  const [scWordOptions, setScWordOptions] = useState<string[]>([]);
  const [scTimeLeft, setScTimeLeft] = useState(60);
  const [scGuessDraft, setScGuessDraft] = useState('');
  const [scGuessChat, setScGuessChat] = useState<{ playerId: string; playerName: string; guess: string; isCorrect: boolean; isClose: boolean }[]>([]);
  const [scRoundWord, setScRoundWord] = useState<string>('');
  const [scRoundScores, setScRoundScores] = useState<Record<string, number>>({});
  // Card Calamity state
  const [ccHand, setCcHand] = useState<CCCard[]>([]);
  const [ccPendingHand, setCcPendingHand] = useState<CCCard[]>([]);
  const [ccIsDealing, setCcIsDealing] = useState(false);
  const [ccTimeLeft, setCcTimeLeft] = useState(30);
  const [ccSelectedCardId, setCcSelectedCardId] = useState<string | null>(null);
  // Scribble Scrabble: Scrambled state
  const [sssPrompt, setSssPrompt] = useState<string>('');
  const [sssIsRealPrompt, setSssIsRealPrompt] = useState<boolean>(false);
  const [sssTimeLeft, setSssTimeLeft] = useState<number>(60);
  const [sssDrawingSubmitted, setSssDrawingSubmitted] = useState<boolean>(false);
  const [sssSelectedVote, setSssSelectedVote] = useState<string | null>(null);
  const [sssVoteSubmitted, setSssVoteSubmitted] = useState<boolean>(false);
  const [sssResults, setSssResults] = useState<{
    realDrawerId: string;
    realPrompt: string;
    allPrompts: Record<string, string>;
    drawings: Record<string, string>;
    votes: Record<string, string>;
    roundScores: Record<string, { tricked: number; correct: boolean }>;
    totalScores: Record<string, number>;
    votesByTarget: Record<string, string[]>;
  } | null>(null);
  const sssCanvasRef = useRef<DrawingCanvasHandle>(null);

  useEffect(() => {
    // Check pathname first: /join/ABCD
    const pathMatch = window.location.pathname.match(/^\/join\/([A-Za-z0-9]+)/);
    if (pathMatch) {
      setRoomCode(pathMatch[1].toUpperCase());
    } else {
      // Fallback to hash: #/join?room=ABCD
      const hash = window.location.hash;
      const qIndex = hash.indexOf('?');
      if (qIndex !== -1) {
        const params = new URLSearchParams(hash.slice(qIndex + 1));
        const room = params.get('room');
        if (room) setRoomCode(room.toUpperCase());
      }
    }

    const onJoined = (data: any) => {
      setJoined(true);
      setError('');
      const nextRoomCode = String(data?.roomCode ?? roomCode).toUpperCase();
      const nextPlayerId = String(data?.playerId ?? '');
      if (nextRoomCode) setRoomCode(nextRoomCode);
      if (nextPlayerId) {
        setPlayerId(nextPlayerId);
        try {
          localStorage.setItem(`playerId:${nextRoomCode}`, nextPlayerId);
        } catch {
          // ignore
        }
      }
      if (data?.gameId) setGameId(String(data.gameId));
    };
    socket.on('joined', onJoined);

    // Track the previous state for comparison
    let prevState: string | undefined;
    
    const onRoomUpdate = (nextRoom: any) => {
      const stateChanged = prevState !== nextRoom?.state;
      prevState = nextRoom?.state;
      
      setRoom(nextRoom);
      if (nextRoom?.gameId) setGameId(String(nextRoom.gameId));
      
      // Only reset drafts/submitted when game state actually changes
      if (stateChanged) {
        setSubmitted(false);
        setAnswerDraft('');
        setPromptDraft('');
        setDpSelected('');
        if (nextRoom?.state !== 'DP_PICK') setDpChoices([]);
      }

      // When the game ends, report stats for the current player (if present)
      if (stateChanged && nextRoom?.state === 'END') {
        (async () => {
          try {
            const me = nextRoom?.players?.find((p: any) => p.id === playerId)
            if (!me) return
            const scores = Array.isArray(nextRoom.players) ? nextRoom.players.map((p: any) => Number(p.score || 0)) : [Number(me.score || 0)]
            const max = scores.length ? Math.max(...scores) : (me.score || 0)
            const won = Number(me.score || 0) >= max && max > 0
            await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/stats/report`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ game: nextRoom.gameId ?? gameId, score: Number(me.score || 0), won, metadata: { roomCode: nextRoom.code } })
            })
          } catch (e) {
            // ignore reporting errors
          }
        })()
      }
    };
    socket.on('room_update', onRoomUpdate);

    const onNewPrompt = (data: any) => { setPrompt(data.prompt); setSubmitted(false); setAnswerDraft(''); };
    socket.on('new_prompt', onNewPrompt);

    const onStartVoting = (data: any) => { setVotingOptions(data.answers); setSubmitted(false); };
    socket.on('start_voting', onStartVoting);

    const onDpChoices = (data: any) => { const choices = Array.isArray(data?.choices) ? data.choices.map((c: any) => String(c)) : []; setDpChoices(choices); setSubmitted(false); };
    socket.on('dp_choices', onDpChoices);

    const onStartPresentation = (data: any) => { setCurrentPresenterId(data.presenterId); setSubmitted(false); };
    socket.on('start_presentation', onStartPresentation);

    const onStartInvesting = (data: any) => { setCurrentPresenterId(data.presenterId); setSubmitted(false); setInvestmentAmount(''); };
    socket.on('start_investing', onStartInvesting);

    const onAqQuestion = (data: any) => { setAqQuestion({ questionId: data.questionId, questionText: data.questionText, questionNumber: data.questionNumber, totalQuestions: data.totalQuestions }); setAqAnswered(false); };
    socket.on('aq_question', onAqQuestion);

    const onAqResults = (data: any) => { setAqResults({ rankings: data.rankings, winnerId: data.winnerId, winnerName: data.winnerName, certificate: data.certificate, loserId: data.loserId, loserName: data.loserName, loserCertificate: data.loserCertificate }); };
    socket.on('aq_results', onAqResults);

    const onAqTimer = (data: { timeLeft: number; questionNumber: number }) => { setAqTimeLeft(data.timeLeft); };
    socket.on('aq_timer', onAqTimer);

    // Scribble Scrabble events
    const onScWordOptions = (data: { words: string[] }) => { setScWordOptions(data.words); };
    socket.on('sc_word_options', onScWordOptions);

    const onScTimer = (data: { timeLeft: number }) => { setScTimeLeft(data.timeLeft); };
    socket.on('sc_timer', onScTimer);

    const onScGuessChat = (data: { playerId: string; playerName: string; guess: string; isCorrect: boolean; isClose: boolean }) => { setScGuessChat(prev => [...prev, data]); };
    socket.on('sc_guess_chat', onScGuessChat);

    const onScCorrectGuess = () => { /* notification handled elsewhere */ };
    socket.on('sc_correct_guess', onScCorrectGuess);

    const onScStrokeData = () => { /* players don't see the canvas */ };
    socket.on('sc_stroke_data', onScStrokeData);

    const onScClearCanvas = () => { /* players don't see the canvas */ };
    socket.on('sc_clear_canvas', onScClearCanvas);

    const onScRoundEnd = (data: { word: string; correctGuessers: string[]; scores: Record<string, number> }) => { setScRoundWord(data.word); setScRoundScores(data.scores); setScGuessChat([]); };
    socket.on('sc_round_end', onScRoundEnd);

    const onScGameEnd = () => { /* handled by room state change */ };
    socket.on('sc_game_end', onScGameEnd);

    // Card Calamity events
    const onCcGameStart = () => { setCcIsDealing(true); setCcHand([]); setCcPendingHand([]); setTimeout(() => { setCcIsDealing(false); }, 4500); };
    socket.on('cc_game_start', onCcGameStart);

    const onCcHand = (data: { cards: CCCard[] }) => { setCcPendingHand(data.cards); setCcSelectedCardId(null); };
    socket.on('cc_hand', onCcHand);

    const onCcTimer = (data: { timeLeft: number }) => { setCcTimeLeft(data.timeLeft); };
    socket.on('cc_timer', onCcTimer);

    const onCcInvalidPlay = () => { setCcSelectedCardId(null); };
    socket.on('cc_invalid_play', onCcInvalidPlay);

    const onCcGameEnd = () => { /* handled by room state change */ };
    socket.on('cc_game_end', onCcGameEnd);

    // Scribble Scrabble: Scrambled events
    const onSssPrompt = (data: { prompt: string; isReal: boolean }) => { setSssPrompt(data.prompt); setSssIsRealPrompt(data.isReal); setSssDrawingSubmitted(false); setSssVoteSubmitted(false); setSssSelectedVote(null); setSssResults(null); };
    socket.on('sss_prompt', onSssPrompt);

    const onSssTimer = (data: { timeLeft: number }) => { setSssTimeLeft(data.timeLeft); };
    socket.on('sss_timer', onSssTimer);

    const onSssResults = (data: any) => { setSssResults(data); };
    socket.on('sss_results', onSssResults);

    const onSssGameEnd = () => { /* handled by room state change */ };
    socket.on('sss_game_end', onSssGameEnd);

    const onError = (data: any) => {
        if (data?.code === 'GAME_ERROR') {
          setSubmitted(false);
          alert(data.message); // Simple alert for now, or use a toast state
          return;
        }
        setError(data.message);
        setJoined(false);
    };
    socket.on('error', onError);

    const onConnectError = () => { const target = socketServerUrl ? ` (${socketServerUrl})` : ''; setError(`Could not connect to game server${target}`); setJoined(false); };
    socket.on('connect_error', onConnectError);

    const onRoomClosed = () => {
      setError('Room closed');
      setJoined(false);
      setRoom(null);
      setSubmitted(false);
      if (roomCode) {
        try {
          localStorage.removeItem(`playerId:${roomCode.toUpperCase()}`);
        } catch {
          // ignore
        }
      }
    };

    const onLobbyClosed = () => {
      // Controller created a new lobby, kick players back to join screen
      setError('Lobby closed by controller');
      setJoined(false);
      setRoom(null);
      setSubmitted(false);
      if (roomCode) {
        try {
          localStorage.removeItem(`playerId:${roomCode.toUpperCase()}`);
        } catch {
          // ignore
        }
      }
    };

    socket.on('room_closed', onRoomClosed);
    socket.on('lobby_closed', onLobbyClosed);

    return () => {
      socket.off('joined');
      socket.off('room_update');
      socket.off('new_prompt', onNewPrompt);
      socket.off('start_voting', onStartVoting);
      socket.off('dp_choices', onDpChoices);
      socket.off('start_presentation', onStartPresentation);
      socket.off('start_investing', onStartInvesting);
      socket.off('aq_question', onAqQuestion);
      socket.off('aq_results', onAqResults);
      socket.off('aq_timer', onAqTimer);
      socket.off('sc_word_options', onScWordOptions);
      socket.off('sc_timer', onScTimer);
      socket.off('sc_guess_chat', onScGuessChat);
      socket.off('sc_correct_guess', onScCorrectGuess);
      socket.off('sc_stroke_data', onScStrokeData);
      socket.off('sc_clear_canvas', onScClearCanvas);
      socket.off('sc_round_end', onScRoundEnd);
      socket.off('sc_game_end', onScGameEnd);
      socket.off('cc_game_start', onCcGameStart);
      socket.off('cc_hand', onCcHand);
      socket.off('cc_timer', onCcTimer);
      socket.off('cc_invalid_play', onCcInvalidPlay);
      socket.off('cc_game_end', onCcGameEnd);
      socket.off('sss_prompt', onSssPrompt);
      socket.off('sss_timer', onSssTimer);
      socket.off('sss_results', onSssResults);
      socket.off('sss_game_end', onSssGameEnd);
      socket.off('error', onError);
      socket.off('connect_error', onConnectError);
      socket.off('room_closed', onRoomClosed);
      socket.off('lobby_closed', onLobbyClosed);
    };
  }, []);

  // When dealing animation completes, or if we're not dealing, transfer pending hand to actual hand
  useEffect(() => {
    if (!ccIsDealing && ccPendingHand.length > 0) {
      setCcHand(ccPendingHand);
      setCcPendingHand([]);
    }
  }, [ccIsDealing, ccPendingHand]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode) return;

    // Determine the name we'll join with (prefer typed name, then account nickname/username)
    const joinName = playerName && playerName.trim() ? playerName.trim() : (user ? (user.nickname ?? user.username) : '')
    if (!joinName) return;

    let rememberedPlayerId: string | null = null;
    try {
      rememberedPlayerId = localStorage.getItem(`playerId:${roomCode.toUpperCase()}`);
    } catch {
      rememberedPlayerId = null;
    }

    socket.emit('join_room', {
      roomCode,
      playerName: joinName,
      isHost: false,
      playerId: rememberedPlayerId ?? undefined
    });
    setPlayerName(joinName)
  };

  const handleStartGame = () => {
    socket.emit('game_action', { action: 'START_GAME' });
  };

  const handleAddBot = () => {
    socket.emit('game_action', { action: 'ADD_BOT' });
  };

  const handleRemoveBot = () => {
    socket.emit('game_action', { action: 'REMOVE_BOT' });
  };

  const handleNextRound = () => {
    socket.emit('game_action', { action: 'NEXT_ROUND' });
  };

  const handleSubmitPrompt = () => {
    const promptText = promptDraft.trim();
    if (!promptText) return;
    socket.emit('game_action', { action: 'SUBMIT_PROMPT', prompt: promptText });
    setSubmitted(true);
  };

  const handleSubmitProblems = () => {
    const problems = problemsDraft.map(p => p.trim()).filter(Boolean).slice(0, 3);
    if (problems.length === 0) return;
    socket.emit('game_action', { action: 'SUBMIT_PROBLEMS', problems });
    setSubmitted(true);
  };

  const handleSelectProblem = (choice: string) => {
    const selected = String(choice ?? '').trim();
    if (!selected) return;
    socket.emit('game_action', { action: 'SELECT_PROBLEM', problem: selected });
    setDpSelected(selected);
    setSubmitted(true);
  };

  const handleSubmitAnswer = (answer: string) => {
      socket.emit('game_action', { action: 'SUBMIT_ANSWER', answer });
      setSubmitted(true);
  };

  const handleSubmitDrawing = (title: string) => {
    socket.emit('game_action', { 
        action: 'SUBMIT_DRAWING', 
        drawing: drawingDraft, 
        title 
    });
    setSubmitted(true);
  };

  const handleInvest = () => {
      const amount = parseInt(investmentAmount);
      if (isNaN(amount) || amount < 0) return;
      socket.emit('game_action', { action: 'INVEST', amount });
      setSubmitted(true);
  };

  const handleVote = (index: number) => {
      socket.emit('game_action', { action: 'SUBMIT_VOTE', voteIndex: index });
      setSubmitted(true);
  };

  if (!joined) {
    return (
      <div className="w-full max-w-md p-8 flex flex-col items-center justify-center min-h-screen">
        <form onSubmit={handleJoin} className="flex flex-col gap-6 w-full">
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-400">ROOM CODE</label>
            <input 
              type="text" 
              maxLength={4}
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              className="w-full p-4 bg-slate-800 rounded-lg text-4xl font-black text-center tracking-widest uppercase focus:ring-2 focus:ring-pink-500 outline-none"
              placeholder="ABCD"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
            />
          </div>
          { !user ? (
            <div>
              <label className="block text-sm font-bold mb-2 text-slate-400">NAME</label>
              <input 
                type="text" 
                maxLength={12}
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                className="w-full p-4 bg-slate-800 rounded-lg text-2xl font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="ENTER NAME"
                autoComplete="off"
                autoCorrect="off"
              />
            </div>
          ) : (
            <div className="text-sm text-slate-400">Logged in as <strong>{user.nickname ?? user.username}</strong>. Your account name will be used.</div>
          )}
          {error && <p className="text-red-500 text-center">{error}</p>}
          <WoodenButton 
            type="submit"
            variant="red"
            className="w-full touch-manipulation"
          >
            PLAY
          </WoodenButton>

          <div className="mt-3 flex flex-col gap-3">
            {!user ? (
              <>
                <WoodenButton onClick={() => window.location.pathname = '/login'} variant="red" className="w-full">Login</WoodenButton>
                <WoodenButton onClick={() => window.location.pathname = '/register'} variant="red" className="w-full">Register</WoodenButton>
              </>
            ) : (
              <WoodenButton onClick={() => window.location.pathname = '/profile'} variant="red" className="w-full">Profile</WoodenButton>
            )}
          </div>
        </form>
      </div>
    );
  }

  const gameState = (room?.state ?? 'LOBBY') as GameState;
  const contestants = room?.contestants ?? [];
  const isContestant = Boolean(playerId && contestants.some(c => c.id === playerId));
  const isController = Boolean(playerId && room?.controllerPlayerId && room.controllerPlayerId === playerId);
  const totalPlayers = (room?.players ?? []).filter(p => p.isConnected || p.isBot).length;

  const handleLeaveGame = () => {
    // Reset all state and go back to join screen
    setJoined(false);
    setRoom(null);
    setError('');
    setSubmitted(false);
    setPrompt('');
    setVotingOptions([]);
    setAnswerDraft('');
    setPromptDraft('');
    setProblemsDraft(['', '', '']);
    setDpChoices([]);
    setDpSelected('');
    setDrawingDraft('');
    setInvestmentAmount('');
    setAqQuestion(null);
    setAqResults(null);
    setAqAnswered(false);
    // Clear stored playerId for this room
    if (roomCode) {
      try {
        localStorage.removeItem(`playerId:${roomCode.toUpperCase()}`);
      } catch {
        // ignore
      }
    }
    // Navigate back to home so users skip splash/title flows
    try { window.location.pathname = '/home'; } catch {}
  };

  const isInGame = gameState !== 'LOBBY' && gameState !== 'END';

  return (
    <div className="w-full h-screen max-h-screen p-2 sm:p-4 flex flex-col bg-slate-900 text-white overflow-y-auto">
      <div className="flex justify-between items-center mb-2 sm:mb-4 text-xs sm:text-sm text-slate-500 border-b border-slate-700 pb-1 sm:pb-2">
          <div className="flex items-center gap-2">
            {isInGame && (
              <button
                onClick={handleLeaveGame}
                className="text-slate-400 hover:text-white transition-colors p-1"
                title="Leave game"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            <span className="font-bold text-pink-500">{playerName}</span>
          </div>
          <span className="font-mono bg-slate-800 px-2 py-1 rounded">Room: {roomCode}</span>
      </div>

      <div className="p-2 flex justify-end">
        {!(joined && (room?.state === 'LOBBY') && user) && <AuthHeader />}
      </div>

      {/* Player list - show during games */}
      {room && gameState !== 'LOBBY' && gameState !== 'END' && (
        <div className="mb-4 px-2">
          <div className="flex flex-wrap gap-2 justify-center">
            {room.players?.filter(p => p.isConnected || p.isBot).map((player) => {
              const isCurrent = player.id === room.ccCurrentPlayerId;
              const isMe = player.id === playerId;
              const cardCount = room.ccHandCounts?.[player.id] ?? 0;
              
              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    isCurrent 
                      ? 'bg-yellow-500/20 border border-yellow-400' 
                      : isMe 
                        ? 'bg-blue-500/20 border border-blue-400'
                        : 'bg-slate-700'
                  }`}
                >
                  <span className={`font-bold ${isCurrent ? 'text-yellow-300' : isMe ? 'text-blue-300' : 'text-white'}`}>
                    {player.name}
                    {isMe && ' (You)'}
                  </span>
                  {isCurrent && <span className="text-yellow-400">🎯</span>}
                  {gameState.startsWith('CC_') && cardCount > 0 && (
                    <>
                      <span className="text-white">🃏</span>
                      <span className={`font-bold ${cardCount <= 2 ? 'text-red-400' : 'text-white'}`}>
                        {cardCount}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center">
        {error && (
          <div className="w-full max-w-md mx-auto mb-6 p-4 bg-red-900/40 border border-red-600 rounded-lg text-red-200 text-center">
            {error}
          </div>
        )}

        {gameState === 'LOBBY' && (
            <div className="text-center">
                <h2 className="text-3xl font-bold mb-4 text-pink-500">You're In!</h2>
                <p className="text-slate-400 text-lg">Watch the main screen for the room.</p>
                {/* Change nickname button for players while in lobby (allowed until game starts) */}
                <div className="mt-4">
                  <div className="max-w-md mx-auto">
                    <WoodenButton onClick={async () => {
                      const newNick = prompt('Enter new nickname (max 24 chars)', (user?.nickname ?? playerName) || '')
                      if (!newNick) return
                      try {
                        // emit to server to update room player name
                        socket.emit('change_nickname', newNick.slice(0,24))
                        // if logged in, update persistent nickname as well
                        if (user) {
                          await fetch(`${import.meta.env.VITE_SERVER_URL ?? ''}/api/auth/nickname`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: newNick.slice(0,24) }) })
                          try { await fetchMe() } catch {}
                        }
                        setPlayerName(newNick.slice(0,24))
                      } catch (e) {
                        // ignore
                      }
                    }} variant="red">Change Nickname</WoodenButton>
                  </div>
                </div>
                {isController ? (
                  <div className="mt-8 w-full max-w-md mx-auto">
                    <div className="text-slate-300 text-lg mb-4">You are the controller.</div>
                    
                    {/* Scribble Scrabble settings */}
                    {gameId === 'scribble-scrabble' && (
                      <div className="mb-6 p-4 bg-slate-800 rounded-lg">
                        <h3 className="text-lg font-bold text-orange-400 mb-3">Game Settings</h3>
                        <div className="flex flex-col gap-3">
                          <div>
                            <label className="text-sm text-slate-400 block mb-1">Rounds per player:</label>
                            <div className="flex gap-2 justify-center">
                              {[1, 2, 3].map(n => (
                                <button
                                  key={n}
                                  onClick={() => socket.emit('game_action', { action: 'SC_SET_ROUNDS', rounds: n })}
                                  className={`px-4 py-2 rounded font-bold ${
                                    (room?.scRoundsPerPlayer ?? 1) === n 
                                      ? 'bg-orange-500 text-black' 
                                      : 'bg-slate-700 text-white'
                                  }`}
                                >
                                  {n}×
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm text-slate-400 block mb-1">Round timer:</label>
                            <div className="flex gap-2 justify-center flex-wrap">
                              {[60, 90, 120, 150].map(sec => (
                                <button
                                  key={sec}
                                  onClick={() => socket.emit('game_action', { action: 'SC_SET_TIMER', duration: sec })}
                                  className={`px-3 py-2 rounded font-bold ${
                                    (room?.scRoundDuration ?? 60) === sec 
                                      ? 'bg-orange-500 text-black' 
                                      : 'bg-slate-700 text-white'
                                  }`}
                                >
                                  {sec}s
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Card Calamity settings */}
                    {gameId === 'card-calamity' && (
                      <div className="mb-6 p-4 bg-slate-800 rounded-lg">
                        <h3 className="text-lg font-bold text-red-400 mb-3">Game Settings</h3>
                        <div className="flex flex-col gap-3">
                          <div>
                            <label className="text-sm text-slate-400 block mb-1">+2/+4 Stacking:</label>
                            <button
                              onClick={() => socket.emit('game_action', { action: 'CC_TOGGLE_STACKING' })}
                              className={`px-4 py-2 rounded font-bold w-full ${
                                room?.ccStackingEnabled 
                                  ? 'bg-green-500 text-black' 
                                  : 'bg-slate-700 text-white'
                              }`}
                            >
                              {room?.ccStackingEnabled ? '✓ ENABLED' : '✗ DISABLED'}
                            </button>
                            <p className="text-xs text-slate-500 mt-1">
                              {room?.ccStackingEnabled 
                                ? 'Players can stack +2 on +2 or +4 on +4' 
                                : 'Players must draw immediately'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scribble Scrabble: Scrambled settings */}
                    {gameId === 'scribble-scrabble-scrambled' && (
                      <div className="mb-6 p-4 bg-slate-800 rounded-lg">
                        <h3 className="text-lg font-bold text-purple-400 mb-3">Game Settings</h3>
                        <div className="flex flex-col gap-4">
                          <div>
                            <label className="text-sm text-slate-400 block mb-1">Draw Time:</label>
                            <div className="flex gap-2 justify-center">
                              {[60, 90].map(sec => (
                                <button
                                  key={sec}
                                  onClick={() => socket.emit('game_action', { action: 'SSS_SET_DRAW_TIME', time: sec })}
                                  className={`px-4 py-2 rounded font-bold flex-1 ${
                                    (room?.sssDrawTime ?? 60) === sec 
                                      ? 'bg-purple-500 text-black' 
                                      : 'bg-slate-700 text-white'
                                  }`}
                                >
                                  {sec}s
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm text-slate-400 block mb-1">Double Rounds:</label>
                            <button
                              onClick={() => socket.emit('game_action', { action: 'SSS_SET_DOUBLE_ROUNDS', enabled: !room?.sssDoubleRounds })}
                              className={`px-4 py-2 rounded font-bold w-full ${
                                room?.sssDoubleRounds 
                                  ? 'bg-purple-500 text-black' 
                                  : 'bg-slate-700 text-white'
                              }`}
                            >
                              {room?.sssDoubleRounds ? '✓ ON (2× Rounds)' : '✗ OFF (Normal)'}
                            </button>
                            <p className="text-xs text-slate-500 mt-1">
                              {room?.sssDoubleRounds 
                                ? 'Each player gets the real prompt twice' 
                                : 'Each player gets the real prompt once'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bot controls - not for Scribble Scrabble, Card Calamity, or SSS */}
                    {gameId !== 'scribble-scrabble' && gameId !== 'card-calamity' && gameId !== 'scribble-scrabble-scrambled' && (
                      <div className="flex gap-3 justify-center mb-4">
                        <WoodenButton type="button" variant="wood" onClick={handleAddBot} className="px-6">
                          ADD CPU
                        </WoodenButton>
                        <WoodenButton type="button" variant="wood" onClick={handleRemoveBot} className="px-6">
                          REMOVE CPU
                        </WoodenButton>
                      </div>
                    )}
                    
                    <WoodenButton
                      type="button"
                      variant="red"
                      onClick={handleStartGame}
                      disabled={totalPlayers < (gameId === 'card-calamity' || gameId === 'autism-assessment' ? 2 : 3)}
                      className={
                        totalPlayers >= (gameId === 'card-calamity' || gameId === 'autism-assessment' ? 2 : 3)
                          ? 'w-full animate-bounce'
                          : 'w-full opacity-60 pointer-events-none'
                      }
                    >
                      EVERYBODY'S IN!
                    </WoodenButton>
                    <p className="mt-4 text-sm text-slate-500">
                      {gameId === 'scribble-scrabble' 
                        ? 'Minimum 3 players. No bots allowed!' 
                        : gameId === 'card-calamity'
                          ? 'Minimum 2 players. No bots allowed!'
                          : gameId === 'autism-assessment'
                            ? 'Minimum 2 players.'
                            : 'Minimum 3 players.'}
                    </p>
                  </div>
                ) : (
                  <p className="mt-8 text-sm text-slate-600">Waiting for the controller to start...</p>
                )}
            </div>
        )}

        {gameState === 'NL_PROMPT_SUBMIT' && (
          <div className="w-full max-w-xl mx-auto">
            <div className="text-center mb-6">
              <div className="text-sm font-black tracking-widest text-slate-400">PROMPT SUBMISSION</div>
              <h2 className="text-xl font-bold mt-2">
                {contestants.length === 2 ? `${contestants[0].name} vs ${contestants[1].name}` : 'Two contestants this round'}
              </h2>
            </div>

            {isContestant ? (
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-3">You’re playing this round</h2>
                <p className="text-slate-400">Hang tight while others submit prompts.</p>
              </div>
            ) : submitted ? (
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Prompt Submitted!</h2>
                <p className="text-slate-400">Waiting for others...</p>
              </div>
            ) : (
              <>
                <textarea
                  className="w-full h-40 bg-slate-800 p-4 rounded-xl text-lg mb-4 focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                  placeholder="Write a fun prompt for the contestants..."
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                />
                <WoodenButton variant="red" onClick={handleSubmitPrompt} className="w-full">
                  SUBMIT PROMPT
                </WoodenButton>
              </>
            )}
          </div>
        )}

        {(gameState === 'DP_PROBLEM_SUBMIT') && (
          <div className="w-full max-w-xl mx-auto">
            <div className="text-center mb-6">
              <div className="text-sm font-black tracking-widest text-slate-400">PROBLEM SUBMISSION</div>
              <h2 className="text-xl font-bold mt-2">Enter up to 3 problems to solve</h2>
            </div>

            {submitted ? (
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Submitted!</h2>
                <p className="text-slate-400">Waiting for others...</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 mb-6">
                  {problemsDraft.map((val, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={val}
                      onChange={(e) => {
                        const next = [...problemsDraft];
                        next[idx] = e.target.value;
                        setProblemsDraft(next);
                      }}
                      className="w-full p-4 bg-slate-800 rounded-xl text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder={`Problem ${idx + 1}`}
                    />
                  ))}
                </div>
                <WoodenButton variant="red" onClick={handleSubmitProblems} className="w-full">
                  SUBMIT
                </WoodenButton>
              </>
            )}
          </div>
        )}

        {gameState === 'DP_PICK' && (
          <div className="w-full max-w-xl mx-auto">
            <div className="text-center mb-6">
              <div className="text-sm font-black tracking-widest text-slate-400">CHOOSE A PROBLEM</div>
              <h2 className="text-xl font-bold mt-2">Pick one to solve</h2>
            </div>

            {dpSelected ? (
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Selected!</h2>
                <p className="text-slate-400">Waiting for others...</p>
              </div>
            ) : dpChoices.length === 0 ? (
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Preparing choices...</h2>
                <p className="text-slate-400">One sec.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {dpChoices.map((choice) => (
                  <button
                    key={choice}
                    onClick={() => handleSelectProblem(choice)}
                    className="p-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-lg font-bold text-left"
                  >
                    {choice}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {gameState === 'DP_DRAWING' && (
             <div className="w-full max-w-xl mx-auto text-center">
                 {submitted ? (
                     <div>
                         <h2 className="text-2xl font-bold mb-4">Invention Submitted!</h2>
                         <p className="text-slate-400">Waiting for others...</p>
                     </div>
                 ) : (
                     <>
                        <div className="mb-4">
                            <h2 className="text-xl font-bold text-pink-500 mb-2">{prompt}</h2>
                            <p className="text-sm text-slate-400">Draw your invention below!</p>
                        </div>
                        <div className="mb-4 flex justify-center">
                            <DrawingCanvas onChange={setDrawingDraft} />
                        </div>
                        <input 
                            type="text"
                            value={answerDraft}
                            onChange={(e) => setAnswerDraft(e.target.value)}
                            className="w-full p-4 bg-slate-800 rounded-xl text-lg mb-4 focus:ring-2 focus:ring-pink-500 outline-none"
                            placeholder="Name your invention..."
                            maxLength={50}
                        />
                        <WoodenButton 
                            variant="red"
                            onClick={() => {
                                const text = answerDraft.trim();
                                if (text && drawingDraft) handleSubmitDrawing(text);
                            }}
                            className="w-full"
                        >
                            SUBMIT INVENTION
                        </WoodenButton>
                     </>
                 )}
             </div>
        )}

        {gameState === 'NL_ANSWER' && (
            <div className="w-full">
                {!isContestant ? (
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Watch for voting</h2>
                    <p className="text-slate-400">Contestants are answering.</p>
                  </div>
                ) : submitted ? (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4">Answer Submitted!</h2>
                        <p className="text-slate-400">Waiting for others...</p>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-4">
                          <div className="text-sm font-black tracking-widest text-slate-400">PROMPT</div>
                          <h2 className="text-xl font-bold">{prompt}</h2>
                        </div>
                        <textarea 
                            className="w-full h-40 bg-slate-800 p-4 rounded-xl text-lg mb-4 focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                            placeholder="Type something funny..."
                            value={answerDraft}
                            onChange={(e) => setAnswerDraft(e.target.value)}
                        />
                        <WoodenButton 
                            variant="red"
                            onClick={() => {
                                const text = answerDraft.trim();
                                if (text) handleSubmitAnswer(text);
                            }}
                            className="w-full"
                        >
                            SUBMIT
                        </WoodenButton>
                    </>
                )}
            </div>
        )}

        {gameState === 'DP_PRESENTING' && (
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Presentation Time!</h2>
                <p className="text-slate-400">Look at the main screen.</p>
                {playerId === currentPresenterId && (
                    <p className="text-pink-500 font-bold mt-4 animate-pulse">IT'S YOUR TURN!</p>
                )}
            </div>
        )}

        {gameState === 'DP_INVESTING' && (
            <div className="w-full max-w-md mx-auto text-center">
                {playerId === currentPresenterId ? (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">Investors are deciding...</h2>
                        <p className="text-slate-400">Good luck!</p>
                    </div>
                ) : submitted ? (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">Investment Locked!</h2>
                        <p className="text-slate-400">Waiting for results...</p>
                    </div>
                ) : (
                    <>
                        <h2 className="text-xl font-bold mb-2">Invest in this invention?</h2>
                        <p className="text-slate-400 mb-6">You have ${room?.players?.find(p => p.id === playerId)?.score ?? 0}</p>
                        
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="number"
                                value={investmentAmount}
                                onChange={(e) => setInvestmentAmount(e.target.value)}
                                className="w-full p-4 bg-slate-800 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-green-500 outline-none"
                                placeholder="$0"
                                min="0"
                                max={room?.players?.find(p => p.id === playerId)?.score ?? 0}
                            />
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <button type="button" onClick={() => setInvestmentAmount('0')} className="bg-slate-700 p-2 rounded">0</button>
                            <button type="button" onClick={() => setInvestmentAmount('100')} className="bg-slate-700 p-2 rounded">100</button>
                            <button type="button" onClick={() => setInvestmentAmount('500')} className="bg-slate-700 p-2 rounded">500</button>
                        </div>

                        <WoodenButton 
                            variant="red"
                            onClick={handleInvest}
                            className="w-full"
                        >
                            INVEST
                        </WoodenButton>
                    </>
                )}
            </div>
        )}

        {gameState === 'NL_VOTING' && (
            <div className="w-full">
                {isContestant ? (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4">Audience Voting</h2>
                        <p className="text-slate-400">You are in this round, so you can't vote.</p>
                    </div>
                ) : submitted ? (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4">Vote Cast!</h2>
                        <p className="text-slate-400">Look at the main screen.</p>
                    </div>
                ) : (
                    <>
                      <div className="text-center mb-4">
                        <h2 className="text-xl font-bold">
                        {gameId === 'dubiously-patented' ? 'Vote for the best invention' : 'Vote for the best answer'}
                        </h2>
                        {room?.promptText && (
                        <div className="text-slate-400 mt-2">Prompt: {room.promptText}</div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {votingOptions.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleVote(idx)}
                            className="p-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-lg font-bold text-left"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </>
                )}
            </div>
        )}

        {(gameState === 'NL_RESULTS' || gameState === 'DP_RESULTS') && (
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Round Over</h2>
                <p className="text-slate-400">Check the scores on the main screen.</p>
                {isController && (
                  <div className="mt-8 max-w-sm mx-auto">
                    <WoodenButton type="button" variant="red" onClick={handleNextRound} className="w-full">
                      {gameState === 'DP_RESULTS' ? 'FINISH' : 'NEXT ROUND'}
                    </WoodenButton>
                  </div>
                )}
            </div>
        )}

        {/* Autism Quiz - Question */}
        {gameState === 'AQ_QUESTION' && aqQuestion && (
          <div className="text-center">
            <div className="text-sm text-slate-400 mb-2">
              Question {aqQuestion.questionNumber} of {aqQuestion.totalQuestions}
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-4">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${(aqQuestion.questionNumber / aqQuestion.totalQuestions) * 100}%` }}
              />
            </div>
            {/* Timer */}
            <div className={`text-4xl font-black mb-4 ${aqTimeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
              {aqTimeLeft}<span className="text-xl">s</span>
            </div>
            
            {!aqAnswered ? (
              <>
                <p className="text-xl mb-8 px-4">{aqQuestion.questionText}</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <WoodenButton 
                    type="button" 
                    variant="wood" 
                    onClick={() => {
                      socket.emit('game_action', { action: 'AQ_ANSWER', questionId: aqQuestion.questionId, agreed: true });
                      setAqAnswered(true);
                    }}
                    className="px-6 py-4 text-lg"
                  >
                    AGREE
                  </WoodenButton>
                  <WoodenButton 
                    type="button" 
                    variant="wood" 
                    onClick={() => {
                      socket.emit('game_action', { action: 'AQ_ANSWER', questionId: aqQuestion.questionId, agreed: 'neutral' });
                      setAqAnswered(true);
                    }}
                    className="px-6 py-4 text-lg opacity-80"
                  >
                    NEUTRAL
                  </WoodenButton>
                  <WoodenButton 
                    type="button" 
                    variant="red" 
                    onClick={() => {
                      socket.emit('game_action', { action: 'AQ_ANSWER', questionId: aqQuestion.questionId, agreed: false });
                      setAqAnswered(true);
                    }}
                    className="px-6 py-4 text-lg"
                  >
                    DISAGREE
                  </WoodenButton>
                </div>
              </>
            ) : (
              <div className="py-8">
                <p className="text-slate-400 text-lg">Waiting for other players...</p>
              </div>
            )}
          </div>
        )}

        {/* Autism Quiz - Results */}
        {gameState === 'AQ_RESULTS' && aqResults && (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">🎉 Results 🎉</h2>
            {aqResults.winnerId === playerId ? (
              <div className="mb-6">
                <p className="text-green-400 text-xl font-bold">YOU WON!</p>
                <p className="text-slate-400">Certified Least Autistic</p>
              </div>
            ) : aqResults.loserId === playerId ? (
              <div className="mb-6">
                <p className="text-purple-400 text-xl font-bold">CONGRATULATIONS!</p>
                <p className="text-slate-400">Certified Most Autistic</p>
              </div>
            ) : (
              <p className="text-slate-400 mb-6">Better luck next time!</p>
            )}
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Rankings:</h3>
              <div className="space-y-1">
                {aqResults.rankings.map((r, i) => (
                  <div key={r.id} className={`${r.id === playerId ? 'text-yellow-400 font-bold' : 'text-slate-300'}`}>
                    #{i + 1} {r.name} - Score: {r.score}
                  </div>
                ))}
              </div>
            </div>

            {aqResults.winnerId === playerId && (
              <WoodenButton
                type="button"
                variant="wood"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = aqResults.certificate;
                  link.download = 'certified-least-autistic.svg';
                  link.click();
                }}
                className="mb-4"
              >
                📜 DOWNLOAD CERTIFICATE
              </WoodenButton>
            )}

            {aqResults.loserId === playerId && (
              <WoodenButton
                type="button"
                variant="wood"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = aqResults.loserCertificate;
                  link.download = 'certified-most-autistic.svg';
                  link.click();
                }}
                className="mb-4"
              >
                🧩 DOWNLOAD CERTIFICATE
              </WoodenButton>
            )}

            {isController && (
              <div className="mt-4">
                <WoodenButton type="button" variant="red" onClick={handleNextRound} className="w-full max-w-sm">
                  FINISH
                </WoodenButton>
              </div>
            )}
          </div>
        )}

        {/* Scribble Scrabble - Word Pick (Drawer) */}
        {gameState === 'SC_WORD_PICK' && room?.scDrawerId === playerId && (
          <div className="text-center w-full max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-2 text-orange-400">🎨 You're Drawing!</h2>
            <p className="text-slate-400 mb-6">Pick a word to draw:</p>
            <div className="flex flex-col gap-3">
              {scWordOptions.map(word => (
                <WoodenButton
                  key={word}
                  type="button"
                  variant="wood"
                  onClick={() => {
                    socket.emit('game_action', { action: 'SC_PICK_WORD', word });
                    setScWordOptions([]);
                  }}
                  className="w-full text-xl py-4"
                >
                  {word.toUpperCase()}
                </WoodenButton>
              ))}
            </div>
          </div>
        )}

        {/* Scribble Scrabble - Word Pick (Waiting) */}
        {gameState === 'SC_WORD_PICK' && room?.scDrawerId !== playerId && (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2 text-orange-400">🎨 Get Ready!</h2>
            <p className="text-slate-400">{room?.scDrawerName} is picking a word...</p>
          </div>
        )}

        {/* Scribble Scrabble - Drawing (Drawer) */}
        {gameState === 'SC_DRAWING' && room?.scDrawerId === playerId && (
          <div className="w-full max-w-lg mx-auto">
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-orange-400 mb-1">
                {scTimeLeft}<span className="text-xl">s</span>
              </div>
              <p className="text-slate-400 text-sm">Round {room?.scCurrentRound}/{room?.scTotalRounds}</p>
            </div>
            
            <ScribbleCanvas
              mode="draw"
              width={800}
              height={600}
              onStroke={(stroke: { points: { x: number; y: number }[]; color: string; width: number }) => {
                socket.emit('game_action', { action: 'SC_DRAW_STROKE', stroke });
              }}
              onClear={() => {
                socket.emit('game_action', { action: 'SC_CLEAR_CANVAS' });
              }}
              className="mx-auto"
            />
            
            <div className="mt-4 flex justify-center">
              <WoodenButton
                type="button"
                variant="wood"
                onClick={() => {
                  socket.emit('game_action', { action: 'SC_REVEAL_HINT' });
                }}
                className="text-sm"
              >
                💡 REVEAL A LETTER
              </WoodenButton>
            </div>
          </div>
        )}

        {/* Scribble Scrabble - Drawing (Guesser) */}
        {gameState === 'SC_DRAWING' && room?.scDrawerId !== playerId && (
          <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-orange-400 mb-1">
                {scTimeLeft}<span className="text-xl">s</span>
              </div>
              <p className="text-slate-400 text-sm mb-2">{room?.scDrawerName} is drawing</p>
              <div className="text-3xl font-mono tracking-widest text-white mb-2">
                {room?.scWordHint}
              </div>
              <p className="text-slate-400 text-sm">Round {room?.scCurrentRound}/{room?.scTotalRounds}</p>
            </div>
            
            {room?.scCorrectGuessers?.includes(playerId) ? (
              <div className="text-center py-8">
                <p className="text-green-400 text-2xl font-bold">✓ You got it!</p>
                <p className="text-slate-400">Waiting for others...</p>
              </div>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                if (scGuessDraft.trim()) {
                  socket.emit('game_action', { action: 'SC_GUESS', guess: scGuessDraft.trim() });
                  setScGuessDraft('');
                }
              }} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={scGuessDraft}
                  onChange={(e) => setScGuessDraft(e.target.value)}
                  placeholder="Type your guess..."
                  className="flex-1 p-3 bg-slate-800 rounded-lg text-lg focus:ring-2 focus:ring-orange-500 outline-none"
                  autoComplete="off"
                />
                <WoodenButton type="submit" variant="red" className="px-6">
                  GUESS
                </WoodenButton>
              </form>
            )}
            
            {/* Guess chat */}
            <div className="bg-slate-800 rounded-lg p-3 h-48 overflow-y-auto">
              {scGuessChat.length === 0 ? (
                <p className="text-slate-500 text-center">Guesses will appear here...</p>
              ) : (
                <div className="space-y-1">
                  {scGuessChat.map((g, i) => (
                    <div key={i} className={`text-sm ${
                      g.isCorrect ? 'text-green-400 font-bold' : 
                      g.isClose ? 'text-yellow-400' : 
                      'text-slate-300'
                    }`}>
                      <span className="font-semibold">{g.playerName}:</span> {g.guess}
                      {g.isClose && !g.isCorrect && <span className="ml-1 text-yellow-500">Close!</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scribble Scrabble - Round Results */}
        {gameState === 'SC_ROUND_RESULTS' && (
          <div className="text-center w-full max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-2 text-orange-400">⏱️ Time's Up!</h2>
            <p className="text-3xl font-bold text-white mb-4">
              The word was: <span className="text-yellow-400">{scRoundWord.toUpperCase()}</span>
            </p>
            
            <div className="bg-slate-800 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-semibold mb-2">Current Scores:</h3>
              <div className="space-y-1">
                {Object.entries(scRoundScores)
                  .sort(([,a], [,b]) => b - a)
                  .map(([pid, score], i) => {
                    const player = room?.players?.find(p => p.id === pid);
                    return (
                      <div key={pid} className={`${pid === playerId ? 'text-yellow-400 font-bold' : 'text-slate-300'}`}>
                        #{i + 1} {player?.name ?? 'Unknown'} - {score} pts
                      </div>
                    );
                  })}
              </div>
            </div>
            
            {isController && (
              <WoodenButton type="button" variant="red" onClick={handleNextRound} className="w-full">
                {(room?.scCurrentRound ?? 1) >= (room?.scTotalRounds ?? 1) ? 'SEE FINAL RESULTS' : 'NEXT ROUND'}
              </WoodenButton>
            )}
            {!isController && (
              <p className="text-slate-400">Waiting for controller...</p>
            )}
          </div>
        )}

        {/* Card Calamity - Playing */}
        {(gameState === 'CC_PLAYING' || gameState === 'CC_PICK_COLOR') && (
          <div className="w-full flex flex-col">
            {/* Top info bar */}
            <div className="flex justify-between items-center mb-2 px-2">
              <div className="flex items-center gap-2">
                {room?.ccActiveColor && <ActiveColorIndicator color={room.ccActiveColor} />}
              </div>
              {ccTimeLeft > 0 && (
                <div className={`text-2xl font-mono font-bold ${ccTimeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {ccTimeLeft}s
                </div>
              )}
            </div>

            {/* Your turn indicator / info */}
            <div className="text-center mb-4">
              {room?.ccCurrentPlayerId === playerId ? (
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="text-2xl font-bold text-yellow-400"
                >
                  🎯 YOUR TURN!
                </motion.div>
              ) : gameState === 'CC_PICK_COLOR' && room?.ccPendingWildPlayerId === playerId ? (
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="text-2xl font-bold text-purple-400"
                >
                  🎨 PICK A COLOR!
                </motion.div>
              ) : (
                <div className="text-lg text-slate-400">
                  Waiting for <span className="text-white font-bold">{room?.ccCurrentPlayerName}</span>...
                </div>
              )}
              
              {room?.ccDrawStack && room.ccDrawStack > 0 && (
                <div className="text-xl font-bold text-red-400 animate-pulse mt-2">
                  +{room.ccDrawStack} cards to draw!
                </div>
              )}
            </div>

            {/* Color Picker (if picking color) */}
            {gameState === 'CC_PICK_COLOR' && room?.ccPendingWildPlayerId === playerId && (
              <div className="flex justify-center mb-6">
                <ColorPicker 
                  onPick={(color) => {
                    socket.emit('game_action', { action: 'CC_PICK_COLOR', color });
                  }}
                />
              </div>
            )}

            {/* Hand display */}
            <div className="mt-4">
              {ccIsDealing ? (
                /* Dealing animation */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <motion.div
                    animate={{ 
                      rotate: [0, -10, 10, -10, 10, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="text-6xl mb-4"
                  >
                    🃏
                  </motion.div>
                  <motion.p
                    className="text-xl font-bold text-yellow-400"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    Dealing cards...
                  </motion.p>
                </motion.div>
              ) : (
                <>
                  <div className="text-sm text-slate-400 text-center mb-2">
                    Your hand ({ccHand.length} cards)
                  </div>
                  
                  <div className="overflow-visible pt-6 pb-4">
                    <div className="flex gap-3 px-4 min-w-min justify-center flex-wrap">
                      <AnimatePresence mode="popLayout">
                        {ccHand.map((card, index) => {
                          const isMyTurn = room?.ccCurrentPlayerId === playerId && gameState === 'CC_PLAYING';
                          const isSelected = ccSelectedCardId === card.id;
                          
                          // Check if card is playable
                          let isPlayable = false;
                          if (isMyTurn && room?.ccActiveColor) {
                            const topCard = room.ccTopCard;
                            // Wild cards always playable
                            if (card.type === 'wild' || card.type === 'wild4') {
                              isPlayable = !room.ccDrawStack || room.ccDrawStack === 0 || (!!room.ccStackingEnabled && card.type === 'wild4' && topCard?.type === 'wild4');
                            } else if (room.ccDrawStack && room.ccDrawStack > 0) {
                              // Can only stack if enabled and matching
                              isPlayable = !!room.ccStackingEnabled && card.type === 'draw2' && topCard?.type === 'draw2';
                            } else {
                              // Match color or type/value
                              isPlayable = card.color === room.ccActiveColor || 
                                (card.type === 'number' && topCard?.type === 'number' && card.value === topCard?.value) ||
                                (card.type === topCard?.type && card.type !== 'number');
                            }
                          }
                          
                          return (
                            <motion.div
                              key={card.id}
                              layout
                              initial={{ scale: 0, rotate: -180, y: -100, opacity: 0 }}
                              animate={{ 
                                scale: 1, 
                                rotate: 0,
                                y: isSelected ? -20 : 0,
                                opacity: 1
                              }}
                              exit={{ scale: 0, x: -100 }}
                              transition={{ 
                                type: 'spring', 
                                stiffness: 200,
                                damping: 50,
                                delay: index * 0.1 // Stagger the cards
                              }}
                            >
                              <CardCalamityCard
                                card={card}
                                disabled={!isMyTurn || !isPlayable}
                                selected={isSelected}
                                small
                                onClick={() => {
                                  if (!isMyTurn || !isPlayable) return;
                                  
                                  if (isSelected) {
                                    // Play the card
                                    socket.emit('game_action', { action: 'CC_PLAY_CARD', cardId: card.id });
                                    setCcSelectedCardId(null);
                                  } else {
                                    // Select the card
                                    setCcSelectedCardId(card.id);
                                  }
                                }}
                              />
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Draw button */}
            {room?.ccCurrentPlayerId === playerId && gameState === 'CC_PLAYING' && (
              <div className="mt-4 px-4">
                <WoodenButton
                  type="button"
                  variant="wood"
                  onClick={() => {
                    socket.emit('game_action', { action: 'CC_DRAW_CARD' });
                    setCcSelectedCardId(null);
                  }}
                  className="w-full"
                >
                  📥 DRAW {room.ccDrawStack && room.ccDrawStack > 0 ? `(+${room.ccDrawStack})` : 'CARD'}
                </WoodenButton>
              </div>
            )}
          </div>
        )}

        {/* Card Calamity - Results */}
        {gameState === 'CC_RESULTS' && (
          <div className="text-center w-full max-w-md mx-auto">
            {room?.ccWinnerId === playerId ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring' }}
              >
                <h1 className="text-4xl font-black text-yellow-400 mb-4">🏆 YOU WIN! 🏆</h1>
              </motion.div>
            ) : (
              <h1 className="text-3xl font-bold text-slate-300 mb-4">
                {room?.ccWinnerName} wins!
              </h1>
            )}
            
            <div className="bg-slate-800 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-semibold mb-2">Final Scores:</h3>
              <div className="space-y-1">
                {room?.players
                  ?.sort((a, b) => {
                    if (a.id === room?.ccWinnerId) return -1;
                    if (b.id === room?.ccWinnerId) return 1;
                    return b.score - a.score;
                  })
                  .map((player, i) => (
                    <div key={player.id} className={`flex justify-between ${player.id === playerId ? 'text-yellow-400 font-bold' : 'text-slate-300'}`}>
                      <span>{player.id === room?.ccWinnerId ? '👑' : `#${i + 1}`} {player.name}</span>
                      <span>{player.score} pts</span>
                    </div>
                  ))}
              </div>
            </div>
            
            {isController ? (
              <div className="flex flex-col gap-4">
                <WoodenButton 
                  type="button" 
                  variant="wood" 
                  onClick={() => {
                    socket.emit('game_action', { action: 'PLAY_AGAIN' });
                  }} 
                  className="px-6 py-3 w-full"
                >
                  PLAY AGAIN
                </WoodenButton>
                <WoodenButton 
                  type="button" 
                  variant="red" 
                  onClick={() => {
                    socket.emit('game_action', { action: 'NEW_LOBBY' });
                    setJoined(false);
                    setRoom(null);
                    setCcHand([]);
                    if (roomCode) {
                      try {
                        localStorage.removeItem(`playerId:${roomCode.toUpperCase()}`);
                      } catch {
                        // ignore
                      }
                    }
                  }} 
                  className="px-6 py-3 w-full"
                >
                  NEW LOBBY
                </WoodenButton>
                <p className="text-sm text-slate-400 mt-2">
                  "Play Again" returns to lobby with same players.<br/>
                  "New Lobby" creates a fresh room.
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-slate-400 mb-4">Waiting for controller to decide...</p>
                <WoodenButton type="button" variant="wood" onClick={() => {
                  setJoined(false);
                  setRoom(null);
                  setCcHand([]);
                  if (roomCode) {
                    try {
                      localStorage.removeItem(`playerId:${roomCode.toUpperCase()}`);
                    } catch {
                      // ignore
                    }
                  }
                }} className="px-6 py-3">
                  LEAVE
                </WoodenButton>
              </div>
            )}
          </div>
        )}

        {/* Scribble Scrabble: Scrambled - Drawing */}
        {gameState === 'SSS_DRAWING' && (
          <div className="w-full max-w-lg mx-auto px-1 sm:px-0">
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-purple-400 mb-1">
                {sssTimeLeft}<span className="text-xl">s</span>
              </div>
              <p className="text-slate-400 text-sm">Round {room?.sssRound}/{room?.totalRounds}</p>
            </div>
            
            {sssIsRealPrompt && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg p-3 mb-4 text-center"
              >
                <p className="text-lg font-bold text-white">🎯 YOU HAVE THE REAL PROMPT!</p>
              </motion.div>
            )}
            
            <div className="bg-slate-800 rounded-lg p-4 mb-4 text-center">
              <p className="text-slate-400 text-sm mb-1">Your prompt:</p>
              <p className="text-2xl font-bold text-white">{sssPrompt}</p>
            </div>
            
            {sssDrawingSubmitted ? (
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-green-400 text-2xl font-bold mb-2"
                >
                  ✓ Drawing Submitted!
                </motion.div>
                <p className="text-slate-400">
                  Waiting for others... ({room?.sssDrawingsSubmitted}/{room?.sssActivePlayerCount})
                </p>
              </div>
            ) : (
              <>
                <div className="w-full flex justify-center mb-2">
                  <div className="w-full max-w-xs">
                    <ScribbleCanvas
                      ref={sssCanvasRef}
                      mode="draw"
                      width={400}
                      height={300}
                      onStroke={() => {}}
                      onClear={() => {}}
                      className="w-full h-auto mx-auto rounded-lg"
                    />
                  </div>
                </div>
                <WoodenButton
                  type="button"
                  variant="red"
                  onClick={() => {
                    if (sssCanvasRef.current) {
                      const drawing = sssCanvasRef.current.getDataURL();
                      socket.emit('game_action', { action: 'SSS_SUBMIT_DRAWING', drawing });
                      setSssDrawingSubmitted(true);
                    }
                  }}
                  className="w-full py-2 text-base sm:text-lg"
                >
                  SUBMIT DRAWING
                </WoodenButton>
              </>
            )}
          </div>
        )}

        {/* Scribble Scrabble: Scrambled - Voting */}
        {gameState === 'SSS_VOTING' && (
          <div className="w-full max-w-lg mx-auto px-1 sm:px-0">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-purple-400 mb-2">🗳️ Vote!</h2>
              <p className="text-slate-400">Which drawing had the REAL prompt?</p>
              <p className="text-sm text-slate-500 mt-1">
                Votes: {room?.sssVotesSubmitted}/{room?.sssActivePlayerCount}
              </p>
            </div>
            
            {sssVoteSubmitted ? (
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-green-400 text-2xl font-bold mb-2"
                >
                  ✓ Vote Submitted!
                </motion.div>
                <p className="text-slate-400">Waiting for others...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-2 sm:mb-4">
                  {Object.entries(room?.sssDrawings ?? {})
                    .filter(([pid]) => pid !== playerId)
                    .map(([pid, drawing]) => {
                      const player = room?.players?.find(p => p.id === pid);
                      const isSelected = sssSelectedVote === pid;
                      return (
                        <motion.button
                          key={pid}
                          onClick={() => setSssSelectedVote(pid)}
                          className={`relative rounded-lg overflow-hidden border-4 transition-all ${
                            isSelected
                              ? 'border-purple-500 scale-105'
                              : 'border-transparent hover:border-slate-600'
                          }`}
                          whileTap={{ scale: 0.95 }}
                        >
                          {drawing ? (
                            <img
                              src={drawing}
                              alt={`Drawing by ${player?.name}`}
                              className="w-full aspect-[4/3] object-contain bg-white max-w-full h-auto"
                            />
                          ) : (
                            <div className="w-full aspect-[4/3] bg-slate-700 flex items-center justify-center">
                              <span className="text-slate-500">No drawing</span>
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                              ✓
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                </div>
                
                <WoodenButton
                  type="button"
                  variant="red"
                  onClick={() => {
                    if (sssSelectedVote) {
                      socket.emit('game_action', { action: 'SSS_VOTE', votedForPlayerId: sssSelectedVote });
                      setSssVoteSubmitted(true);
                    }
                  }}
                  disabled={!sssSelectedVote}
                  className={`w-full py-2 text-base sm:text-lg ${!sssSelectedVote ? 'opacity-50' : ''}`}
                >
                  CONFIRM VOTE
                </WoodenButton>
              </>
            )}
          </div>
        )}

        {/* Scribble Scrabble: Scrambled - Results */}
        {gameState === 'SSS_RESULTS' && sssResults && (
          <div className="w-full max-w-lg mx-auto">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-purple-400 mb-2">📊 Round Results</h2>
              <p className="text-slate-400">Round {room?.sssRound}/{room?.totalRounds}</p>
            </div>
            
            {/* Personal score breakdown */}
            <div className="bg-slate-800 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-white mb-2">Your Round:</h3>
              <div className="space-y-1">
                {sssResults.roundScores[playerId]?.tricked > 0 && (
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="text-green-400"
                  >
                    Tricked {sssResults.roundScores[playerId].tricked} player(s): +{sssResults.roundScores[playerId].tricked}
                  </motion.div>
                )}
                {sssResults.roundScores[playerId]?.correct && (
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-green-400"
                  >
                    Correct guess: +2
                  </motion.div>
                )}
                {!sssResults.roundScores[playerId]?.tricked && !sssResults.roundScores[playerId]?.correct && (
                  <div className="text-slate-400">No points this round</div>
                )}
              </div>
            </div>
            
            {/* Real prompt reveal */}
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg p-4 mb-4 text-center">
              <p className="text-sm text-white/80 mb-1">The REAL prompt was:</p>
              <p className="text-xl font-bold text-white">{sssResults.realPrompt}</p>
              <p className="text-sm text-white/80 mt-1">
                by {room?.players?.find(p => p.id === sssResults.realDrawerId)?.name}
                {sssResults.realDrawerId === playerId && " (You!)"}
              </p>
            </div>
            
            {/* All prompts that were in play */}
            <div className="bg-slate-800 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-white mb-2">All Prompts:</h3>
              <div className="space-y-1 text-sm">
                {Object.entries(sssResults.allPrompts).map(([pid, prompt]) => {
                  const player = room?.players?.find(p => p.id === pid);
                  const isReal = pid === sssResults.realDrawerId;
                  return (
                    <div key={pid} className={isReal ? 'text-yellow-400 font-semibold' : 'text-slate-300'}>
                      {player?.name}: "{prompt}" {isReal && '(REAL)'}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Current standings */}
            <div className="bg-slate-800 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-white mb-2">Standings:</h3>
              <div className="space-y-1">
                {Object.entries(sssResults.totalScores)
                  .sort(([,a], [,b]) => b - a)
                  .map(([pid, score], i) => {
                    const player = room?.players?.find(p => p.id === pid);
                    return (
                      <div key={pid} className={`flex justify-between ${pid === playerId ? 'text-yellow-400 font-bold' : 'text-slate-300'}`}>
                        <span>#{i + 1} {player?.name}</span>
                        <span>{score} pts</span>
                      </div>
                    );
                  })}
              </div>
            </div>
            
            {isController && (
              <WoodenButton
                type="button"
                variant="red"
                onClick={() => {
                  socket.emit('game_action', { action: 'NEXT_ROUND' });
                }}
                className="w-full"
              >
                {(room?.sssRound ?? 0) < (room?.totalRounds ?? 0) ? 'NEXT ROUND' : 'SEE FINAL RESULTS'}
              </WoodenButton>
            )}
          </div>
        )}

        {gameState === 'END' && (
            <div className="text-center">
                <h2 className="text-3xl font-bold mb-4">GAME OVER</h2>
                {isController ? (
                  <div className="flex flex-col gap-4">
                    <WoodenButton 
                      type="button" 
                      variant="wood" 
                      onClick={() => {
                        socket.emit('game_action', { action: 'PLAY_AGAIN' });
                      }} 
                      className="px-6 py-3 w-full"
                    >
                      PLAY AGAIN
                    </WoodenButton>
                    <WoodenButton 
                      type="button" 
                      variant="red" 
                      onClick={() => {
                        socket.emit('game_action', { action: 'NEW_LOBBY' });
                        // Reset local state and go back to join screen
                        setJoined(false);
                        setRoom(null);
                        setError('');
                        setSubmitted(false);
                        setPrompt('');
                        setVotingOptions([]);
                        setAnswerDraft('');
                        setPromptDraft('');
                        setProblemsDraft(['', '', '']);
                        setDpChoices([]);
                        setDpSelected('');
                        setDrawingDraft('');
                        setInvestmentAmount('');
                        if (roomCode) {
                          try {
                            localStorage.removeItem(`playerId:${roomCode.toUpperCase()}`);
                          } catch {
                            // ignore
                          }
                        }
                      }} 
                      className="px-6 py-3 w-full"
                    >
                      NEW LOBBY
                    </WoodenButton>
                    <p className="text-sm text-slate-400 mt-2">
                      "Play Again" returns to lobby with same players.<br/>
                      "New Lobby" creates a fresh room.
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-slate-400 mb-4">Waiting for controller to decide...</p>
                    <WoodenButton type="button" variant="wood" onClick={() => {
                      setJoined(false);
                      setRoom(null);
                      setError('');
                      setSubmitted(false);
                      setPrompt('');
                      setVotingOptions([]);
                      setAnswerDraft('');
                      setPromptDraft('');
                      setProblemsDraft(['', '', '']);
                      setDpChoices([]);
                      setDpSelected('');
                      setDrawingDraft('');
                      setInvestmentAmount('');
                      if (roomCode) {
                        try {
                          localStorage.removeItem(`playerId:${roomCode.toUpperCase()}`);
                        } catch {
                          // ignore
                        }
                      }
                    }} className="px-6 py-3">
                      LEAVE
                    </WoodenButton>
                  </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}
