import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Circle,
  Loader2,
  Play,
  Settings,
  Download,
  RefreshCw,
  Filter,
  Search,
  ArrowLeft,
  Trash2,
  Clock,
  CheckSquare,
  MessageSquare
} from 'lucide-react';
import { GoalInterviewDialog } from '@/components/GoalInterviewDialog';
import { Link } from 'wouter';
import { useLoadingQueue } from '@/contexts/LoadingQueueContext';

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idBoard: string;
  idList: string;
  boardName?: string;
  listName?: string;
  hasAPTLSS: boolean;
  selected: boolean;
  due?: string;
  badges?: {
    attachments: number;
  };
}

interface TrelloBoard {
  id: string;
  name: string;
  cardCount: number;
  selected: boolean;
}

interface TrelloWorkspace {
  id: string;
  name: string;
  boardCount: number;
  cardCount?: number;
  boards: { id: string; name: string; cardCount?: number }[];
  selected: boolean;
}

interface GenerationProgress {
  total: number;
  completed: number;
  failed: number;
  jobId?: string;
  current?: string;
  status: 'idle' | 'submitting' | 'running' | 'completed' | 'completed_with_errors' | 'failed';
  completedAt?: string | null;
}

interface GenerationJobStatusResponse {
  jobId: string;
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed';
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  completedAt?: string | null;
}

const HISTORY_REFRESH_MS = 5000;

