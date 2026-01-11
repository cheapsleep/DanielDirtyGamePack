import { useState, useEffect } from 'react';
import { socket } from './socket';
import HostScreen from './components/HostScreen';
import PlayerScreen from './components/PlayerScreen';
import SplashScreen from './components/SplashScreen';
import GameLibrary from './components/GameLibrary';

type View = 'SPLASH' | 'LIBRARY' | 'HOST' | 'PLAYER';

function App() {
  const [isJoin, setIsJoin] = useState<boolean>(() => window.location.hash.startsWith('#/join'));
  const [view, setView] = useState<View>('SPLASH');
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  useEffect(() => {
    function onConnect() {
      console.log('Connected to server');
    }

    function onDisconnect() {
      console.log('Disconnected from server');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  useEffect(() => {
    function onHashChange() {
      setIsJoin(window.location.hash.startsWith('#/join'));
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleSplashComplete = () => {
    setView('LIBRARY');
  };

  const handleSelectGame = (gameId: string) => {
    setSelectedGame(gameId);
    setView('HOST');
  };

  const handleJoinGame = () => {
    window.location.hash = '#/join';
  };

  const handleBackToLibrary = () => {
    setView('LIBRARY');
    setSelectedGame(null);
  };

  if (isJoin) {
    return (
      <div className="min-h-screen bg-slate-900 font-thertole overflow-hidden">
        <PlayerScreen onBack={() => (window.location.hash = '#/join')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 font-thertole overflow-hidden">
      {view === 'SPLASH' && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}

      {view === 'LIBRARY' && (
        <GameLibrary 
            onSelectGame={handleSelectGame} 
            onJoinGame={handleJoinGame} 
        />
      )}

      {view === 'HOST' && (
        <HostScreen onBack={handleBackToLibrary} gameId={selectedGame ?? 'nasty-libs'} />
      )}

      {view === 'PLAYER' && (
        <PlayerScreen onBack={handleBackToLibrary} />
      )}
    </div>
  );
}

export default App;
