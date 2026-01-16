import { useState, useEffect } from 'react';
import { socket } from './socket';
import HostScreen from './components/HostScreen';
import PlayerScreen from './components/PlayerScreen';
import SplashScreen from './components/SplashScreen';
import TitleScreen from './components/TitleScreen';
import GameLibrary from './components/GameLibrary';
import Login from './components/Login';
import Register from './components/Register';
import Profile from './components/Profile';

type View = 'SPLASH' | 'TITLE' | 'LIBRARY' | 'HOST' | 'PLAYER';

function isJoinRoute() {
  return window.location.pathname.startsWith('/join') || window.location.hash.startsWith('#/join');
}

function App() {
  const [isJoin, setIsJoin] = useState<boolean>(isJoinRoute);
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
    function onRouteChange() {
      setIsJoin(isJoinRoute());
    }
    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('popstate', onRouteChange);
    return () => {
      window.removeEventListener('hashchange', onRouteChange);
      window.removeEventListener('popstate', onRouteChange);
    };
  }, []);

  const handleSplashComplete = () => {
    setView('TITLE');
  };

  const handleTitleContinue = () => {
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
      <div className="min-h-screen bg-slate-900 overflow-hidden">
        <PlayerScreen />
      </div>
    );
  }

  // simple pathname routing for auth pages
  const pathname = window.location.pathname
  if (pathname === '/login') return <Login />
  if (pathname === '/register') return <Register />
  if (pathname === '/profile') return <Profile />

  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden">
      {view === 'SPLASH' && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}

      {view === 'TITLE' && (
        <TitleScreen onContinue={handleTitleContinue} />
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
        <PlayerScreen />
      )}
    </div>
  );
}

export default App;
