/**
 * ATIS API Routes
 * 
 * Endpoints for the Adaptive Task Intelligence System
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { 
  atisWorkspaces, 
  atisBoards, 
  atisCards, 
  atisAttachments,
  atisComments,
  atisIngestionJobs,
  atisCardUnderstanding,
} from '../../drizzle/schema';
import { eq, desc, isNull, sql, and } from 'drizzle-orm';
import { processCardUnderstanding, processAllCardsUnderstanding, getUnderstandingStats } from '../services/atis-understanding';
import { createChecklistSyncService } from '../services/trello-checklist-sync';
import { createAttachmentExtractor } from '../services/attachment-extractor';
import { createChatbotExtractor } from '../services/chatbot-extractor';

const router = Router();

/**
 * GET /api/atis/stats
 * Get current ingestion statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const [workspaceResult] = await db.select({ count: sql<number>`count(*)` }).from(atisWorkspaces);
    const [boardResult] = await db.select({ count: sql<number>`count(*)` }).from(atisBoards);
    const [cardResult] = await db.select({ count: sql<number>`count(*)` }).from(atisCards);
    const [attachmentResult] = await db.select({ count: sql<number>`count(*)` }).from(atisAttachments);
    const [commentResult] = await db.select({ count: sql<number>`count(*)` }).from(atisComments);
    
    // Get pending attachments (not yet processed)
    const [pendingResult] = await db.select({ count: sql<number>`count(*)` })
      .from(atisAttachments)
      .where(eq(atisAttachments.extractionStatus, 'pending'));

    // Get cards without understanding
    const [cardsWithoutUnderstanding] = await db.select({ count: sql<number>`count(*)` })
      .from(atisCards);
    const [cardsWithUnderstanding] = await db.select({ count: sql<number>`count(*)` })
      .from(atisCardUnderstanding);

    // Get cards without due dates
    const [cardsWithoutDueDate] = await db.select({ count: sql<number>`count(*)` })
      .from(atisCards)
      .where(isNull(atisCards.dueDate));

    res.json({
      workspaces: Number(workspaceResult?.count) || 0,
      boards: Number(boardResult?.count) || 0,
      cards: Number(cardResult?.count) || 0,
      attachments: Number(attachmentResult?.count) || 0,
      comments: Number(commentResult?.count) || 0,
      pendingAttachments: Number(pendingResult?.count) || 0,
      cardsWithUnderstanding: Number(cardsWithUnderstanding?.count) || 0,
      cardsWithoutUnderstanding: (Number(cardsWithoutUnderstanding?.count) || 0) - (Number(cardsWithUnderstanding?.count) || 0),
      cardsWithoutDueDate: Number(cardsWithoutDueDate?.count) || 0,
    });
  } catch (error: any) {
    console.error('[ATIS] Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/jobs
 * Get list of ingestion jobs
 */
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const jobs = await db.select()
      .from(atisIngestionJobs)
      .orderBy(desc(atisIngestionJobs.createdAt))
      .limit(20);

    res.json(jobs);
  } catch (error: any) {
    console.error('[ATIS] Jobs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/workspaces
 * Get all ingested workspaces
 */
router.get('/workspaces', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const workspaces = await db.select()
      .from(atisWorkspaces)
      .orderBy(atisWorkspaces.name);

    res.json(workspaces);
  } catch (error: any) {
    console.error('[ATIS] Workspaces error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/boards
 * Get all ingested boards (optionally filtered by workspace)
 */
router.get('/boards', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;

    let query = db.select().from(atisBoards);
    if (workspaceId) {
      query = query.where(eq(atisBoards.workspaceId, workspaceId)) as any;
    }
    
    const boards = await query.orderBy(atisBoards.name);

    res.json(boards);
  } catch (error: any) {
    console.error('[ATIS] Boards error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/cards
 * Get all ingested cards (optionally filtered by board)
 */
router.get('/cards', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const boardId = req.query.boardId ? parseInt(req.query.boardId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    let query = db.select().from(atisCards);
    if (boardId) {
      query = query.where(eq(atisCards.boardId, boardId)) as any;
    }
    
    const cards = await query
      .orderBy(desc(atisCards.dueDate))
      .limit(limit)
      .offset(offset);

    res.json(cards);
  } catch (error: any) {
    console.error('[ATIS] Cards error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/cards/:id
 * Get a single card with all its data
 */
router.get('/cards/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const cardId = parseInt(req.params.id);

    const [card] = await db.select()
      .from(atisCards)
      .where(eq(atisCards.id, cardId))
      .limit(1);

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Get attachments
    const attachments = await db.select()
      .from(atisAttachments)
      .where(eq(atisAttachments.cardId, cardId));

    // Get comments
    const comments = await db.select()
      .from(atisComments)
      .where(eq(atisComments.cardId, cardId))
      .orderBy(desc(atisComments.commentDate));

    // Get understanding if exists
    const [understanding] = await db.select()
      .from(atisCardUnderstanding)
      .where(eq(atisCardUnderstanding.cardId, cardId))
      .limit(1);

    res.json({
      ...card,
      attachments,
      comments,
      understanding,
    });
  } catch (error: any) {
    console.error('[ATIS] Card error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/cards-without-due-date
 * Get all cards that don't have a due date
 */
router.get('/cards-without-due-date', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const cards = await db.select({
      id: atisCards.id,
      trelloId: atisCards.trelloId,
      name: atisCards.name,
      description: atisCards.description,
      url: atisCards.url,
      listName: atisCards.listName,
      boardId: atisCards.boardId,
      isArchived: atisCards.isArchived,
    })
      .from(atisCards)
      .where(isNull(atisCards.dueDate))
      .orderBy(atisCards.name);

    // Get board names for context
    const boardIds = Array.from(new Set(cards.map(c => c.boardId)));
    
    if (boardIds.length > 0) {
      const boards = await db.select()
        .from(atisBoards);
      
      const boardMap = new Map(boards.map(b => [b.id, b.name]));

      const cardsWithBoardNames = cards.map(c => ({
        ...c,
        boardName: boardMap.get(c.boardId) || 'Unknown',
      }));

      return res.json(cardsWithBoardNames);
    }

    res.json(cards);
  } catch (error: any) {
    console.error('[ATIS] Cards without due date error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/understanding/stats
 * Get AI understanding statistics
 */
router.get('/understanding/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getUnderstandingStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[ATIS] Understanding stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/atis/understanding/process
 * Process cards with AI understanding
 */
router.post('/understanding/process', async (req: Request, res: Response) => {
  try {
    const { cardId, limit } = req.body;

    if (cardId) {
      // Process single card
      const understanding = await processCardUnderstanding(cardId);
      if (!understanding) {
        return res.status(404).json({ error: 'Card not found' });
      }
      return res.json({ success: true, understanding });
    }

    // Process all cards without understanding
    console.log('[ATIS] Starting batch AI understanding processing...');
    
    const result = await processAllCardsUnderstanding(
      (progress) => {
        if (progress.current % 5 === 0) {
          console.log(`[ATIS Understanding] Progress: ${progress.current}/${progress.total} - ${progress.status}`);
        }
      },
      limit || 100 // Default to 100 cards at a time
    );

    res.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
    });
  } catch (error: any) {
    console.error('[ATIS] Understanding process error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/card/:id/understanding
 * Get AI understanding for a specific card
 */
router.get('/card/:id/understanding', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const cardId = parseInt(req.params.id);

    const [understanding] = await db.select()
      .from(atisCardUnderstanding)
      .where(eq(atisCardUnderstanding.cardId, cardId))
      .limit(1);

    if (!understanding) {
      return res.status(404).json({ error: 'Understanding not found for this card' });
    }

    // Parse JSON fields
    res.json({
      ...understanding,
      entities: understanding.entities ? JSON.parse(understanding.entities) : null,
      deadlines: understanding.deadlines ? JSON.parse(understanding.deadlines) : null,
      dependencies: understanding.dependencies ? JSON.parse(understanding.dependencies) : null,
      produces: understanding.produces ? JSON.parse(understanding.produces) : null,
      missingInfo: understanding.missingInfo ? JSON.parse(understanding.missingInfo) : null,
    });
  } catch (error: any) {
    console.error('[ATIS] Card understanding error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/atis/understanding/reprocess-failed
 * Reprocess cards with low confidence (fallback results)
 */
router.post('/understanding/reprocess-failed', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { limit = 50 } = req.body;

    // Get cards with low confidence (fallback results)
    const lowConfidenceCards = await db.select({
      id: atisCardUnderstanding.cardId,
    })
      .from(atisCardUnderstanding)
      .where(sql`${atisCardUnderstanding.confidenceScore} < 30`)
      .limit(limit);

    console.log(`[ATIS] Reprocessing ${lowConfidenceCards.length} low-confidence cards...`);

    let processed = 0;
    let failed = 0;

    for (const card of lowConfidenceCards) {
      try {
        await processCardUnderstanding(card.id);
        processed++;
        console.log(`[ATIS Reprocess] [${processed}/${lowConfidenceCards.length}] Reprocessed card ${card.id}`);
      } catch (error: any) {
        failed++;
        console.error(`[ATIS Reprocess] Failed to reprocess card ${card.id}:`, error.message);
      }
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    res.json({
      success: true,
      processed,
      failed,
      remaining: lowConfidenceCards.length - processed,
    });
  } catch (error: any) {
    console.error('[ATIS] Reprocess failed error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/timeline-tasks
 * Get tasks for the dashboard timeline with AI understanding and checklists
 */
router.get('/timeline-tasks', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { 
      limit = 50,
      offset = 0,
      filter = 'upcoming', // upcoming, overdue, all, today
      taskType, // admin, creation, technical, etc.
      complexity, // simple, medium, complex
      sortBy = 'dueDate', // dueDate, estimatedTime, complexity
      sortOrder = 'asc',
    } = req.query;

    // Build query conditions
    const conditions = [
      eq(atisCards.isArchived, 0), // Only non-archived cards
    ];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Get cards with their understanding
    const cards = await db.select({
      id: atisCards.id,
      trelloId: atisCards.trelloId,
      name: atisCards.name,
      description: atisCards.description,
      url: atisCards.url,
      listName: atisCards.listName,
      dueDate: atisCards.dueDate,
      boardId: atisCards.boardId,
      // Understanding fields
      understandingId: atisCardUnderstanding.id,
      goal: atisCardUnderstanding.goal,
      deliverable: atisCardUnderstanding.deliverable,
      taskType: atisCardUnderstanding.taskType,
      complexity: atisCardUnderstanding.complexity,
      estimatedMinutes: atisCardUnderstanding.estimatedMinutes,
      confidenceScore: atisCardUnderstanding.confidenceScore,
      clarityScore: atisCardUnderstanding.clarityScore,
      entities: atisCardUnderstanding.entities,
      aptlssChecklist: atisCardUnderstanding.aptlssChecklist,
    })
      .from(atisCards)
      .leftJoin(atisCardUnderstanding, eq(atisCards.id, atisCardUnderstanding.cardId))
      .where(and(...conditions))
      .orderBy(
        sortOrder === 'desc' 
          ? desc(atisCards.dueDate) 
          : atisCards.dueDate
      )
      .limit(Number(limit))
      .offset(Number(offset));

    // Get board names
    const boardIds = Array.from(new Set(cards.map(c => c.boardId)));
    const boards = boardIds.length > 0 
      ? await db.select().from(atisBoards).where(sql`${atisBoards.id} IN (${sql.join(boardIds.map(id => sql`${id}`), sql`, `)})`)
      : [];
    const boardMap = new Map(boards.map(b => [b.id, b.name]));

    // Process and filter results
    let tasks = cards.map(card => {
      // Parse checklist JSON from stored aptlssChecklist or generate fallback
      let checklist: any[] = [];
      
      // First try to parse stored aptlssChecklist from AI understanding
      if (card.aptlssChecklist) {
        try {
          const parsed = JSON.parse(card.aptlssChecklist);
          if (Array.isArray(parsed) && parsed.length > 0) {
            checklist = parsed.map((item: any) => ({
              step: item.name || item.step || item.description || 'Step',
              timeMinutes: item.estimatedMinutes || item.timeMinutes || item.time || 15,
              aptlssType: item.priority || item.aptlssType || item.type || 'T',
            }));
          }
        } catch (e) {
          console.warn('[ATIS] Failed to parse aptlssChecklist for card', card.id, e);
        }
      }
      
      // Fallback: generate simple checklist from goal if no stored checklist
      if (checklist.length === 0 && card.goal) {
        checklist = [{ step: card.goal, timeMinutes: card.estimatedMinutes || 30, aptlssType: 'T' }];
      }

      // Parse entities JSON
      let entities: any = null;
      if (card.entities) {
        try {
          entities = JSON.parse(card.entities);
        } catch (e) {
          entities = null;
        }
      }

      // Calculate status based on due date
      let status = 'pending';
      if (card.dueDate) {
        const due = new Date(card.dueDate);
        if (due < now) {
          status = 'overdue';
        } else if (due < todayEnd) {
          status = 'due_today';
        } else if (due < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          status = 'due_this_week';
        }
      }

      return {
        id: card.id,
        atisCardId: card.id, // For sync operations
        trelloId: card.trelloId,
        name: card.name,
        description: card.description,
        url: card.url,
        listName: card.listName,
        boardName: boardMap.get(card.boardId) || 'Unknown',
        dueDate: card.dueDate,
        status,
        // AI Understanding
        hasUnderstanding: !!card.understandingId,
        goal: card.goal,
        deliverable: card.deliverable,
        taskType: card.taskType,
        complexity: card.complexity,
        estimatedMinutes: card.estimatedMinutes,
        confidenceScore: card.confidenceScore,
        clarityScore: card.clarityScore,
        entities,
        // APTLSS Checklist
        checklist: checklist.map((item: any, index: number) => ({
          id: `${card.id}-step-${index}`,
          step: item.step || item,
          timeMinutes: item.timeMinutes || item.time || 5,
          aptlssType: item.aptlssType || item.type || 'T',
          completed: false, // Will be tracked separately
        })),
        totalSteps: checklist.length,
        completedSteps: 0, // Will be updated from tracking
      };
    });

    // Deduplicate by card name - keep only one card per unique name
    // This handles cases where the same card exists in multiple boards (e.g., template copies)
    const seenCardNames = new Map<string, typeof tasks[0]>();
    tasks.forEach(task => {
      const key = task.name.toLowerCase().trim();
      const existing = seenCardNames.get(key);
      // Keep the one with:
      // 1. AI understanding (prioritize analyzed cards)
      // 2. Higher id (more recent) if both have/don't have understanding
      if (!existing || 
          (task.hasUnderstanding && !existing.hasUnderstanding) ||
          (task.hasUnderstanding === existing.hasUnderstanding && task.id > existing.id)) {
        seenCardNames.set(key, task);
      }
    });
    tasks = Array.from(seenCardNames.values());

    // Apply filters
    if (filter === 'overdue') {
      tasks = tasks.filter(t => t.status === 'overdue');
    } else if (filter === 'today') {
      tasks = tasks.filter(t => t.status === 'due_today');
    } else if (filter === 'upcoming') {
      tasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) >= now);
    }

    if (taskType) {
      tasks = tasks.filter(t => t.taskType === taskType);
    }

    if (complexity) {
      tasks = tasks.filter(t => t.complexity === complexity);
    }

    // Get total count for pagination
    const [totalResult] = await db.select({ count: sql<number>`count(*)` })
      .from(atisCards)
      .where(eq(atisCards.isArchived, 0));

    // For now, all tasks are considered scheduled (no overflow logic in ATIS endpoint)
    // The overflow logic will be applied when scheduling is triggered
    const scheduled = tasks;
    const overflow: typeof tasks = [];
    
    // Calculate metrics
    const totalScheduledMinutes = scheduled.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
    const totalOverflowMinutes = overflow.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
    const dailyCapacityMinutes = 480; // 8 hours per day
    
    res.json({
      scheduled,
      overflow,
      metrics: {
        totalScheduled: scheduled.length,
        totalOverflow: overflow.length,
        totalScheduledMinutes,
        totalOverflowMinutes,
        dailyCapacityMinutes,
        averageDailyLoad: scheduled.length > 0 ? (totalScheduledMinutes / 5) : 0,
      },
      pagination: {
        total: Number(totalResult?.count) || 0,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: tasks.length === Number(limit),
      },
      filters: {
        filter,
        taskType,
        complexity,
        sortBy,
        sortOrder,
      },
    });
  } catch (error: any) {
    console.error('[ATIS] Timeline tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/atis/checklist/toggle
 * Toggle completion status of a checklist step
 */
router.post('/checklist/toggle', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { cardId, stepIndex, userId } = req.body;

    if (!cardId || stepIndex === undefined || !userId) {
      return res.status(400).json({ error: 'Missing required fields: cardId, stepIndex, userId' });
    }

    // Check if already completed
    const existing = await db.execute(
      sql`SELECT id FROM atis_checklist_completion WHERE card_id = ${cardId} AND step_index = ${stepIndex} AND user_id = ${userId}`
    );
    const rows = (existing as any)[0] || [];

    if (rows && rows.length > 0) {
      // Remove completion
      await db.execute(
        sql`DELETE FROM atis_checklist_completion WHERE card_id = ${cardId} AND step_index = ${stepIndex} AND user_id = ${userId}`
      );
      return res.json({ completed: false, cardId, stepIndex });
    } else {
      // Add completion
      await db.execute(
        sql`INSERT INTO atis_checklist_completion (card_id, step_index, user_id) VALUES (${cardId}, ${stepIndex}, ${userId})`
      );
      return res.json({ completed: true, cardId, stepIndex });
    }
  } catch (error: any) {
    console.error('[ATIS] Checklist toggle error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/checklist/status/:cardId
 * Get completion status for all steps of a card
 */
router.get('/checklist/status/:cardId', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const cardId = parseInt(req.params.cardId);
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;

    let query = sql`SELECT step_index, user_id, completed_at FROM atis_checklist_completion WHERE card_id = ${cardId}`;
    if (userId) {
      query = sql`SELECT step_index, user_id, completed_at FROM atis_checklist_completion WHERE card_id = ${cardId} AND user_id = ${userId}`;
    }

    const result = await db.execute(query);
    const rows = (result as any)[0] || [];
    const completedSteps = rows.map((r: any) => ({
      stepIndex: r.step_index,
      userId: r.user_id,
      completedAt: r.completed_at,
    }));

    res.json({ cardId, completedSteps });
  } catch (error: any) {
    console.error('[ATIS] Checklist status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/atis/checklist/sync-completion/:cardId
 * Sync completion status to Trello when a step is completed in dashboard
 */
router.post('/checklist/sync-completion/:cardId', async (req: Request, res: Response) => {
  try {
    const cardId = parseInt(req.params.cardId);
    const { stepIndex, completed } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Get card's Trello ID and synced checklist ID
    const cardResult = await db.execute(sql`
      SELECT c.trello_id, s.trello_checklist_id
      FROM atis_cards c
      LEFT JOIN atis_checklist_sync s ON c.trello_id = s.trello_card_id
      WHERE c.id = ${cardId}
    `);
    const cardRows = (cardResult as any)[0] || [];

    if (cardRows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const { trello_id: trelloCardId, trello_checklist_id: checklistId } = cardRows[0];

    if (!trelloCardId || !checklistId) {
      return res.json({ synced: false, reason: 'Checklist not synced to Trello yet' });
    }

    // Get checklist items from Trello
    const syncService = createChecklistSyncService();
    const checklists = await syncService.getCardChecklists(trelloCardId);
    const aptlssChecklist = checklists.find(c => c.id === checklistId);

    if (!aptlssChecklist) {
      return res.json({ synced: false, reason: 'APTLSS checklist not found on Trello card' });
    }

    // Find the item at the given step index
    if (stepIndex >= aptlssChecklist.checkItems.length) {
      return res.status(400).json({ error: 'Step index out of range' });
    }

    const checkItem = aptlssChecklist.checkItems[stepIndex];
    const newState = completed ? 'complete' : 'incomplete';

    // Update in Trello
    await syncService.updateChecklistItemState(trelloCardId, checkItem.id, newState);

    res.json({ synced: true, stepIndex, completed, trelloItemId: checkItem.id });
  } catch (error: any) {
    console.error('[ATIS] Checklist sync completion error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/atis/sync-checklist/:cardId
 * Sync APTLSS checklist to a single Trello card
 */
router.post('/sync-checklist/:cardId', async (req: Request, res: Response) => {
  try {
    const cardId = parseInt(req.params.cardId);
    const { replaceExisting = false, preserveCompleted = true } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Get card understanding with checklist
    const result = await db.execute(sql`
      SELECT c.trello_id, u.checklist
      FROM atis_cards c
      LEFT JOIN atis_card_understanding u ON c.id = u.card_id
      WHERE c.id = ${cardId}
    `);

    const rows = (result as any)[0] || [];
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const card = rows[0];
    if (!card.trello_id) {
      return res.status(400).json({ error: 'Card has no Trello ID' });
    }

    let checklist: any[] = [];
    try {
      checklist = card.checklist ? JSON.parse(card.checklist) : [];
    } catch (e) {
      return res.status(400).json({ error: 'Invalid checklist data' });
    }

    if (checklist.length === 0) {
      return res.status(400).json({ error: 'No checklist items to sync' });
    }

    // Sync to Trello
    const syncService = createChecklistSyncService();
    const syncResult = await syncService.syncChecklistToCard(
      card.trello_id,
      checklist,
      { replaceExisting, preserveCompleted }
    );

    res.json(syncResult);
  } catch (error: any) {
    console.error('[ATIS] Checklist sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/atis/sync-checklists/bulk
 * Bulk sync APTLSS checklists to multiple Trello cards
 */
router.post('/sync-checklists/bulk', async (req: Request, res: Response) => {
  try {
    const { cardIds, replaceExisting = false, preserveCompleted = true, limit = 50 } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Get cards with understanding
    let result;
    if (cardIds && cardIds.length > 0) {
      const idList = cardIds.map((id: number) => id).join(',');
      result = await db.execute(sql`
        SELECT c.id, c.trello_id, u.checklist
        FROM atis_cards c
        JOIN atis_card_understanding u ON c.id = u.card_id
        WHERE c.id IN (${sql.raw(idList)})
        AND u.checklist IS NOT NULL
        AND c.trello_id IS NOT NULL
        LIMIT ${limit}
      `);
    } else {
      result = await db.execute(sql`
        SELECT c.id, c.trello_id, u.checklist
        FROM atis_cards c
        JOIN atis_card_understanding u ON c.id = u.card_id
        WHERE u.checklist IS NOT NULL
        AND c.trello_id IS NOT NULL
        AND c.is_archived = 0
        LIMIT ${limit}
      `);
    }

    const rows = (result as any)[0] || [];

    if (rows.length === 0) {
      return res.json({ total: 0, success: 0, failed: 0, results: [] });
    }

    // Parse checklists and prepare for sync
    const cardsToSync = rows.map((row: any) => {
      let checklist: any[] = [];
      try {
        checklist = row.checklist ? JSON.parse(row.checklist) : [];
      } catch (e) {
        checklist = [];
      }
      return {
        cardId: row.id,
        trelloId: row.trello_id,
        checklist,
      };
    }).filter((c: any) => c.checklist.length > 0);

    // Sync to Trello
    const syncService = createChecklistSyncService();
    const syncResult = await syncService.bulkSync(cardsToSync, { replaceExisting, preserveCompleted });

    res.json(syncResult);
  } catch (error: any) {
    console.error('[ATIS] Bulk checklist sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/sync-status/:cardId
 * Get sync status for a card
 */
router.get('/sync-status/:cardId', async (req: Request, res: Response) => {
  try {
    const cardId = parseInt(req.params.cardId);

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Get card's Trello ID
    const cardResult = await db.execute(sql`
      SELECT trello_id FROM atis_cards WHERE id = ${cardId}
    `);
    const cardRows = (cardResult as any)[0] || [];
    
    if (cardRows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const trelloId = cardRows[0].trello_id;
    if (!trelloId) {
      return res.json({ synced: false, reason: 'No Trello ID' });
    }

    // Get sync status
    const syncResult = await db.execute(sql`
      SELECT trello_checklist_id, items_synced, synced_at
      FROM atis_checklist_sync
      WHERE trello_card_id = ${trelloId}
    `);
    const syncRows = (syncResult as any)[0] || [];

    if (syncRows.length === 0) {
      return res.json({ synced: false });
    }

    res.json({
      synced: true,
      checklistId: syncRows[0].trello_checklist_id,
      itemsSynced: syncRows[0].items_synced,
      syncedAt: syncRows[0].synced_at,
    });
  } catch (error: any) {
    console.error('[ATIS] Sync status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/task-types
 * Get available task types for filtering
 */
router.get('/task-types', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const result = await db.select({
      taskType: atisCardUnderstanding.taskType,
      count: sql<number>`count(*)`,
    })
      .from(atisCardUnderstanding)
      .groupBy(atisCardUnderstanding.taskType)
      .orderBy(desc(sql`count(*)`));

    res.json(result.filter(r => r.taskType));
  } catch (error: any) {
    console.error('[ATIS] Task types error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ATTACHMENT EXTRACTION ENDPOINTS
// ============================================

/**
 * GET /api/atis/extraction/stats
 * Get attachment extraction statistics
 */
router.get('/extraction/stats', async (req: Request, res: Response) => {
  try {
    const extractor = createAttachmentExtractor();
    const stats = await extractor.getExtractionStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[ATIS] Extraction stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/atis/extraction/process
 * Process pending attachments for content extraction
 */
router.post('/extraction/process', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.body;
    const extractor = createAttachmentExtractor();
    const result = await extractor.processPendingAttachments(limit);
    res.json(result);
  } catch (error: any) {
    console.error('[ATIS] Extraction process error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/extraction/card/:cardId
 * Get extracted content for a specific card
 */
router.get('/extraction/card/:cardId', async (req: Request, res: Response) => {
  try {
    const cardId = parseInt(req.params.cardId);
    const extractor = createAttachmentExtractor();
    const content = await extractor.getCardAttachmentContent(cardId);
    res.json({ cardId, attachmentCount: content.length, content });
  } catch (error: any) {
    console.error('[ATIS] Card extraction error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CHATBOT URL EXTRACTION ENDPOINTS
// ============================================

/**
 * GET /api/atis/chatbot/stats
 * Get chatbot URL extraction statistics
 */
router.get('/chatbot/stats', async (req: Request, res: Response) => {
  try {
    const extractor = createChatbotExtractor();
    const stats = await extractor.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[ATIS] Chatbot stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/atis/chatbot/scan
 * Scan cards and comments for chatbot URLs
 */
router.post('/chatbot/scan', async (req: Request, res: Response) => {
  try {
    const extractor = createChatbotExtractor();
    const detected = await extractor.scanForChatbotUrls();
    
    // Group by platform
    const byPlatform: Record<string, number> = {};
    for (const d of detected) {
      byPlatform[d.platform] = (byPlatform[d.platform] || 0) + 1;
    }
    
    res.json({
      totalDetected: detected.length,
      byPlatform,
      urls: detected.slice(0, 50), // Return first 50 for preview
    });
  } catch (error: any) {
    console.error('[ATIS] Chatbot scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/atis/chatbot/process
 * Process detected chatbot URLs and extract conversations
 */
router.post('/chatbot/process', async (req: Request, res: Response) => {
  try {
    const { limit = 20 } = req.body;
    const extractor = createChatbotExtractor();
    const result = await extractor.processDetectedUrls(limit);
    res.json(result);
  } catch (error: any) {
    console.error('[ATIS] Chatbot process error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/atis/chatbot/card/:cardId
 * Get chatbot conversations for a specific card
 */
router.get('/chatbot/card/:cardId', async (req: Request, res: Response) => {
  try {
    const cardId = parseInt(req.params.cardId);
    const extractor = createChatbotExtractor();
    const conversations = await extractor.getCardConversations(cardId);
    res.json({ cardId, conversationCount: conversations.length, conversations });
  } catch (error: any) {
    console.error('[ATIS] Card chatbot error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/atis/chatbot/extract-url
 * Extract conversation from a single chatbot URL
 */
router.post('/chatbot/extract-url', async (req: Request, res: Response) => {
  try {
    const { url, cardId } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const extractor = createChatbotExtractor();
    const detected = extractor.detectUrls(url);
    
    if (detected.length === 0) {
      return res.status(400).json({ error: 'No valid chatbot URL detected' });
    }
    
    const { url: detectedUrl, platform } = detected[0];
    const result = await extractor.extractConversation(detectedUrl, platform);
    
    if (result.success && result.conversation && cardId) {
      await extractor.storeConversation(cardId, result.conversation, detectedUrl);
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('[ATIS] URL extraction error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
