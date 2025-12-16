import { Router } from 'express';
import type { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db';
import { generationJobs, generationItems, scheduledJobs, userWorkingHours, holidays } from '../../drizzle/schema';
import { eq, desc, and } from 'drizzle-orm';
import { fetchWithRetry } from '../utils/retry';
import { getCachedTasks, setCachedTasks, invalidateCache } from '../services/trello-cache';
import { requestQueue } from '../services/request-queue';
import { websocketService } from '../services/websocket';
import { parseAPTLSSItem, parseAPTLSSChecklist } from '../utils/aptlss-parser';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Enhanced task scheduling algorithm with break times and task type optimization
interface SchedulingOptions {
  workStartHour: number;
  workEndHour: number;
  workingDays: number[];
  holidays: string[];
  lunchBreakStart?: number;  // e.g., 12
  lunchBreakDuration?: number; // minutes (e.g., 60)
  breakfastBreakStart?: number; // e.g., 9 (optional)
  breakfastBreakDuration?: number; // minutes (e.g., 30)
  dinnerBreakStart?: number; // e.g., 18 (optional)
  dinnerBreakDuration?: number; // minutes (e.g., 30)
  shortBreakInterval?: number; // minutes between short breaks
  shortBreakDuration?: number; // minutes for short breaks
}

function scheduleTasksByTime(
  tasks: any[], 
  workStartHour: number = 9, 
  workEndHour: number = 18, 
  workingDays: number[] = [1, 2, 3, 4, 5], 
  userHolidays: string[] = [],
  options?: Partial<SchedulingOptions>
) {
  // Working hours configurable per user
  const WORK_START_HOUR = workStartHour;
  const WORK_END_HOUR = workEndHour;
  const MAX_HOURS_PER_DAY = WORK_END_HOUR - WORK_START_HOUR;
  const WORKING_DAYS = new Set(workingDays); // Convert to Set for faster lookup
  
  // Break settings (defaults)
  const LUNCH_START = options?.lunchBreakStart ?? 12;
  const LUNCH_DURATION = options?.lunchBreakDuration ?? 60; // minutes
  const LUNCH_END = LUNCH_START + Math.floor(LUNCH_DURATION / 60); // Calculate end hour
  const LUNCH_END_MINUTE = LUNCH_DURATION % 60;
  
  // Optional breakfast break
  const BREAKFAST_START = options?.breakfastBreakStart;
  const BREAKFAST_DURATION = options?.breakfastBreakDuration ?? 0;
  
  // Optional dinner break
  const DINNER_START = options?.dinnerBreakStart;
  const DINNER_DURATION = options?.dinnerBreakDuration ?? 0;
  
  const SHORT_BREAK_INTERVAL = options?.shortBreakInterval ?? 90; // 90 minutes
  const SHORT_BREAK_DURATION = options?.shortBreakDuration ?? 10; // 10 minutes

  // Group tasks by date and card
  const tasksByDate = new Map<string, any[]>();
  
  for (const task of tasks) {
    if (!tasksByDate.has(task.date)) {
      tasksByDate.set(task.date, []);
    }
    tasksByDate.get(task.date)!.push(task);
  }

  // Schedule each day's tasks
  const scheduledTasks: any[] = [];
  
  for (const [date, dayTasks] of Array.from(tasksByDate.entries())) {
    // Parse date and check if it's a working day
    const taskDate = new Date(date);
    const dayOfWeek = taskDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    
    // Check if this is a holiday
    const isHoliday = userHolidays.includes(date);
    
    // If this is not a working day or is a holiday, mark all tasks as TBD
    if (!WORKING_DAYS.has(dayOfWeek) || isHoliday) {
      const reason = isHoliday ? 'Holiday' : 'Non-working day';
      for (const task of dayTasks) {
        scheduledTasks.push({
          ...task,
          startTime: 'TBD',
          endTime: 'TBD',
          note: reason
        });
      }
      continue;
    }
    // Enhanced sorting: priority, then task type optimization, then card grouping
    const sortedTasks = dayTasks.sort((a: any, b: any) => {
      // Priority order: CRITICAL > URGENT > HIGH > NORMAL
      const priorityOrder: Record<string, number> = { CRITICAL: 0, URGENT: 1, HIGH: 2, NORMAL: 3 };
      const priorityDiff = (priorityOrder[a.priorityLevel] ?? 3) - (priorityOrder[b.priorityLevel] ?? 3);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Task type optimization: schedule communication tasks early, creative tasks mid-day
      const taskTypeOrder: Record<string, number> = {
        communication: 1, // Early morning - clear inbox
        admin: 2,         // Morning - routine tasks
        meeting: 3,       // Mid-morning
        creation: 4,      // Late morning/afternoon - peak focus
        research: 5,      // Afternoon
        review: 6,        // End of day
        other: 4
      };
      const typeA = taskTypeOrder[a.taskType] ?? 4;
      const typeB = taskTypeOrder[b.taskType] ?? 4;
      if (typeA !== typeB) return typeA - typeB;
      
      // If same priority and type, sort by card name then step index (to keep steps together)
      if (a.cardName !== b.cardName) return a.cardName.localeCompare(b.cardName);
      return a.stepIndex - b.stepIndex;
    });

    let currentHour = WORK_START_HOUR;
    let currentMinute = 0;
    let minutesSinceBreak = 0;

    // Helper to convert hour:minute to total minutes
    const toMinutes = (h: number, m: number) => h * 60 + m;
    
    // Helper to check if time is during lunch
    const isDuringLunch = (h: number, m: number) => {
      const mins = toMinutes(h, m);
      const lunchEndMins = toMinutes(LUNCH_START, 0) + LUNCH_DURATION;
      return mins >= toMinutes(LUNCH_START, 0) && mins < lunchEndMins;
    };
    
    // Helper to check if time is during breakfast
    const isDuringBreakfast = (h: number, m: number) => {
      if (!BREAKFAST_START || !BREAKFAST_DURATION) return false;
      const mins = toMinutes(h, m);
      const breakfastEndMins = toMinutes(BREAKFAST_START, 0) + BREAKFAST_DURATION;
      return mins >= toMinutes(BREAKFAST_START, 0) && mins < breakfastEndMins;
    };
    
    // Helper to check if time is during dinner
    const isDuringDinner = (h: number, m: number) => {
      if (!DINNER_START || !DINNER_DURATION) return false;
      const mins = toMinutes(h, m);
      const dinnerEndMins = toMinutes(DINNER_START, 0) + DINNER_DURATION;
      return mins >= toMinutes(DINNER_START, 0) && mins < dinnerEndMins;
    };
    
    // Helper to check if time is during any meal break
    const isDuringMealBreak = (h: number, m: number) => {
      return isDuringLunch(h, m) || isDuringBreakfast(h, m) || isDuringDinner(h, m);
    };
    
    // Helper to skip past any active meal break
    const skipMealBreak = () => {
      if (isDuringBreakfast(currentHour, currentMinute) && BREAKFAST_START) {
        const breakfastEndMins = toMinutes(BREAKFAST_START, 0) + BREAKFAST_DURATION;
        currentHour = Math.floor(breakfastEndMins / 60);
        currentMinute = breakfastEndMins % 60;
        minutesSinceBreak = 0;
      }
      if (isDuringLunch(currentHour, currentMinute)) {
        const lunchEndMins = toMinutes(LUNCH_START, 0) + LUNCH_DURATION;
        currentHour = Math.floor(lunchEndMins / 60);
        currentMinute = lunchEndMins % 60;
        minutesSinceBreak = 0;
      }
      if (isDuringDinner(currentHour, currentMinute) && DINNER_START) {
        const dinnerEndMins = toMinutes(DINNER_START, 0) + DINNER_DURATION;
        currentHour = Math.floor(dinnerEndMins / 60);
        currentMinute = dinnerEndMins % 60;
        minutesSinceBreak = 0;
      }
    };

    for (const task of sortedTasks) {
      // Skip if already completed
      if (task.isCompleted) {
        scheduledTasks.push({
          ...task,
          startTime: '--:--',
          endTime: '--:--',
          schedulingNote: 'Completed'
        });
        continue;
      }

      // Skip any meal break if we're about to enter it
      skipMealBreak();
      
      // Add short break if needed (every 90 minutes of work)
      if (minutesSinceBreak >= SHORT_BREAK_INTERVAL) {
        currentMinute += SHORT_BREAK_DURATION;
        if (currentMinute >= 60) {
          currentHour += Math.floor(currentMinute / 60);
          currentMinute = currentMinute % 60;
        }
        minutesSinceBreak = 0;
        
        // Skip any meal break if short break pushed us into it
        skipMealBreak();
      }

      // Calculate end time
      const durationMinutes = Math.ceil(task.durationHours * 60);
      let endHour = currentHour;
      let endMinute = currentMinute + durationMinutes;

      // Handle minute overflow
      if (endMinute >= 60) {
        endHour += Math.floor(endMinute / 60);
        endMinute = endMinute % 60;
      }
      
      // Check if task spans lunch - if so, push start to after lunch
      const startMins = toMinutes(currentHour, currentMinute);
      const endMins = toMinutes(endHour, endMinute);
      
      // Check if task spans any meal break and push to after if needed
      const checkAndPushPastMealBreak = (breakStart: number | undefined, breakDuration: number) => {
        if (!breakStart || !breakDuration) return false;
        const breakStartMins = toMinutes(breakStart, 0);
        const breakEndMins = breakStartMins + breakDuration;
        if (startMins < breakStartMins && endMins > breakStartMins) {
          // Task would span this break, push to after
          currentHour = Math.floor(breakEndMins / 60);
          currentMinute = breakEndMins % 60;
          endHour = currentHour;
          endMinute = currentMinute + durationMinutes;
          if (endMinute >= 60) {
            endHour += Math.floor(endMinute / 60);
            endMinute = endMinute % 60;
          }
          return true;
        }
        return false;
      };
      
      // Check breakfast, lunch, and dinner breaks
      checkAndPushPastMealBreak(BREAKFAST_START, BREAKFAST_DURATION);
      checkAndPushPastMealBreak(LUNCH_START, LUNCH_DURATION);
      checkAndPushPastMealBreak(DINNER_START, DINNER_DURATION);

      // Check if task fits in working hours
      if (endHour > WORK_END_HOUR || (endHour === WORK_END_HOUR && endMinute > 0)) {
        // Task doesn't fit, mark as unscheduled with reason
        scheduledTasks.push({
          ...task,
          startTime: 'TBD',
          endTime: 'TBD',
          overbooked: true,
          schedulingNote: 'Exceeds daily capacity'
        });
        continue;
      }

      // Format times
      const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

      scheduledTasks.push({
        ...task,
        startTime,
        endTime,
        schedulingNote: task.durationConfidence === 'low' ? 'Duration estimated' : undefined
      });

      // Move to next time slot and track time since break
      minutesSinceBreak += durationMinutes;
      currentHour = endHour;
      currentMinute = endMinute;
    }
  }

  return scheduledTasks;
}

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

// Get tasks from Trello cards with APTLSS checklists
router.get('/trello/tasks', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const forceRefresh = req.query.refresh === 'true';
    const cacheTTL = parseInt(req.query.ttl as string) || 300; // 5 minutes default

    // Try to get from cache first
    const cachedData = await getCachedTasks(user.id, user.openId, { 
      ttlSeconds: cacheTTL, 
      forceRefresh 
    });

    if (cachedData && !forceRefresh) {
      console.log('Cache hit for tasks');
      return res.json(cachedData);
    }

    console.log('Cache miss for tasks - fetching from Trello API');

    const apiKey = process.env.TRELLO_API_KEY;
    const apiToken = process.env.TRELLO_TOKEN;

    if (!apiKey || !apiToken) {
      return res.status(500).json({ error: 'Trello credentials not configured' });
    }

    // Use request queue to deduplicate simultaneous requests
    const queueKey = `trello-tasks-${user.openId}`;
    const responseData = await requestQueue.execute(queueKey, async () => {
      // Fetch all boards with retry
    const boardsResponse = await fetchWithRetry(
      `https://api.trello.com/1/members/me/boards?filter=open&key=${apiKey}&token=${apiToken}`,
      undefined,
      {
        maxRetries: 3,
        initialDelayMs: 1000,
        onRetry: (attempt, error, delayMs) => {
          console.log(`Retrying boards fetch (attempt ${attempt}) after ${delayMs}ms due to:`, error.message);
        }
      }
    );
    
    if (!boardsResponse.ok) {
      const errorText = await boardsResponse.text();
      console.error('Trello API error fetching boards:', errorText);
      return res.status(boardsResponse.status).json({ 
        error: 'Failed to fetch boards from Trello',
        details: errorText 
      });
    }
    
    const boards = await boardsResponse.json();
    
    // Validate boards is an array
    if (!Array.isArray(boards)) {
      console.error('Trello API returned non-array for boards:', boards);
      return res.status(500).json({ 
        error: 'Invalid response from Trello API',
        details: 'Expected array of boards' 
      });
    }

    const tasks: any[] = [];

    // For each board, get cards with checklists
    for (const board of boards) {
      const cardsResponse = await fetchWithRetry(
        `https://api.trello.com/1/boards/${board.id}/cards?checklists=all&key=${apiKey}&token=${apiToken}`,
        undefined,
        {
          maxRetries: 3,
          initialDelayMs: 1000,
          onRetry: (attempt, error, delayMs) => {
            console.log(`Retrying cards fetch for board ${board.id} (attempt ${attempt}) after ${delayMs}ms due to:`, error.message);
          }
        }
      );
      
      if (!cardsResponse.ok) {
        console.error(`Trello API error fetching cards for board ${board.id}:`, cardsResponse.statusText);
        continue; // Skip this board and continue with others
      }
      
      const cards = await cardsResponse.json();
      
      // Validate cards is an array
      if (!Array.isArray(cards)) {
        console.error(`Trello API returned non-array for cards in board ${board.id}:`, cards);
        continue; // Skip this board
      }

      // Process each card
      for (const card of cards.filter((c: any) => !c.closed)) {
        // Find APTLSS checklist
        const aptlssChecklist = card.checklists?.find((cl: any) => 
          cl.name.toLowerCase().includes('aptlss') || 
          cl.name.toLowerCase().includes('action plan')
        );

        if (aptlssChecklist && aptlssChecklist.checkItems) {
          // Get card due date if available
          const cardDueDate = card.due ? new Date(card.due).toISOString().split('T')[0] : undefined;
          const cardLabels = card.labels?.map((l: any) => l.name.toLowerCase()) || [];
          
          // Use enhanced APTLSS parser for better accuracy
          const parsedItems = parseAPTLSSChecklist(
            aptlssChecklist.checkItems,
            cardDueDate,
            cardLabels
          );
          
          parsedItems.forEach((parsed, index) => {
            const item = parsed.originalItem;
            
            // Determine priority level from card labels
            const priorityLevel = cardLabels.some((l: string) => l.includes('critical')) ? 'CRITICAL' :
                                 cardLabels.some((l: string) => l.includes('urgent')) ? 'URGENT' :
                                 cardLabels.some((l: string) => l.includes('high')) ? 'HIGH' : 'NORMAL';
            
            tasks.push({
              id: `${card.id}_${item.id}`,
              cardId: card.id,
              cardName: card.name,
              checklistId: aptlssChecklist.id,
              checkItemId: item.id,
              stepIndex: index,
              description: parsed.cleanDescription || parsed.description,
              fullDescription: parsed.description,
              durationHours: parsed.durationHours,
              durationConfidence: parsed.durationConfidence,
              startTime: '09:00',
              endTime: '10:00',
              date: parsed.dueDate || new Date().toISOString().split('T')[0],
              dateSource: parsed.dateSource,
              isCompleted: item.state === 'complete',
              isArchived: false,
              isBlocker: parsed.isBlocker,
              isPriority: cardLabels.some((l: string) => l.includes('priority')),
              priorityLevel,
              taskType: parsed.taskType,
              complexity: parsed.complexity,
              dependencies: parsed.dependencies,
              hasExternalDependency: parsed.hasExternalDependency,
              keywords: parsed.keywords,
              hasDutch: parsed.description.toLowerCase().includes('dutch') || parsed.description.toLowerCase().includes('nederlands'),
              attachments: []
            });
          });
        }
      }
    }

    // Get user's working hours settings and holidays
    let workStartHour = 9;
    let workEndHour = 18;
    let workingDays = [1, 2, 3, 4, 5]; // Default: Mon-Fri
    let userHolidays: string[] = [];
    const schedulingOptions: Partial<SchedulingOptions> = {};
    
    if (req.user) {
      try {
        const db = await getDb();
        if (db) {
          const settings = await db.select().from(userWorkingHours)
            .where(eq(userWorkingHours.userOpenId, req.user.openId))
            .limit(1);
          
          if (settings.length > 0) {
            workStartHour = settings[0].workStartHour;
            workEndHour = settings[0].workEndHour;
            // Parse working days from comma-separated string
            workingDays = settings[0].workingDays
              .split(',')
              .filter(d => d)
              .map(d => parseInt(d));
            
            // Get meal break settings (times are stored as HH:MM strings)
            const parseTimeToHour = (timeStr: string | null): number | undefined => {
              if (!timeStr) return undefined;
              const parts = timeStr.split(':');
              return parseInt(parts[0], 10);
            };
            
            if (settings[0].lunchTime) {
              schedulingOptions.lunchBreakStart = parseTimeToHour(settings[0].lunchTime);
              schedulingOptions.lunchBreakDuration = settings[0].lunchDuration || 60;
            }
            if (settings[0].breakfastTime) {
              schedulingOptions.breakfastBreakStart = parseTimeToHour(settings[0].breakfastTime);
              schedulingOptions.breakfastBreakDuration = settings[0].breakfastDuration || 30;
            }
            if (settings[0].dinnerTime) {
              schedulingOptions.dinnerBreakStart = parseTimeToHour(settings[0].dinnerTime);
              schedulingOptions.dinnerBreakDuration = settings[0].dinnerDuration || 30;
            }
          }

          // Fetch active holidays
          const holidayRecords = await db.select()
            .from(holidays)
            .where(and(
              eq(holidays.userOpenId, req.user.openId),
              eq(holidays.isActive, 1)
            ));
          
          userHolidays = holidayRecords.map(h => h.date);
        }
      } catch (error) {
        console.warn('Could not fetch user working hours, using defaults:', error);
      }
    }
    
    // Schedule tasks with proper time slots (including meal break options)
    const scheduledTasks = scheduleTasksByTime(tasks, workStartHour, workEndHour, workingDays, userHolidays, schedulingOptions);
    
    // Get user's timezone for client-side conversion
    let userTimezone = 'UTC';
    if (req.user) {
      try {
        const db = await getDb();
        if (db) {
          const settings = await db.select().from(userWorkingHours)
            .where(eq(userWorkingHours.userOpenId, req.user.openId))
            .limit(1);
          
          if (settings.length > 0 && settings[0].timezone) {
            userTimezone = settings[0].timezone;
          }
        }
      } catch (error) {
        console.warn('Could not fetch user timezone:', error);
      }
    }
    
      const responseData = {
        tasks: scheduledTasks,
        timezone: userTimezone
      };

      // Save to cache
      await setCachedTasks(user.id, user.openId, responseData, cacheTTL);
      console.log(`Cached ${scheduledTasks.length} tasks for ${cacheTTL} seconds`);

      return responseData;
    }); // End of requestQueue.execute

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching Trello tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks from Trello' });
  }
});

