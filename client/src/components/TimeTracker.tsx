import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Timer,
  StopCircle,
  Clock,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  RefreshCw,
  Pencil,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useEatClock } from "@/hooks/useEatClock";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function formatHHMMSS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, "0")).join(":");
}

/** Parse "HH:MM:SS" or "H:MM" or just minutes into total seconds. */
function parseDurationInput(raw: string): number | null {
  const trimmed = raw.trim();
  const hms = trimmed.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hms) return parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3]);
  const hm = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (hm) return parseInt(hm[1]) * 3600 + parseInt(hm[2]) * 60;
  const mins = trimmed.match(/^(\d+)m?$/);
  if (mins) return parseInt(mins[1]) * 60;
  return null;
}

function secondsToHMSInput(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

interface EditDialogProps {
  cardId: string;
  cardName: string;
  date: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function EditDialog({ cardId, cardName, date, open, onClose, onSaved }: EditDialogProps) {
  const { data: entries = [], refetch } = trpc.timer.getEntriesForCard.useQuery(
    { cardId, date },
    { enabled: open }
  );

  const updateMutation = trpc.timer.updateEntry.useMutation({
    onSuccess: () => {
      toast.success("Duration updated");
      refetch();
      onSaved();
    },
    onError: (e) => toast.error(`Failed to update: ${e.message}`),
  });

  const deleteMutation = trpc.timer.delete.useMutation({
    onSuccess: () => {
      toast.success("Session deleted");
      refetch();
      onSaved();
    },
    onError: (e) => toast.error(`Failed to delete: ${e.message}`),
  });

  const [editValues, setEditValues] = useState<Record<number, string>>({});

  useEffect(() => {
    if (entries.length > 0) {
      const initial: Record<number, string> = {};
      entries.forEach(e => {
        initial[e.id] = secondsToHMSInput(e.durationSeconds ?? 0);
      });
      setEditValues(initial);
    }
  }, [entries]);

  const handleSave = (id: number) => {
    const raw = editValues[id] ?? "";
    const secs = parseDurationInput(raw);
    if (secs === null || secs < 0) {
      toast.error("Invalid duration. Use H:MM:SS, H:MM, or plain minutes (e.g. 45)");
      return;
    }
    if (secs > 86400) {
      toast.error("Duration cannot exceed 24 hours");
      return;
    }
    updateMutation.mutate({ id, durationSeconds: secs });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="w-4 h-4 text-violet-500" />
            Edit Sessions — {cardName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No completed sessions found for today.</p>
          )}

          {entries.map((entry) => {
            const isOvernight = (entry.durationSeconds ?? 0) > 8 * 3600;
            return (
              <div key={entry.id} className={`p-3 rounded-lg border ${isOvernight ? "border-amber-500/50 bg-amber-500/5" : "border-border bg-muted/30"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Started {new Date(entry.startedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                      {entry.stoppedAt && ` → ${new Date(entry.stoppedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                    {isOvernight && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span className="text-xs text-amber-600 dark:text-amber-400">Possible overnight timer — please correct</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={() => {
                      deleteMutation.mutate({ id: entry.id });
                    }}
                    disabled={deleteMutation.isPending}
                    title="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">Duration (H:MM:SS or minutes)</Label>
                    <Input
                      value={editValues[entry.id] ?? ""}
                      onChange={(e) => setEditValues(prev => ({ ...prev, [entry.id]: e.target.value }))}
                      className="h-8 text-sm font-mono"
                      placeholder="1:30:00"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="mt-5 bg-violet-600 hover:bg-violet-700 text-white"
                    onClick={() => handleSave(entry.id)}
                    disabled={updateMutation.isPending}
                    title="Save duration correction"
                  >
                    Save
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────

interface WeeklyBarChartProps {
  breakdown: { date: string; totalSeconds: number; targetSeconds: number; overtimeSeconds: number; isWorkday: boolean }[];
  todayDate: string;
}

function WeeklyBarChart({ breakdown, todayDate }: WeeklyBarChartProps) {
  const maxTargetSeconds = Math.max(...breakdown.map((day) => day.targetSeconds), 0);
  const maxSeconds = Math.max(...breakdown.map(d => d.totalSeconds), maxTargetSeconds, 1);

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        This Week
      </p>
      {/* Extra top padding to accommodate hour labels above bars */}
      <div className="flex items-end gap-1.5 h-28 pt-6 relative">
        {breakdown.map((day, i) => {
          const pct = day.totalSeconds / maxSeconds;
          const isProtectedDay = !day.isWorkday;
          const goalPct = day.targetSeconds / maxSeconds;
          const isToday = day.date === todayDate;
          const isGoalMet = !isProtectedDay && day.totalSeconds >= day.targetSeconds;
          const barColor = day.overtimeSeconds > 0
            ? "bg-amber-500"
            : isGoalMet
            ? "bg-green-500"
            : isToday
            ? "bg-violet-500"
            : "bg-violet-500/40";
          const hoursNum = day.totalSeconds / 3600;
          const hoursLabel = hoursNum >= 0.1
            ? (Number.isInteger(Math.round(hoursNum * 10) / 10)
                ? `${Math.round(hoursNum)}h`
                : `${hoursNum.toFixed(1)}h`)
            : null;

          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative h-full">
              {/* Bar container — fills remaining height */}
              <div className="w-full flex-1 relative flex flex-col justify-end">
                {/* Goal line */}
                {!isProtectedDay && <div
                  className="absolute w-full border-t border-dashed border-muted-foreground/30"
                  style={{ bottom: `${goalPct * 100}%` }}
                />}
                {/* Bar */}
                {day.totalSeconds > 0 ? (
                  <div
                    className="relative w-full flex flex-col items-center justify-end"
                    style={{ height: `${Math.max(pct * 100, 4)}%` }}
                  >
                    {/* Hour label above bar */}
                    {hoursLabel && (
                      <span
                        className={`absolute -top-5 text-[10px] font-semibold tabular-nums whitespace-nowrap ${
                          day.overtimeSeconds > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : isGoalMet
                            ? "text-green-600 dark:text-green-400"
                            : isToday
                            ? "text-violet-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {hoursLabel}
                      </span>
                    )}
                    <div
                      className={`w-full h-full rounded-t-sm transition-all ${barColor} ${isToday ? "ring-1 ring-violet-400/50" : ""}`}
                    />
                  </div>
                ) : (
                  <div className="w-full h-1 rounded-sm bg-muted/40" />
                )}
              </div>
              {/* Day label */}
              <span className={`text-xs tabular-nums ${isToday ? "text-violet-500 font-bold" : "text-muted-foreground"}`}>
                {DAY_LABELS[i]}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-green-500" />
          <span className="text-xs text-muted-foreground">Goal met</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-violet-500" />
          <span className="text-xs text-muted-foreground">In progress</span>
        </div>
        <div className="flex items-center gap-1 sm:ml-auto">
          <div className="w-4 border-t border-dashed border-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">{(maxTargetSeconds / 3600).toFixed(0)}h workday target | protected days have no target</span>
        </div>
      </div>
    </div>
  );
}

// ─── main component ────────────────────────────────────────────────────────────

export default function TimeTracker() {
  const { dateKey: todayDate, weekBounds, isSunday } = useEatClock(60_000);
  const [isExpanded, setIsExpanded] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Edit dialog state
  const [editCard, setEditCard] = useState<{ cardId: string; cardName: string } | null>(null);

  const utils = trpc.useUtils();

  // ── queries ──────────────────────────────────────────────────────────────────
  // All timer queries are now driven by SSE "timer-invalidate" events broadcast by the
  // server after every start/stop/delete/update mutation. No polling needed.
  // A 30-min fallback staleTime ensures data is refreshed after long idle periods.
  const { data: activeTimer } = trpc.timer.getActive.useQuery(undefined, {
    staleTime: 30 * 60_000, // no polling; SSE handles invalidation
  });

  // One weekly query provides totals, overtime, the chart, and today's exact log.
  const { data: weeklyEvidence } = trpc.timer.getWeeklyEvidence.useQuery(weekBounds, {
    staleTime: 30 * 60_000,
  });

  // ── SSE listener: invalidate all timer queries on server push ─────────────────
  const dailyEvidence = weeklyEvidence?.currentDay ?? null;
  const dailyGoalSeconds = dailyEvidence?.targetSeconds ?? (isSunday ? 0 : 9 * 3_600);
  const protectedDay = dailyEvidence ? !dailyEvidence.isWorkday : isSunday;
  const dailySummary = dailyEvidence?.cards ?? [];
  const weeklyBreakdown = weeklyEvidence?.days ?? [];

  // ── live elapsed counter ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTimer) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = new Date(activeTimer.startedAt).getTime();
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  // ── mutations ─────────────────────────────────────────────────────────────────
  const stopMutation = trpc.timer.stop.useMutation({
    onSuccess: () => {
      toast.success("Timer stopped");
      setBannerDismissed(false);
      void utils.timer.getActive.invalidate();
      void utils.timer.getWeeklyEvidence.invalidate();
    },
    onError: (e) => toast.error(`Failed to stop: ${e.message}`),
  });

  const handleStop = useCallback(() => {
    if (!activeTimer) return;
    stopMutation.mutate({ cardId: activeTimer.cardId });
  }, [activeTimer, stopMutation]);

  const handleOpenEdit = useCallback((entry: { cardId: string; cardName: string }) => {
    setEditCard({ cardId: entry.cardId, cardName: entry.cardName });
  }, []);

  const handleEditSaved = useCallback(() => {
    void utils.timer.getActive.invalidate();
    void utils.timer.getWeeklyEvidence.invalidate();
  }, [utils]);

  // ── derived ───────────────────────────────────────────────────────────────────
  const activeIsInWeek = Boolean(activeTimer && todayDate >= weekBounds.startDate && todayDate <= weekBounds.endDate);
  const activeElapsedAtDailyCalculation = activeTimer && dailyEvidence
    ? Math.max(0, Math.floor((new Date(dailyEvidence.calculatedAt).getTime() - new Date(activeTimer.startedAt).getTime()) / 1_000))
    : 0;
  const activeElapsedAtWeeklyCalculation = activeTimer && weeklyEvidence
    ? Math.max(0, Math.floor((new Date(weeklyEvidence.calculatedAt).getTime() - new Date(activeTimer.startedAt).getTime()) / 1_000))
    : 0;
  const dailyLiveDelta = activeTimer ? Math.max(0, elapsedSeconds - activeElapsedAtDailyCalculation) : 0;
  const weeklyLiveDelta = activeIsInWeek ? Math.max(0, elapsedSeconds - activeElapsedAtWeeklyCalculation) : 0;
  const todayTotalSeconds = (dailyEvidence?.trackedSeconds ?? 0) + dailyLiveDelta;
  const weeklySeconds = (weeklyEvidence?.trackedSeconds ?? 0) + weeklyLiveDelta;
  const weeklyHours = Math.round((weeklySeconds / 3600) * 10) / 10;
  const liveWeeklyBreakdown = weeklyBreakdown.map((day) => day.date === todayDate && activeIsInWeek
    ? { ...day, totalSeconds: day.totalSeconds + weeklyLiveDelta, overtimeSeconds: Math.max(0, day.totalSeconds + weeklyLiveDelta - day.targetSeconds) }
    : day);

  // Show the resume banner if a timer is running and it hasn't been dismissed this session
  const showResumeBanner = !!activeTimer && !bannerDismissed;

  return (
    <>
      {/* ── Timer Still Running Banner ─────────────────────────────────────────── */}
      {showResumeBanner && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-green-500/40 bg-green-500/10 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">Timer still running</p>
              <p className="text-xs text-green-600 dark:text-green-400 truncate">
                {activeTimer.cardName} — started {new Date(activeTimer.startedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">
              {formatHHMMSS(elapsedSeconds)}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-500/10 h-7 text-xs"
              onClick={handleStop}
              disabled={stopMutation.isPending}
              title="Stop running timer"
            >
              <StopCircle className="w-3.5 h-3.5 mr-1" />
              Stop
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setBannerDismissed(true)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-semibold text-foreground">Time Tracker</CardTitle>
              {activeTimer && (
                <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 animate-pulse text-xs">
                  ● RUNNING
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Summary pills when collapsed */}
              {!isExpanded && (
                <>
                  <Badge variant="outline" className="text-xs px-2 py-0.5 text-violet-600 dark:text-violet-400 border-violet-500/30">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatSeconds(todayTotalSeconds)} today
                  </Badge>
                  <Badge variant="outline" className="text-xs px-2 py-0.5 text-blue-600 dark:text-blue-400 border-blue-500/30">
                    <BarChart3 className="w-3 h-3 mr-1" />
                    {weeklyHours}h week
                  </Badge>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsExpanded(v => !v)}
                aria-label={isExpanded ? "Collapse time tracker" : "Expand time tracker"}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4 pt-0">
            {/* ── Running Timer ─────────────────────────────────────────────────── */}
            {activeTimer ? (
              <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                    <a
                      href={activeTimer.cardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-foreground hover:underline truncate text-sm flex items-center gap-1"
                    >
                      {activeTimer.cardName}
                      <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground ml-4">
                    Started {new Date(activeTimer.startedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-mono text-xl font-bold text-green-600 dark:text-green-400 tabular-nums">
                    {formatHHMMSS(elapsedSeconds)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    onClick={handleStop}
                    disabled={stopMutation.isPending}
                    title="Stop running timer"
                  >
                    <StopCircle className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-dashed border-border">
                <Timer className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {protectedDay
                    ? "No timer running. Sunday is protected; emergency work can be started from Today with confirmation."
                    : "No timer running. Start the current task from Today, or use the Trello Power-Up from a card."}
                </p>
              </div>
            )}

            {/* ── Summary Row ───────────────────────────────────────────────────── */}
            {(() => {
              const otSeconds = Math.max(0, todayTotalSeconds - dailyGoalSeconds);
              const isOvertime = otSeconds > 0;
              const pct = protectedDay || dailyGoalSeconds === 0 ? 0 : Math.min(todayTotalSeconds / dailyGoalSeconds, 1);
              const radius = 28;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference * (1 - pct);
              const isOnTrack = pct >= 0.9;
              // Overtime → amber ring; goal met → green; progressing → violet; early → amber
              const ringColor = isOvertime ? "#f59e0b" : pct >= 1 ? "#22c55e" : pct >= 0.6 ? "#a78bfa" : "#f59e0b";
              const goalHours = (dailyGoalSeconds / 3600).toFixed(0);
              const weeklyMin = weeklyEvidence?.weeklyHoursMin ?? 50;
              const weeklyMax = weeklyEvidence?.weeklyHoursMax ?? 55;
              const weeklyOtHours = Math.max(weeklyHours - weeklyMax, 0);
              const isWeeklyOT = weeklyOtHours > 0;
              return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-center">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">Today</p>
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {formatSeconds(todayTotalSeconds)}
                    </p>
                    {isOvertime && !protectedDay && (
                      <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                        +{formatSeconds(otSeconds)} OT
                      </p>
                    )}
                  </div>
                  {protectedDay ? (
                    <div className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center ${isOvertime ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
                      <ShieldCheck className={`h-8 w-8 ${isOvertime ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`} />
                      <p className={`mt-1 text-xs font-semibold ${isOvertime ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>Protected day</p>
                      <p className="text-[10px] text-muted-foreground">{isOvertime ? `${formatSeconds(otSeconds)} overtime` : "No hour target"}</p>
                    </div>
                  ) : (
                    <div className={`flex flex-col items-center justify-center p-2 border rounded-lg ${
                      isOvertime ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/30 border-border"
                    }`}>
                      <div className="relative w-16 h-16">
                        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90" aria-label={`${Math.round(pct * 100)}% of daily target`}>
                          <circle cx="36" cy="36" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted-foreground/20" />
                          <circle
                            cx="36" cy="36" r={radius} fill="none"
                            stroke={ringColor} strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            style={{ transition: "stroke-dashoffset 0.5s ease" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold tabular-nums" style={{ color: ringColor }}>
                            {isOvertime ? "OT" : `${Math.round(pct * 100)}%`}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs mt-1" style={{ color: ringColor }}>
                        {isOvertime
                          ? `+${formatSeconds(otSeconds)} over`
                          : isOnTrack
                          ? `${goalHours}h goal complete`
                          : `${formatSeconds(Math.max(dailyGoalSeconds - todayTotalSeconds, 0))} left`}
                      </p>
                    </div>
                  )}
                  <div className={`p-3 border rounded-lg text-center ${
                    isWeeklyOT ? "bg-amber-500/10 border-amber-500/30" : "bg-blue-500/10 border-blue-500/20"
                  }`}>
                    <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${
                      isWeeklyOT ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
                    }`}>This Week</p>
                    <p className={`text-lg font-bold tabular-nums ${
                      isWeeklyOT ? "text-amber-700 dark:text-amber-300" : "text-blue-700 dark:text-blue-300"
                    }`}>
                      {weeklyHours}h
                    </p>
                    {isWeeklyOT && (
                      <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                        +{weeklyOtHours.toFixed(1)}h OT
                      </p>
                    )}
                    {!isWeeklyOT && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {Math.max(weeklyMin - weeklyHours, 0) > 0
                          ? `${(weeklyMin - weeklyHours).toFixed(1)}h to min`
                          : `${Math.max(weeklyMax - weeklyHours, 0).toFixed(1)}h to max`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Weekly Bar Chart ──────────────────────────────────────────────── */}
            {liveWeeklyBreakdown.length > 0 && (
              <>
                <Separator />
                <WeeklyBarChart breakdown={liveWeeklyBreakdown} todayDate={todayDate} />
              </>
            )}

            {/* ── Today's Log ───────────────────────────────────────────────────── */}
            {dailySummary.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Today's Log
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => { utils.timer.getWeeklyEvidence.invalidate(); utils.timer.getActive.invalidate(); }}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {dailySummary.map((entry) => {
                      const isLong = entry.totalSeconds > 8 * 3600;
                      return (
                        <div
                          key={entry.cardId}
                          className={`flex items-center justify-between gap-2 p-2.5 rounded-lg group ${isLong ? "bg-amber-500/10 border border-amber-500/30" : "bg-muted/30"}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {isLong && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                              <a
                                href={entry.cardUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-foreground hover:underline truncate flex items-center gap-1"
                              >
                                {entry.cardName}
                                <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-40" />
                              </a>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
                                {entry.boardName}
                              </Badge>
                              <span className="text-xs text-muted-foreground">›</span>
                              <span className="text-xs text-muted-foreground">{entry.listName}</span>
                              {entry.entryCount > 1 && (
                                <span className="text-xs text-muted-foreground">· {entry.entryCount} sessions</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`font-mono text-sm font-semibold tabular-nums ${isLong ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                              {formatSeconds(entry.totalSeconds)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-violet-500"
                              onClick={() => handleOpenEdit(entry)}
                              title="Edit / correct session durations"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {dailySummary.length === 0 && !activeTimer && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No time tracked today yet.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Edit Dialog ─────────────────────────────────────────────────────────── */}
      {editCard && (
        <EditDialog
          cardId={editCard.cardId}
          cardName={editCard.cardName}
          date={todayDate}
          open={!!editCard}
          onClose={() => setEditCard(null)}
          onSaved={handleEditSaved}
        />
      )}
    </>
  );
}
