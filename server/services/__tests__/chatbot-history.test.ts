import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../db', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '../../db';
import {
  storeConversation,
  updateConversationResponse,
  getCardConversations,
  getWorkerResponseRate,
  getCommandStats,
  createConversationFromCommand,
} from '../chatbot-history';

describe('Chatbot History Service', () => {
  const mockDb = {
    execute: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getDb as any).mockResolvedValue(mockDb);
  });

  describe('storeConversation', () => {
    it('should store a conversation record', async () => {
      mockDb.execute.mockResolvedValueOnce([{}]); // INSERT
      mockDb.execute.mockResolvedValueOnce([[{ id: 123 }]]); // LAST_INSERT_ID

      const record = {
        cardTrelloId: 'card123',
        cardName: 'Test Card',
        boardTrelloId: 'board456',
        command: 'status',
        commandArgs: ['arg1'],
        authorTrelloId: 'author789',
        authorName: 'Test User',
        incomingCommentId: 'comment001',
        responseStatus: 'pending' as const,
        receivedAt: new Date(),
      };

      const id = await storeConversation(record);
      
      expect(id).toBe(123);
      expect(mockDb.execute).toHaveBeenCalledTimes(2);
    });

    it('should return null if database is not available', async () => {
      (getDb as any).mockResolvedValue(null);

      const record = {
        cardTrelloId: 'card123',
        command: 'status',
        responseStatus: 'pending' as const,
        receivedAt: new Date(),
      };

      const id = await storeConversation(record);
      expect(id).toBeNull();
    });
  });

  describe('updateConversationResponse', () => {
    it('should update conversation with response details', async () => {
      const receivedAt = new Date(Date.now() - 1000);
      mockDb.execute.mockResolvedValueOnce([[{ receivedAt }]]); // SELECT
      mockDb.execute.mockResolvedValueOnce([{}]); // UPDATE

      await updateConversationResponse(
        123,
        'response-comment-id',
        'Bot response text',
        'success'
      );

      expect(mockDb.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCardConversations', () => {
    it('should return conversations for a card', async () => {
      const mockConversations = [
        { id: 1, cardTrelloId: 'card123', command: 'status' },
        { id: 2, cardTrelloId: 'card123', command: 'checkin' },
      ];
      mockDb.execute.mockResolvedValueOnce([mockConversations]);

      const conversations = await getCardConversations('card123', 10);

      expect(conversations).toHaveLength(2);
      expect(conversations[0].command).toBe('status');
    });

    it('should return empty array if database is not available', async () => {
      (getDb as any).mockResolvedValue(null);

      const conversations = await getCardConversations('card123');
      expect(conversations).toEqual([]);
    });
  });

  describe('getWorkerResponseRate', () => {
    it('should calculate response rate for a worker', async () => {
      mockDb.execute.mockResolvedValueOnce([[{
        totalCheckins: 10,
        responded: 8,
        avgResponseMinutes: 15,
      }]]);

      const stats = await getWorkerResponseRate(1, 30);

      expect(stats.totalCheckins).toBe(10);
      expect(stats.responded).toBe(8);
      expect(stats.responseRate).toBe(80);
      expect(stats.avgResponseMinutes).toBe(15);
    });

    it('should return zero stats if no data', async () => {
      mockDb.execute.mockResolvedValueOnce([[{}]]);

      const stats = await getWorkerResponseRate(1, 30);

      expect(stats.totalCheckins).toBe(0);
      expect(stats.responseRate).toBe(0);
    });
  });

  describe('getCommandStats', () => {
    it('should return command usage statistics', async () => {
      mockDb.execute.mockResolvedValueOnce([[
        { command: 'status', count: 50 },
        { command: 'checkin', count: 30 },
        { command: 'help', count: 20 },
      ]]);

      const stats = await getCommandStats(30);

      expect(stats.status).toBe(50);
      expect(stats.checkin).toBe(30);
      expect(stats.help).toBe(20);
    });

    it('should return empty object if database is not available', async () => {
      (getDb as any).mockResolvedValue(null);

      const stats = await getCommandStats(30);
      expect(stats).toEqual({});
    });
  });

  describe('createConversationFromCommand', () => {
    it('should create a conversation record from a bot command', () => {
      const cmd = {
        command: 'status',
        args: ['arg1', 'arg2'],
        cardId: 'card123',
        commentId: 'comment456',
        authorId: 'author789',
        authorName: 'Test User',
      };

      const record = createConversationFromCommand(cmd);

      expect(record.cardTrelloId).toBe('card123');
      expect(record.command).toBe('status');
      expect(record.commandArgs).toEqual(['arg1', 'arg2']);
      expect(record.authorTrelloId).toBe('author789');
      expect(record.authorName).toBe('Test User');
      expect(record.responseStatus).toBe('pending');
      expect(record.receivedAt).toBeInstanceOf(Date);
    });
  });
});
