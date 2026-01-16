import { io } from 'socket.io-client';

// Use the current hostname so phones can connect if they are on the same network
const isProd = import.meta.env.PROD;
const envUrl = import.meta.env.VITE_SERVER_URL;
const defaultProdServerUrl = 'https://server.danielsdgp.com';

// Check for server param in pathname: /join/CODE?server=...
const serverParamFromSearch = new URLSearchParams(window.location.search).get('server') ?? undefined;
const serverParamFromHash = (() => {
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex === -1) return undefined;
  return new URLSearchParams(hash.slice(qIndex + 1)).get('server') ?? undefined;
})();
const serverParam = serverParamFromSearch ?? serverParamFromHash;

const rawUrl =
  serverParam ??
  envUrl ??
  (isProd ? defaultProdServerUrl : `http://${window.location.hostname}:3001`);

const resolvedUrl = (() => {
  if (!rawUrl) return undefined;
  const trimmed = String(rawUrl).trim();
  const upgradedForHttps =
    window.location.protocol === 'https:' && trimmed.startsWith('http://')
      ? `https://${trimmed.slice('http://'.length)}`
      : trimmed;

  return upgradedForHttps;
})();

export const socketServerUrl = resolvedUrl;

export const socket = io(resolvedUrl, {
  autoConnect: true,
  withCredentials: true,
  transports: ['websocket', 'polling']
});
