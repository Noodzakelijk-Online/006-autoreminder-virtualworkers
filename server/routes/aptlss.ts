import { Router } from 'express';
import type { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db';
import { generationJobs, generationItems, scheduledJobs } from '../../drizzle/schema';
import { eq, desc, and } from 'drizzle-orm';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Mock data for development
const mockBoards = [
  { id: 'board1', name: 'VA Tasks - Operations', cardCount: 45 },
  { id: 'board2', name: 'VA Tasks - Finance', cardCount: 32 },
  { id: 'board3', name: 'VA Tasks - Marketing', cardCount: 28 },
];

const mockCards = [
  {
    id: 'card1',
    name: 'Review supplier contracts',
    desc: 'Review all active supplier contracts for renewal dates and pricing',
    idBoard: 'board1',
    idList: 'list1',
    boardName: 'VA Tasks - Operations',
    listName: 'To Do',
    checklists: [],
  },
  {
    id: 'card2',
    name: 'Update inventory spreadsheet',
    desc: 'Update Q4 inventory data in the main spreadsheet',
    idBoard: 'board1',
    idList: 'list1',
    boardName: 'VA Tasks - Operations',
    listName: 'To Do',
    checklists: [{ id: 'checklist1', name: 'APTLSS' }],
  },
];

// Get all workspaces (organizations)
router.get('/trello/workspaces', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!apiKey || !token) {
      console.warn('Trello credentials not found');
      return res.json([]);
    }

    const response = await fetch(
      `https://api.trello.com/1/members/me/organizations?key=${apiKey}&token=${token}`
    );
    
    if (!response.ok) {
      throw new Error(`Trello API error: ${response.statusText}`);
    }

    const workspaces = await response.json();
    
    // Get board counts for each workspace
    const workspacesWithCounts = await Promise.all(
      workspaces.map(async (workspace: any) => {
        try {
          const boardsResponse = await fetch(
            `https://api.trello.com/1/organizations/${workspace.id}/boards?filter=open&key=${apiKey}&token=${token}`
          );
          if (!boardsResponse.ok) {
            console.warn(`Failed to fetch boards for workspace ${workspace.displayName}`);
            return null;
          }
          const boards = await boardsResponse.json();
          const boardsArray = Array.isArray(boards) ? boards : [];
          
          // Get card counts for each board
          const boardsWithCards = await Promise.all(
            boardsArray.map(async (board: any) => {
              try {
                const cardsResponse = await fetch(
                  `https://api.trello.com/1/boards/${board.id}/cards?key=${apiKey}&token=${token}`
                );
                if (!cardsResponse.ok) return { id: board.id, name: board.name, cardCount: 0 };
                const cards = await cardsResponse.json();
                return {
                  id: board.id,
                  name: board.name,
                  cardCount: Array.isArray(cards) ? cards.length : 0
                };
              } catch (error) {
                return { id: board.id, name: board.name, cardCount: 0 };
              }
            })
          );
          
          const totalCards = boardsWithCards.reduce((sum, b) => sum + b.cardCount, 0);
          
          return {
            id: workspace.id,
            name: workspace.displayName,
            boardCount: boardsArray.length,
            cardCount: totalCards,
            boards: boardsWithCards
          };
        } catch (error) {
          console.warn(`Error fetching boards for workspace ${workspace.displayName}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null results (failed workspace fetches)
    const validWorkspaces = workspacesWithCounts.filter(w => w !== null);

    res.json(validWorkspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// Get all boards
router.get('/trello/boards', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!apiKey || !token) {
      console.warn('Trello credentials not found, using mock data');
      return res.json(mockBoards);
    }

    const response = await fetch(
      `https://api.trello.com/1/members/me/boards?filter=open&key=${apiKey}&token=${token}`
    );
    
    if (!response.ok) {
      throw new Error(`Trello API error: ${response.statusText}`);
    }

    const boards = await response.json();
    
    // Get card counts for each board with error handling
    const boardsWithCounts = await Promise.all(
      boards.map(async (board: any) => {
        try {
          const cardsResponse = await fetch(
            `https://api.trello.com/1/boards/${board.id}/cards?key=${apiKey}&token=${token}`
          );
          if (!cardsResponse.ok) {
            console.warn(`Failed to fetch cards for board ${board.name}`);
            return null;
          }
          const cards = await cardsResponse.json();
          return {
            id: board.id,
            name: board.name,
            cardCount: Array.isArray(cards) ? cards.length : 0
          };
        } catch (error) {
          console.warn(`Error fetching cards for board ${board.name}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null results (failed board fetches)
    const validBoards = boardsWithCounts.filter(b => b !== null);

    res.json(validBoards);
  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// Get cards for a specific board
router.get('/trello/boards/:boardId/cards', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!apiKey || !token) {
      console.warn('Trello credentials not found, using mock data');
      const cards = mockCards.filter(card => card.idBoard === boardId);
      return res.json(cards);
    }

    // Fetch cards with checklists and board/list info
    const response = await fetch(
      `https://api.trello.com/1/boards/${boardId}/cards?key=${apiKey}&token=${token}&checklists=all&list=true&board=true`
    );
    
    if (!response.ok) {
      throw new Error(`Trello API error: ${response.statusText}`);
    }

    const cards = await response.json();
    
    // Transform to our format
    const formattedCards = cards.map((card: any) => ({
      id: card.id,
      name: card.name,
      desc: card.desc,
      idBoard: card.idBoard,
      idList: card.idList,
      boardName: card.board?.name,
      listName: card.list?.name,
      checklists: card.checklists || []
    }));

    res.json(formattedCards);
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// Generate APTLSS for a card
router.post('/aptlss/generate', async (req: Request, res: Response) => {
  try {
    const { cardId, cardData, settings } = req.body;

    if (!cardId && !cardData) {
      return res.status(400).json({ error: 'Card ID or card data is required' });
    }

    // Fetch card data if only ID provided
    let card = cardData;
    if (!card && cardId) {
      const apiKey = process.env.TRELLO_API_KEY;
      const token = process.env.TRELLO_TOKEN;
      
      const response = await fetch(
        `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${token}&checklists=all`
      );
      card = await response.json();
    }

    console.log(`Generating APTLSS for card ${card.id} with settings:`, settings);

    // Call Python APTLSS generator
    const pythonScript = path.join(__dirname, 'aptlss-bridge.py');
    const input = JSON.stringify({ cardData: card, settings });
    
    try {
      const { stdout, stderr } = await execAsync(
        `python3 "${pythonScript}" '${input.replace(/'/g, "'\\''")}' 2>&1`
      );
      
      if (stderr) {
        console.error('Python stderr:', stderr);
      }
      
      const result = JSON.parse(stdout);
      
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error,
          validation: result.validation
        });
      }
      
      res.json(result);
    } catch (pythonError: any) {
      console.error('Python execution error:', pythonError);
      
      // Fallback to mock generation if Python fails
      console.warn('Python APTLSS generator failed, using mock generation');
      res.json({
        success: true,
        cardId: card.id,
        message: 'APTLSS generated (mock mode)',
        checklistId: 'checklist_' + Date.now(),
        mock: true
      });
    }
  } catch (error) {
    console.error('Error generating APTLSS:', error);
    res.status(500).json({ error: 'Failed to generate APTLSS' });
  }
});

// Get generation history
router.get('/aptlss/history', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    const jobs = await db.select().from(generationJobs).orderBy(desc(generationJobs.createdAt));
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get job details with items
router.get('/aptlss/history/:jobId', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const { jobId } = req.params;
    
    const job = await db.select().from(generationJobs).where(eq(generationJobs.id, jobId)).limit(1);
    
    if (!job || job.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const items = await db.select().from(generationItems).where(eq(generationItems.jobId, jobId));
    
    res.json({
      ...job[0],
      items
    });
  } catch (error) {
    console.error('Error fetching job details:', error);
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

// Retry failed items
router.post('/aptlss/history/:jobId/retry', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const { jobId } = req.params;
    
    // Get failed items
    const failedItems = await db.select()
      .from(generationItems)
      .where(eq(generationItems.jobId, jobId));
    
    const failed = failedItems.filter((item: any) => item.status === 'failed');
    
    if (failed.length === 0) {
      return res.json({ message: 'No failed items to retry' });
    }
    
    // Create new job for retries
    const newJobId = `retry_${jobId}_${Date.now()}`;
    
    await db.insert(generationJobs).values({
      id: newJobId,
      totalCards: failed.length,
      completedCards: 0,
      failedCards: 0,
      status: 'running',
      settings: '{}',
      createdBy: 'system',
      createdAt: new Date()
    });
    
    res.json({
      success: true,
      jobId: newJobId,
      itemsToRetry: failed.length
    });
  } catch (error) {
    console.error('Error retrying failed items:', error);
    res.status(500).json({ error: 'Failed to retry items' });
  }
});

// Batch generate APTLSS
router.post('/aptlss/generate-batch', async (req: Request, res: Response) => {
  try {
    const { cardIds, settings } = req.body;

    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ error: 'Card IDs array is required' });
    }

    console.log(`Batch generating APTLSS for ${cardIds.length} cards`);

    // TODO: Implement actual batch generation
    // This would process cards in batches using the Python APTLSS generator

    const results = {
      total: cardIds.length,
      completed: 0,
      failed: 0,
      results: [] as any[],
    };

    for (const cardId of cardIds) {
      try {
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 500));

        results.completed++;
        results.results.push({
          cardId,
          success: true,
          checklistId: 'checklist_' + Date.now(),
        });
      } catch (error) {
        results.failed++;
        results.results.push({
          cardId,
          success: false,
          error: 'Generation failed',
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error in batch generation:', error);
    res.status(500).json({ error: 'Failed to batch generate APTLSS' });
  }
});

// Get generation status
router.get('/aptlss/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    // TODO: Implement actual status tracking
    // This would check the status of a running generation job

    res.json({
      jobId,
      status: 'completed',
      progress: {
        total: 10,
        completed: 10,
        failed: 0,
      },
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Schedule generation endpoint
router.post('/aptlss/schedule', async (req: any, res: Response) => {
  try {
    const { cardIds, scheduledTime, settings } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const jobId = `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await db.insert(scheduledJobs).values({
      id: jobId,
      cardIds: JSON.stringify(cardIds),
      scheduledTime: new Date(scheduledTime),
      status: 'pending',
      settings: JSON.stringify(settings),
      createdBy: user.openId
    });

    res.json({ success: true, jobId });
  } catch (error) {
    console.error('Error scheduling generation:', error);
    res.status(500).json({ error: 'Failed to schedule generation' });
  }
});

// Get scheduled jobs endpoint
router.get('/aptlss/scheduled', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const jobs = await db.select().from(scheduledJobs)
      .where(eq(scheduledJobs.createdBy, user.openId))
      .orderBy(desc(scheduledJobs.createdAt));

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching scheduled jobs:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled jobs' });
  }
});

// Cancel scheduled job endpoint
router.delete('/aptlss/scheduled/:id', async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    await db.update(scheduledJobs)
      .set({ status: 'cancelled' })
      .where(and(
        eq(scheduledJobs.id, id),
        eq(scheduledJobs.createdBy, user.openId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling scheduled job:', error);
    res.status(500).json({ error: 'Failed to cancel scheduled job' });
  }
});

export default router;
