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

export default router;
