import { motion } from 'framer-motion';
import WoodenButton from './WoodenButton';

interface GameLibraryProps {
  onSelectGame: (gameId: string) => void;
  onJoinGame: () => void;
}

export default function GameLibrary({ onSelectGame, onJoinGame }: GameLibraryProps) {
  const games = [
    {
      id: 'nasty-libs',
      title: 'NASTY LIBS',
      description: 'A wildly inappropriate spoof of Mad Libs. Fill in the blanks with the worst things you can think of.',
      color: 'bg-pink-600',
      logo: '/assets/Nasty_Libs_Logo.svg',
    },
    {
      id: 'dubiously-patented',
      title: 'DUBIOUSLY PATENTED',
      description: 'A spoof of idea-pitch games. Solve dumb problems with even dumber inventions, then vote for the best disaster.',
      color: 'bg-emerald-600',
      logo: '/assets/Dubiously_Patented_Logo.png',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col">
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-4xl font-bold text-yellow-500 tracking-widest uppercase drop-shadow-lg">
          Game Library
        </h1>
        <div className="flex gap-4">
             <WoodenButton variant="white" onClick={onJoinGame} className="text-lg px-6 py-2">
                Join Existing Game
             </WoodenButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto w-full">
        {games.map((game) => (
          <motion.div
            key={game.id}
            whileHover={{ scale: 1.02, y: -5 }}
            className="bg-slate-800 rounded-xl overflow-hidden shadow-2xl border-4 border-slate-700 flex flex-col"
          >
            <div className={`h-48 ${game.color} flex items-center justify-center p-4 relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black opacity-20"></div>
                {game.logo ? (
                     <img src={game.logo} alt={game.title} className="max-h-full max-w-full relative z-10 transform -rotate-6 drop-shadow-lg" />
                ) : (
                    <h2 className="text-4xl font-black text-white relative z-10 text-center transform -rotate-6">
                        {game.title}
                    </h2>
                )}
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <p className="text-slate-300 text-lg mb-6 leading-relaxed">
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
        <div className="bg-slate-800/50 rounded-xl border-4 border-dashed border-slate-700 flex flex-col items-center justify-center p-12 text-slate-500">
            <span className="text-6xl mb-4">?</span>
            <h3 className="text-2xl font-bold uppercase">More Coming Soon</h3>
        </div>
      </div>
    </div>
  );
}
