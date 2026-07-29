/**
 * PlanMyDay — AI-generated cross-card daily work schedule.
 *
 * Calls trpc.aptlss.planMyDay which returns:
 *   schedule[]  — time-blocked items with time, cardId, cardName, action, estimatedMinutes, priority, notes
 *   totalScheduledMinutes
 *   dailySummary
 *   topPriority
 *   robertItems[]  — cards needing Robert decisions
 *   unscheduledCards[]  — cards that couldn't be scheduled
 *
 * The schedule is cached in localStorage for the current day so re-opening
 * the tab is instant. A "Regenerate" button forces a fresh plan.
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertTriangle,
  Shield,
  Info,
  User,
} from "lucide-react";

// ─── Types (matching server response) ────────────────────────────────────────
interface ScheduleItem {
  time: string;
  cardId: string | null;
  cardName: string;
  action: string;
  estimatedMinutes: number;
  priority: string;
  notes: string;
}

interface RobertItem {
  cardId: string;
  cardName: string;
  decision: string;
}

interface UnscheduledCard {
  cardId: string;
  cardName: string;
  reason: string;
}

interface DayPlan {
  schedule: ScheduleItem[];
  totalScheduledMinutes: number;
  dailySummary: string;
  topPriority: string;
  robertItems: RobertItem[];
  unscheduledCards: UnscheduledCard[];
  generatedAt: string; // added client-side
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PRIORITY_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  CRITICAL: { bg: "bg-red-500/10",    border: "border-red-500/40",    text: "text-red-600 dark:text-red-400" },
  HIGH:     { bg: "bg-orange-500/10", border: "border-orange-500/40", text: "text-orange-600 dark:text-orange-400" },
  MEDIUM:   { bg: "bg-amber-500/10",  border: "border-amber-500/40",  text: "text-amber-600 dark:text-amber-400" },
  LOW:      { bg: "bg-slate-500/10",  border: "border-slate-500/30",  text: "text-slate-500 dark:text-slate-400" },
  BLOCKED:  { bg: "bg-purple-500/10", border: "border-purple-500/40", text: "text-purple-600 dark:text-purple-400" },
  BUFFER:   { bg: "bg-muted/40",      border: "border-border/40",     text: "text-muted-foreground" },
  BREAK:    { bg: "bg-muted/40",      border: "border-border/40",     text: "text-muted-foreground" },
};

function getStyle(priority: string) {
  return PRIORITY_STYLES[priority?.toUpperCase()] ?? PRIORITY_STYLES.MEDIUM;
}

function PriorityChip({ priority }: { priority: string }) {
  const s = getStyle(priority);
  const isBreak = !priority || priority === "BREAK" || priority === "BUFFER";
  if (isBreak) return null;
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${s.bg} ${s.border} ${s.text}`}>
      {priority}
    </span>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const CACHE_KEY = "worker-plan-my-day-v2";

function getCachedPlan(): DayPlan | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { plan: DayPlan; date: string };
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return null;
    return parsed.plan;
  } catch {
    return null;
  }
}

function cachePlan(plan: DayPlan) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(CACHE_KEY, JSON.stringify({ plan, date: today }));
}

// ─── Schedule item card ───────────────────────────────────────────────────────
function ScheduleItemCard({ item, index }: { item: ScheduleItem; index: number }) {
  const [expanded, setExpanded] = useState(index < 4);
  const isBreak = !item.priority || item.priority === "BREAK" || item.priority === "BUFFER" || item.cardId === null;
  const s = isBreak ? PRIORITY_STYLES.BREAK : getStyle(item.priority);

  return (
    <div className={`rounded-xl border ${s.bg} ${s.border} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        {/* Time */}
        <div className="flex-shrink-0 w-14 text-center">
          <p className="text-xs font-bold text-foreground tabular-nums">{item.time}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">{formatDuration(item.estimatedMinutes)}</p>
        </div>

        {/* Divider */}
        <div className="w-px h-8 flex-shrink-0 bg-border/40" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityChip priority={item.priority} />
            <p className={`text-sm font-semibold truncate ${isBreak ? "text-muted-foreground italic" : "text-foreground"}`}>
              {item.cardName}
            </p>
          </div>
          {!isBreak && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.action}</p>
          )}
        </div>

        {/* Expand */}
        {(item.action || item.notes) && (
          expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {/* Expanded */}
      {expanded && (item.action || item.notes) && (
        <div className="px-4 pb-3 pt-0 border-t border-current/10 space-y-2">
          {item.action && !isBreak && (
            <p className="text-xs text-foreground/80 leading-relaxed mt-2">{item.action}</p>
          )}
          {item.notes && (
            <p className="text-[11px] text-muted-foreground italic leading-relaxed border-t border-current/10 pt-2">
              {item.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PlanMyDay() {
  const [plan, setPlan] = useState<DayPlan | null>(() => getCachedPlan());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planMyDay = trpc.aptlss.planMyDay.useMutation({
    onSuccess: (data) => {
      const enriched: DayPlan = { ...data, generatedAt: new Date().toISOString() };
      setPlan(enriched);
      cachePlan(enriched);
      setError(null);
      setIsGenerating(false);
    },
    onError: (err) => {
      setError(err.message ?? "Failed to generate plan. Please try again.");
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    setError(null);
    planMyDay.mutate();
  };

  // Auto-generate on first load if no cached plan exists
  useEffect(() => {
    if (!plan && !isGenerating) {
      handleGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const criticalCount = plan?.schedule.filter(s => s.priority === "CRITICAL").length ?? 0;
  const blockedCount = plan?.schedule.filter(s => s.priority === "BLOCKED").length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Plan My Day</h2>
                <p className="text-[11px] text-muted-foreground">{today}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {plan && (
                <p className="text-[10px] text-muted-foreground">
                  Generated {new Date(plan.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="gap-1.5 text-xs h-8"
              >
                {isGenerating
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />
                }
                {isGenerating ? "Generating…" : plan ? "Regenerate" : "Generate Plan"}
              </Button>
            </div>
          </div>

          {/* Stats row */}
          {plan && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatDuration(plan.totalScheduledMinutes)} scheduled
              </span>
              {criticalCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 font-medium">
                  <Zap className="w-3 h-3" />
                  {criticalCount} critical
                </span>
              )}
              {blockedCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                  <Shield className="w-3 h-3" />
                  {blockedCount} blocked
                </span>
              )}
              {(plan.robertItems?.length ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {plan.robertItems.length} need Robert
                </span>
              )}
              {plan.topPriority && (
                <span className="flex items-center gap-1 text-[11px] text-foreground/70 font-medium">
                  <Zap className="w-3 h-3 text-amber-500" />
                  Top: {plan.topPriority}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">Plan generation failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {isGenerating && !plan && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
          ))}
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Analysing all active cards and generating your schedule…
          </div>
        </div>
      )}

      {/* Summary */}
      {plan && plan.dailySummary && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/80 leading-relaxed">{plan.dailySummary}</p>
          </CardContent>
        </Card>
      )}

      {/* Robert Decision Queue (inline) */}
      {plan && (plan.robertItems?.length ?? 0) > 0 && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                Decisions Needed from Robert ({plan.robertItems.length})
              </h3>
            </div>
            <div className="space-y-2">
              {plan.robertItems.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-orange-500/20 border border-orange-500/40 text-[9px] font-bold text-orange-600 dark:text-orange-400 flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{item.cardName}</p>
                    <p className="text-muted-foreground mt-0.5">{item.decision}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All clear */}
      {plan && plan.schedule.length === 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-6 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Nothing to schedule!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No active DOING or ON-HOLD cards with APTLSS plans found. Generate plans for your cards first using the 🎯 APTLSS Plan button in the Trello Power-Up.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule */}
      {plan && plan.schedule.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Today's Schedule
          </h3>
          {plan.schedule.map((item, i) => (
            <ScheduleItemCard key={`${item.cardId ?? "break"}-${i}`} item={item} index={i} />
          ))}
        </div>
      )}

      {/* Unscheduled cards */}
      {plan && (plan.unscheduledCards?.length ?? 0) > 0 && (
        <Card className="border-slate-500/20 bg-slate-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-muted-foreground">
                Not Scheduled Today ({plan.unscheduledCards.length})
              </h3>
            </div>
            <div className="space-y-1.5">
              {plan.unscheduledCards.map((card, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground mt-0.5">·</span>
                  <div>
                    <span className="font-medium text-foreground">{card.cardName}</span>
                    <span className="text-muted-foreground ml-1.5">— {card.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
