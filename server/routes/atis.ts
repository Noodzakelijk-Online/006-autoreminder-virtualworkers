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

export default router;
