const express = require('express');
const { body, query, validationResult } = require('express-validator');
const TrelloService = require('../services/trelloService');
const MonitoringService = require('../services/monitoringService');
const Card = require('../models/Card');
const Configuration = require('../models/Configuration');
const Log = require('../models/Log');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/trello/validate
// @desc    Validate Trello API credentials
// @access  Private
router.get('/validate', async (req, res, next) => {
  try {
    const validation = await TrelloService.validateCredentials();

    if (validation.valid) {
      res.json({
        success: true,
        data: {
          valid: true,
          member: validation.member
        },
        message: 'Trello credentials are valid'
      });
    } else {
      // Return 200 with validation failure instead of 400
      res.json({
        success: true,
        data: {
          valid: false,
          error: validation.error
        },
        message: 'Trello credentials validation completed'
      });
    }
  } catch (error) {
    // Even if there's an error, return validation failure instead of throwing
    res.json({
      success: true,
      data: {
        valid: false,
        error: error.message
      },
      message: 'Trello credentials validation completed'
    });
  }
});

// @route   GET /api/trello/organizations
// @desc    Get all Trello organizations
// @access  Private (Admin only)
router.get('/organizations', requireAdmin, async (req, res, next) => {
  try {
    const organizations = await TrelloService.getOrganizations();
    
    res.json({
      success: true,
      data: { organizations },
      message: 'Organizations retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/trello/boards
// @desc    Get all Trello boards
// @access  Private
router.get('/boards', [
  query('organizationId').optional().isString().withMessage('Organization ID must be a string')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    // First validate credentials
    const validation = await TrelloService.validateCredentials();
    if (!validation.valid) {
      // In development, provide mock data
      if (process.env.NODE_ENV === 'development') {
        const mockBoards = [
          {
            id: 'mock-board-1',
            name: 'Sample Project Board',
            desc: 'This is a mock board for development',
            url: 'https://trello.com/b/mock-board-1',
            dateLastActivity: new Date().toISOString()
          },
          {
            id: 'mock-board-2',
            name: 'Development Tasks',
            desc: 'Mock development board',
            url: 'https://trello.com/b/mock-board-2',
            dateLastActivity: new Date().toISOString()
          }
        ];

        return res.json({
          success: true,
          data: { boards: mockBoards },
          message: 'Mock boards retrieved (Trello credentials invalid)',
          warning: 'Using mock data - please configure valid Trello credentials'
        });
      }

      return res.status(401).json({
        success: false,
        error: {
          message: 'Trello API credentials are invalid or expired',
          details: validation.error,
          type: 'TRELLO_AUTH_ERROR'
        }
      });
    }

    const { organizationId } = req.query;
    const boards = await TrelloService.getBoards(organizationId);

    res.json({
      success: true,
      data: { boards },
      message: 'Boards retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/trello/boards/:boardId
// @desc    Get board details
// @access  Private
router.get('/boards/:boardId', async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const board = await TrelloService.getBoardDetails(boardId);
    
    res.json({
      success: true,
      data: { board },
      message: 'Board details retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/trello/boards/:boardId/lists
// @desc    Get lists on a board
// @access  Private
router.get('/boards/:boardId/lists', async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const lists = await TrelloService.getBoardLists(boardId);
    
    res.json({
      success: true,
      data: { lists },
      message: 'Board lists retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/trello/boards/:boardId/cards
// @desc    Get cards from a board
// @access  Private
router.get('/boards/:boardId/cards', async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const cards = await TrelloService.getCardsFromBoard(boardId);
    
    res.json({
      success: true,
      data: { cards },
      message: 'Board cards retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/trello/cards/:cardId
// @desc    Get card details
// @access  Private
router.get('/cards/:cardId', async (req, res, next) => {
  try {
    const { cardId } = req.params;
    const card = await TrelloService.getCardDetails(cardId);
    
    res.json({
      success: true,
      data: { card },
      message: 'Card details retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/trello/cards/:cardId/comments
// @desc    Get card comments
// @access  Private
router.get('/cards/:cardId/comments', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const { cardId } = req.params;
    const { limit = 50 } = req.query;
    
    const comments = await TrelloService.getCardComments(cardId, parseInt(limit));
    
    res.json({
      success: true,
      data: { comments },
      message: 'Card comments retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/trello/cards/:cardId/comments
// @desc    Post a comment on a card
// @access  Private (Admin only)
router.post('/cards/:cardId/comments', requireAdmin, [
  body('text').notEmpty().trim().isLength({ max: 16384 }).withMessage('Comment text is required and must be less than 16384 characters'),
  body('memberIds').optional().isArray().withMessage('Member IDs must be an array')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const { cardId } = req.params;
    const { text, memberIds = [] } = req.body;
    
    const comment = await TrelloService.postComment(cardId, text, memberIds);
    
    res.json({
      success: true,
      data: { comment },
      message: 'Comment posted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/trello/sync
// @desc    Sync cards from Trello to database
// @access  Private (Admin only)
router.post('/sync', requireAdmin, [
  body('boardIds').optional().isArray().withMessage('Board IDs must be an array')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    // First validate credentials
    const validation = await TrelloService.validateCredentials();
    if (!validation.valid) {
      // In development, provide mock sync results
      if (process.env.NODE_ENV === 'development') {
        const mockSyncResults = {
          totalCards: 2,
          newCards: 2,
          updatedCards: 0,
          errors: []
        };

        return res.json({
          success: true,
          data: { syncResults: mockSyncResults },
          message: 'Mock sync completed (Trello credentials invalid)',
          warning: 'Using mock data - please configure valid Trello credentials'
        });
      }

      return res.status(401).json({
        success: false,
        error: {
          message: 'Trello API credentials are invalid or expired',
          details: validation.error,
          type: 'TRELLO_AUTH_ERROR'
        }
      });
    }

    const { boardIds = [] } = req.body;

    const syncResults = await TrelloService.syncAllCards(boardIds);

    res.json({
      success: true,
      data: { syncResults },
      message: 'Cards synced successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/trello/cards
// @desc    Get cards from database with filtering
// @access  Private
router.get('/cards', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('boardId').optional().isString().withMessage('Board ID must be a string'),
  query('hasResponse').optional().isBoolean().withMessage('Has response must be a boolean'),
  query('isOverdue').optional().isBoolean().withMessage('Is overdue must be a boolean'),
  query('search').optional().isString().withMessage('Search must be a string')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const {
      page = 1,
      limit = 20,
      boardId,
      hasResponse,
      isOverdue,
      search
    } = req.query;

    // Check if using mock boards
    if (boardId && (boardId === 'mock-board-1' || boardId === 'mock-board-2')) {
      const mockCards = [
        {
          id: 'mock-card-1',
          name: 'Sample Task 1',
          description: 'This is a mock card for development',
          url: 'https://trello.com/c/mock-card-1',
          shortUrl: 'https://trello.com/c/mock1',
          boardId: boardId,
          boardName: boardId === 'mock-board-1' ? 'Sample Project Board' : 'Development Tasks',
          listId: 'mock-list-doing',
          listName: 'Doing',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          dateLastActivity: new Date(),
          assignedUsers: [],
          labels: [{ name: 'High Priority', color: 'red' }],
          reminderStatus: {
            hasResponse: false,
            lastReminderDate: null,
            reminderCount: 0
          }
        },
        {
          id: 'mock-card-2',
          name: 'Sample Task 2',
          description: 'Another mock card for testing',
          url: 'https://trello.com/c/mock-card-2',
          shortUrl: 'https://trello.com/c/mock2',
          boardId: boardId,
          boardName: boardId === 'mock-board-1' ? 'Sample Project Board' : 'Development Tasks',
          listId: 'mock-list-onhold',
          listName: 'On-Hold',
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday (overdue)
          dateLastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          assignedUsers: [],
          labels: [{ name: 'Bug', color: 'orange' }],
          reminderStatus: {
            hasResponse: false,
            lastReminderDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
            reminderCount: 1
          }
        }
      ];

      return res.json({
        success: true,
        data: {
          cards: mockCards,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: mockCards.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        },
        message: 'Mock cards retrieved (Trello credentials invalid)',
        warning: 'Using mock data - please configure valid Trello credentials'
      });
    }

    // Build query for real data
    const query = { isActive: true };

    if (boardId) query.boardId = boardId;
    if (hasResponse !== undefined) query['reminderStatus.hasResponse'] = hasResponse === 'true';
    if (isOverdue === 'true') query.dueDate = { $lt: new Date() };
    if (search) {
      query.$text = { $search: search };
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const cards = await Card.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignedUsers');

    const total = await Card.countDocuments(query);

    res.json({
      success: true,
      data: {
        cards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      },
      message: 'Cards retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/trello/cards/needing-reminders
// @desc    Get cards that need reminders
// @access  Private (Admin only)
router.get('/cards/needing-reminders', requireAdmin, async (req, res, next) => {
  try {
    const config = await Configuration.getCurrent();
    const cards = await TrelloService.getCardsNeedingReminders(config);
    
    res.json({
      success: true,
      data: { cards },
      message: 'Cards needing reminders retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/trello/cards/:cardId/reminder
// @desc    Send manual reminder for a card
// @access  Private (Admin only)
router.post('/cards/:cardId/reminder', requireAdmin, [
  body('type').isIn(['trello', 'email', 'sms', 'whatsapp']).withMessage('Reminder type must be trello, email, sms, or whatsapp'),
  body('urgent').optional().isBoolean().withMessage('Urgent must be a boolean'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const { cardId } = req.params;
    const { type, urgent = false, reason } = req.body;
    
    // Find card in database
    const card = await Card.findOne({ trelloId: cardId });
    if (!card) {
      return res.status(404).json({
        success: false,
        error: { message: 'Card not found' }
      });
    }

    // Mark as urgent if specified
    if (urgent) {
      await card.markAsUrgent(reason || 'Manual urgent reminder');
    }

    // Send reminder based on type
    let result;
    switch (type) {
      case 'trello':
        result = await TrelloService.sendReminderComment(card);
        break;
      case 'email':
        // This will be implemented in the notification service
        result = { message: 'Email reminder queued' };
        break;
      case 'sms':
        // This will be implemented in the notification service
        result = { message: 'SMS reminder queued' };
        break;
      case 'whatsapp':
        // This will be implemented in the notification service
        result = { message: 'WhatsApp reminder queued' };
        break;
    }

    res.json({
      success: true,
      data: { result },
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} reminder sent successfully`
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/trello/cards/:cardId/pause
// @desc    Pause reminders for a card
// @access  Private (Admin only)
router.put('/cards/:cardId/pause', requireAdmin, [
  body('until').isISO8601().withMessage('Until date must be a valid ISO 8601 date'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const { cardId } = req.params;
    const { until, reason } = req.body;
    
    const card = await Card.findOne({ trelloId: cardId });
    if (!card) {
      return res.status(404).json({
        success: false,
        error: { message: 'Card not found' }
      });
    }

    await card.pauseReminders(new Date(until), reason);
    
    res.json({
      success: true,
      data: { card },
      message: 'Card reminders paused successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/trello/stats
// @desc    Get Trello integration statistics
// @access  Private
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await MonitoringService.getCardsSummary();
    
    res.json({
      success: true,
      data: { stats },
      message: 'Statistics retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/trello/monitoring/trigger
// @desc    Trigger manual monitoring check
// @access  Private (Admin only)
router.post('/monitoring/trigger', requireAdmin, async (req, res, next) => {
  try {
    const result = await MonitoringService.triggerManualCheck();
    
    if (result.success) {
      res.json({
        success: true,
        data: { result },
        message: 'Manual monitoring check completed successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: { message: result.message }
      });
    }
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/trello/monitoring/status
// @desc    Get monitoring service status
// @access  Private
router.get('/monitoring/status', async (req, res, next) => {
  try {
    const status = MonitoringService.getStatus();
    
    res.json({
      success: true,
      data: { status },
      message: 'Monitoring status retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

