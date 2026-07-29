import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketService } from './services/websocket';
import { createServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

describe('WebSocket Service', () => {
  let wsService: WebSocketService;
  let httpServer: any;
  let clientSocket: ClientSocket;
  let port: number;

  beforeEach(async () => {
    // Create HTTP server
    httpServer = createServer();
    
    // Find available port
    port = 3100 + Math.floor(Math.random() * 100);
    
    // Initialize WebSocket service
    wsService = new WebSocketService();
    wsService.initialize(httpServer);
    
    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(port, () => resolve());
    });
  });

  afterEach(async () => {
    // Cleanup
    if (clientSocket) {
      clientSocket.disconnect();
    }
    wsService.disconnectAll();
    
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  describe('Connection management', () => {
    it('should accept client connections', (done) => {
      clientSocket = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });

    it('should authenticate clients', (done) => {
      clientSocket = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('authenticate', {
          userId: 1,
          userOpenId: 'test-user',
        });
      });

      clientSocket.on('authenticated', (data) => {
        expect(data.success).toBe(true);
        expect(data.connectedClients).toBeGreaterThan(0);
        done();
      });
    });

    it('should track connected clients', (done) => {
      clientSocket = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('authenticate', {
          userId: 1,
          userOpenId: 'test-user',
        });
      });

      clientSocket.on('authenticated', () => {
        const count = wsService.getConnectedClientsCount();
        expect(count).toBe(1);
        done();
      });
    });

    it('should handle disconnections', (done) => {
      clientSocket = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('authenticate', {
          userId: 1,
          userOpenId: 'test-user',
        });
      });

      clientSocket.on('authenticated', () => {
        expect(wsService.getConnectedClientsCount()).toBe(1);
        
        clientSocket.disconnect();
        
        // Wait for disconnection to be processed
        setTimeout(() => {
          expect(wsService.getConnectedClientsCount()).toBe(0);
          done();
        }, 100);
      });
    });
  });

  describe('Event broadcasting', () => {
    it('should broadcast task completion events', (done) => {
      const client1 = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      const client2 = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      let authenticatedCount = 0;

      const checkBothAuthenticated = () => {
        authenticatedCount++;
        if (authenticatedCount === 2) {
          // Both clients authenticated, emit event from client1
          client1.emit('task:complete', {
            taskId: 'test-task-1',
            isCompleted: true,
          });
        }
      };

      client1.on('connect', () => {
        client1.emit('authenticate', {
          userId: 1,
          userOpenId: 'test-user',
        });
      });

      client2.on('connect', () => {
        client2.emit('authenticate', {
          userId: 1,
          userOpenId: 'test-user',
        });
      });

      client1.on('authenticated', checkBothAuthenticated);
      client2.on('authenticated', checkBothAuthenticated);

      // Client2 should receive the event from client1
      client2.on('task:completed', (data) => {
        expect(data.taskId).toBe('test-task-1');
        expect(data.isCompleted).toBe(true);
        expect(data.timestamp).toBeDefined();
        
        client1.disconnect();
        client2.disconnect();
        done();
      });
    });

    it('should not broadcast to sender', (done) => {
      clientSocket = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('authenticate', {
          userId: 1,
          userOpenId: 'test-user',
        });
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('task:complete', {
          taskId: 'test-task-1',
          isCompleted: true,
        });

        // Wait to ensure no event is received
        setTimeout(() => {
          done();
        }, 200);
      });

      // Should not receive own event
      clientSocket.on('task:completed', () => {
        done(new Error('Should not receive own event'));
      });
    });

    it('should broadcast cache invalidation', (done) => {
      const client1 = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      const client2 = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      let authenticatedCount = 0;

      const checkBothAuthenticated = () => {
        authenticatedCount++;
        if (authenticatedCount === 2) {
          client1.emit('cache:invalidate');
        }
      };

      client1.on('connect', () => {
        client1.emit('authenticate', {
          userId: 1,
          userOpenId: 'test-user',
        });
      });

      client2.on('connect', () => {
        client2.emit('authenticate', {
          userId: 1,
          userOpenId: 'test-user',
        });
      });

      client1.on('authenticated', checkBothAuthenticated);
      client2.on('authenticated', checkBothAuthenticated);

      client2.on('cache:invalidated', (data) => {
        expect(data.timestamp).toBeDefined();
        
        client1.disconnect();
        client2.disconnect();
        done();
      });
    });
  });

  describe('User isolation', () => {
    it('should only broadcast to same user', (done) => {
      const user1Client1 = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      const user1Client2 = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      const user2Client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      let authenticatedCount = 0;

      const checkAllAuthenticated = () => {
        authenticatedCount++;
        if (authenticatedCount === 3) {
          // All authenticated, emit from user1
          user1Client1.emit('task:complete', {
            taskId: 'test-task-1',
            isCompleted: true,
          });
        }
      };

      user1Client1.on('connect', () => {
        user1Client1.emit('authenticate', {
          userId: 1,
          userOpenId: 'user-1',
        });
      });

      user1Client2.on('connect', () => {
        user1Client2.emit('authenticate', {
          userId: 1,
          userOpenId: 'user-1',
        });
      });

      user2Client.on('connect', () => {
        user2Client.emit('authenticate', {
          userId: 2,
          userOpenId: 'user-2',
        });
      });

      user1Client1.on('authenticated', checkAllAuthenticated);
      user1Client2.on('authenticated', checkAllAuthenticated);
      user2Client.on('authenticated', checkAllAuthenticated);

      // User1's second client should receive
      user1Client2.on('task:completed', (data) => {
        expect(data.taskId).toBe('test-task-1');
        
        user1Client1.disconnect();
        user1Client2.disconnect();
        user2Client.disconnect();
        done();
      });

      // User2's client should NOT receive
      user2Client.on('task:completed', () => {
        done(new Error('User2 should not receive User1 events'));
      });
    });

    it('should track user-specific client counts', (done) => {
      const user1Client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      const user2Client = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      let authenticatedCount = 0;

      const checkBothAuthenticated = () => {
        authenticatedCount++;
        if (authenticatedCount === 2) {
          expect(wsService.getUserClientsCount('user-1')).toBe(1);
          expect(wsService.getUserClientsCount('user-2')).toBe(1);
          expect(wsService.getConnectedUsers()).toContain('user-1');
          expect(wsService.getConnectedUsers()).toContain('user-2');
          
          user1Client.disconnect();
          user2Client.disconnect();
          done();
        }
      };

      user1Client.on('connect', () => {
        user1Client.emit('authenticate', {
          userId: 1,
          userOpenId: 'user-1',
        });
      });

      user2Client.on('connect', () => {
        user2Client.emit('authenticate', {
          userId: 2,
          userOpenId: 'user-2',
        });
      });

      user1Client.on('authenticated', checkBothAuthenticated);
      user2Client.on('authenticated', checkBothAuthenticated);
    });
  });

  describe('Server-side emit', () => {
    it('should emit to specific user', (done) => {
      clientSocket = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('authenticate', {
          userId: 1,
          userOpenId: 'test-user',
        });
      });

      clientSocket.on('authenticated', () => {
        // Emit from server side
        wsService.emitToUser('test-user', 'custom:event', {
          message: 'Hello from server',
        });
      });

      clientSocket.on('custom:event', (data) => {
        expect(data.message).toBe('Hello from server');
        done();
      });
    });

    it('should emit to all clients', (done) => {
      clientSocket = ioClient(`http://localhost:${port}`, {
        path: '/ws',
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('authenticate', {
          userId: 1,
          userOpenId: 'test-user',
        });
      });

      clientSocket.on('authenticated', () => {
        wsService.emitToAll('broadcast:event', {
          message: 'Broadcast message',
        });
      });

      clientSocket.on('broadcast:event', (data) => {
        expect(data.message).toBe('Broadcast message');
        done();
      });
    });
  });
});
