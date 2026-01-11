import { useEffect, useState } from 'react';
import { socket, socketServerUrl } from '../socket';

import WoodenButton from './WoodenButton';

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
  | 'DP_ANSWER'
  | 'DP_VOTING'
  | 'DP_RESULTS'
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

    socket.on('error', (data) => {
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

  const promptTitle = gameId === 'dubiously-patented' ? 'PROBLEM' : 'PROMPT';
  const answerPlaceholder =
    gameId === 'dubiously-patented'
      ? 'Name your invention + what it does...'
      : 'Type something funny...';

  return (
    <div className="w-full h-screen p-4 flex flex-col bg-slate-900 text-white">
      <div className="flex justify-between items-center mb-4 text-sm text-slate-500 border-b border-slate-700 pb-2">
          <span className="font-bold text-pink-500">{playerName}</span>
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

        {(gameState === 'NL_ANSWER' || gameState === 'DP_ANSWER') && (
            <div className="w-full">
                {gameState === 'NL_ANSWER' && !isContestant ? (
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
                          <div className="text-sm font-black tracking-widest text-slate-400">{promptTitle}</div>
                          <h2 className="text-xl font-bold">{prompt}</h2>
                        </div>
                        <textarea 
                            className="w-full h-40 bg-slate-800 p-4 rounded-xl text-lg mb-4 focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                            placeholder={answerPlaceholder}
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

        {(gameState === 'NL_VOTING' || gameState === 'DP_VOTING') && (
            <div className="w-full">
                {submitted ? (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4">Vote Cast!</h2>
                        <p className="text-slate-400">Look at the main screen.</p>
                    </div>
                ) : (
                    <>
                        <h2 className="text-xl font-bold mb-6 text-center">
                          {gameId === 'dubiously-patented' ? 'Vote for the best invention' : 'Vote for the best answer'}
                        </h2>
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

        {gameState === 'END' && (
            <div className="text-center">
                <h2 className="text-3xl font-bold mb-4">GAME OVER</h2>
                <WoodenButton type="button" variant="wood" onClick={onBack} className="px-6 py-3">
                  BACK
                </WoodenButton>
            </div>
        )}
      </div>
    </div>
  );
}
