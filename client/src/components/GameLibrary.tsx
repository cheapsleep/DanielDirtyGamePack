import { motion } from 'framer-motion';
import WoodenButton from './WoodenButton';

interface GameLibraryProps {
  onSelectGame: (gameId: string) => void;
  onJoinGame: () => void;
}

export default function GameLibrary({ onSelectGame }: GameLibraryProps) {
  const games = [
    {
      id: 'nasty-libs',
      title: 'NASTY LIBS',
      description: 'A wildly inappropriate spoof of Mad Libs. Fill in the blanks with the worst things you can think of.',
      color: 'bg-pink-600',
      logo: '/assets/Nasty_Libs_Logo.svg',
      minPlayers: 3,
    },
    {
      id: 'dubiously-patented',
      title: 'DUBIOUSLY PATENTED',
      description: 'A spoof of idea-pitch games. Solve dumb problems with even dumber inventions, then vote for the best disaster.',
      color: 'bg-emerald-600',
      logo: '/assets/Dubiously_Patented_Logo.png',
      minPlayers: 3,
    },
    {
      id: 'autism-assessment',
      title: 'WHO IS THE MOST AUTISTIC?',
      description: 'A 20-question quiz to determine who in your group is the most neurotypical. The least autistic player wins a certificate!',
      color: 'bg-blue-600',
      logo: '/assets/Autism_Assessment_Logo.png',
      minPlayers: 2,
    },
    {
      id: 'scribble-scrabble',
      title: 'SCRIBBLE SCRABBLE',
      description: 'Draw and guess! Take turns drawing secret words while others race to guess. No bots allowed — humans only!',
      color: 'bg-orange-600',
      logo: '/assets/Scribble_Scrabble_Logo.png',
      minPlayers: 3,
    },
  ];

  return (
    <div className="min-h-screen text-white p-8 flex flex-col prehistoric-bg relative overflow-hidden">
      {/* Background texture: low-opacity prehistoric shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none opacity-30">
        <svg className="w-full h-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="g1" x1="0" x2="1">
              <stop offset="0%" stopColor="#6b4a2a" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#3b2b1b" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <rect width="1200" height="800" fill="url(#g1)" />
          {/* big stone silhouettes */}
          <g transform="translate(80,120) scale(1.6)" fill="#4a331f">
            <ellipse cx="60" cy="140" rx="140" ry="50" />
            <ellipse cx="380" cy="180" rx="200" ry="70" />
            <ellipse cx="920" cy="120" rx="220" ry="80" />
          </g>
          {/* primitive tree shapes */}
          <g transform="translate(40,40)" fill="#3b2b1b" opacity="0.6">
            <circle cx="220" cy="80" r="36" />
            <circle cx="260" cy="60" r="28" />
            <circle cx="240" cy="120" r="42" />
          </g>
          {/* playful dino silhouette */}
          <g transform="translate(760,420) scale(1)" fill="#2f1f14" opacity="0.25">
            <path d="M24 96c12-36 64-60 128-44 40 10 64 36 88 30 28-8 40-38 72-36 32 2 76 44 104 46 16 1 28-6 36-12 6 18 12 54-6 96-20 46-66 84-160 78-88-6-220-56-267-106-18-20-18-48-1-72z" />
          </g>
        </svg>
      </div>
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-5xl font-extrabold prehistoric-title tracking-widest uppercase drop-shadow-lg flex items-center gap-4">
          <svg width="56" height="40" viewBox="0 0 56 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="-ml-2">
            <ellipse cx="14" cy="22" rx="12" ry="8" fill="#8b5e3b" />
            <ellipse cx="34" cy="18" rx="14" ry="9" fill="#6b4a2a" />
          </svg>
          Game Library
        </h1>
        <div className="flex gap-4">
             {/* Join Button Removed */}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-32 max-w-5xl mx-auto w-full pt-40">
        {games.map((game) => (
          <motion.div
            key={game.id}
            whileHover={{ scale: 1.02, y: -5 }}
            className="stone-card rounded-xl overflow-visible shadow-2xl flex flex-col relative z-10"
          >
            <div className={`h-32 ${game.color} flex items-end justify-center relative rounded-t-xl`}> 
              <div className="absolute inset-0 bg-black opacity-20 rounded-t-xl"></div>
              <div className="absolute inset-0 overflow-hidden rounded-t-xl">
                <div className="card-rock rock-top-left" aria-hidden></div>
                <div className="card-rock rock-bottom-right" aria-hidden></div>
              </div>
              {game.logo ? (
                 <img src={game.logo} alt={game.title} className="max-h-96 max-w-[120%] object-contain relative z-0 drop-shadow-2xl translate-y-20" />
              ) : (
                <h2 className="text-5xl font-black text-white relative z-10 text-center transform -rotate-6">
                  {game.title}
                </h2>
              )}
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between relative z-10 bg-stone-800 rounded-b-xl">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">{game.title}</h3>
                <p className="text-sm text-slate-400 mb-2">👥 {game.minPlayers}+ players</p>
                <p className="text-slate-300 text-base mb-4 leading-relaxed">
                    {game.description}
                </p>
              </div>
              <WoodenButton 
                variant="red" 
                onClick={() => onSelectGame(game.id)}
                className="w-full"
              >
                PLAY NOW
              </WoodenButton>
            </div>
          </motion.div>
        ))}
        
        {/* Placeholder for "Coming Soon" */}
        <div className="bg-slate-800/50 rounded-xl border-4 border-dashed border-slate-700 flex flex-col items-center justify-center p-12 text-slate-500 relative z-10">
            <span className="text-6xl mb-4">?</span>
            <h3 className="text-2xl font-bold uppercase">More Coming Soon</h3>
        </div>
      </div>
    </div>
  );
}
