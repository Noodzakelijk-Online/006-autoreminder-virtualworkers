import { Router } from 'express';

const router = Router();

interface TrelloBoard {
  id: string;
  name: string;
  url: string;
  desc: string;
  closed: boolean;
  idOrganization: string;
}

interface BoardOption {
  id: string;
  name: string;
  url: string;
}

/**
 * GET /api/trello-boards
 * Fetch all Trello boards for the authenticated user
 * Returns a list of boards with id, name, and url
 */
router.get('/', async (req, res) => {
  try {
    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!apiKey || !token) {
      return res.status(500).json({
        error: 'Trello API credentials not configured. Please set TRELLO_API_KEY and TRELLO_TOKEN environment variables.',
      });
    }

    // Fetch boards from Trello API
    const url = `https://api.trello.com/1/members/me/boards?key=${apiKey}&token=${token}&filter=open`;
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TrelloBoards] Trello API error:', errorText);
      
      if (response.status === 401) {
        return res.status(401).json({
          error: 'Trello authentication failed. Your API credentials may be invalid or expired.',
        });
      }

      return res.status(response.status).json({
        error: `Failed to fetch Trello boards: ${errorText}`,
      });
    }

    const boards: TrelloBoard[] = await response.json();

    // Transform boards to include only necessary fields
    const boardOptions: BoardOption[] = boards
      .filter(board => !board.closed) // Only include open boards
      .map(board => ({
        id: board.id,
        name: board.name,
        url: board.url,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

    res.json({
      success: true,
      boards: boardOptions,
      count: boardOptions.length,
    });
  } catch (error) {
    console.error('[TrelloBoards] Error fetching boards:', error);
    res.status(500).json({
      error: 'Failed to fetch Trello boards. Please try again later.',
    });
  }
});

export default router;
