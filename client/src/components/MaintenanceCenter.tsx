import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, ChevronRight, Clock, Loader2, Play, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { InfoTooltip } from "@/components/InfoTooltip";
import { OperationProgress, formatEtaDuration } from "@/components/OperationProgress";

function intervalLabel(minutes: number) {
  if (minutes < 60) return `Every ${minutes} minutes`;
  if (minutes === 60) return "Every hour";
  if (minutes < 1_440) return `Every ${minutes / 60} hours`;
  if (minutes === 1_440) return "Every day";
  if (minutes < 10_080) return `Every ${minutes / 1_440} days`;
  if (minutes === 10_080) return "Every week";
  return `Every ${minutes / 10_080} weeks`;
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function formatDuration(milliseconds: number | null | undefined) {
  if (!milliseconds) return "Learning";
  const seconds = Math.max(1, Math.round(milliseconds / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function formatTimeUntil(value: Date | string | null | undefined, now: number) {
  if (!value) return "Not scheduled";
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return "Unknown";
  const remainingSeconds = Math.max(0, Math.ceil((target - now) / 1_000));
  return remainingSeconds === 0 ? "Due now" : `in ${formatEtaDuration(remainingSeconds)}`;
}

type DraftSchedule = Record<string, { enabled: boolean; intervalMinutes: number }>;

export default function MaintenanceCenter() {
  const utils = trpc.useUtils();
  const center = trpc.system.maintenanceCenter.useQuery(undefined, {
    retry: false,
    staleTime: 10_000,
    refetchInterval: (query) => (
      query.state.data?.jobs.some((job) => job.progress.status === "running") ? 750 : 30_000
    ),
  });
  const [drafts, setDrafts] = useState<DraftSchedule>({});
  const [now, setNow] = useState(() => Date.now());
  const [expandedCategories, setExpandedCategories] = useState(
    () => new Set<string>(["Intelligence", "Communication", "Accountability"]),
  );
  const [expandedJobs, setExpandedJobs] = useState(() => new Set<string>());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!center.data) return;
    setDrafts((current) => Object.fromEntries(center.data.jobs.map((job) => [
      job.jobKey,
      current[job.jobKey] ?? job.schedule,
    ])));
    const runningJobs = center.data.jobs.filter((job) => job.progress.status === "running");
    if (runningJobs.length === 0) return;
    setExpandedCategories((current) => {
      const next = new Set(current);
      runningJobs.forEach((job) => next.add(job.category));
      return next.size === current.size ? current : next;
    });
    setExpandedJobs((current) => {
      const next = new Set(current);
      runningJobs.forEach((job) => next.add(job.jobKey));
      return next.size === current.size ? current : next;
    });
  }, [center.data]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleJob = (jobKey: string) => {
    setExpandedJobs((current) => {
      const next = new Set(current);
      if (next.has(jobKey)) next.delete(jobKey);
      else next.add(jobKey);
      return next;
    });
  };

  const refreshAfterRun = async () => {
    await Promise.all([
      center.refetch(),
      utils.system.scheduledJobFreshness.invalidate(),
      utils.system.readiness.invalidate(),
      utils.aptlss.getLatestWeeklyAnalysis.invalidate(),
      utils.aptlss.getWeeklyAnalysisHistory.invalidate(),
    ]);
  };

  const runJob = trpc.system.runMaintenanceJob.useMutation({
    onMutate: () => void center.refetch(),
    onSuccess: async (result) => {
      await refreshAfterRun();
      toast.success("Maintenance run completed", { description: result.summary });
    },
    onError: async (error) => {
      await center.refetch();
      toast.error("Maintenance run failed", { description: error.message });
    },
  });

  const saveSchedule = trpc.system.setMaintenanceSchedule.useMutation({
    onSuccess: async (_, variables) => {
      await center.refetch();
      toast.success("Maintenance schedule saved", {
        description: variables.enabled ? intervalLabel(variables.intervalMinutes) : "Automatic runs disabled.",
      });
    },
    onError: (error) => toast.error("Schedule was not saved", { description: error.message }),
  });

  const categories = useMemo(() => {
    const jobs = center.data?.jobs ?? [];
    return ["Intelligence", "Communication", "Accountability"].map((category) => ({
      category,
      jobs: jobs.filter((job) => job.category === category),
    }));
  }, [center.data]);

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Activity className="h-4 w-4 text-primary" />
            Maintenance center
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One place for background intelligence, communication checks, and accountability runs.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={center.isFetching} onClick={() => void center.refetch()}>
          <RefreshCw className={`h-3.5 w-3.5 ${center.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {center.isLoading ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading maintenance controls...
        </div>
      ) : center.error ? (
        <p className="m-5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-700 dark:text-red-300">
          Maintenance controls are unavailable: {center.error.message}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {categories.map(({ category, jobs }) => {
            if (jobs.length === 0) return null;
            const categoryExpanded = expandedCategories.has(category);
            const runningCount = jobs.filter((job) => job.progress.status === "running").length;
            return (
              <div key={category} className="px-5 py-4">
                <section className="overflow-hidden rounded-md border border-border bg-background">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                    aria-expanded={categoryExpanded}
                    aria-controls={`maintenance-category-${category.toLowerCase()}`}
                    onClick={() => toggleCategory(category)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {categoryExpanded
                        ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="text-xs font-semibold uppercase text-foreground">{category}</span>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">{jobs.length}</Badge>
                    </span>
                    {runningCount > 0 && <Badge className="border-0 bg-primary/10 text-primary">{runningCount} running</Badge>}
                  </button>

                  {categoryExpanded && (
                    <div id={`maintenance-category-${category.toLowerCase()}`} className="divide-y divide-border border-t border-border">
                      {jobs.map((job) => {
                        const draft = drafts[job.jobKey] ?? job.schedule;
                        const running = job.progress.status === "running";
                        const jobExpanded = expandedJobs.has(job.jobKey);
                        const savingThis = saveSchedule.isPending && saveSchedule.variables?.jobKey === job.jobKey;
                        const runningThis = runJob.isPending && runJob.variables?.jobKey === job.jobKey;
                        const changed = draft.enabled !== job.schedule.enabled
                          || draft.intervalMinutes !== job.schedule.intervalMinutes;
                        return (
                          <div key={job.jobKey} className="min-w-0">
                            <div className="flex items-center gap-2 px-4 py-3">
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left"
                                aria-expanded={jobExpanded}
                                aria-controls={`maintenance-job-${job.jobKey}`}
                                onClick={() => toggleJob(job.jobKey)}
                              >
                                {jobExpanded
                                  ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                <span className="text-sm font-semibold text-foreground">{job.title}</span>
                                <Badge variant="outline" className={job.schedule.enabled ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}>
                                  {job.schedule.enabled ? "Automatic" : "Manual only"}
                                </Badge>
                                {running && <Badge className="border-0 bg-primary/10 text-primary">Running {job.progress.percent}%</Badge>}
                                <span className="ml-auto text-[11px] text-muted-foreground" title={draft.enabled ? formatDateTime(job.nextRunAt) : undefined}>
                                  Next: {draft.enabled ? formatTimeUntil(job.nextRunAt, now) : "Disabled"}
                                </span>
                              </button>
                              <InfoTooltip content={job.detail} side="right" maxWidth={340} />
                            </div>

                            {jobExpanded && (
                              <div id={`maintenance-job-${job.jobKey}`} className="border-t border-border">
                                <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,auto)] lg:items-center">
                                  <div className="min-w-0">
                                    <p className="text-xs leading-relaxed text-muted-foreground">{job.description}</p>
                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                      <span>Last: {formatDateTime(job.latestRun?.startedAt)}</span>
                                      <span>Duration: {formatDuration(job.latestRun?.durationMs ?? job.typicalDurationMs)}</span>
                                    </div>
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-[auto_minmax(150px,1fr)_auto_auto] sm:items-center">
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={draft.enabled}
                                        disabled={savingThis || running}
                                        onCheckedChange={(enabled) => setDrafts((current) => ({
                                          ...current,
                                          [job.jobKey]: { ...draft, enabled },
                                        }))}
                                        aria-label={`Enable automatic ${job.title}`}
                                      />
                                      <span className="text-xs text-muted-foreground">Auto</span>
                                    </div>
                                    <label className="sr-only" htmlFor={`maintenance-interval-${job.jobKey}`}>Interval for {job.title}</label>
                                    <select
                                      id={`maintenance-interval-${job.jobKey}`}
                                      value={draft.intervalMinutes}
                                      disabled={savingThis || running}
                                      onChange={(event) => setDrafts((current) => ({
                                        ...current,
                                        [job.jobKey]: { ...draft, intervalMinutes: Number(event.target.value) },
                                      }))}
                                      className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
                                    >
                                      {job.intervalOptions.map((minutes) => (
                                        <option key={minutes} value={minutes}>{intervalLabel(minutes)}</option>
                                      ))}
                                    </select>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={!changed || savingThis || running}
                                      onClick={() => saveSchedule.mutate({
                                        jobKey: job.jobKey,
                                        enabled: draft.enabled,
                                        intervalMinutes: draft.intervalMinutes,
                                      })}
                                      title="Save this job's automatic interval"
                                    >
                                      {savingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={running || runJob.isPending}
                                      onClick={() => {
                                        setExpandedJobs((current) => new Set(current).add(job.jobKey));
                                        runJob.mutate({ jobKey: job.jobKey });
                                      }}
                                    >
                                      {runningThis || running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                      {running
                                        ? `${job.progress.percent}% - ${job.progress.etaUpperSeconds == null ? "estimating" : `${formatEtaDuration(job.progress.etaUpperSeconds)} left`}`
                                        : "Run now"}
                                    </Button>
                                  </div>
                                </div>
                                {running && (
                                  <OperationProgress
                                    progress={job.progress}
                                    name={job.title}
                                    className="border-t border-primary/20"
                                    testId={`maintenance-progress-${job.jobKey}`}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Automatic intervals run only while the dashboard server is online. Durable leases prevent overlapping copies of the same job.
      </div>
    </section>
  );
}