export default function APTLSSManagement() {
  const { addOperation, updateOperation, removeOperation } = useLoadingQueue();
  const [workspaces, setWorkspaces] = useState<TrelloWorkspace[]>([]);
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [cards, setCards] = useState<TrelloCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<TrelloCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    status: 'idle'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBoard, setFilterBoard] = useState<string>('all');
  const [settings, setSettings] = useState({
    skipExisting: true,
    validateBeforeGenerate: true,
    autoReminder: false,
    batchSize: 10,
    scheduledTime: '',
    scheduledJobs: [] as any[]
  });
  const [history, setHistory] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<any>(null);
  const [loadingProgress, setLoadingProgress] = useState<{current: number; total: number; message: string} | null>(null);
  const [interviewCardId, setInterviewCardId] = useState<string | null>(null);
  const [interviewCardName, setInterviewCardName] = useState<string>('');
  const [clarifiedGoal, setClarifiedGoal] = useState<any | null>(null);
  
  // Auto-load all cards state
  const [autoLoadProgress, setAutoLoadProgress] = useState<{
    isLoading: boolean;
    current: number;
    total: number;
    loaded: number;
    skipped: number;
    failed: number;
    failedBoards: { id: string; name: string; workspaceName: string }[];
    currentBoard: string;
    cancelled?: boolean;
    startTime?: number;
    avgTimePerBoard?: number;
  } | null>(null);
  
  // Cancel flag ref (to avoid stale closure issues)
  const cancelLoadRef = useRef(false);
  
  // Local storage key for persisting cards
  const CARDS_STORAGE_KEY = 'aptlss_loaded_cards';
  
  // Board selection state for filtered loading
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  const [selectedWorkspacesForLoad, setSelectedWorkspacesForLoad] = useState<Set<string>>(new Set());
  const [workspaceSearchTerm, setWorkspaceSearchTerm] = useState('');
  
  // Ref for workspace search input (for keyboard shortcut)
  const workspaceSearchInputRef = useRef<HTMLInputElement>(null);
  
  // Local storage key for remembering workspace selection
  const WORKSPACE_SELECTION_KEY = 'aptlss_selected_workspaces';

  // Load cards from local storage on mount
  useEffect(() => {
    const savedCards = localStorage.getItem(CARDS_STORAGE_KEY);
    if (savedCards) {
      try {
        const parsedCards = JSON.parse(savedCards);
        if (Array.isArray(parsedCards) && parsedCards.length > 0) {
          setCards(parsedCards);
          toast.success(`Restored ${parsedCards.length} cards from cache`);
        }
      } catch (e) {
        console.error('Failed to parse saved cards:', e);
        localStorage.removeItem(CARDS_STORAGE_KEY);
      }
    }
    
    // Load saved workspace selection
    const savedWorkspaces = localStorage.getItem(WORKSPACE_SELECTION_KEY);
    if (savedWorkspaces) {
      try {
        const parsedWorkspaces = JSON.parse(savedWorkspaces);
        if (Array.isArray(parsedWorkspaces)) {
          setSelectedWorkspacesForLoad(new Set(parsedWorkspaces));
        }
      } catch (e) {
        console.error('Failed to parse saved workspace selection:', e);
        localStorage.removeItem(WORKSPACE_SELECTION_KEY);
      }
    }
  }, []);
  
  // Save cards to local storage when they change
  useEffect(() => {
    if (cards.length > 0) {
      localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
    }
  }, [cards]);
  
  // Save workspace selection to local storage when it changes
  useEffect(() => {
    if (selectedWorkspacesForLoad.size > 0) {
      localStorage.setItem(WORKSPACE_SELECTION_KEY, JSON.stringify(Array.from(selectedWorkspacesForLoad)));
    }
  }, [selectedWorkspacesForLoad]);

  // Keyboard shortcut: "/" to focus workspace search when selector is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not already in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      if (e.key === '/' && showBoardSelector) {
        e.preventDefault();
        workspaceSearchInputRef.current?.focus();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showBoardSelector]);

  // Load workspaces and boards
  useEffect(() => {
    loadWorkspaces();
    loadBoards();
    loadHistory();
    loadScheduledJobs();
  }, []);

  useEffect(() => {
    const hasActiveJob = history.some((job: any) => job.status === 'running');
    if (!hasActiveJob) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadHistory();
    }, HISTORY_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [history]);

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }

    const interval = window.setInterval(() => {
      void toggleJobDetails(selectedJobId, true);
    }, HISTORY_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [selectedJobId]);

  useEffect(() => {
    if (!progress.jobId || (progress.status !== 'running' && progress.status !== 'submitting')) {
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/aptlss/status/${progress.jobId}`);
        if (!response.ok) {
          return;
        }

        const data = await response.json() as GenerationJobStatusResponse;
        setProgress((prev) => ({
          ...prev,
          total: data.progress.total,
          completed: data.progress.completed,
          failed: data.progress.failed,
          status: data.status,
          completedAt: data.completedAt || null,
        }));

        if (data.status !== 'running') {
          await loadHistory();
        }
      } catch (error) {
        console.error('Failed to poll generation status:', error);
      }
    };

    void pollStatus();
    const interval = window.setInterval(() => {
      void pollStatus();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [progress.jobId, progress.status]);

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/aptlss/history');
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Failed to load history');
    }
  };

  const loadScheduledJobs = async () => {
    try {
      const response = await fetch('/api/aptlss/scheduled');
      const jobs = await response.json();
      setSettings(prev => ({ ...prev, scheduledJobs: jobs }));
    } catch (error) {
      console.error('Error loading scheduled jobs:', error);
    }
  };

  const toggleJobDetails = async (jobId: string, keepOpen: boolean = false) => {
    if (!keepOpen && selectedJobId === jobId) {
      setSelectedJobId(null);
      setJobDetails(null);
    } else {
      try {
        const response = await fetch(`/api/aptlss/history/${jobId}`);
        const data = await response.json();
        setJobDetails(data);
        if (!keepOpen) {
          setSelectedJobId(jobId);
        }
      } catch (error) {
        console.error('Error loading job details:', error);
        toast.error('Failed to load job details');
      }
    }
  };

  const retryFailedItems = async (jobId: string) => {
    try {
      const response = await fetch(`/api/aptlss/history/${jobId}/retry`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Retrying ${result.itemsToRetry} failed items`);
        loadHistory();
      } else {
        toast.info(result.message || 'No items to retry');
      }
    } catch (error) {
      console.error('Error retrying items:', error);
      toast.error('Failed to retry items');
    }
  };

  // Filter cards based on search and board filter
  useEffect(() => {
    // Deduplicate cards by ID to prevent duplicate key errors
    const seenIds = new Set();
    let filtered = cards.filter(card => {
      if (seenIds.has(card.id)) {
        return false; // Skip duplicate
      }
      seenIds.add(card.id);
      return true;
    });

    if (searchTerm) {
      filtered = filtered.filter(card =>
        card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.desc.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterBoard !== 'all') {
      filtered = filtered.filter(card => card.idBoard === filterBoard);
    }

    setFilteredCards(filtered);
  }, [cards, searchTerm, filterBoard]);


  const loadWorkspaces = async () => {
    setLoading(true);
    setLoadingProgress({ current: 0, total: 0, message: 'Fetching workspaces...' });
    try {
      const response = await fetch('/api/trello/workspaces');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || response.statusText);
      }
      
      const data = await response.json();
      
      // Validate data is an array
      if (!Array.isArray(data)) {
        console.error('Invalid workspaces data:', data);
        throw new Error(data.error || 'Invalid response format');
      }
      
      setWorkspaces(data.map((workspace: any) => ({
        id: workspace.id,
        name: workspace.name,
        boardCount: workspace.boardCount || 0,
        cardCount: workspace.cardCount || 0,
        boards: workspace.boards || [],
        selected: false
      })));
      
      toast.success(`Loaded ${data.length} workspaces successfully`);
    } catch (error) {
      toast.error('Failed to load workspaces');
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingProgress(null);
    }
  };

  const selectAllCardsInWorkspace = async (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;
    
    setLoading(true);
    setLoadingProgress({ current: 0, total: workspace.boards.length, message: 'Loading cards from boards...' });
    
    try {
      const allCards: TrelloCard[] = [];
      
      for (let i = 0; i < workspace.boards.length; i++) {
        const board = workspace.boards[i];
        setLoadingProgress({ current: i + 1, total: workspace.boards.length, message: `Loading ${board.name}...` });
        
        const response = await fetch(`/api/trello/boards/${board.id}/cards`);
        const boardCards = await response.json();
        
        allCards.push(...boardCards.map((card: any) => ({
          ...card,
          selected: true,
          boardName: board.name
        })));
      }
      
      // Merge with existing cards
      const existingCardIds = new Set(cards.map(c => c.id));
      const newCards = allCards.filter(c => !existingCardIds.has(c.id));
      const updatedCards = cards.map(c => {
        const workspaceCard = allCards.find(wc => wc.id === c.id);
        return workspaceCard ? { ...c, selected: true } : c;
      });
      
      setCards([...updatedCards, ...newCards]);
      toast.success(`Selected ${allCards.length} cards from ${workspace.name}`);
    } catch (error) {
      toast.error('Failed to load cards from workspace');
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingProgress(null);
    }
  };

  const loadBoards = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/trello/boards');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || response.statusText);
      }
      
      const data = await response.json();
      
      // Validate data is an array
      if (!Array.isArray(data)) {
        console.error('Invalid boards data:', data);
        throw new Error(data.error || 'Invalid response format');
      }
      
      setBoards(data.map((board: any) => ({
        id: board.id,
        name: board.name,
        cardCount: board.cardCount || 0,
        selected: false
      })));
      
      toast.success('Boards loaded successfully');
    } catch (error) {
      toast.error('Failed to load boards');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadCardsForBoard = async (boardId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/trello/boards/${boardId}/cards`);
      const data = await response.json();
      
      const newCards = data.map((card: any) => ({
        id: card.id,
        name: card.name,
        desc: card.desc,
        idBoard: card.idBoard,
        idList: card.idList,
        boardName: card.boardName,
        listName: card.listName,
        hasAPTLSS: card.checklists && card.checklists.length > 0,
        selected: false
      }));
      
      setCards(prev => [...prev, ...newCards]);
      toast.success(`Loaded ${newCards.length} cards from board`);
    } catch (error) {
      toast.error('Failed to load cards');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkspaceSelection = (workspaceId: string) => {
    setWorkspaces(workspaces.map(ws => 
      ws.id === workspaceId ? { ...ws, selected: !ws.selected } : ws
    ));
  };

  const loadWorkspaceBoards = async (workspaceId: string) => {
    const workspace = workspaces.find(ws => ws.id === workspaceId);
    if (!workspace) return;

    setLoading(true);
    try {
      // Load all cards from all boards in this workspace
      const allCards: TrelloCard[] = [];
      
      for (const board of workspace.boards) {
        const response = await fetch(`/api/trello/boards/${board.id}/cards`);
        const boardCards = await response.json();
        allCards.push(...boardCards.map((card: any) => ({
          id: card.id,
          name: card.name,
          desc: card.desc,
          boardId: card.idBoard,
          boardName: board.name,
          listName: card.listName || '',
          hasAPTLSS: card.checklists?.some((cl: any) => cl.name === 'APTLSS'),
          selected: false
        })));
      }
      
      setCards(allCards);
      toast.success(`Loaded ${allCards.length} cards from workspace "${workspace.name}"`);
    } catch (error) {
      toast.error('Failed to load workspace cards');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBoardSelection = (boardId: string) => {
    setBoards(prev =>
      prev.map(board =>
        board.id === boardId ? { ...board, selected: !board.selected } : board
      )
    );

    // Load cards for newly selected board
    const board = boards.find(b => b.id === boardId);
    if (board && !board.selected) {
      loadCardsForBoard(boardId);
    }
  };

  const toggleCardSelection = (cardId: string) => {
    setCards(prev =>
      prev.map(card =>
        card.id === cardId ? { ...card, selected: !card.selected } : card
      )
    );
  };

  const selectAllCards = () => {
    setCards(prev => prev.map(card => ({ ...card, selected: true })));
  };

  const deselectAllCards = () => {
    setCards(prev => prev.map(card => ({ ...card, selected: false })));
  };

  // Cancel the current load operation
  const cancelAutoLoad = () => {
    cancelLoadRef.current = true;
    toast.info('Cancelling load operation...');
  };
  
  // Clear the card cache
  const clearCache = () => {
    localStorage.removeItem(CARDS_STORAGE_KEY);
    setCards([]);
    setAutoLoadProgress(null);
    toast.success('Card cache cleared');
  };
  
  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${minutes}m ${secs}s`;
  };
  
  // Calculate estimated time remaining
  const getEstimatedTimeRemaining = (): string | null => {
    if (!autoLoadProgress || !autoLoadProgress.isLoading || !autoLoadProgress.startTime) return null;
    if (autoLoadProgress.current < 2) return 'Calculating...';
    
    const elapsed = (Date.now() - autoLoadProgress.startTime) / 1000;
    const avgTimePerBoard = elapsed / autoLoadProgress.current;
    const remaining = (autoLoadProgress.total - autoLoadProgress.current) * avgTimePerBoard;
    
    return formatTimeRemaining(remaining);
  };

  // Auto-load all cards from all workspaces (or selected workspaces)
  const autoLoadAllCards = async (selectedOnly: boolean = false) => {
    if (workspaces.length === 0) {
      toast.error('No workspaces available. Please refresh first.');
      return;
    }

    // Reset cancel flag
    cancelLoadRef.current = false;

    // Calculate total boards across all (or selected) workspaces
    const allBoards: { id: string; name: string; workspaceName: string; cardCount: number }[] = [];
    for (const workspace of workspaces) {
      // If selectedOnly, only include selected workspaces
      if (selectedOnly && !selectedWorkspacesForLoad.has(workspace.id)) continue;
      
      for (const board of workspace.boards) {
        allBoards.push({
          id: board.id,
          name: board.name,
          workspaceName: workspace.name,
          cardCount: board.cardCount || 0
        });
      }
    }

    if (allBoards.length === 0) {
      toast.error(selectedOnly ? 'No boards in selected workspaces.' : 'No boards found in any workspace.');
      return;
    }

    // Get existing card IDs to skip already loaded cards
    const existingCardIds = new Set(cards.map(c => c.id));

    setAutoLoadProgress({
      isLoading: true,
      current: 0,
      total: allBoards.length,
      loaded: 0,
      skipped: 0,
      failed: 0,
      failedBoards: [],
      currentBoard: '',
      cancelled: false,
      startTime: Date.now()
    });
    
    // Add to global loading queue
    const operationId = 'aptlss-load-cards';
    addOperation(operationId, `Loading cards from ${allBoards.length} boards`);
    
    // Close the board selector if open
    setShowBoardSelector(false);

    const newCards: TrelloCard[] = [];
    const failedBoards: { id: string; name: string; workspaceName: string }[] = [];
    let loadedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < allBoards.length; i++) {
      // Check if cancelled
      if (cancelLoadRef.current) {
        setAutoLoadProgress(prev => prev ? { ...prev, isLoading: false, cancelled: true } : null);
        updateOperation(operationId, { status: 'cancelled' });
        toast.warning(`Load cancelled. ${loadedCount} cards loaded, ${failedBoards.length} boards remaining.`);
        // Still save what we loaded so far
        if (newCards.length > 0) {
          setCards(prev => [...prev, ...newCards]);
        }
        return;
      }

      const board = allBoards[i];
      
      setAutoLoadProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        currentBoard: `${board.workspaceName} / ${board.name}`
      } : null);
      
      // Update global loading queue progress
      const progressPercent = Math.round(((i + 1) / allBoards.length) * 100);
      updateOperation(operationId, {
        progress: progressPercent,
        current: i + 1,
        total: allBoards.length
      });

      // Retry mechanism - try up to 3 times
      let success = false;
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          if (attempt > 0) {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          }

          const response = await fetch(`/api/trello/boards/${board.id}/cards`);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const boardCards = await response.json();
          
          if (!Array.isArray(boardCards)) {
            throw new Error('Invalid response format');
          }

          // Process cards - skip already loaded ones
          for (const card of boardCards) {
            if (existingCardIds.has(card.id)) {
              skippedCount++;
            } else {
              newCards.push({
                id: card.id,
                name: card.name,
                desc: card.desc || '',
                idBoard: card.idBoard,
                idList: card.idList,
                boardName: board.name,
                listName: card.listName || '',
                hasAPTLSS: card.checklists?.some((cl: any) => cl.name === 'APTLSS') || false,
                selected: false,
                due: card.due,
                badges: card.badges
              });
              existingCardIds.add(card.id); // Prevent duplicates within this load
              loadedCount++;
            }
          }

          success = true;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.error(`Attempt ${attempt + 1} failed for board ${board.name}:`, error);
        }
      }

      if (!success) {
        failedBoards.push(board);
        console.error(`All attempts failed for board ${board.name}:`, lastError);
      }

      // Update progress
      setAutoLoadProgress(prev => prev ? {
        ...prev,
        loaded: loadedCount,
        skipped: skippedCount,
        failed: failedBoards.length,
        failedBoards: [...failedBoards]
      } : null);
    }

    // Add all new cards to state
    if (newCards.length > 0) {
      setCards(prev => [...prev, ...newCards]);
    }

    // Show completion message
    setAutoLoadProgress(prev => prev ? { ...prev, isLoading: false } : null);
    
    // Update global loading queue with completion status
    if (failedBoards.length === 0) {
      updateOperation(operationId, {
        status: 'completed',
        progress: 100
      });
      toast.success(`Loaded ${loadedCount} new cards (${skippedCount} already loaded)`);
    } else {
      updateOperation(operationId, {
        status: 'failed',
        progress: 100
      });
      toast.warning(`Loaded ${loadedCount} cards, ${failedBoards.length} boards failed`);
    }
  };

  // Retry failed boards
  const retryFailedBoards = async () => {
    if (!autoLoadProgress || autoLoadProgress.failedBoards.length === 0) return;

    const failedBoards = [...autoLoadProgress.failedBoards];
    const existingCardIds = new Set(cards.map(c => c.id));

    setAutoLoadProgress(prev => prev ? {
      ...prev,
      isLoading: true,
      current: 0,
      total: failedBoards.length,
      failedBoards: [],
      failed: 0
    } : null);

    const newCards: TrelloCard[] = [];
    const stillFailedBoards: { id: string; name: string; workspaceName: string }[] = [];
    let loadedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < failedBoards.length; i++) {
      const board = failedBoards[i];
      
      setAutoLoadProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        currentBoard: `${board.workspaceName} / ${board.name}`
      } : null);

      let success = false;
      
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          }

          const response = await fetch(`/api/trello/boards/${board.id}/cards`);
          
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          
          const boardCards = await response.json();
          
          if (!Array.isArray(boardCards)) throw new Error('Invalid response');

          for (const card of boardCards) {
            if (existingCardIds.has(card.id)) {
              skippedCount++;
            } else {
              newCards.push({
                id: card.id,
                name: card.name,
                desc: card.desc || '',
                idBoard: card.idBoard,
                idList: card.idList,
                boardName: board.name,
                listName: card.listName || '',
                hasAPTLSS: card.checklists?.some((cl: any) => cl.name === 'APTLSS') || false,
                selected: false,
                due: card.due,
                badges: card.badges
              });
              existingCardIds.add(card.id);
              loadedCount++;
            }
          }

          success = true;
        } catch (error) {
          console.error(`Retry attempt ${attempt + 1} failed for ${board.name}:`, error);
        }
      }

      if (!success) {
        stillFailedBoards.push(board);
      }

      setAutoLoadProgress(prev => prev ? {
        ...prev,
        loaded: prev.loaded + loadedCount,
        skipped: prev.skipped + skippedCount,
        failed: stillFailedBoards.length,
        failedBoards: [...stillFailedBoards]
      } : null);
    }

    if (newCards.length > 0) {
      setCards(prev => [...prev, ...newCards]);
    }

    setAutoLoadProgress(prev => prev ? { ...prev, isLoading: false } : null);
    
    if (stillFailedBoards.length === 0) {
      toast.success(`Retry successful! Loaded ${loadedCount} cards`);
    } else {
      toast.warning(`Loaded ${loadedCount} cards, ${stillFailedBoards.length} boards still failing`);
    }
  };

  const startGeneration = async () => {
    const selectedCards = cards.filter(card => card.selected);
    
    if (selectedCards.length === 0) {
      toast.error('Please select at least one card');
      return;
    }

    setProgress({
      total: selectedCards.length,
      completed: 0,
      failed: 0,
      status: 'submitting'
    });

    toast.info(`Starting APTLSS generation for ${selectedCards.length} cards`);

    try {
      const response = await fetch('/api/aptlss/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cardIds: selectedCards.map(card => card.id),
          settings: {
            ...settings,
            clarifiedGoal,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate APTLSS');
      }

      setProgress({
        jobId: data.jobId,
        total: data.total || selectedCards.length,
        completed: data.completed || 0,
        failed: data.failed || 0,
        current: '',
        status: data.failed > 0 ? 'completed_with_errors' : 'completed',
        completedAt: new Date().toISOString(),
      });

      await loadHistory();
      await loadScheduledJobs();
      setSelectedJobId(data.jobId);
      await toggleJobDetails(data.jobId, true);

      if (data.failed > 0) {
        toast.warning(`APTLSS generation completed with ${data.failed} failure(s)`);
      } else {
        toast.success(`Generated APTLSS for ${data.completed || selectedCards.length} cards`);
      }
    } catch (error) {
      console.error('Failed to generate APTLSS:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate APTLSS');
      setProgress(prev => ({ ...prev, status: 'failed' }));
    }
  };

  const selectedCount = cards.filter(c => c.selected).length;
  const progressPercent = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
  const activeJob = history.find((job: any) => job.id === progress.jobId) || null;

  const getJobBadgeVariant = (status: string) => {
    if (status === 'completed') return 'default';
    if (status === 'running' || status === 'submitting') return 'secondary';
    if (status === 'completed_with_errors') return 'outline';
    return 'destructive';
  };

  return (
    <div className="container mx-auto py-4 md:py-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10">
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-3xl font-bold">APTLSS Management</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Select cards and generate APTLSS checklists in bulk
            </p>
          </div>
        </div>
        <Button onClick={loadBoards} variant="outline" disabled={loading} className="w-full md:w-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Progress Card */}
      {progress.status !== 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 text-lg md:text-xl">
              <span>Generation Progress</span>
              <Badge variant={getJobBadgeVariant(progress.status)}>
                {progress.status.replace(/_/g, ' ')}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {progress.jobId ? `Job ${progress.jobId}` : 'Submitting generation request'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-sm">
              <span>Completed: {progress.completed}/{progress.total}</span>
              <span>Failed: {progress.failed}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            {progress.status === 'submitting' && (
              <p className="text-sm text-muted-foreground">
                The server is creating the batch job and will respond with the final result when processing finishes.
              </p>
            )}
            {progress.status === 'running' && (
              <p className="text-sm text-muted-foreground">
                This page polls the server for live job status while the batch is running.
              </p>
            )}
            {progress.status === 'completed_with_errors' && (
              <p className="text-sm text-amber-700">
                The batch finished with partial failures. Review the history details below to retry failed cards.
              </p>
            )}
            {progress.status === 'failed' && (
              <p className="text-sm text-red-700">
                The request failed before the batch reported completion. Check the history tab for any partial job records.
              </p>
            )}
            {progress.completedAt && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(progress.completedAt).toLocaleString()}
              </p>
            )}
            {activeJob?.failedCards > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => retryFailedItems(activeJob.id)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry {activeJob.failedCards} Failed Items
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="workspaces" className="flex-1">
        <Card>
          <CardHeader>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
              <TabsTrigger value="boards">Boards</TabsTrigger>
              <TabsTrigger value="cards">Cards</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>

            {/* Workspaces Tab */}
            <TabsContent value="workspaces" className="space-y-4">
              {loadingProgress && (
                <Card className="bg-primary/5">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{loadingProgress.message}</p>
                        {loadingProgress.total > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {loadingProgress.current} of {loadingProgress.total} boards
                          </p>
                        )}
                      </div>
                      {loadingProgress.total > 0 && (
                        <span className="text-sm font-medium">
                          {Math.round((loadingProgress.current / loadingProgress.total) * 100)}%
                        </span>
                      )}
                    </div>
                    {loadingProgress.total > 0 && (
                      <Progress 
                        value={(loadingProgress.current / loadingProgress.total) * 100} 
                        className="mt-2"
                      />
                    )}
                  </CardContent>
                </Card>
              )}
              
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {workspaces.length} workspaces available
                </p>
              </div>

              <div className="grid gap-4">
                {workspaces.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      Loading workspaces...
                    </CardContent>
                  </Card>
                ) : (
                  workspaces.map(workspace => (
                    <Card key={workspace.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{workspace.name}</CardTitle>
                            <CardDescription>
                              {workspace.boardCount} boards • {workspace.boards?.reduce((sum, b: any) => sum + (b.cardCount || 0), 0) || 0} total cards
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => selectAllCardsInWorkspace(workspace.id)}
                              disabled={loading}
                            >
                              Select All Cards
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadWorkspaceBoards(workspace.id)}
                            >
                              Load All Boards
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {workspace.boards && workspace.boards.length > 0 && (
                        <CardContent>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground mb-2">Boards:</p>
                            <div className="grid gap-2">
                              {workspace.boards.map((board: any) => (
                                <div
                                  key={board.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                                >
                                  <div>
                                    <p className="font-medium">{board.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {board.cardCount || 0} cards
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      // Load this specific board's cards
                                      fetch(`/api/trello/boards/${board.id}/cards`)
                                        .then(res => res.json())
                                        .then(cardData => {
                                          const newCards = cardData.map((c: any) => ({
                                            ...c,
                                            boardName: board.name,
                                            selected: false,
                                            hasAPTLSS: false
                                          }));
                                          setCards(prev => [...prev, ...newCards]);
                                          toast.success(`Loaded ${newCards.length} cards from ${board.name}`);
                                        })
                                        .catch(err => {
                                          console.error('Error loading cards:', err);
                                          toast.error('Failed to load cards');
                                        });
                                    }}
                                  >
                                    Load Cards
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Cards Tab */}
            <TabsContent value="cards" className="space-y-4">
          {/* Workspace Selector Modal */}
          {showBoardSelector && (
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Select Workspaces to Load</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowBoardSelector(false)}>
                    ✕
                  </Button>
                </div>
                <CardDescription>
                  Choose which workspaces to load cards from. Loading fewer workspaces is faster.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={workspaceSearchInputRef}
                      placeholder="Search workspaces... (press / to focus)"
                      value={workspaceSearchTerm}
                      onChange={(e) => setWorkspaceSearchTerm(e.target.value)}
                      className="pl-9 pr-12"
                    />
                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">/</kbd>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const filteredIds = workspaces
                          .filter(w => w.name.toLowerCase().includes(workspaceSearchTerm.toLowerCase()))
                          .map(w => w.id);
                        setSelectedWorkspacesForLoad(new Set([...Array.from(selectedWorkspacesForLoad), ...filteredIds]));
                      }}
                    >
                      <CheckSquare className="h-3 w-3 mr-1" />
                      {workspaceSearchTerm ? 'Select Filtered' : 'Select All'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (workspaceSearchTerm) {
                          const filteredIds = workspaces
                            .filter(w => w.name.toLowerCase().includes(workspaceSearchTerm.toLowerCase()))
                            .map(w => w.id);
                          const newSet = new Set(selectedWorkspacesForLoad);
                          filteredIds.forEach(id => newSet.delete(id));
                          setSelectedWorkspacesForLoad(newSet);
                        } else {
                          setSelectedWorkspacesForLoad(new Set());
                        }
                      }}
                    >
                      {workspaceSearchTerm ? 'Clear Filtered' : 'Clear All'}
                    </Button>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-2">
                    {workspaces
                      .filter(w => w.name.toLowerCase().includes(workspaceSearchTerm.toLowerCase()))
                      .map(workspace => (
                      <label
                        key={workspace.id}
                        className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedWorkspacesForLoad.has(workspace.id)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedWorkspacesForLoad);
                            if (checked) {
                              newSet.add(workspace.id);
                            } else {
                              newSet.delete(workspace.id);
                            }
                            setSelectedWorkspacesForLoad(newSet);
                          }}
                        />
                        <span className="flex-1 text-sm">{workspace.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {workspace.boardCount} boards • {workspace.boards?.reduce((sum, b: any) => sum + (b.cardCount || 0), 0) || 0} cards
                        </span>
                      </label>
                    ))}
                    {workspaces.filter(w => w.name.toLowerCase().includes(workspaceSearchTerm.toLowerCase())).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No workspaces found matching "{workspaceSearchTerm}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      {selectedWorkspacesForLoad.size} workspace{selectedWorkspacesForLoad.size !== 1 ? 's' : ''} selected
                      ({workspaces.filter(w => selectedWorkspacesForLoad.has(w.id)).reduce((sum, w) => sum + w.boardCount, 0)} boards)
                      {workspaceSearchTerm && (
                        <span className="ml-2">
                          • Showing {workspaces.filter(w => w.name.toLowerCase().includes(workspaceSearchTerm.toLowerCase())).length} of {workspaces.length}
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBoardSelector(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={selectedWorkspacesForLoad.size === 0}
                        onClick={() => autoLoadAllCards(true)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Load Selected
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Auto-load Progress */}
          {autoLoadProgress && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {autoLoadProgress.isLoading && (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      )}
                      <div>
                        <p className="font-medium">
                          {autoLoadProgress.isLoading ? 'Loading cards...' : 'Loading complete'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {autoLoadProgress.currentBoard || 'Preparing...'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">
                        {autoLoadProgress.current} / {autoLoadProgress.total} boards
                      </p>
                      <p className="text-muted-foreground">
                        {Math.round((autoLoadProgress.current / autoLoadProgress.total) * 100)}%
                      </p>
                      {autoLoadProgress.isLoading && getEstimatedTimeRemaining() && (
                        <p className="text-xs text-muted-foreground flex items-center justify-end gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          ~{getEstimatedTimeRemaining()} remaining
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <Progress 
                    value={(autoLoadProgress.current / autoLoadProgress.total) * 100} 
                    className="h-2"
                  />
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex gap-4">
                      <span className="text-green-600">✓ Loaded: {autoLoadProgress.loaded}</span>
                      <span className="text-blue-600">⊘ Skipped: {autoLoadProgress.skipped}</span>
                      {autoLoadProgress.failed > 0 && (
                        <span className="text-red-600">✗ Failed: {autoLoadProgress.failed}</span>
                      )}
                      {autoLoadProgress.cancelled && (
                        <span className="text-amber-600">⚠ Cancelled</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {autoLoadProgress.isLoading && (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={cancelAutoLoad}
                        >
                          Cancel
                        </Button>
                      )}
                      {!autoLoadProgress.isLoading && autoLoadProgress.failedBoards.length > 0 && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={retryFailedBoards}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry {autoLoadProgress.failedBoards.length} Failed
                        </Button>
                      )}
                      {!autoLoadProgress.isLoading && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setAutoLoadProgress(null)}
                        >
                          Dismiss
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Failed boards list */}
                  {!autoLoadProgress.isLoading && autoLoadProgress.failedBoards.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <p className="text-sm font-medium text-red-600 mb-2">Failed Boards:</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {autoLoadProgress.failedBoards.map((board) => (
                          <div key={`${board.id}-${board.workspaceName}`} className="text-xs text-muted-foreground flex items-center justify-between bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded">
                            <span>{board.workspaceName} / {board.name}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/trello/boards/${board.id}/cards`);
                                  if (!response.ok) throw new Error('Failed');
                                  const boardCards = await response.json();
                                  const existingIds = new Set(cards.map(c => c.id));
                                  const newCards = boardCards.filter((c: any) => !existingIds.has(c.id)).map((card: any) => ({
                                    id: card.id,
                                    name: card.name,
                                    desc: card.desc || '',
                                    idBoard: card.idBoard,
                                    idList: card.idList,
                                    boardName: board.name,
                                    listName: card.listName || '',
                                    hasAPTLSS: card.checklists?.some((cl: any) => cl.name === 'APTLSS') || false,
                                    selected: false,
                                    due: card.due,
                                    badges: card.badges
                                  }));
                                  if (newCards.length > 0) {
                                    setCards(prev => [...prev, ...newCards]);
                                  }
                                  setAutoLoadProgress(prev => prev ? {
                                    ...prev,
                                    failedBoards: prev.failedBoards.filter(b => b.id !== board.id),
                                    failed: prev.failed - 1,
                                    loaded: prev.loaded + newCards.length
                                  } : null);
                                  toast.success(`Loaded ${newCards.length} cards from ${board.name}`);
                                } catch (e) {
                                  toast.error(`Failed to retry ${board.name}`);
                                }
                              }}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card Count Summary */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {cards.length > 0 
                ? `${cards.length} cards loaded • ${filteredCards.length} shown`
                : `Total cards across all workspaces: ${workspaces.reduce((sum, w) => sum + (w.boards?.reduce((bSum, b: any) => bSum + (b.cardCount || 0), 0) || 0), 0)}`
              }
            </p>
            <div className="flex gap-2">
              {cards.length > 0 && (
                <Button 
                  onClick={clearCache} 
                  variant="outline"
                  size="sm"
                  disabled={autoLoadProgress?.isLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Cache
                </Button>
              )}
              <Button 
                onClick={() => setShowBoardSelector(true)} 
                variant="outline"
                size="sm"
                disabled={autoLoadProgress?.isLoading || workspaces.length === 0}
              >
                <Filter className="h-4 w-4 mr-2" />
                Select Workspaces
              </Button>
              <Button 
                onClick={() => autoLoadAllCards(false)} 
                variant="default"
                size="sm"
                disabled={autoLoadProgress?.isLoading || workspaces.length === 0}
              >
                {autoLoadProgress?.isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {autoLoadProgress?.isLoading ? 'Loading...' : 'Load All Cards'}
              </Button>
            </div>
          </div>

          {/* Filters and Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search cards..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={selectAllCards} variant="outline" size="sm">
                    Select All
                  </Button>
                  <Button onClick={deselectAllCards} variant="outline" size="sm">
                    Deselect All
                  </Button>
                  <Button 
                    onClick={() => {
                      setCards(prev => prev.map(c => ({
                        ...c,
                        selected: !c.hasAPTLSS
                      })));
                      toast.success('Selected cards without APTLSS');
                    }}
                    variant="outline" 
                    size="sm"
                  >
                    Without APTLSS
                  </Button>
                  <Button 
                    onClick={() => {
                      const now = new Date();
                      setCards(prev => prev.map(c => {
                        const dueDate = c.due ? new Date(c.due) : null;
                        return {
                          ...c,
                          selected: dueDate ? dueDate < now : false
                        };
                      }));
                      toast.success('Selected overdue cards');
                    }}
                    variant="outline" 
                    size="sm"
                  >
                    Overdue
                  </Button>
                  <Button 
                    onClick={() => {
                      setCards(prev => prev.map(c => ({
                        ...c,
                        selected: (c.badges?.attachments ?? 0) > 0
                      })));
                      toast.success('Selected cards with attachments');
                    }}
                    variant="outline" 
                    size="sm"
                  >
                    With Attachments
                  </Button>
                  <Button 
                    onClick={startGeneration} 
                    disabled={selectedCount === 0 || progress.status === 'running' || progress.status === 'submitting'}
                    size="sm"
                  >
                    {progress.status === 'running' || progress.status === 'submitting' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Generate ({selectedCount})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards List */}
          <div className="grid gap-4">
            {filteredCards.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No cards loaded. Select a board to load cards.
                </CardContent>
              </Card>
            ) : (
              filteredCards.map(card => (
                <Card key={card.id} className={card.selected ? 'border-primary' : ''}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={card.selected}
                        onCheckedChange={() => toggleCardSelection(card.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <a
                            href={`https://trello.com/c/${card.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium truncate hover:text-primary hover:underline transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {card.name}
                          </a>
                          {card.hasAPTLSS && (
                            <Badge variant="secondary" className="shrink-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Has APTLSS
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {card.desc || 'No description'}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {card.boardName && (
                            <Badge variant="outline" className="text-xs">
                              {card.boardName}
                            </Badge>
                          )}
                          {card.listName && (
                            <Badge variant="outline" className="text-xs">
                              {card.listName}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInterviewCardId(card.id);
                              setInterviewCardName(card.name);
                            }}
                            className="gap-2"
                          >
                            <MessageSquare className="h-3 w-3" />
                            Start Goal Interview
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Boards Tab */}
        <TabsContent value="boards" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {boards.map(board => (
              <Card 
                key={board.id} 
                className={`cursor-pointer transition-colors ${
                  board.selected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                }`}
                onClick={() => toggleBoardSelection(board.id)}
              >
                <CardContent className="py-6">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={board.selected}
                      onCheckedChange={() => toggleBoardSelection(board.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">{board.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {board.cardCount} cards
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              View past generation jobs and retry failed items
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadHistory}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <div className="space-y-4">
            {history.map((job: any) => (
              <Card key={job.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        Job {job.id}
                      </CardTitle>
                      <CardDescription>
                        {new Date(job.createdAt).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={getJobBadgeVariant(job.status)}
                    >
                      {job.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Progress
                      value={job.totalCards > 0 ? ((job.completedCards + job.failedCards) / job.totalCards) * 100 : 0}
                      className="h-2"
                    />
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Cards</p>
                        <p className="font-medium">{job.totalCards}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Completed</p>
                        <p className="font-medium text-green-600">
                          {job.completedCards}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Failed</p>
                        <p className="font-medium text-red-600">
                          {job.failedCards}
                        </p>
                      </div>
                    </div>
                    {job.completedAt && (
                      <p className="text-xs text-muted-foreground">
                        Completed at {new Date(job.completedAt).toLocaleString()}
                      </p>
                    )}

                    {job.failedCards > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retryFailedItems(job.id)}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry {job.failedCards} Failed Items
                      </Button>
                    )}

                    {selectedJobId === job.id && jobDetails && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium">Item Details:</p>
                        <div className="max-h-[300px] overflow-y-auto space-y-2">
                          {jobDetails.items.map((item: any) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 border rounded text-sm"
                            >
                              <div className="flex-1">
                                <p className="font-medium">{item.cardName}</p>
                                {item.boardName && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.boardName}
                                  </p>
                                )}
                                {item.error && (
                                  <p className="text-xs text-red-600 mt-1">
                                    Error: {item.error}
                                  </p>
                                )}
                              </div>
                              <Badge
                                variant={
                                  item.status === 'completed'
                                    ? 'default'
                                    : item.status === 'failed'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                              >
                                {item.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleJobDetails(job.id)}
                    >
                      {selectedJobId === job.id ? 'Hide' : 'Show'} Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {history.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No generation history yet. Start a batch generation to see results here.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generation Settings</CardTitle>
              <CardDescription>
                Configure how APTLSS checklists are generated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Skip Existing APTLSS</Label>
                  <p className="text-sm text-muted-foreground">
                    Don't regenerate for cards that already have APTLSS
                  </p>
                </div>
                <Switch
                  checked={settings.skipExisting}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({ ...prev, skipExisting: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Validate Before Generate</Label>
                  <p className="text-sm text-muted-foreground">
                    Run ARES validation before generating APTLSS
                  </p>
                </div>
                <Switch
                  checked={settings.validateBeforeGenerate}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({ ...prev, validateBeforeGenerate: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Auto-Reminder</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically set up reminders for generated APTLSS
                  </p>
                </div>
                <Switch
                  checked={settings.autoReminder}
                  onCheckedChange={(checked) =>
                    setSettings(prev => ({ ...prev, autoReminder: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Batch Size</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.batchSize}
                  onChange={(e) =>
                    setSettings(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Number of cards to process simultaneously
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule Generation</CardTitle>
              <CardDescription>
                Schedule bulk APTLSS generation for off-hours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Schedule Date & Time</Label>
                <Input
                  type="datetime-local"
                  onChange={(e) => {
                    const scheduledTime = new Date(e.target.value);
                    if (scheduledTime > new Date()) {
                      setSettings(prev => ({ ...prev, scheduledTime: e.target.value }));
                    } else {
                      toast.error('Please select a future date and time');
                    }
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Selected cards will be processed at this time
                </p>
              </div>

              <Button
                onClick={() => {
                  const selectedCards = cards.filter(c => c.selected);
                  if (selectedCards.length === 0) {
                    toast.error('Please select cards first');
                    return;
                  }
                  if (!settings.scheduledTime) {
                    toast.error('Please select a schedule time');
                    return;
                  }
                  
                  // Schedule the job
                  fetch('/api/aptlss/schedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      cardIds: selectedCards.map(c => c.id),
                      scheduledTime: settings.scheduledTime,
                      settings: {
                        skipExisting: settings.skipExisting,
                        validateBeforeGenerate: settings.validateBeforeGenerate,
                        autoReminder: settings.autoReminder,
                        batchSize: settings.batchSize
                      }
                    })
                  })
                    .then(res => res.json())
                    .then(data => {
                      toast.success(`Scheduled generation for ${selectedCards.length} cards at ${new Date(settings.scheduledTime).toLocaleString()}`);
                    })
                    .catch(error => {
                      console.error('Error scheduling generation:', error);
                      toast.error('Failed to schedule generation');
                    });
                }}
                disabled={selectedCount === 0}
                className="w-full"
              >
                Schedule Generation for {selectedCount} Selected Cards
              </Button>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Scheduled Jobs</p>
                  <Button
                    variant="ghost"
                    size="sm"
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/aptlss/scheduled');
                          const jobs = await response.json();
                          setSettings(prev => ({ ...prev, scheduledJobs: jobs }));
                      } catch (error) {
                        console.error('Error loading scheduled jobs:', error);
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {settings.scheduledJobs && settings.scheduledJobs.length > 0 ? (
                    settings.scheduledJobs.map((job: any) => (
                      <div key={job.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {JSON.parse(job.cardIds).length} cards
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(job.scheduledTime).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={job.status === 'pending' ? 'secondary' : 'default'}>
                            {job.status}
                          </Badge>
                          {job.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await fetch(`/api/aptlss/scheduled/${job.id}`, {
                                    method: 'DELETE'
                                  });
                                  toast.success('Scheduled job cancelled');
                                  // Reload jobs
                                  await loadScheduledJobs();
                                } catch (error) {
                                  toast.error('Failed to cancel job');
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No scheduled jobs</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      {/* Goal Interview Dialog */}
      <GoalInterviewDialog
        open={interviewCardId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInterviewCardId(null);
            setInterviewCardName('');
          }
        }}
        cardId={interviewCardId || ''}
        cardName={interviewCardName}
        onComplete={(finalGoal) => {
          console.log('Interview complete, final goal:', finalGoal);
          toast.success('Goal clarified! You can now generate APTLSS based on this goal.');
          setClarifiedGoal(finalGoal);
        }}
      />
    </div>
  );
}