// Update task completion status in Trello
router.put('/trello/tasks/:taskId/complete', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { isCompleted, cardId, checklistId, checkItemId } = req.body;

    const apiKey = process.env.TRELLO_API_KEY;
    const apiToken = process.env.TRELLO_TOKEN;

    if (!apiKey || !apiToken) {
      return res.status(500).json({ error: 'Trello credentials not configured' });
    }

    if (!cardId || !checklistId || !checkItemId) {
      return res.status(400).json({ error: 'Missing required fields: cardId, checklistId, checkItemId' });
    }

    // Update checklist item state in Trello
    const state = isCompleted ? 'complete' : 'incomplete';
    const updateUrl = `https://api.trello.com/1/cards/${cardId}/checkItem/${checkItemId}?state=${state}&key=${apiKey}&token=${apiToken}`;
    
    const response = await fetch(updateUrl, {
      method: 'PUT'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Trello API error:', errorText);
      return res.status(response.status).json({ error: 'Failed to update task in Trello', details: errorText });
    }

    const result = await response.json();
    
    // Broadcast task completion to all connected clients
    const user = (req as any).user;
    if (user) {
      websocketService.emitToUser(user.openId, 'task:completed', {
        taskId,
        isCompleted,
        cardId,
        checklistId,
        checkItemId,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ 
      success: true, 
      taskId,
      isCompleted,
      trelloResponse: result
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
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
