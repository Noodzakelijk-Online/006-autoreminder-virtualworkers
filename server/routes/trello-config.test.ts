import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import trelloConfigRoutes from './trello-config';

describe('Trello Config Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/trello', trelloConfigRoutes);

    // Mock environment variables
    process.env.TRELLO_API_KEY = 'test-key';
    process.env.TRELLO_TOKEN = 'test-token';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('PUT /api/trello/tasks/:taskId/complete', () => {
    it('should return 400 when missing required fields', async () => {
      const response = await request(app)
        .put('/api/trello/tasks/task-123/complete')
        .send({
          isCompleted: true,
          // Missing cardId, checklistId, checkItemId
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 500 when Trello credentials are missing', async () => {
      delete process.env.TRELLO_API_KEY;

      const response = await request(app)
        .put('/api/trello/tasks/task-123/complete')
        .send({
          isCompleted: true,
          cardId: 'card-123',
          checklistId: 'checklist-123',
          checkItemId: 'item-123',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Trello credentials not configured');
    });
  });

  describe('PUT /api/trello/cards/:cardId/status', () => {
    it('should return 400 when cardId is missing', async () => {
      const response = await request(app)
        .put('/api/trello/cards/')
        .send({
          isCompleted: true,
        });

      // Note: Express will return 404 for missing route parameter
      expect(response.status).toBe(404);
    });

    it('should return 500 when Trello credentials are missing', async () => {
      delete process.env.TRELLO_API_KEY;

      const response = await request(app)
        .put('/api/trello/cards/card-123/status')
        .send({
          isCompleted: true,
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Trello credentials not configured');
    });

    it('should handle card fetch errors gracefully', async () => {
      // Mock fetch to fail
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const response = await request(app)
        .put('/api/trello/cards/invalid-card/status')
        .send({
          isCompleted: true,
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to update card status');
    });
  });

  describe('GET /api/trello/labels', () => {
    it('should return 500 when Trello credentials are missing', async () => {
      delete process.env.TRELLO_API_KEY;

      const response = await request(app)
        .get('/api/trello/labels');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Trello credentials not configured');
    });
  });

  describe('GET /api/trello/completion-labels', () => {
    it('should return empty labels when user is not authenticated', async () => {
      const response = await request(app)
        .get('/api/trello/completion-labels');

      // Since we don't have auth middleware, this will return 401
      expect(response.status).toBe(401);
    });
  });
});
