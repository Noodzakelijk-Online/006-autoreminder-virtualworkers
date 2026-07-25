import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clipboard, FolderOpen, Monitor, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import type { BrowserTabPolicy } from "@shared/browserTabPolicy";

function hostname(value: string) {
  try {
    return new URL(value).hostname || value;
  } catch {
    return value;
  }
}

export function BrowserTabEndOfDayAlert({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = trpc.browserTabs.getStatus.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading || !data?.policy.enabled || !data.warningWindow || data.protectedDay || data.status === "clear") return null;
  if (data.status === "disconnected" || data.status === "stale" || !data.shouldWarn) return null;

  return (
    <Alert className="border-red-500/40 bg-red-500/5">
      <AlertTriangle className="h-4 w-4 text-red-600" />
      <AlertDescription className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">
              {`Close ${data.excessTabs} excess browser tab${data.excessTabs === 1 ? "" : "s"}`}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {`${data.actionableTabs} non-pinned work tabs remain open; the end-of-day limit is ${data.allowedTabs}. Close completed and duplicate tabs before ${data.workEnd} EAT.`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {data.tabs.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setExpanded((value) => !value)}>
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Review
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onOpenSettings}>Settings</Button>
          </div>
        </div>
        {expanded && (
          <div className="mt-3 divide-y divide-border/60 rounded-md border border-border bg-background">
            {data.tabs.slice(0, 10).map((tab) => (
              <div key={`${tab.windowId}-${tab.id}`} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <p className="truncate text-xs font-medium text-foreground">{tab.title}</p>
                <span className="truncate text-[11px] text-muted-foreground">{hostname(tab.url)}</span>
              </div>
            ))}
            {data.tabs.length > 10 && <p className="px-3 py-2 text-xs text-muted-foreground">And {data.tabs.length - 10} more tabs.</p>}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Use the Joyce Browser Hygiene toolbar button to select and close tabs. Nothing closes automatically.</p>
      </AlertDescription>
    </Alert>
  );
}

export function BrowserExtensionSetupBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data: status, isLoading } = trpc.browserTabs.getStatus.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const { data: setup } = trpc.browserTabs.getCollectorSetup.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (isLoading || !status?.policy.enabled || status.connected) return null;
  const stale = status.status === "stale";
  const extensionPath = setup?.extensionDirectory ?? "browser-extension";

  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <FolderOpen className="h-4 w-4 text-amber-600" />
      <AlertDescription>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{stale ? "Chrome tab collector needs attention" : "Finish browser organization setup"}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {stale
                ? `Chrome last reported ${status.ageMinutes} minutes ago. Confirm that Joyce Browser Hygiene is enabled.`
                : "Chrome requires one explicit Load unpacked approval. After that, the dashboard token, connection, and minute-by-minute checks configure themselves automatically."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {!stale && (
              <Button variant="outline" size="sm" disabled={!setup?.extensionDirectory} onClick={async () => {
                await navigator.clipboard.writeText(extensionPath);
                toast.success("Extension folder copied", { description: "Paste it into Chrome's Load unpacked folder picker." });
              }}><Clipboard className="h-3.5 w-3.5" />Copy extension folder</Button>
            )}
            <Button variant="outline" size="sm" onClick={onOpenSettings}>Setup details</Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function BrowserTabHygieneSettings() {
  const utils = trpc.useUtils();
  const { data: policy, isLoading: policyLoading } = trpc.browserTabs.getPolicy.useQuery();
  const { data: status, isLoading: statusLoading, refetch, isFetching } = trpc.browserTabs.getStatus.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const { data: setup } = trpc.browserTabs.getCollectorSetup.useQuery(undefined, { retry: false });
  const [draft, setDraft] = useState<BrowserTabPolicy | null>(null);
  useEffect(() => { if (policy && !draft) setDraft(policy); }, [policy, draft]);

  const save = trpc.browserTabs.setPolicy.useMutation({
    onSuccess: async (saved) => {
      setDraft(saved);
      await Promise.all([utils.browserTabs.getPolicy.invalidate(), utils.browserTabs.getStatus.invalidate()]);
      toast.success("Browser tab policy saved");
    },
    onError: (error) => toast.error("Could not save browser tab policy", { description: error.message }),
  });

  const connectionLabel = status?.connected ? "Connected" : status?.status === "stale" ? "Stale" : "Not connected";
  const extensionPath = setup?.extensionDirectory ?? "browser-extension";

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm lg:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Monitor className="h-4 w-4 text-primary" />Browser tab hygiene</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Warn Joyce near the end of the workday when too many non-pinned work tabs remain open.</p>
        </div>
        <Badge variant="outline" className={status?.connected ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 text-amber-700 dark:text-amber-300"}>{statusLoading ? "Checking" : connectionLabel}</Badge>
      </div>

      {policyLoading || !draft ? <p className="mt-5 text-sm text-muted-foreground">Loading browser policy...</p> : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-md border border-border bg-background px-3 py-3">
              <span><span className="block text-sm font-medium text-foreground">End-of-day warning</span><span className="mt-0.5 block text-xs text-muted-foreground">Evaluate tab organization on workdays.</span></span>
              <Switch checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1.5 text-xs font-medium text-foreground">Allowed tabs<Input type="number" min={0} max={50} value={draft.maxOpenTabs} onChange={(event) => setDraft({ ...draft, maxOpenTabs: Number(event.target.value) })} /></label>
              <label className="space-y-1.5 text-xs font-medium text-foreground">Warn before EOD<Input type="number" min={0} max={240} step={5} value={draft.warningMinutesBeforeEnd} onChange={(event) => setDraft({ ...draft, warningMinutesBeforeEnd: Number(event.target.value) })} /></label>
              <label className="space-y-1.5 text-xs font-medium text-foreground">Stale after<Input type="number" min={2} max={120} value={draft.staleAfterMinutes} onChange={(event) => setDraft({ ...draft, staleAfterMinutes: Number(event.target.value) })} /></label>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-md border border-border bg-background px-3 py-3">
              <span><span className="block text-sm font-medium text-foreground">Count pinned tabs</span><span className="mt-0.5 block text-xs text-muted-foreground">Pinned reference tabs are excluded by default.</span></span>
              <Switch checked={draft.includePinnedTabs} onCheckedChange={(includePinnedTabs) => setDraft({ ...draft, includePinnedTabs })} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button disabled={save.isPending} onClick={() => save.mutate(draft)}>{save.isPending ? "Saving..." : "Save policy"}</Button>
              <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />Refresh status</Button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chrome collector</p>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Latest inventory</span><span className="font-medium text-foreground">{status?.capturedAt ? new Date(status.capturedAt).toLocaleString("en-GB") : "Never"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Open work tabs</span><span className="font-medium text-foreground">{status?.actionableTabs ?? 0}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Windows</span><span className="font-medium text-foreground">{status?.windowCount ?? 0}</span></div>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs leading-relaxed text-muted-foreground">Chrome requires one manual <strong>Load unpacked</strong> approval for <code className="text-foreground">{extensionPath}</code>. Once loaded, the extension obtains its local collector token and starts reporting automatically.</p>
              <Button variant="outline" size="sm" className="mt-3" disabled={!setup?.extensionDirectory} onClick={async () => {
                await navigator.clipboard.writeText(extensionPath);
                toast.success("Extension folder copied");
              }}><FolderOpen className="h-3.5 w-3.5" />Copy extension folder</Button>
              <Button variant="outline" size="sm" className="mt-3" disabled={!setup?.token} onClick={async () => {
                if (!setup?.token) return;
                await navigator.clipboard.writeText(setup.token);
                toast.success("Collector token copied");
              }}><Clipboard className="h-3.5 w-3.5" />Copy collector token</Button>
            </div>
            {status?.connected && <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Collector is reporting automatically.</div>}
          </div>
        </div>
      )}
    </section>
  );
}
