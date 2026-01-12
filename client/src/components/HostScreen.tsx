import { useEffect, useState } from 'react';
import { socket, socketServerUrl } from '../socket';

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
  const [shortUrl, setShortUrl] = useState<string>('');
  const [presentationData, setPresentationData] = useState<{
      presenterId: string;
      drawing: string;
      title: string;
      prompt: string;
  } | null>(null);
  
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

  const roomCode = room?.code;
  const joinBase =
    ((import.meta as any)?.env?.VITE_JOIN_URL as string | undefined) ??
    window.location.origin;
  const publicServerUrl =
    ((import.meta as any)?.env?.VITE_PUBLIC_SERVER_URL as string | undefined) ?? socketServerUrl;
  const joinUrl = roomCode ? `${joinBase}#/join?room=${roomCode}${
    publicServerUrl ? `&server=${encodeURIComponent(publicServerUrl)}` : ''
  }` : '';

  const qrSrc = roomCode ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}` : '';

  useEffect(() => {
    if (shortUrl || !joinUrl) return;
    
    // Attempt to shorten URL
    fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(joinUrl)}`)
      .then(res => res.text())
      .then(text => {
        if (text.startsWith('http')) {
          setShortUrl(text);
        }
      })
      .catch(() => {
        // Fallback to long URL silently
      });
  }, [joinUrl, shortUrl]);

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
      socket.off('game_over');
      socket.off('error');
    };
  }, [gameId, retryKey]);

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
    ? (room.gameId ?? gameId) === 'dubiously-patented' ? 'Dubiously Patented' : 'Nasty Libs'
    : '';
  const isPatented = room ? (room.gameId ?? gameId) === 'dubiously-patented' : false;
  const isPromptPhase = room ? room.state === 'NL_ANSWER' : false;
  const isVotingPhase = room ? room.state === 'NL_VOTING' : false;
  const isResultsPhase = room ? room.state === 'NL_RESULTS' || room.state === 'DP_RESULTS' : false;
  const isNastySetup = room ? room.state === 'NL_PROMPT_SUBMIT' : false;
  const displayUrl = shortUrl || joinUrl;
  
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
            {qrSrc && (
              <img src={qrSrc} alt="Join QR code" className="w-24 h-24 bg-white p-1 rounded" />
            )}
            <div>
              <div className="text-sm text-slate-500 uppercase tracking-widest break-words">{title}</div>
              <div className="text-xs text-slate-400 mt-2 break-words">{shortUrl || joinUrl}</div>
            </div>
          </div>
        </div>
        <div className="text-center">
            <h2 className="text-xl text-slate-400">ROOM CODE</h2>
            <h1 className="text-6xl font-black text-pink-500 tracking-widest">{room.code}</h1>
            <div className="text-sm text-slate-500 mt-2 uppercase tracking-widest">Controller: {controllerName}</div>
        </div>
        {room.state === 'LOBBY' && (
          <WoodenButton variant="wood" onClick={handleBack} className="px-6 py-2 text-lg">
            BACK
          </WoodenButton>
        )}
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
                  {p.name}{p.isBot ? ' (CPU)' : ''}
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
                    <img src={presentationData.drawing} alt="Invention" className="max-h-[50vh] object-contain" />
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
                            <img src={presentationData.drawing} alt="Invention" className="h-48 object-contain" />
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
                                {isPatented ? '$' : ''}{p.score}
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
