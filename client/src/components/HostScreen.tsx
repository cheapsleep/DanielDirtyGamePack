import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { socket, socketServerUrl } from '../socket';
import DrawingCanvas, { useStrokeReceiver } from './DrawingCanvas';
import CardCalamityCard, { ActiveColorIndicator, DirectionIndicator, CCCard } from './CardCalamityCard';

interface Player {
  id: string;
  name: string;
  score: number;
  isConnected: boolean;
  isBot?: boolean;
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
  | 'END';

interface RoomState {
  code: string;
  gameId?: string;
  players: Player[];
  controllerPlayerId?: string;
  state: GameState;
  currentRound: number;
  totalRounds: number;
  contestants?: { id: string; name: string }[];
  promptSubmissions?: number;
  problemsSubmitted?: number;
  problemsTotal?: number;
  selectionsMade?: number;
  dpDrawings?: Record<string, string>;
  currentPresenterId?: string;
  currentInvestments?: Record<string, number>;
  currentDrawing?: string;
  currentTitle?: string;
  currentProblem?: string;
  promptText?: string;
  // Autism Quiz fields
  aqCurrentQuestion?: number;
  aqAnsweredCount?: number;
  aqScores?: Record<string, number>;
  // Scribble Scrabble fields
  scDrawerId?: string;
  scDrawerName?: string;
  scWordHint?: string;
  scCurrentRound?: number;
  scTotalRounds?: number;
  scCorrectGuessers?: string[];
  scScores?: Record<string, number>;
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
}

import WoodenButton from './WoodenButton';

interface HostScreenProps {
  onBack: () => void;
  gameId: string;
}

export default function HostScreen({ onBack, gameId }: HostScreenProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [votingOptions, setVotingOptions] = useState<string[]>([]);
  const [roundResults, setRoundResults] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [retryKey, setRetryKey] = useState(0);
  const [presentationData, setPresentationData] = useState<{
      presenterId: string;
      drawing: string;
      title: string;
      prompt: string;
  } | null>(null);
  // Autism Quiz state
  const [aqQuestion, setAqQuestion] = useState<{ questionId: number; questionText: string; questionNumber: number; totalQuestions: number } | null>(null);
  const [aqResults, setAqResults] = useState<{ rankings: { id: string; name: string; score: number }[]; winnerId: string; winnerName: string; certificate: string; loserId: string; loserName: string; loserCertificate: string } | null>(null);
  
  // Scribble Scrabble state
  const [scGuessChat, setScGuessChat] = useState<{ playerName: string; guess: string; isCorrect: boolean; isClose: boolean }[]>([]);
  const [scRoundWord, setScRoundWord] = useState<string>('');
  const [scRoundScores, setScRoundScores] = useState<Record<string, number>>({});
  
  // Card Calamity state
  const [ccTimeLeft, setCcTimeLeft] = useState<number>(30);
  
  // Initialize stroke receiver for SC
  const strokeReceiver = useStrokeReceiver();
  
  useEffect(() => {
    // Update presentation data whenever a new presenter starts presenting
    if (
      room &&
      (room.state === 'DP_PRESENTING' || room.state === 'DP_INVESTING') &&
      room.currentPresenterId &&
      room.currentDrawing
    ) {
      if (!presentationData || presentationData.presenterId !== room.currentPresenterId) {
        setPresentationData({
          presenterId: room.currentPresenterId,
          drawing: room.currentDrawing,
          title: room.currentTitle || '',
          prompt: room.currentProblem || ''
        });
      }
    } else {
      // Clear presentation data when leaving presentation/investing phases
      if (presentationData) setPresentationData(null);
    }
  }, [room?.state, room?.currentPresenterId, room?.currentDrawing, room?.currentTitle, room?.currentProblem, presentationData]);

  // Reset SC state when starting a new drawing round
  useEffect(() => {
    if (room?.state === 'SC_WORD_PICK') {
      setScGuessChat([]);
      strokeReceiver.clearStrokes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.state, room?.scCurrentRound]);

  const roomCode = room?.code;
  const joinBase =
    ((import.meta as any)?.env?.VITE_JOIN_URL as string | undefined) ??
    window.location.origin;
  const publicServerUrl =
    ((import.meta as any)?.env?.VITE_PUBLIC_SERVER_URL as string | undefined) ?? socketServerUrl;
  const defaultServerUrl = 'https://server.danieldgp.com';
  // Clean URL format: /join/ABCD - only add server param if non-default
  const needsServerParam = publicServerUrl && publicServerUrl !== defaultServerUrl;
  const joinUrl = roomCode ? `${joinBase}/join/${roomCode}${
    needsServerParam ? `?server=${encodeURIComponent(publicServerUrl)}` : ''
  }` : '';
  // Display URL without https://www. prefix
  const displayUrl = joinUrl.replace(/^https?:\/\/(www\.)?/, '');

  useEffect(() => {
    const storageKey = `host:${gameId}`;
    const saved = (() => {
      try {
        return JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as
          | { roomCode: string; hostKey: string }
          | null;
      } catch {
        return null;
      }
    })();

    let didGetRoomUpdate = false;
    let didCreateRoom = false;
    let fallbackTimer: number | undefined;

    const createRoom = () => {
      if (didCreateRoom) return;
      didCreateRoom = true;
      socket.emit('create_room', { gameId });
    };

    const joinOrCreate = () => {
      if (saved?.roomCode && saved?.hostKey) {
        socket.emit('join_room', { roomCode: saved.roomCode, isHost: true, hostKey: saved.hostKey });
      } else {
        createRoom();
      }
    };

    socket.on('room_created', (data: any) => {
      const roomCode = String(data?.roomCode ?? '');
      const hostKey = String(data?.hostKey ?? '');
      if (!roomCode || !hostKey) return;
      sessionStorage.setItem(storageKey, JSON.stringify({ roomCode, hostKey }));
    });

    socket.on('room_update', (roomState: RoomState) => {
      didGetRoomUpdate = true;
      setRoom(roomState);
      // If the game ended, clear saved host info so starting again creates a fresh room
      try {
        if (roomState?.state === 'END') sessionStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    });

    socket.on('new_prompt', (data) => {
      setCurrentPrompt(data.prompt);
      setTimeLeft(data.timeLimit);
    });

    socket.on('start_presentation', (data) => {
      // Server will emit room_update with the authoritative drawing/title/prompt.
      // Only set the timer here to avoid overwriting presentationData before room_update arrives.
      setTimeLeft(data.timeLimit);
    });

    socket.on('start_investing', (data) => {
        // Keep presentation data but update timer
        setTimeLeft(data.timeLimit);
    });

    socket.on('start_voting', (data) => {
        setVotingOptions(data.answers);
        setTimeLeft(data.timeLimit);
    });

    socket.on('round_results', (data) => {
        setRoundResults(data.results);
    });

    socket.on('aq_question', (data) => {
        setAqQuestion(data);
    });

    socket.on('aq_results', (data) => {
        setAqResults(data);
    });

    socket.on('aq_timer', (data: { timeLeft: number; questionNumber: number }) => {
        setTimeLeft(data.timeLeft);
    });

    // Scribble Scrabble events
    socket.on('sc_timer', (data: { timeLeft: number }) => {
        setTimeLeft(data.timeLeft);
    });

    socket.on('sc_guess_chat', (data: { playerName: string; guess: string; isCorrect: boolean; isClose: boolean }) => {
        setScGuessChat(prev => [...prev, data]);
    });

    socket.on('sc_correct_guess', () => {
        // Could show a notification, but room_update handles correctGuessers
    });

    socket.on('sc_stroke_data', (data: { stroke: { points: { x: number; y: number }[]; color: string; width: number } }) => {
        strokeReceiver.addCompleteStroke(data.stroke);
    });

    socket.on('sc_clear_canvas', () => {
        strokeReceiver.clearStrokes();
    });

    socket.on('sc_round_end', (data: { word: string; scores: Record<string, number> }) => {
        setScRoundWord(data.word);
        setScRoundScores(data.scores);
    });

    socket.on('sc_game_end', (data: { finalScores: Record<string, number> }) => {
        setScRoundScores(data.finalScores);
    });

    // Card Calamity events
    socket.on('cc_timer', (data: { timeLeft: number }) => {
        setCcTimeLeft(data.timeLeft);
    });

    socket.on('cc_game_end', () => {
        // Game end handled via room_update
    });

    socket.on('game_over', () => {
        // Handle game over if needed separately, or rely on room state 'END'
    });

    socket.on('error', (data) => {
      const message = String(data?.message ?? 'Unknown error');
      setError(message);
      if (!didGetRoomUpdate && saved?.roomCode && (message.includes('Room not found') || message.includes('Invalid host key'))) {
        sessionStorage.removeItem(storageKey);
        createRoom();
      }
    });

    socket.on('connect_error', () => {
      const target = socketServerUrl ? ` (${socketServerUrl})` : '';
      setError(`Could not connect to game server${target}`);
      if (socketServerUrl) {
        const healthUrl = socketServerUrl.replace(/\/$/, '') + '/health';
        fetch(healthUrl)
          .then(r => (r.ok ? r.json() : null))
          .then(data => {
            if (data?.ok) setError(`Game server is reachable, but Socket.IO failed${target}`);
          })
          .catch(() => {
            // ignore
          });
      }
    });

    socket.on('disconnect', () => {
      setError('Disconnected from game server');
    });

    fallbackTimer = window.setTimeout(() => {
      if (didGetRoomUpdate) return;
      if (saved?.roomCode && saved?.hostKey && !didCreateRoom) return;
      createRoom();
    }, 1500);

    if (socket.connected) {
      joinOrCreate();
    } else {
      socket.once('connect', joinOrCreate);
    }

    return () => {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      socket.off('connect_error');
      socket.off('disconnect');
      socket.off('room_created');
      socket.off('room_update');
      socket.off('new_prompt');
      socket.off('start_presentation');
      socket.off('start_investing');
      socket.off('start_voting');
      socket.off('round_results');
      socket.off('aq_question');
      socket.off('aq_results');
      socket.off('aq_timer');
      socket.off('sc_timer');
      socket.off('sc_guess_chat');
      socket.off('sc_correct_guess');
      socket.off('sc_stroke_data');
      socket.off('sc_clear_canvas');
      socket.off('sc_round_end');
      socket.off('sc_game_end');
      socket.off('cc_timer');
      socket.off('cc_game_end');
      socket.off('game_over');
      socket.off('error');
    };
  }, [gameId, retryKey, strokeReceiver]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleBack = () => {
    socket.emit('close_room');
    sessionStorage.removeItem(`host:${gameId}`);
    onBack();
  };

  const handleRetry = () => {
    try {
      sessionStorage.removeItem(`host:${gameId}`);
    } catch {
      // ignore
    }
    setRoom(null);
    setError('');
    if (!socket.connected) socket.connect();
    setRetryKey(x => x + 1);
  };

  const title = room
    ? (room.gameId ?? gameId) === 'dubiously-patented' 
      ? 'Dubiously Patented' 
      : (room.gameId ?? gameId) === 'autism-assessment'
        ? 'Who Is The Most Autistic?'
        : (room.gameId ?? gameId) === 'scribble-scrabble'
          ? 'Scribble Scrabble'
          : (room.gameId ?? gameId) === 'card-calamity'
            ? 'Card Calamity'
            : 'Nasty Libs'
    : '';
  const gameLogo = room
    ? (room.gameId ?? gameId) === 'dubiously-patented'
      ? '/assets/Dubiously_Patented_Logo.png'
      : (room.gameId ?? gameId) === 'autism-assessment'
        ? '/assets/Autism_Assessment_Logo.png'
        : (room.gameId ?? gameId) === 'scribble-scrabble'
          ? '/assets/Scribble_Scrabble_Logo.png'
          : (room.gameId ?? gameId) === 'card-calamity'
            ? '/assets/Card_Calamity_Logo.svg'
            : '/assets/Nasty_Libs_Logo.svg'
    : '';
  const isPatented = room ? (room.gameId ?? gameId) === 'dubiously-patented' : false;
  const isScribble = room ? (room.gameId ?? gameId) === 'scribble-scrabble' : false;
  const isPromptPhase = room ? room.state === 'NL_ANSWER' : false;
  const isVotingPhase = room ? room.state === 'NL_VOTING' : false;
  const isResultsPhase = room ? room.state === 'NL_RESULTS' || room.state === 'DP_RESULTS' : false;
  const isNastySetup = room ? room.state === 'NL_PROMPT_SUBMIT' : false;
  
  const controllerName = room
    ? room.players.find(p => p.id === room.controllerPlayerId)?.name ?? 'Nobody yet'
    : '';

  if (!room) {
    return (
      <div className="w-full h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-2xl text-center">
          <div className="text-2xl animate-pulse mb-6">Creating Room...</div>
          
          <div className="text-xs text-slate-500 font-mono mb-4">
            Target: {socketServerUrl || 'Auto (window.location)'} <br/>
            Env: {import.meta.env.MODE} | Prod: {String(import.meta.env.PROD)} <br/>
            EnvURL: {import.meta.env.VITE_SERVER_URL || 'Not Set'}
          </div>

          {error && (
            <div className="w-full mb-6 p-4 bg-red-900/40 border border-red-600 rounded-lg text-red-200 text-center">
              {error}
            </div>
          )}
          <div className="flex justify-center gap-3">
            <WoodenButton variant="wood" onClick={handleRetry} className="px-6 py-2 text-lg">
              RETRY
            </WoodenButton>
            <WoodenButton variant="wood" onClick={onBack} className="px-6 py-2 text-lg">
              BACK
            </WoodenButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col p-8">
      <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div>
          <h2 className="text-xl text-slate-400">JOIN AT</h2>
          <h1 className="text-4xl font-bold text-blue-400">{displayUrl}</h1>
          <div className="flex items-center gap-4 mt-3">
            {joinUrl && (
              <QRCodeSVG value={joinUrl} size={96} bgColor="#ffffff" fgColor="#000000" className="p-1 bg-white rounded" />
            )}
            <div className="text-sm text-slate-500 uppercase tracking-widest break-words">{title}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
            {gameLogo && (
              <img src={gameLogo} alt={title} className="h-28 object-contain" />
            )}
            <div className="text-center">
              <h2 className="text-xl text-slate-400">ROOM CODE</h2>
              <h1 className="text-6xl font-black text-pink-500 tracking-widest">{room.code}</h1>
              <div className="text-sm text-slate-500 mt-2 uppercase tracking-widest">Controller: {controllerName}</div>
            </div>
        </div>
        <WoodenButton variant="wood" onClick={handleBack} className="px-6 py-2 text-lg">
          {room.state === 'LOBBY' ? 'BACK' : 'QUIT GAME'}
        </WoodenButton>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {error && (
          <div className="w-full max-w-3xl mb-6 p-4 bg-red-900/40 border border-red-600 rounded-lg text-red-200 text-center">
            {error}
          </div>
        )}

        {room.state === 'LOBBY' && (
          <div className="w-full max-w-4xl text-center">
            <h2 className="text-3xl mb-8">Waiting for players...</h2>
            <div className="grid grid-cols-4 gap-4 mb-12">
              {room.players.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 rounded-lg text-xl font-bold ${p.isConnected ? 'bg-indigo-600' : 'bg-red-900 opacity-50'}`}
                >
                  {p.name}
                </div>
              ))}
              {room.players.length === 0 && <p className="col-span-4 text-slate-500">No players yet</p>}
            </div>
            <div className="text-slate-400 text-lg">The first player to join becomes the controller.</div>
          </div>
        )}

        {isNastySetup && (
          <div className="text-center w-full max-w-4xl">
            <h2 className="text-2xl text-slate-400 mb-4">ROUND {room.currentRound} / {room.totalRounds}</h2>
            <h1 className="text-5xl font-bold mb-6 leading-tight">Players are writing prompts</h1>
            <div className="text-slate-300 text-xl mb-10">
              Submissions: {room.promptSubmissions ?? 0}
            </div>
            <div className="text-slate-500 text-lg">
              Contestants: {(room.contestants ?? []).map(c => c.name).join(' vs ') || 'TBD'}
            </div>
          </div>
        )}

        {room.state === 'DP_PROBLEM_SUBMIT' && (
          <div className="text-center w-full max-w-4xl">
            <h1 className="text-5xl font-bold mb-6 leading-tight">Players are submitting problems</h1>
            <div className="text-slate-300 text-2xl">
              {room.problemsSubmitted ?? 0} / {room.problemsTotal ?? 0} submitted
            </div>
          </div>
        )}

        {room.state === 'DP_PICK' && (
          <div className="text-center w-full max-w-4xl">
            <h1 className="text-5xl font-bold mb-6 leading-tight">Players are choosing a problem</h1>
            <div className="text-slate-300 text-2xl">
              {room.selectionsMade ?? 0} / {room.problemsTotal ?? 0} chosen
            </div>
          </div>
        )}

        {room.state === 'DP_DRAWING' && (
          <div className="text-center w-full max-w-4xl">
             <h1 className="text-5xl font-bold mb-6 leading-tight">Players are inventing</h1>
             <div className="text-slate-300 text-2xl mb-8">
                Drawings Submitted: {Object.keys(room.dpDrawings || {}).length} / {room.players.length}
             </div>
             <div className="grid grid-cols-4 gap-4">
                {room.players.map(p => (
                    <div key={p.id} className={`p-4 rounded-lg border-2 ${room.dpDrawings?.[p.id] ? 'bg-green-900/50 border-green-500' : 'bg-slate-800 border-slate-700'}`}>
                        {p.name}
                        {room.dpDrawings?.[p.id] && ' ✓'}
                    </div>
                ))}
             </div>
          </div>
        )}

        {room.state === 'DP_PRESENTING' && presentationData && (
            <div className="w-full h-full flex flex-col items-center justify-center relative">
                 <div className="absolute top-0 right-0 p-4 text-4xl font-black text-white bg-slate-800 rounded-full w-24 h-24 flex items-center justify-center border-4 border-pink-500 z-10">
                    {timeLeft}
                </div>
                <div className="text-center mb-4">
                    <h2 className="text-2xl text-slate-400 mb-2">INVENTION PRESENTATION</h2>
                    <h1 className="text-5xl font-black text-yellow-400 mb-2">{presentationData.title}</h1>
                    <div className="text-xl text-slate-300">By {room.players.find(p => p.id === presentationData.presenterId)?.name}</div>
                </div>
                
                <div className="bg-white p-4 rounded-xl shadow-2xl mb-6">
                    {presentationData.drawing ? (
                      <img 
                        src={presentationData.drawing} 
                        alt="Invention" 
                        className="max-h-[50vh] object-contain"
                        onError={(e) => {
                          console.error('Image failed to load:', presentationData.drawing?.substring(0, 100));
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-96 h-64 bg-slate-200 flex items-center justify-center text-slate-500">
                        No drawing available
                      </div>
                    )}
                </div>

                <div className="bg-slate-800 p-6 rounded-xl max-w-3xl w-full text-center border-2 border-slate-600">
                    <div className="text-sm font-black tracking-widest text-slate-400 mb-2">SOLVES THE PROBLEM</div>
                    <p className="text-2xl">{presentationData.prompt}</p>
                </div>
            </div>
        )}

        {room.state === 'DP_INVESTING' && presentationData && (
            <div className="w-full h-full flex flex-col items-center justify-center relative">
                 <div className="absolute top-0 right-0 p-4 text-4xl font-black text-white bg-slate-800 rounded-full w-24 h-24 flex items-center justify-center border-4 border-green-500 z-10 animate-pulse">
                    {timeLeft}
                </div>
                <h1 className="text-6xl font-black text-green-500 mb-12 animate-bounce">INVEST NOW!</h1>
                
                <div className="grid grid-cols-2 gap-12 items-center w-full max-w-5xl">
                    <div className="text-center">
                        <div className="bg-white p-2 rounded-xl inline-block mb-4 opacity-50">
                            {presentationData.drawing ? (
                              <img 
                                src={presentationData.drawing} 
                                alt="Invention" 
                                className="h-48 object-contain"
                                onError={(e) => {
                                  console.error('Investing image failed:', presentationData.drawing?.substring(0, 100));
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-48 h-48 bg-slate-200 flex items-center justify-center text-slate-500">
                                No image
                              </div>
                            )}
                        </div>
                        <h2 className="text-3xl font-bold">{presentationData.title}</h2>
                    </div>
                    <div className="bg-slate-800 p-8 rounded-xl border-2 border-green-500 h-full flex flex-col justify-center">
                        <h3 className="text-2xl text-slate-400 mb-6 text-center">Current Investments</h3>
                        <div className="grid grid-cols-2 gap-4">
                             {Object.entries(room.currentInvestments || {}).map(([pid, amount]) => {
                                 const p = room.players.find(pl => pl.id === pid);
                                 if (!p || amount <= 0) return null;
                                 return (
                                     <div key={pid} className="flex justify-between items-center bg-slate-900 p-3 rounded">
                                         <span>{p.name}</span>
                                         <span className="text-green-400 font-bold">${amount}</span>
                                     </div>
                                 );
                             })}
                             {Object.keys(room.currentInvestments || {}).length === 0 && (
                                 <div className="col-span-2 text-center text-slate-500 italic">No investments yet...</div>
                             )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {isPromptPhase && (
            <div className="text-center relative">
                <div className="absolute top-0 right-0 p-4 text-4xl font-black text-white bg-slate-800 rounded-full w-24 h-24 flex items-center justify-center border-4 border-pink-500">
                    {timeLeft}
                </div>
                <h2 className="text-2xl text-slate-400 mb-4">ROUND {room.currentRound} / {room.totalRounds}</h2>
                <div className="text-sm font-black tracking-widest text-slate-400 mb-3">
                  {isPatented ? 'PROBLEM' : 'PROMPT'}
                </div>
                <h1 className="text-5xl font-bold mb-12 leading-tight max-w-4xl">{currentPrompt}</h1>
                <div className="animate-pulse text-2xl text-yellow-400">Look at your device!</div>
            </div>
        )}

        {isVotingPhase && (
            <div className="w-full max-w-4xl relative">
                {room?.promptText && (
                  <div className="text-center mb-6">
                    <div className="text-sm font-black tracking-widest text-slate-400">PROMPT</div>
                    <h2 className="text-2xl font-bold mt-2">{room.promptText}</h2>
                  </div>
                )}
                <div className="absolute -top-16 right-0 p-4 text-4xl font-black text-white bg-slate-800 rounded-full w-20 h-20 flex items-center justify-center border-4 border-blue-500">
                    {timeLeft}
                </div>
                <h2 className="text-3xl text-center mb-8">
                  {isPatented ? 'VOTE FOR THE BEST INVENTION' : 'VOTE FOR THE BEST (OR WORST) ANSWER'}
                </h2>
                <div className="grid grid-cols-1 gap-4">
                    {votingOptions.map((opt, idx) => (
                        <div key={idx} className="p-6 bg-slate-800 rounded-xl text-2xl text-center border-2 border-slate-700">
                            {opt}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {isResultsPhase && (
            <div className="w-full max-w-4xl text-center">
                <h2 className="text-4xl mb-8 font-bold">ROUND RESULTS</h2>
                <div className="space-y-4 mb-8">
                    {roundResults.map((res, idx) => (
                        <div key={idx} className="flex justify-between items-center p-4 bg-slate-800 rounded-lg">
                            <div className="text-left">
                                <p className="text-xl font-bold text-pink-400">{res.answer}</p>
                                <p className="text-sm text-slate-400">{res.playerName}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-green-400">+{res.points}</p>
                                <p className="text-sm text-slate-400">{res.votes} Votes</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="text-slate-400 text-lg">Controller advances the game.</div>
            </div>
        )}

        {room.state === 'AQ_QUESTION' && aqQuestion && (
            <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="text-center mb-8">
                    <h2 className="text-2xl text-slate-400 mb-2">QUESTION {aqQuestion.questionNumber} / {aqQuestion.totalQuestions}</h2>
                    <div className="w-full bg-slate-700 rounded-full h-3 mb-4">
                        <div 
                            className="bg-blue-500 h-3 rounded-full transition-all duration-500" 
                            style={{ width: `${(aqQuestion.questionNumber / aqQuestion.totalQuestions) * 100}%` }}
                        />
                    </div>
                    {/* Timer */}
                    <div className={`text-6xl font-black ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                        {timeLeft}<span className="text-3xl">s</span>
                    </div>
                </div>
                
                <div className="bg-slate-800 p-12 rounded-2xl max-w-4xl w-full text-center border-2 border-blue-500">
                    <p className="text-4xl font-bold leading-relaxed">{aqQuestion.questionText}</p>
                </div>
                
                <div className="mt-12 text-center">
                    <div className="animate-pulse text-2xl text-blue-400 mb-4">Answer on your device!</div>
                    <p className="text-slate-400">
                        {room.aqAnsweredCount ?? 0} / {room.players.length} players answered
                    </p>
                </div>
            </div>
        )}

        {room.state === 'AQ_RESULTS' && aqResults && (
            <div className="w-full h-full flex flex-col items-center overflow-y-auto py-8">
                <h1 className="text-4xl font-black text-green-400 mb-2">🏆 CERTIFIED LEAST AUTISTIC 🏆</h1>
                <h2 className="text-3xl font-bold text-white mb-6">{aqResults.winnerName}</h2>
                
                <div className="grid grid-cols-3 gap-6 w-full max-w-6xl px-4">
                    <div className="bg-slate-800 p-4 rounded-xl">
                        <h3 className="text-lg text-slate-400 mb-3 text-center">GROUP RANKINGS</h3>
                        <div className="space-y-2">
                            {aqResults.rankings.map((r, idx) => (
                                <div 
                                    key={r.id} 
                                    className={`flex justify-between items-center p-2 rounded-lg ${idx === 0 ? 'bg-green-900/50 border border-green-500' : idx === aqResults.rankings.length - 1 ? 'bg-purple-900/50 border border-purple-500' : 'bg-slate-900'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold w-6">{idx + 1}</span>
                                        <span className="text-base">{r.name}</span>
                                    </div>
                                    <span className={`text-base font-bold ${idx === 0 ? 'text-green-400' : idx === aqResults.rankings.length - 1 ? 'text-purple-400' : 'text-slate-400'}`}>
                                        {r.score}/20
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-3 text-center">Lower score = Less autistic = Winner!</p>
                    </div>
                    
                    <div className="flex flex-col items-center">
                        <h3 className="text-base text-green-400 mb-2">🏆 Least Autistic</h3>
                        <img 
                            src={aqResults.certificate} 
                            alt="Least Autistic Certificate" 
                            className="w-full rounded-lg shadow-xl border-2 border-yellow-500"
                        />
                        <a
                            href={aqResults.certificate}
                            download={`${aqResults.winnerName}_Least_Autistic_Certificate.svg`}
                            className="mt-3 px-4 py-2 bg-yellow-500 text-black text-sm font-bold rounded-lg hover:bg-yellow-400 transition-colors"
                        >
                            📥 Download
                        </a>
                    </div>
                    
                    <div className="flex flex-col items-center">
                        <h3 className="text-base text-purple-400 mb-2">🧩 Most Autistic</h3>
                        <img 
                            src={aqResults.loserCertificate} 
                            alt="Most Autistic Certificate" 
                            className="w-full rounded-lg shadow-xl border-2 border-purple-500"
                        />
                        <a
                            href={aqResults.loserCertificate}
                            download={`${aqResults.loserName}_Most_Autistic_Certificate.svg`}
                            className="mt-3 px-4 py-2 bg-purple-500 text-white text-sm font-bold rounded-lg hover:bg-purple-400 transition-colors"
                        >
                            📥 Download
                        </a>
                    </div>
                </div>
                
                <WoodenButton 
                  variant="red"
                  onClick={handleBack}
                  className="mt-6"
                >
                  BACK TO MENU
                </WoodenButton>
            </div>
        )}

        {/* Scribble Scrabble - Word Pick */}
        {room.state === 'SC_WORD_PICK' && (
            <div className="w-full h-full flex flex-col items-center justify-center">
                <h2 className="text-2xl text-slate-400 mb-2">ROUND {room.scCurrentRound}/{room.scTotalRounds}</h2>
                <h1 className="text-5xl font-bold mb-8 text-orange-400">🎨 {room.scDrawerName} is picking a word...</h1>
                <div className="animate-pulse text-2xl text-slate-400">Get ready to guess!</div>
            </div>
        )}

        {/* Scribble Scrabble - Drawing */}
        {room.state === 'SC_DRAWING' && (
            <div className="w-full h-full flex gap-6">
                {/* Main drawing area */}
                <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl text-slate-400">ROUND {room.scCurrentRound}/{room.scTotalRounds}</h2>
                            <p className="text-lg text-orange-400">🎨 {room.scDrawerName} is drawing</p>
                        </div>
                        <div className={`text-6xl font-black ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                            {timeLeft}<span className="text-3xl">s</span>
                        </div>
                    </div>
                    
                    {/* Word hint */}
                    <div className="text-center mb-4">
                        <div className="text-5xl font-mono tracking-[0.5em] text-white">
                            {room.scWordHint}
                        </div>
                    </div>
                    
                    {/* Canvas */}
                    <div className="flex-1 overflow-hidden flex items-center justify-center min-h-0">
                        <DrawingCanvas
                            mode="view"
                            width={800}
                            height={600}
                            strokes={strokeReceiver.strokes}
                            className="max-w-full max-h-full rounded-xl"
                        />
                    </div>
                </div>
                
                {/* Sidebar: Guess chat + Leaderboard */}
                <div className="w-80 flex flex-col gap-4">
                    {/* Guess chat */}
                    <div className="flex-1 bg-slate-800 rounded-xl p-4 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-300 mb-3">💬 Guesses</h3>
                        <div className="flex-1 overflow-y-auto space-y-1">
                            {scGuessChat.length === 0 ? (
                                <p className="text-slate-500 text-center text-sm">Waiting for guesses...</p>
                            ) : (
                                scGuessChat.map((g, i) => (
                                    <div key={i} className={`text-sm p-2 rounded ${
                                        g.isCorrect ? 'bg-green-900/50 text-green-400 font-bold' : 
                                        g.isClose ? 'bg-yellow-900/50 text-yellow-400' : 
                                        'text-slate-300'
                                    }`}>
                                        <span className="font-semibold">{g.playerName}:</span> {g.guess}
                                        {g.isClose && !g.isCorrect && <span className="ml-1 text-yellow-500">Close!</span>}
                                        {g.isCorrect && <span className="ml-1">✓</span>}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    
                    {/* Leaderboard */}
                    <div className="bg-slate-800 rounded-xl p-4">
                        <h3 className="text-lg font-bold text-slate-300 mb-3">🏆 Scores</h3>
                        <div className="space-y-1">
                            {Object.entries(room.scScores || {})
                                .sort(([,a], [,b]) => b - a)
                                .map(([pid, score], idx) => {
                                    const player = room.players.find(p => p.id === pid);
                                    const hasGuessed = room.scCorrectGuessers?.includes(pid);
                                    const isDrawer = pid === room.scDrawerId;
                                    return (
                                        <div key={pid} className={`flex justify-between items-center p-2 rounded ${
                                            idx === 0 ? 'bg-yellow-900/30' : 'bg-slate-900/50'
                                        } ${hasGuessed ? 'border-l-4 border-green-500' : ''} ${isDrawer ? 'border-l-4 border-orange-500' : ''}`}>
                                            <span className="text-sm truncate">
                                                {isDrawer && '🎨 '}
                                                {hasGuessed && '✓ '}
                                                {player?.name ?? 'Unknown'}
                                            </span>
                                            <span className="text-sm font-bold text-green-400">{score}</span>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Scribble Scrabble - Round Results */}
        {room.state === 'SC_ROUND_RESULTS' && (
            <div className="w-full h-full flex flex-col items-center justify-center">
                <h2 className="text-2xl text-slate-400 mb-2">ROUND {room.scCurrentRound}/{room.scTotalRounds}</h2>
                <h1 className="text-5xl font-black text-yellow-400 mb-4">⏱️ Time's Up!</h1>
                <p className="text-4xl mb-8">
                    The word was: <span className="text-orange-400 font-bold">{scRoundWord.toUpperCase()}</span>
                </p>
                
                <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg mb-6">
                    <h3 className="text-xl font-bold text-slate-300 mb-4 text-center">Scores</h3>
                    <div className="space-y-2">
                        {Object.entries(scRoundScores)
                            .sort(([,a], [,b]) => b - a)
                            .map(([pid, score], idx) => {
                                const player = room.players.find(p => p.id === pid);
                                return (
                                    <div key={pid} className={`flex justify-between items-center p-3 rounded-lg ${
                                        idx === 0 ? 'bg-yellow-900/50 border-2 border-yellow-500' : 'bg-slate-900'
                                    }`}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl font-bold w-8">#{idx + 1}</span>
                                            <span className="text-lg">{player?.name ?? 'Unknown'}</span>
                                        </div>
                                        <span className="text-xl font-bold text-green-400">{score} pts</span>
                                    </div>
                                );
                            })}
                    </div>
                </div>
                
                <p className="text-slate-400">Controller advances to {(room.scCurrentRound ?? 1) >= (room.scTotalRounds ?? 1) ? 'final results' : 'next round'}...</p>
            </div>
        )}

        {/* Card Calamity - Playing */}
        {(room.state === 'CC_PLAYING' || room.state === 'CC_PICK_COLOR') && (
            <div className="w-full h-full flex flex-col p-4">
                {/* Top bar: Timer and info */}
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <DirectionIndicator direction={room.ccDirection ?? 1} />
                        {room.ccActiveColor && <ActiveColorIndicator color={room.ccActiveColor} />}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`text-5xl font-mono font-bold ${ccTimeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                            {ccTimeLeft}s
                        </div>
                    </div>
                    {room.ccDrawStack && room.ccDrawStack > 0 && (
                        <div className="bg-red-600 px-4 py-2 rounded-xl text-white font-bold text-xl animate-bounce">
                            +{room.ccDrawStack} STACK!
                        </div>
                    )}
                </div>

                {/* Main content: Discard pile and player ring */}
                <div className="flex-1 flex items-center justify-center relative">
                    {/* Player ring around discard */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        {room.ccTurnOrder?.map((playerId, idx) => {
                            const player = room.players.find(p => p.id === playerId);
                            const isCurrent = playerId === room.ccCurrentPlayerId;
                            const cardCount = room.ccHandCounts?.[playerId] ?? 0;
                            const angle = (idx / (room.ccTurnOrder?.length ?? 1)) * 2 * Math.PI - Math.PI / 2;
                            const radius = Math.min(300, window.innerWidth * 0.25);
                            const x = Math.cos(angle) * radius;
                            const y = Math.sin(angle) * radius;
                            
                            return (
                                <motion.div
                                    key={playerId}
                                    className={`absolute flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                                        isCurrent 
                                            ? 'bg-yellow-500/30 border-2 border-yellow-400 scale-110' 
                                            : 'bg-slate-800/70'
                                    }`}
                                    style={{
                                        transform: `translate(${x}px, ${y}px)`
                                    }}
                                    animate={isCurrent ? { scale: [1.1, 1.15, 1.1] } : {}}
                                    transition={{ repeat: Infinity, duration: 1 }}
                                >
                                    <span className={`font-bold text-sm truncate max-w-24 ${isCurrent ? 'text-yellow-300' : 'text-white'}`}>
                                        {player?.name ?? 'Unknown'}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-2xl">🃏</span>
                                        <span className={`text-xl font-bold ${cardCount <= 2 ? 'text-red-400' : 'text-white'}`}>
                                            {cardCount}
                                        </span>
                                    </div>
                                    {isCurrent && room.state === 'CC_PICK_COLOR' && (
                                        <span className="text-xs text-yellow-400 animate-pulse">Picking color...</span>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Center: Discard pile */}
                    <div className="relative z-10">
                        <AnimatePresence mode="popLayout">
                            {room.ccTopCard && (
                                <motion.div
                                    key={room.ccTopCard.id}
                                    initial={{ scale: 0.5, rotate: -180, opacity: 0 }}
                                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                >
                                    <CardCalamityCard card={room.ccTopCard} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Bottom: Last action */}
                <AnimatePresence>
                    {room.ccLastAction && (
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -50, opacity: 0 }}
                            className="flex justify-center mb-4"
                        >
                            <div className={`px-6 py-3 rounded-xl text-xl font-bold ${
                                room.ccLastAction.type === 'play' 
                                    ? 'bg-green-600/80' 
                                    : room.ccLastAction.type === 'draw'
                                        ? 'bg-blue-600/80'
                                        : 'bg-red-600/80'
                            }`}>
                                {room.ccLastAction.type === 'play' && (
                                    <span>🎴 {room.ccLastAction.playerName} played a card!</span>
                                )}
                                {room.ccLastAction.type === 'draw' && (
                                    <span>📥 {room.ccLastAction.playerName} drew cards!</span>
                                )}
                                {room.ccLastAction.type === 'timeout' && (
                                    <span>⏱️ {room.ccLastAction.playerName} timed out! +2 cards</span>
                                )}
                                {room.ccLastAction.color && (
                                    <span className="ml-2">→ {room.ccLastAction.color.toUpperCase()}</span>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        )}

        {/* Card Calamity - Results */}
        {room.state === 'CC_RESULTS' && (
            <div className="w-full h-full flex flex-col items-center justify-center">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                >
                    <h1 className="text-6xl font-black text-yellow-400 mb-2">🎉 WINNER! 🎉</h1>
                </motion.div>
                <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-4xl font-bold text-white mb-8"
                >
                    {room.ccWinnerName}
                </motion.div>
                
                <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg">
                    <h3 className="text-xl font-bold text-slate-300 mb-4 text-center">Final Scores</h3>
                    <div className="space-y-2">
                        {room.players
                            .sort((a, b) => {
                                if (a.id === room.ccWinnerId) return -1;
                                if (b.id === room.ccWinnerId) return 1;
                                return b.score - a.score;
                            })
                            .map((player, idx) => (
                                <motion.div
                                    key={player.id}
                                    initial={{ x: -50, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.4 + idx * 0.1 }}
                                    className={`flex justify-between items-center p-3 rounded-lg ${
                                        player.id === room.ccWinnerId 
                                            ? 'bg-yellow-900/50 border-2 border-yellow-500' 
                                            : 'bg-slate-900'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl font-bold w-8">
                                            {player.id === room.ccWinnerId ? '👑' : `#${idx + 1}`}
                                        </span>
                                        <span className="text-lg">{player.name}</span>
                                        {player.id === room.ccWinnerId && (
                                            <span className="text-xs bg-yellow-600 px-2 py-1 rounded">WINNER</span>
                                        )}
                                    </div>
                                    <span className="text-xl font-bold text-green-400">{player.score} pts</span>
                                </motion.div>
                            ))}
                    </div>
                </div>
                
                <WoodenButton 
                    variant="red"
                    onClick={handleBack}
                    className="mt-8"
                >
                    BACK TO MENU
                </WoodenButton>
            </div>
        )}

        {room.state === 'END' && (
            <div className="text-center w-full max-w-2xl">
                <h1 className="text-6xl font-black text-yellow-500 mb-12">GAME OVER</h1>
                <div className="space-y-4">
                    {room.players.sort((a,b) => b.score - a.score).map((p, idx) => (
                        <div key={p.id} className={`flex justify-between items-center p-6 rounded-xl ${idx === 0 ? 'bg-yellow-900/50 border-2 border-yellow-500' : 'bg-slate-800'}`}>
                            <div className="flex items-center gap-4">
                                <span className="text-3xl font-bold w-12">{idx + 1}</span>
                                <span className="text-2xl">{p.name}</span>
                            </div>
                            <span className="text-3xl font-bold text-green-400">
                                {isPatented ? '$' : ''}{p.score}{isScribble ? ' pts' : ''}
                            </span>
                        </div>
                    ))}
                </div>
                <WoodenButton 
                  variant="red"
                  onClick={handleBack}
                  className="mt-12"
                >
                  BACK TO MENU
                </WoodenButton>
            </div>
        )}
      </div>
    </div>
  );
}
