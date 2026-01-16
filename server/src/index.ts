import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { GameManager } from './game';
import sessionMiddleware from './session';
import authRouter from './routes/auth';
import debugRouter from './routes/debug';

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || process.env.APP_URL || 'http://localhost:5173'

const corsOptions = {
  origin: CLIENT_ORIGIN,
  credentials: true,
};

const app = express();
// Behind a single proxy (cloudflared) — trust one proxy hop so req.ip is correct
// Use a numeric value (1) rather than `true` to avoid permissive-trust-proxy errors
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// session must be used before routes that depend on it
app.use(sessionMiddleware);

// general rate limiter for auth-related endpoints (slightly higher to reduce accidental 429s)
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

// route-specific limiter for password-reset requests to prevent abuse (hourly window)
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many password reset requests, try again later' }
});

// apply resetLimiter for the specific endpoint path before mounting the general auth router
app.use('/api/auth/request-password-reset', resetLimiter);

app.use('/api/auth', authLimiter, authRouter);

// Debug routes (send test email) — protected by DEBUG_EMAIL_SECRET header/body
app.use('/api/debug', debugRouter);

app.get('/', (_req, res) => {
  res.status(200).send('DanielBox server is running. Try GET /health.');
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

// attach session to socket handshake
io.use((socket, next) => {
  const req: any = socket.request;
  sessionMiddleware(req, {} as any, next as any);
});

const gameManager = new GameManager(io);

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // attach userId from session if available
  try {
    // @ts-ignore
    const userId = socket.request.session?.userId
    if (userId) socket.data.userId = userId
  } catch (e) {
    // ignore
  }

  // Handle joining a room
  socket.on('join_room', (data) => {
    gameManager.handleJoin(socket, data);
  });

  // Handle creating a room (host only)
  socket.on('create_room', (data) => {
    gameManager.handleCreateRoom(socket, data?.gameId);
  });

  socket.on('close_room', () => {
    gameManager.handleCloseRoom(socket);
  });

  // Handle game actions
  socket.on('game_action', (data) => {
    gameManager.handleGameAction(socket, data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    gameManager.handleDisconnect(socket);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
