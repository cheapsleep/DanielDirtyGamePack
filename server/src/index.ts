import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameManager } from './game';

const CLIENT_ORIGINS = process.env.CLIENT_ORIGINS ? process.env.CLIENT_ORIGINS.split(',') : ['http://localhost:5173'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || CLIENT_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));

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

const gameManager = new GameManager(io);

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

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
