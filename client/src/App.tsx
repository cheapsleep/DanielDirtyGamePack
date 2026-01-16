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
import Verify from './components/Verify';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';

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
    // Navigate to /home so the library is at danieldgp.com/home
    window.location.pathname = '/home';
  };

  const handleSelectGame = (gameId: string) => {
    setSelectedGame(gameId);
    setView('HOST');
  };

  const handleJoinGame = () => {
    window.location.hash = '#/join';
  };

  const handleBackToLibrary = () => {
    // Always navigate to /home so users skip splash/title flows on return
    try { setSelectedGame(null); } catch {}
    window.location.pathname = '/home';
  };

  if (isJoin) {
    return (
      <div className="min-h-screen bg-slate-900 overflow-hidden">
        <PlayerScreen />
      </div>
    );
  }

  // simple pathname routing for auth & utility pages
  const pathname = window.location.pathname
  if (pathname === '/login') return <Login />
  if (pathname === '/register') return <Register />
  if (pathname === '/profile') return <Profile />
  if (pathname === '/verify') return <Verify />
  if (pathname === '/forgot-password') return <ForgotPassword />
  if (pathname === '/reset-password') return <ResetPassword />

  // Treat `/home` as the library view, but prefer `HOST`/`PLAYER` when set so
  // clicking PLAY can open Host/Player screens even when pathname === '/home'.
  let effectiveView: View = view;
  if (view !== 'HOST' && view !== 'PLAYER') {
    effectiveView = pathname === '/home' ? 'LIBRARY' : view;
  }

  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden">
      {effectiveView === 'SPLASH' && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}

      {effectiveView === 'TITLE' && (
        <TitleScreen onContinue={handleTitleContinue} />
      )}

      {effectiveView === 'LIBRARY' && (
        <GameLibrary 
            onSelectGame={handleSelectGame} 
            onJoinGame={handleJoinGame} 
        />
      )}

      {effectiveView === 'HOST' && (
        <HostScreen onBack={handleBackToLibrary} gameId={selectedGame ?? 'nasty-libs'} />
      )}

      {effectiveView === 'PLAYER' && (
        <PlayerScreen />
      )}
    </div>
  );
}

export default App;
