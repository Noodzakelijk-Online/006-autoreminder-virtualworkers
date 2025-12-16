import { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { 
  ArrowLeft, Plus, Users, Clock, CheckCircle, AlertTriangle, Loader2, 
  MoreVertical, Mail, Globe, DollarSign, Search, Flag, ExternalLink,
  Star, MessageSquare, Calendar, Send, RefreshCw, Filter, Briefcase,
  Timer, AlertCircle, CheckSquare, XCircle, ArrowUpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface VA {
  id: number;
  name: string;
  email: string | null;
  timezone: string;
  skills: string | null;
  hourlyRate: number | null;
  currency: string | null;
  workStartHour: number;
  workEndHour: number;
  workingDays: string;
  status: 'active' | 'inactive' | 'on_leave';
}

interface WorkloadItem {
  va: VA;
  totalTasks: number;
  statusCounts: {
    assigned: number;
    in_progress: number;
    completed: number;
    blocked: number;
    ready_for_review: number;
  };
}

interface TaskAssignment {
  id: number;
  taskId: string;
  taskTitle: string;
  cardName: string;
  cardId: string;
  vaId: number | null;
  vaName: string | null;
  priority: 'critical' | 'urgent' | 'high' | 'normal';
  isPriorityOverride: boolean;
  status: 'assigned' | 'in_progress' | 'completed' | 'blocked' | 'ready_for_review';
  estimatedMinutes: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  blockedBy: string[];
  clientProject?: string;
}

interface ReviewItem {
  id: number;
  taskId: string;
  taskTitle: string;
  cardName: string;
  vaId: number;
  vaName: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'revision_requested';
  notes?: string;
}

interface CommunicationEntry {
  id: number;
  taskId: string;
  vaId: number;
  vaName: string;
  type: 'note' | 'question' | 'update' | 'handoff';
  message: string;
  timestamp: string;
  isRead: boolean;
}

interface TimezoneOverlap {
  vaId: number;
  vaName: string;
  vaTimezone: string;
  overlapHours: number;
  overlapStart: string;
  overlapEnd: string;
}

const TIMEZONES = [
  { value: 'Asia/Manila', label: 'Philippines (GMT+8)' },
  { value: 'Asia/Jakarta', label: 'Indonesia (GMT+7)' },
  { value: 'Asia/Kolkata', label: 'India (GMT+5:30)' },
  { value: 'Europe/Amsterdam', label: 'Netherlands (GMT+1)' },
  { value: 'America/New_York', label: 'US Eastern (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (GMT-8)' },
  { value: 'UTC', label: 'UTC' },
];

export default function FounderDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [workload, setWorkload] = useState<WorkloadItem[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [communications, setCommunications] = useState<CommunicationEntry[]>([]);
  const [timezoneOverlaps, setTimezoneOverlaps] = useState<TimezoneOverlap[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddVA, setShowAddVA] = useState(false);
  const [newVA, setNewVA] = useState({
    name: '',
    email: '',
    timezone: 'Asia/Manila',
    hourlyRate: '',
    currency: 'USD',
  });
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVAFilter, setSelectedVAFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  // Briefing settings
  const [briefingEnabled, setBriefingEnabled] = useState(true);
  const [briefingTime, setBriefingTime] = useState('08:00');
  const [eodReportEnabled, setEodReportEnabled] = useState(true);
  const [eodReportTime, setEodReportTime] = useState('18:00');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchWorkload(),
        fetchAssignments(),
        fetchReviews(),
        fetchCommunications(),
        fetchTimezoneOverlaps(),
        fetchBriefingSettings(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkload = async () => {
    try {
      const res = await fetch('/api/va/workload-overview', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setWorkload(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching workload:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      const res = await fetch('/api/va/assignments', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAssignments(Array.isArray(data) ? data : data.assignments || []);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch('/api/va/reviews', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setReviews(Array.isArray(data) ? data : data.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const fetchCommunications = async () => {
    try {
      const res = await fetch('/api/va/communications', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCommunications(Array.isArray(data) ? data : data.communications || []);
      }
    } catch (error) {
      console.error('Error fetching communications:', error);
    }
  };

  const fetchTimezoneOverlaps = async () => {
    try {
      const res = await fetch('/api/va/timezone-overlaps', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTimezoneOverlaps(Array.isArray(data) ? data : data.overlaps || []);
      }
    } catch (error) {
      console.error('Error fetching timezone overlaps:', error);
    }
  };

  const fetchBriefingSettings = async () => {
    try {
      const res = await fetch('/api/va/briefing-settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setBriefingEnabled(data.morningBriefingEnabled ?? true);
          setBriefingTime(data.morningBriefingTime ?? '08:00');
          setEodReportEnabled(data.eodReportEnabled ?? true);
          setEodReportTime(data.eodReportTime ?? '18:00');
        }
      }
    } catch (error) {
      console.error('Error fetching briefing settings:', error);
    }
  };

  const handleAddVA = async () => {
    if (!newVA.name.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/va/vas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...newVA,
          hourlyRate: newVA.hourlyRate ? parseInt(newVA.hourlyRate) * 100 : null,
        }),
      });

      if (res.ok) {
        toast.success('VA added successfully');
        setShowAddVA(false);
        setNewVA({ name: '', email: '', timezone: 'Asia/Manila', hourlyRate: '', currency: 'USD' });
        fetchWorkload();
      } else {
        toast.error('Failed to add VA');
      }
    } catch (error) {
      toast.error('Failed to add VA');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (vaId: number, status: string) => {
    try {
      const res = await fetch(`/api/va/vas/${vaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        toast.success('Status updated');
        fetchWorkload();
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleAssignTask = async (assignmentId: number, vaId: number) => {
    try {
      const res = await fetch(`/api/va/assignments/${assignmentId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ vaId }),
      });

      if (res.ok) {
        const va = workload.find(w => w.va.id === vaId)?.va;
        setAssignments(assignments.map(a => 
          a.id === assignmentId 
            ? { ...a, vaId, vaName: va?.name || null }
            : a
        ));
        toast.success(`Task assigned to ${va?.name}`);
        fetchWorkload();
      } else {
        toast.error('Failed to assign task');
      }
    } catch (error) {
      toast.error('Failed to assign task');
    }
  };

  const handlePriorityOverride = async (assignmentId: number, priority: string) => {
    try {
      const res = await fetch(`/api/va/assignments/${assignmentId}/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priority }),
      });

      if (res.ok) {
        setAssignments(assignments.map(a => 
          a.id === assignmentId 
            ? { ...a, priority: priority as any, isPriorityOverride: true }
            : a
        ));
        toast.success(`Priority set to ${priority.toUpperCase()}`);
      } else {
        toast.error('Failed to set priority');
      }
    } catch (error) {
      toast.error('Failed to set priority');
    }
  };

  const handleApproveReview = async (reviewId: number) => {
    try {
      const res = await fetch(`/api/va/reviews/${reviewId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        setReviews(reviews.map(r => 
          r.id === reviewId ? { ...r, status: 'approved' } : r
        ));
        toast.success('Task approved');
      } else {
        toast.error('Failed to approve');
      }
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleRequestRevision = async (reviewId: number, notes: string) => {
    try {
      const res = await fetch(`/api/va/reviews/${reviewId}/revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes }),
      });

      if (res.ok) {
        setReviews(reviews.map(r => 
          r.id === reviewId ? { ...r, status: 'revision_requested', notes } : r
        ));
        toast.success('Revision requested');
      } else {
        toast.error('Failed to request revision');
      }
    } catch (error) {
      toast.error('Failed to request revision');
    }
  };

  const handleSaveBriefingSettings = async () => {
    try {
      const res = await fetch('/api/va/briefing-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          morningBriefingEnabled: briefingEnabled,
          morningBriefingTime: briefingTime,
          eodReportEnabled: eodReportEnabled,
          eodReportTime: eodReportTime,
        }),
      });

      if (res.ok) {
        toast.success('Briefing settings saved');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    let filtered = assignments;
    
    if (selectedVAFilter !== 'all') {
      filtered = filtered.filter(a => a.vaId === parseInt(selectedVAFilter));
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.taskTitle.toLowerCase().includes(query) ||
        a.cardName.toLowerCase().includes(query) ||
        a.clientProject?.toLowerCase().includes(query)
      );
    }
    
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(a => a.priority === priorityFilter);
    }
    
    return filtered;
  }, [assignments, selectedVAFilter, searchQuery, priorityFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-500';
      case 'inactive': return 'bg-gray-500/10 text-gray-500';
      case 'on_leave': return 'bg-yellow-500/10 text-yellow-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500 text-white';
      case 'urgent': return 'bg-orange-500 text-white';
      case 'high': return 'bg-yellow-500 text-black';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-700"><Timer className="h-3 w-3 mr-1" />In Progress</Badge>;
      case 'blocked':
        return <Badge className="bg-red-100 text-red-700"><AlertCircle className="h-3 w-3 mr-1" />Blocked</Badge>;
      case 'ready_for_review':
        return <Badge className="bg-purple-100 text-purple-700"><Star className="h-3 w-3 mr-1" />Ready for Review</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700"><Clock className="h-3 w-3 mr-1" />Assigned</Badge>;
    }
  };

  const getWorkloadLevel = (item: WorkloadItem) => {
    const active = item.statusCounts.assigned + item.statusCounts.in_progress;
    if (active > 10) return { level: 'Overloaded', color: 'text-red-500' };
    if (active > 5) return { level: 'High', color: 'text-yellow-500' };
    if (active > 0) return { level: 'Normal', color: 'text-green-500' };
    return { level: 'Available', color: 'text-blue-500' };
  };

  const totalStats = workload.reduce((acc, item) => ({
    totalTasks: acc.totalTasks + item.totalTasks,
    inProgress: acc.inProgress + item.statusCounts.in_progress,
    completed: acc.completed + item.statusCounts.completed,
    blocked: acc.blocked + item.statusCounts.blocked,
    forReview: acc.forReview + item.statusCounts.ready_for_review,
  }), { totalTasks: 0, inProgress: 0, completed: 0, blocked: 0, forReview: 0 });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                VA Management
              </h1>
              <p className="text-sm text-muted-foreground">Manage your virtual assistants and workload</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchAllData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={showAddVA} onOpenChange={setShowAddVA}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add VA
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Virtual Assistant</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={newVA.name}
                      onChange={(e) => setNewVA({ ...newVA, name: e.target.value })}
                      placeholder="e.g., Joyce"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newVA.email}
                      onChange={(e) => setNewVA({ ...newVA, email: e.target.value })}
                      placeholder="va@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select value={newVA.timezone} onValueChange={(v) => setNewVA({ ...newVA, timezone: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hourly Rate</Label>
                      <Input
                        type="number"
                        value={newVA.hourlyRate}
                        onChange={(e) => setNewVA({ ...newVA, hourlyRate: e.target.value })}
                        placeholder="15"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select value={newVA.currency} onValueChange={(v) => setNewVA({ ...newVA, currency: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="PHP">PHP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddVA(false)}>Cancel</Button>
                  <Button onClick={handleAddVA} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add VA
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="reviews">
              Reviews
              {reviews.filter(r => r.status === 'pending').length > 0 && (
                <Badge className="ml-2 bg-red-500 text-white text-xs">{reviews.filter(r => r.status === 'pending').length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
            <TabsTrigger value="timezones">Timezones</TabsTrigger>
            <TabsTrigger value="briefings">Briefings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total VAs</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{workload.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">In Progress</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{totalStats.inProgress}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Completed</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{totalStats.completed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-muted-foreground">Blocked</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{totalStats.blocked}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-muted-foreground">For Review</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{totalStats.forReview}</p>
                </CardContent>
              </Card>
            </div>

            {/* VA Cards */}
            {loading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array(3).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-4 w-32 mt-2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : workload.length === 0 ? (
              <Card className="py-12">
                <CardContent className="text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Virtual Assistants Yet</h3>
                  <p className="text-muted-foreground mb-4">Add your first VA to start managing tasks and workload.</p>
                  <Button onClick={() => setShowAddVA(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First VA
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workload.map((item) => {
                  const workloadLevel = getWorkloadLevel(item);
                  const skills = item.va.skills ? JSON.parse(item.va.skills) : [];
                  
                  return (
                    <Card key={item.va.id} className="relative hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-lg font-semibold text-primary">
                                {item.va.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <CardTitle className="text-lg">{item.va.name}</CardTitle>
                              <Badge className={getStatusColor(item.va.status)}>
                                {item.va.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedVAFilter(item.va.id.toString());
                                setActiveTab('assignments');
                              }}>
                                View Tasks
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleUpdateStatus(item.va.id, 'active')}>
                                Set Active
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleUpdateStatus(item.va.id, 'on_leave')}>
                                Set On Leave
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleUpdateStatus(item.va.id, 'inactive')}>
                                Set Inactive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Contact & Location */}
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          {item.va.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">{item.va.email}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            <span>{item.va.timezone.split('/')[1]?.replace('_', ' ') || item.va.timezone}</span>
                          </div>
                          {item.va.hourlyRate && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              <span>{(item.va.hourlyRate / 100).toFixed(0)}/hr</span>
                            </div>
                          )}
                        </div>

                        {/* Workload Bar */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Workload</span>
                            <span className={`text-sm font-medium ${workloadLevel.color}`}>
                              {workloadLevel.level}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${Math.min((item.statusCounts.assigned + item.statusCounts.in_progress) * 10, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Task Stats */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="p-2 bg-muted/50 rounded">
                            <p className="text-lg font-semibold">{item.statusCounts.assigned}</p>
                            <p className="text-xs text-muted-foreground">Assigned</p>
                          </div>
                          <div className="p-2 bg-blue-500/10 rounded">
                            <p className="text-lg font-semibold text-blue-500">{item.statusCounts.in_progress}</p>
                            <p className="text-xs text-muted-foreground">Active</p>
                          </div>
                          <div className="p-2 bg-green-500/10 rounded">
                            <p className="text-lg font-semibold text-green-500">{item.statusCounts.completed}</p>
                            <p className="text-xs text-muted-foreground">Done</p>
                          </div>
                          <div className="p-2 bg-red-500/10 rounded">
                            <p className="text-lg font-semibold text-red-500">{item.statusCounts.blocked}</p>
                            <p className="text-xs text-muted-foreground">Blocked</p>
                          </div>
                        </div>

                        {/* Skills */}
                        {skills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {skills.slice(0, 3).map((skill: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {skills.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{skills.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Working Hours */}
                        <div className="text-xs text-muted-foreground">
                          Working: {item.va.workStartHour}:00 - {item.va.workEndHour}:00 ({item.va.timezone.split('/')[1]?.replace('_', ' ')})
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Load Balancing Suggestion */}
            {workload.some(w => getWorkloadLevel(w).level === 'Overloaded') && (
              <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-500">
                    <AlertTriangle className="h-5 w-5" />
                    Load Balancing Suggestion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Some VAs are overloaded. Consider redistributing tasks to VAs with lower workload
                    or hiring additional help.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('assignments')}>View Task Distribution</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedVAFilter} onValueChange={setSelectedVAFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by VA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All VAs</SelectItem>
                  {workload.map(w => (
                    <SelectItem key={w.va.id} value={w.va.id.toString()}>{w.va.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))
              ) : filteredAssignments.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No tasks found matching your filters.</p>
                    <p className="text-sm mt-2">Tasks from Trello will appear here once synced.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredAssignments.map(task => (
                  <Card key={task.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority.toUpperCase()}
                            </Badge>
                            {task.isPriorityOverride && (
                              <Badge variant="outline" className="text-xs">
                                <ArrowUpCircle className="h-3 w-3 mr-1" />
                                Override
                              </Badge>
                            )}
                            {getTaskStatusBadge(task.status)}
                          </div>
                          <h3 className="font-medium">{task.taskTitle}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Briefcase className="h-3 w-3" />
                            {task.cardName}
                            {task.clientProject && (
                              <>
                                <span>•</span>
                                {task.clientProject}
                              </>
                            )}
                          </p>
                          {task.blockedBy && task.blockedBy.length > 0 && (
                            <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                              <AlertCircle className="h-3 w-3" />
                              Blocked by: {task.blockedBy.join(', ')}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {Math.round(task.estimatedMinutes / 60 * 10) / 10}h
                            </span>
                            {task.scheduledStart && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {task.scheduledStart} - {task.scheduledEnd}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {/* VA Assignment */}
                          <Select
                            value={task.vaId?.toString() || 'unassigned'}
                            onValueChange={(v) => v !== 'unassigned' && handleAssignTask(task.id, parseInt(v))}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Assign VA" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {workload.map(w => (
                                <SelectItem key={w.va.id} value={w.va.id.toString()}>
                                  <span className="flex items-center gap-2">
                                    <span className={`h-2 w-2 rounded-full ${w.va.status === 'active' ? 'bg-green-500' : w.va.status === 'on_leave' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                                    {w.va.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {/* Priority Override */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Flag className="h-4 w-4 mr-2" />
                                Priority
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Set Priority</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handlePriorityOverride(task.id, 'critical')}>
                                <span className="h-2 w-2 rounded-full bg-red-500 mr-2" />
                                Critical - Do This First!
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePriorityOverride(task.id, 'urgent')}>
                                <span className="h-2 w-2 rounded-full bg-orange-500 mr-2" />
                                Urgent
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePriorityOverride(task.id, 'high')}>
                                <span className="h-2 w-2 rounded-full bg-yellow-500 mr-2" />
                                High
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePriorityOverride(task.id, 'normal')}>
                                <span className="h-2 w-2 rounded-full bg-gray-400 mr-2" />
                                Normal
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          
                          {/* Open in Trello */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`https://trello.com/c/${task.cardId}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Trello
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Quality Review Queue
                </CardTitle>
                <CardDescription>Review completed tasks before delivery to clients</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No tasks pending review</p>
                    <p className="text-sm mt-2">Tasks marked as "Ready for Review" will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map(review => (
                      <div key={review.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium">{review.taskTitle}</h3>
                            <p className="text-sm text-muted-foreground">
                              {review.cardName} • Submitted by {review.vaName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(review.submittedAt).toLocaleString()}
                            </p>
                            {review.notes && (
                              <p className="text-sm mt-2 p-2 bg-secondary/50 rounded">{review.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {review.status === 'pending' ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const notes = prompt('Enter revision notes:');
                                    if (notes) handleRequestRevision(review.id, notes);
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Revision
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveReview(review.id)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                              </>
                            ) : review.status === 'approved' ? (
                              <Badge className="bg-green-100 text-green-700">Approved</Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-700">Revision Requested</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="communications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                  Communication Log
                </CardTitle>
                <CardDescription>Messages, notes, and handoffs from VAs</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : communications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No communications yet</p>
                    <p className="text-sm mt-2">VA notes and handoff messages will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {communications.map(comm => (
                      <div key={comm.id} className={`border rounded-lg p-4 ${!comm.isRead ? 'bg-blue-50 border-blue-200' : ''}`}>
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{comm.vaName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{comm.vaName}</span>
                              <Badge variant="outline" className="text-xs">{comm.type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(comm.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="mt-1">{comm.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timezones Tab */}
          <TabsContent value="timezones" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-green-500" />
                  Timezone Overlap Calculator
                </CardTitle>
                <CardDescription>See working hour overlaps with your VAs</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : workload.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No VAs configured to calculate timezone overlaps</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workload.map(w => {
                      // Calculate overlap (simplified - assumes founder is in Europe/Amsterdam)
                      const founderStart = 9;
                      const founderEnd = 18;
                      const vaStart = w.va.workStartHour;
                      const vaEnd = w.va.workEndHour;
                      
                      // Simple timezone offset calculation (approximate)
                      const tzOffsets: Record<string, number> = {
                        'Europe/Amsterdam': 1,
                        'Asia/Manila': 8,
                        'Asia/Jakarta': 7,
                        'Asia/Kolkata': 5.5,
                        'America/New_York': -5,
                        'America/Los_Angeles': -8,
                        'UTC': 0,
                      };
                      
                      const founderOffset = tzOffsets['Europe/Amsterdam'] || 0;
                      const vaOffset = tzOffsets[w.va.timezone] || 0;
                      const diff = vaOffset - founderOffset;
                      
                      // Convert VA hours to founder's timezone
                      const vaStartInFounder = vaStart - diff;
                      const vaEndInFounder = vaEnd - diff;
                      
                      // Calculate overlap
                      const overlapStart = Math.max(founderStart, vaStartInFounder);
                      const overlapEnd = Math.min(founderEnd, vaEndInFounder);
                      const overlapHours = Math.max(0, overlapEnd - overlapStart);
                      
                      return (
                        <div key={w.va.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">{w.va.name}</h3>
                              <p className="text-sm text-muted-foreground">{w.va.timezone}</p>
                              <p className="text-xs text-muted-foreground">
                                Works {w.va.workStartHour}:00 - {w.va.workEndHour}:00 local time
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`text-2xl font-bold ${overlapHours >= 4 ? 'text-green-600' : overlapHours >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {overlapHours}h
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {overlapHours > 0 ? `${Math.floor(overlapStart)}:00 - ${Math.floor(overlapEnd)}:00 (your time)` : 'No overlap'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${overlapHours >= 4 ? 'bg-green-500' : overlapHours >= 2 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${(overlapHours / 8) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Briefings Tab */}
          <TabsContent value="briefings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-purple-500" />
                  Daily Briefing Settings
                </CardTitle>
                <CardDescription>Configure automated email reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Morning Briefing */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Morning Briefing</h3>
                      <p className="text-sm text-muted-foreground">
                        Daily email with today's tasks, priorities, and schedule
                      </p>
                    </div>
                    <Switch
                      checked={briefingEnabled}
                      onCheckedChange={setBriefingEnabled}
                    />
                  </div>
                  {briefingEnabled && (
                    <div className="flex items-center gap-4 pl-4 border-l-2">
                      <Label>Send at:</Label>
                      <Input
                        type="time"
                        value={briefingTime}
                        onChange={(e) => setBriefingTime(e.target.value)}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>

                {/* End of Day Report */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">End of Day Report</h3>
                      <p className="text-sm text-muted-foreground">
                        Summary of completed tasks, blockers, and tomorrow's preview
                      </p>
                    </div>
                    <Switch
                      checked={eodReportEnabled}
                      onCheckedChange={setEodReportEnabled}
                    />
                  </div>
                  {eodReportEnabled && (
                    <div className="flex items-center gap-4 pl-4 border-l-2">
                      <Label>Send at:</Label>
                      <Input
                        type="time"
                        value={eodReportTime}
                        onChange={(e) => setEodReportTime(e.target.value)}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>

                <Button onClick={handleSaveBriefingSettings}>
                  <Send className="h-4 w-4 mr-2" />
                  Save Briefing Settings
                </Button>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Briefing Preview</CardTitle>
                <CardDescription>Example of what your daily briefing will look like</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-secondary/30">
                  <h3 className="font-bold text-lg mb-2">Daily Briefing - {new Date().toLocaleDateString()}</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong>Today's Priority Tasks:</strong>
                      <ul className="list-disc list-inside ml-2 mt-1">
                        <li className="text-red-600">[CRITICAL] Review client proposal - Due 2:00 PM</li>
                        <li className="text-orange-600">[URGENT] Respond to support tickets</li>
                      </ul>
                    </div>
                    <div>
                      <strong>VA Status:</strong>
                      <ul className="list-disc list-inside ml-2 mt-1">
                        {workload.slice(0, 3).map(w => (
                          <li key={w.va.id}>
                            {w.va.status === 'active' ? '✅' : w.va.status === 'on_leave' ? '🟡' : '⚪'} {w.va.name} - {w.statusCounts.in_progress} active tasks
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong>Pending Reviews:</strong> {reviews.filter(r => r.status === 'pending').length} tasks awaiting your approval
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
