import { useState, useEffect } from 'react';
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
  Pause,
  Settings,
  Download,
  RefreshCw,
  Filter,
  Search
} from 'lucide-react';

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
  current?: string;
  status: 'idle' | 'running' | 'paused' | 'completed';
}

export default function APTLSSManagement() {
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

  // Load workspaces and boards
  useEffect(() => {
    loadWorkspaces();
    loadBoards();
    loadHistory();
  }, []);

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

  const toggleJobDetails = async (jobId: string) => {
    if (selectedJobId === jobId) {
      setSelectedJobId(null);
      setJobDetails(null);
    } else {
      try {
        const response = await fetch(`/api/aptlss/history/${jobId}`);
        const data = await response.json();
        setJobDetails(data);
        setSelectedJobId(jobId);
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
    let filtered = cards;

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
      // TODO: Replace with actual API call
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
      status: 'running'
    });

    toast.info(`Starting APTLSS generation for ${selectedCards.length} cards`);

    // TODO: Implement actual generation
    for (let i = 0; i < selectedCards.length; i++) {
      if (progress.status === 'paused') break;

      const card = selectedCards[i];
      
      setProgress(prev => ({
        ...prev,
        current: card.name,
        completed: i
      }));

      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // TODO: Replace with actual API call
        // await fetch('/api/aptlss/generate', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ cardId: card.id, settings })
        // });

        setProgress(prev => ({
          ...prev,
          completed: prev.completed + 1
        }));

        toast.success(`Generated APTLSS for: ${card.name}`);
      } catch (error) {
        setProgress(prev => ({
          ...prev,
          failed: prev.failed + 1
        }));
        toast.error(`Failed to generate APTLSS for: ${card.name}`);
      }
    }

    setProgress(prev => ({ ...prev, status: 'completed' }));
    toast.success('APTLSS generation completed!');
  };

  const pauseGeneration = () => {
    setProgress(prev => ({ ...prev, status: 'paused' }));
    toast.info('Generation paused');
  };

  const resumeGeneration = () => {
    setProgress(prev => ({ ...prev, status: 'running' }));
    toast.info('Generation resumed');
  };

  const selectedCount = cards.filter(c => c.selected).length;
  const progressPercent = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">APTLSS Management</h1>
          <p className="text-muted-foreground">
            Select cards and generate APTLSS checklists in bulk
          </p>
        </div>
        <Button onClick={loadBoards} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Progress Card */}
      {progress.status !== 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Generation Progress</span>
              <div className="flex gap-2">
                {progress.status === 'running' && (
                  <Button size="sm" variant="outline" onClick={pauseGeneration}>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                )}
                {progress.status === 'paused' && (
                  <Button size="sm" variant="outline" onClick={resumeGeneration}>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              {progress.current && `Currently processing: ${progress.current}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-sm">
              <span>Completed: {progress.completed}/{progress.total}</span>
              <span>Failed: {progress.failed}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
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
                    disabled={selectedCount === 0 || progress.status === 'running'}
                    size="sm"
                  >
                    {progress.status === 'running' ? (
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
                      variant={
                        job.status === 'completed'
                          ? 'default'
                          : job.status === 'running'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
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
                                  const response = await fetch('/api/aptlss/scheduled');
                                  const jobs = await response.json();
                                  setSettings(prev => ({ ...prev, scheduledJobs: jobs }));
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
    </div>
  );
}
