import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

export interface AnalysisProgressUpdate {
  sessionId: string;
  taskId: string;
  phase: number;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  confidence?: number;
  progress?: number;
  error?: string;
  timestamp: number;
}

export interface PhaseCompletionEvent {
  sessionId: string;
  phase: number;
  duration: number;
  confidence: number;
  timestamp: number;
}

export interface AnalysisCompleteEvent {
  sessionId: string;
  taskId: string;
  overallConfidence: number;
  completedPhases: number;
  totalPhases: number;
  totalDuration: number;
  timestamp: number;
}

export interface WebSocketError {
  sessionId: string;
  phase: number;
  error: string;
  timestamp: number;
}

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server with Socket.io
 */
export function initializeWebSocket(httpServer: HTTPServer): SocketIOServer<any, any> {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.VITE_FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    // In production, validate JWT token here
    if (!token && process.env.NODE_ENV === 'production') {
      return next(new Error('Authentication error'));
    }
    next();
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Join analysis session room
    socket.on('join-session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      console.log(`[WebSocket] Client ${socket.id} joined session ${sessionId}`);
      socket.emit('session-joined', { sessionId, socketId: socket.id });
    });

    // Leave analysis session room
    socket.on('leave-session', (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
      console.log(`[WebSocket] Client ${socket.id} left session ${sessionId}`);
    });

    // Monitor active sessions
    socket.on('get-active-sessions', () => {
      const rooms = socket.rooms;
      const sessions = Array.from(rooms)
        .filter(room => room.startsWith('session:'))
        .map(room => room.replace('session:', ''));
      socket.emit('active-sessions', sessions);
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });

    // Error handler
    socket.on('error', (error: Error) => {
      console.error(`[WebSocket] Socket error for ${socket.id}:`, error);
    });
  });

  return io;
}

/**
 * Get the Socket.io instance
 */
export function getWebSocketServer(): SocketIOServer<any, any> | null {
  return io;
}

/**
 * Broadcast analysis progress update to all clients in a session
 */
export function broadcastProgressUpdate(update: AnalysisProgressUpdate): void {
  if (!io) return;
  io.to(`session:${update.sessionId}`).emit('progress-update', update);
}

/**
 * Broadcast phase completion event
 */
export function broadcastPhaseCompletion(event: PhaseCompletionEvent): void {
  if (!io) return;
  io.to(`session:${event.sessionId}`).emit('phase-completed', event);
}

/**
 * Broadcast analysis completion event
 */
export function broadcastAnalysisComplete(event: AnalysisCompleteEvent): void {
  if (!io) return;
  io.to(`session:${event.sessionId}`).emit('analysis-complete', event);
}

/**
 * Broadcast error event
 */
export function broadcastError(error: WebSocketError): void {
  if (!io) return;
  io.to(`session:${error.sessionId}`).emit('analysis-error', error);
}

/**
 * Broadcast real-time confidence score update
 */
export function broadcastConfidenceUpdate(
  sessionId: string,
  phase: number,
  confidence: number
): void {
  if (!io) return;
  io.to(`session:${sessionId}`).emit('confidence-update', {
    phase,
    confidence,
    timestamp: Date.now(),
  });
}

/**
 * Get active connections count for a session
 */
export function getSessionConnectionCount(sessionId: string): number {
  if (!io) return 0;
  const room = io.sockets.adapter.rooms.get(`session:${sessionId}`);
  return room ? room.size : 0;
}

/**
 * Get total active connections
 */
export function getTotalConnections(): number {
  if (!io) return 0;
  return io.engine.clientsCount;
}

/**
 * Notify specific client
 */
export function notifyClient(socketId: string, event: string, data: any): void {
  if (!io) return;
  io.to(socketId).emit(event, data);
}

/**
 * Cleanup WebSocket server
 */
export function closeWebSocket(): void {
  if (io) {
    io.close();
    io = null;
  }
}
