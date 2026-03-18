import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

interface ConnectedClient {
  socket: Socket;
  userId: number;
  userOpenId: string;
  connectedAt: Date;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();

  /**
   * Get the Socket.IO server instance (for shutdown)
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*', // In production, restrict to specific origins
        methods: ['GET', 'POST'],
      },
      path: '/ws',
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`);

      // Handle authentication
      socket.on('authenticate', (data: { userId: number; userOpenId: string }) => {
        this.handleAuthentication(socket, data);
      });

      // ATIS session management
      socket.on('join-session', (sessionId: string) => {
        if (!sessionId) return;
        socket.join(`session:${sessionId}`);
        socket.emit('session-joined', {
          sessionId,
          socketId: socket.id,
        });
      });

      socket.on('leave-session', (sessionId: string) => {
        if (!sessionId) return;
        socket.leave(`session:${sessionId}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

      // Handle task completion
      socket.on('task:complete', (data: { taskId: string; isCompleted: boolean }) => {
        this.broadcastTaskUpdate(socket, 'task:completed', data);
      });

      // Handle task reschedule
      socket.on('task:reschedule', (data: any) => {
        this.broadcastTaskUpdate(socket, 'task:rescheduled', data);
      });

      // Handle cache invalidation
      socket.on('cache:invalidate', () => {
        this.broadcastCacheInvalidation(socket);
      });
    });

    console.log('[WebSocket] Server initialized');
  }

  /**
   * Handle client authentication
   */
  private handleAuthentication(socket: Socket, data: { userId: number; userOpenId: string }): void {
    const client: ConnectedClient = {
      socket,
      userId: data.userId,
      userOpenId: data.userOpenId,
      connectedAt: new Date(),
    };

    this.clients.set(socket.id, client);
    console.log(`[WebSocket] Client authenticated: ${socket.id} (user: ${data.userOpenId})`);

    // Send authentication success
    socket.emit('authenticated', {
      success: true,
      connectedClients: this.getConnectedClientsCount(),
    });
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(socket: Socket): void {
    const client = this.clients.get(socket.id);
    if (client) {
      console.log(`[WebSocket] Client disconnected: ${socket.id} (user: ${client.userOpenId})`);
      this.clients.delete(socket.id);
    } else {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    }
  }

  /**
   * Broadcast task update to all clients except sender
   */
  private broadcastTaskUpdate(socket: Socket, event: string, data: any): void {
    const client = this.clients.get(socket.id);
    if (!client) {
      console.warn(`[WebSocket] Cannot broadcast - client not authenticated: ${socket.id}`);
      return;
    }

    console.log(`[WebSocket] Broadcasting ${event} from user ${client.userOpenId}`);
    
    // Broadcast to all clients of the same user
    this.clients.forEach((otherClient, socketId) => {
      if (otherClient.userOpenId === client.userOpenId && socketId !== socket.id) {
        otherClient.socket.emit(event, {
          ...data,
          timestamp: new Date().toISOString(),
          sourceSocketId: socket.id,
        });
      }
    });
  }

  /**
   * Broadcast cache invalidation to all clients of the same user
   */
  private broadcastCacheInvalidation(socket: Socket): void {
    const client = this.clients.get(socket.id);
    if (!client) return;

    console.log(`[WebSocket] Broadcasting cache invalidation for user ${client.userOpenId}`);
    
    this.clients.forEach((otherClient, socketId) => {
      if (otherClient.userOpenId === client.userOpenId && socketId !== socket.id) {
        otherClient.socket.emit('cache:invalidated', {
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Emit event to all clients of a specific user
   */
  emitToUser(userOpenId: string, event: string, data: any): void {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.userOpenId === userOpenId) {
        client.socket.emit(event, data);
        count++;
      }
    });
    console.log(`[WebSocket] Emitted ${event} to ${count} clients of user ${userOpenId}`);
  }

  /**
   * Emit event to all connected clients
   */
  emitToAll(event: string, data: any): void {
    if (!this.io) return;
    this.io.emit(event, data);
    console.log(`[WebSocket] Emitted ${event} to all clients`);
  }

  /**
   * Emit event to a specific ATIS session room
   */
  emitToSession(sessionId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`session:${sessionId}`).emit(event, data);
    console.log(`[WebSocket] Emitted ${event} to session ${sessionId}`);
  }

  /**
   * Emit ATIS progress update
   */
  emitATISProgress(
    sessionId: string,
    taskId: string,
    phase: number,
    status: 'started' | 'in_progress' | 'completed' | 'failed',
    confidence?: number,
    error?: string,
    progress?: number
  ): void {
    this.emitToSession(sessionId, 'progress-update', {
      sessionId,
      taskId,
      phase,
      status,
      confidence,
      progress,
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit phase completion event
   */
  emitPhaseCompleted(
    sessionId: string,
    phase: number,
    duration: number,
    confidence: number
  ): void {
    this.emitToSession(sessionId, 'phase-completed', {
      sessionId,
      phase,
      duration,
      confidence,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit final analysis completion event
   */
  emitAnalysisComplete(
    sessionId: string,
    taskId: string,
    overallConfidence: number,
    completedPhases: number,
    totalPhases: number,
    totalDuration: number
  ): void {
    this.emitToSession(sessionId, 'analysis-complete', {
      sessionId,
      taskId,
      overallConfidence,
      completedPhases,
      totalPhases,
      totalDuration,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit ATIS analysis error
   */
  emitAnalysisError(sessionId: string, phase: number, error: string): void {
    this.emitToSession(sessionId, 'analysis-error', {
      sessionId,
      phase,
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit confidence update for a phase
   */
  emitConfidenceUpdate(sessionId: string, phase: number, confidence: number): void {
    this.emitToSession(sessionId, 'confidence-update', {
      phase,
      confidence,
      timestamp: Date.now(),
    });
  }

  /**
   * Get number of connected clients
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get connected clients for a specific user
   */
  getUserClientsCount(userOpenId: string): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.userOpenId === userOpenId) count++;
    });
    return count;
  }

  /**
   * Get all connected users
   */
  getConnectedUsers(): string[] {
    const users = new Set<string>();
    this.clients.forEach((client) => {
      users.add(client.userOpenId);
    });
    return Array.from(users);
  }

  /**
   * Disconnect all clients (for cleanup)
   */
  disconnectAll(): void {
    this.clients.forEach((client) => {
      client.socket.disconnect(true);
    });
    this.clients.clear();
    console.log('[WebSocket] All clients disconnected');
  }
}

// Singleton instance
const websocketService = new WebSocketService();

export { websocketService, WebSocketService };
