import { Router } from 'express';
import type { Request, Response } from 'express';

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
      `https://api.trello.com/1/members/me/boards?key=${apiKey}&token=${token}`
    );
    
    if (!response.ok) {
      throw new Error(`Trello API error: ${response.statusText}`);
    }

    const boards = await response.json();
    
    // Get card counts for each board
    const boardsWithCounts = await Promise.all(
      boards.map(async (board: any) => {
        const cardsResponse = await fetch(
          `https://api.trello.com/1/boards/${board.id}/cards?key=${apiKey}&token=${token}`
        );
        const cards = await cardsResponse.json();
        return {
          id: board.id,
          name: board.name,
          cardCount: cards.length
        };
      })
    );

    res.json(boardsWithCounts);
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
    const { cardId, settings } = req.body;

    if (!cardId) {
      return res.status(400).json({ error: 'Card ID is required' });
    }

    // TODO: Implement actual APTLSS generation
    // This would call the Python APTLSS generator
    // For now, return mock success

    console.log(`Generating APTLSS for card ${cardId} with settings:`, settings);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    res.json({
      success: true,
      cardId,
      message: 'APTLSS generated successfully',
      checklistId: 'checklist_' + Date.now(),
    });
  } catch (error) {
    console.error('Error generating APTLSS:', error);
    res.status(500).json({ error: 'Failed to generate APTLSS' });
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

export default router;
