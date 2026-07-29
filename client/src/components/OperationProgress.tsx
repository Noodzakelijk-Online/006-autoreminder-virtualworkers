import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type OperationProgressValue = {
  percent: number;
  label: string;
  detail: string;
  currentStep: number;
  totalSteps: number;
  startedAt: string | null;
  etaLowerSeconds: number | null;
  etaUpperSeconds: number | null;
  isTakingLongerThanExpected: boolean;
};

function formatExpectedTime(seconds: number) {
  if (seconds < 10) return "under 10 sec";
  if (seconds < 60) return `about ${Math.ceil(seconds / 5) * 5} sec`;
  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes} min`;
}

function formatElapsedTime(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes} min`;
}

export function OperationProgress({
  progress,
  name,
  className = "",
  testId = "operation-progress",
}: {
  progress: OperationProgressValue;
  name?: string;
  className?: string;
  testId?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsedSeconds = progress.startedAt
    ? Math.max(0, Math.floor((now - Date.parse(progress.startedAt)) / 1_000))
    : 0;
  const eta = progress.etaUpperSeconds == null
    ? "Estimating completion time"
    : progress.isTakingLongerThanExpected
      ? "Taking longer than usual; the run is still active"
      : `Expected in ${formatExpectedTime(progress.etaUpperSeconds)}`;
  const accessibleName = name ? `${name}: ${progress.label}` : progress.label;

  return (
    <section
      data-testid={testId}
      className={`bg-primary/[0.06] px-4 py-3 ${className}`}
      aria-live="polite"
      aria-label={`${name ?? "Operation"} progress`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            {name && <span className="text-xs font-semibold uppercase text-muted-foreground">{name}</span>}
            <p className="text-sm font-semibold text-foreground">{progress.label}</p>
            <Badge variant="outline" className="border-primary/25 bg-background/60 text-[11px] text-primary">
              Step {progress.currentStep} of {progress.totalSteps}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{progress.detail}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">{progress.percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label={`${accessibleName}: ${progress.percent}%`}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/15"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{eta}</span>
        <span className="tabular-nums">Elapsed {formatElapsedTime(elapsedSeconds)}</span>
      </div>
    </section>
  );
}
