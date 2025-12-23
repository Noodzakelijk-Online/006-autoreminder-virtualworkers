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
      // Parse checklist JSON
      let checklist: any[] = [];
      // APTLSS checklist is generated from AI understanding, stored in description for now
      // We'll generate checklist steps from the goal/deliverable if no checklist exists
      if (card.goal) {
        try {
          // Generate simple checklist from goal
          checklist = [{ step: card.goal, timeMinutes: card.estimatedMinutes || 30, aptlssType: 'T' }];
        } catch (e) {
          checklist = [];
        }
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

    res.json({
      tasks,
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

export default router;
