import { useEffect, useState, useRef } from 'react';
import { socket, socketServerUrl } from '../socket';

import WoodenButton from './WoodenButton';

// Simple drawing canvas
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

interface PlayerScreenProps {
  onBack: () => void;
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
}

export default function PlayerScreen({ onBack }: PlayerScreenProps) {
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

  useEffect(() => {
    const hash = window.location.hash;
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
      const params = new URLSearchParams(hash.slice(qIndex + 1));
      const room = params.get('room');
      if (room) setRoomCode(room.toUpperCase());
    }

    socket.on('joined', (data: any) => {
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
    });

    socket.on('room_update', (nextRoom: any) => {
      setRoom(nextRoom);
      if (nextRoom?.gameId) setGameId(String(nextRoom.gameId));
      setSubmitted(false);
      setAnswerDraft('');
      setPromptDraft('');
      setDpSelected('');
      if (nextRoom?.state !== 'DP_PICK') setDpChoices([]);
    });

    socket.on('new_prompt', (data) => {
        setPrompt(data.prompt);
        setSubmitted(false);
        setAnswerDraft('');
    });

    socket.on('start_voting', (data) => {
        setVotingOptions(data.answers);
        setSubmitted(false);
    });

    socket.on('dp_choices', (data: any) => {
      const choices = Array.isArray(data?.choices) ? data.choices.map((c: any) => String(c)) : [];
      setDpChoices(choices);
      setSubmitted(false);
    });

    socket.on('start_presentation', (data: any) => {
        setCurrentPresenterId(data.presenterId);
        setSubmitted(false);
    });

    socket.on('start_investing', (data: any) => {
        setCurrentPresenterId(data.presenterId);
        setSubmitted(false);
        setInvestmentAmount('');
    });

    socket.on('aq_question', (data: any) => {
      setAqQuestion({
        questionId: data.questionId,
        questionText: data.questionText,
        questionNumber: data.questionNumber,
        totalQuestions: data.totalQuestions
      });
      setAqAnswered(false);
    });

    socket.on('aq_results', (data: any) => {
      setAqResults({
        rankings: data.rankings,
        winnerId: data.winnerId,
        winnerName: data.winnerName,
        certificate: data.certificate
      });
    });

    socket.on('aq_timer', (data: { timeLeft: number; questionNumber: number }) => {
      setAqTimeLeft(data.timeLeft);
    });

    socket.on('error', (data) => {
        if (data?.code === 'GAME_ERROR') {
          setSubmitted(false);
          alert(data.message); // Simple alert for now, or use a toast state
          return;
        }
        setError(data.message);
        setJoined(false);
    });

    socket.on('connect_error', () => {
      const target = socketServerUrl ? ` (${socketServerUrl})` : '';
      setError(`Could not connect to game server${target}`);
      setJoined(false);
    });

    socket.on('room_closed', () => {
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
    });

    return () => {
      socket.off('joined');
      socket.off('room_update');
      socket.off('new_prompt');
      socket.off('start_voting');
      socket.off('dp_choices');
      socket.off('start_presentation');
      socket.off('start_investing');
      socket.off('aq_question');
      socket.off('aq_results');
      socket.off('aq_timer');
      socket.off('error');
      socket.off('connect_error');
      socket.off('room_closed');
    };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode || !playerName) return;

    let rememberedPlayerId: string | null = null;
    try {
      rememberedPlayerId = localStorage.getItem(`playerId:${roomCode.toUpperCase()}`);
    } catch {
      rememberedPlayerId = null;
    }

    socket.emit('join_room', {
      roomCode,
      playerName,
      isHost: false,
      playerId: rememberedPlayerId ?? undefined
    });
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
      <div className="w-full max-w-md p-8">
        <form onSubmit={handleJoin} className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-400">ROOM CODE</label>
            <input 
              type="text" 
              maxLength={4}
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              className="w-full p-4 bg-slate-800 rounded-lg text-4xl font-black text-center tracking-widest uppercase focus:ring-2 focus:ring-pink-500 outline-none"
              placeholder="ABCD"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-400">NAME</label>
            <input 
              type="text" 
              maxLength={12}
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="w-full p-4 bg-slate-800 rounded-lg text-2xl font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="ENTER NAME"
            />
          </div>
          {error && <p className="text-red-500 text-center">{error}</p>}
          <WoodenButton 
            type="submit"
            variant="red"
            className="w-full"
          >
            PLAY
          </WoodenButton>
          <WoodenButton 
            type="button"
            variant="wood"
            onClick={onBack}
            className="w-full"
          >
            BACK
          </WoodenButton>
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
  };

  const isInGame = gameState !== 'LOBBY' && gameState !== 'END';

  return (
    <div className="w-full h-screen p-4 flex flex-col bg-slate-900 text-white">
      <div className="flex justify-between items-center mb-4 text-sm text-slate-500 border-b border-slate-700 pb-2">
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
                {isController ? (
                  <div className="mt-8 w-full max-w-md mx-auto">
                    <div className="text-slate-300 text-lg mb-4">You are the controller.</div>
                    <div className="flex gap-3 justify-center mb-4">
                      <WoodenButton type="button" variant="wood" onClick={handleAddBot} className="px-6">
                        ADD CPU
                      </WoodenButton>
                      <WoodenButton type="button" variant="wood" onClick={handleRemoveBot} className="px-6">
                        REMOVE CPU
                      </WoodenButton>
                    </div>
                    <WoodenButton
                      type="button"
                      variant="red"
                      onClick={handleStartGame}
                      disabled={totalPlayers < 3}
                      className={
                        totalPlayers >= 3
                          ? 'w-full animate-bounce'
                          : 'w-full opacity-60 pointer-events-none'
                      }
                    >
                      EVERYBODY'S IN!
                    </WoodenButton>
                    <p className="mt-4 text-sm text-slate-500">Minimum 3 players.</p>
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
                <div className="flex gap-4 justify-center">
                  <WoodenButton 
                    type="button" 
                    variant="wood" 
                    onClick={() => {
                      socket.emit('game_action', { action: 'AQ_ANSWER', questionId: aqQuestion.questionId, agreed: true });
                      setAqAnswered(true);
                    }}
                    className="px-8 py-4 text-lg"
                  >
                    AGREE
                  </WoodenButton>
                  <WoodenButton 
                    type="button" 
                    variant="red" 
                    onClick={() => {
                      socket.emit('game_action', { action: 'AQ_ANSWER', questionId: aqQuestion.questionId, agreed: false });
                      setAqAnswered(true);
                    }}
                    className="px-8 py-4 text-lg"
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

        {gameState === 'END' && (
            <div className="text-center">
                <h2 className="text-3xl font-bold mb-4">GAME OVER</h2>
                <WoodenButton type="button" variant="wood" onClick={() => {
                  // Reset state and go back to join screen
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
                  // Clear stored playerId for this room
                  if (roomCode) {
                    try {
                      localStorage.removeItem(`playerId:${roomCode.toUpperCase()}`);
                    } catch {
                      // ignore
                    }
                  }
                }} className="px-6 py-3">
                  BACK
                </WoodenButton>
            </div>
        )}
      </div>
    </div>
  );
}
