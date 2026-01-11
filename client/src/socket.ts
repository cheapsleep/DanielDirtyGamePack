import { io } from 'socket.io-client';

// Use the current hostname so phones can connect if they are on the same network
const isProd = Boolean((import.meta as any)?.env?.PROD);
const defaultProdServerUrl = 'https://danieldirtygamepack.onrender.com';
const envUrl = (import.meta as any)?.env?.VITE_SERVER_URL as string | undefined;
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
  if (window.location.protocol === 'https:' && rawUrl.startsWith('http://')) {
    return `https://${rawUrl.slice('http://'.length)}`;
  }
  return rawUrl;
})();

export const socketServerUrl = resolvedUrl;

export const socket = io(resolvedUrl, {
    autoConnect: true
});
