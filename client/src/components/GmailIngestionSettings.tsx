import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Copy, ExternalLink, FolderOpen, Loader2, Mail, Play, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

function formatRunTime(value: Date | string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function GmailIngestionSettings() {
  const utils = trpc.useUtils();
  const status = trpc.settings.getGmailIngestion.useQuery(undefined, {
    retry: false,
    staleTime: 15_000,
    refetchInterval: 5 * 60_000,
  });
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(60);

  useEffect(() => {
    if (!status.data) return;
    setEnabled(status.data.settings.enabled);
    setIntervalMinutes(status.data.settings.intervalMinutes);
  }, [status.data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("gmail");
    if (!result) return;
    if (result === "connected") {
      toast.success("Google Workspace connected", { description: params.get("account") || "The account is ready for ingestion." });
      void status.refetch();
    } else {
      toast.error("Google Workspace connection failed", { description: params.get("gmail_message") || "Google did not complete the connection." });
    }
    params.delete("gmail");
    params.delete("account");
    params.delete("gmail_message");
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
  }, [status]);

  const refreshOperationalData = async () => {
    await Promise.all([
      status.refetch(),
      utils.system.readiness.invalidate(),
      utils.system.scheduledJobFreshness.invalidate(),
      utils.emailInbox.getAll.invalidate(),
      utils.emailInbox.getPending.invalidate(),
      utils.emailInbox.getPendingCount.invalidate(),
      utils.system.navigationCounts.invalidate(),
    ]);
  };

  const saveClient = trpc.settings.saveGmailOauthClient.useMutation({
    onSuccess: async (result) => {
      setClientId("");
      setClientSecret("");
      await refreshOperationalData();
      toast.success("Google OAuth client saved", {
        description: result.reconnectRequired ? "The previous Google connection was cleared. Connect the account again." : "Google Workspace can now be connected.",
      });
    },
    onError: (error) => toast.error("OAuth client was not saved", { description: error.message }),
  });

  const beginOauth = trpc.settings.beginGmailOauth.useMutation({
    onSuccess: ({ authUrl }) => window.location.assign(authUrl),
    onError: (error) => toast.error("Google Workspace connection could not start", { description: error.message }),
  });

  const disconnect = trpc.settings.disconnectGmail.useMutation({
    onSuccess: async () => {
      await refreshOperationalData();
      toast.success("Google Workspace disconnected");
    },
    onError: (error) => toast.error("Google Workspace was not disconnected", { description: error.message }),
  });

  const saveSchedule = trpc.settings.setGmailIngestion.useMutation({
    onSuccess: async ({ settings }) => {
      await refreshOperationalData();
      toast.success(settings.enabled ? "Workspace schedule enabled" : "Workspace schedule disabled", {
        description: settings.enabled ? `The server will index Gmail, Drive, and Trello every ${settings.intervalMinutes} minutes.` : "Automatic workspace ingestion is stopped.",
      });
    },
    onError: (error) => toast.error("Workspace schedule was not saved", { description: error.message }),
  });

  const runNow = trpc.settings.runGmailIngestion.useMutation({
    onSuccess: async (result) => {
      await refreshOperationalData();
      toast.success("Workspace ingestion completed", {
        description: `${result.gmail.result?.imported ?? 0} Gmail, ${result.googleDrive.result?.indexed ?? 0} Drive, and ${result.trello.result?.imported ?? 0} Trello records indexed; ${result.linking.linksCreated} card links.`,
      });
    },
    onError: (error) => toast.error("Workspace ingestion failed", { description: error.message }),
  });

  const data = status.data;
  const busy = saveClient.isPending || beginOauth.isPending || disconnect.isPending || saveSchedule.isPending || runNow.isPending;
  const canSaveClient = clientId.trim().length >= 10 && clientSecret.trim().length >= 6 && !busy;
  const callbackUrl = data?.callbackUrl ?? `${window.location.origin}/api/integrations/gmail/callback`;

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm lg:col-span-2">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FolderOpen className="h-4 w-4 text-primary" /> Workspace intelligence
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Read-only Gmail, Drive, and Trello evidence linked to APTLSS cards.</p>
        </div>
        <div className="flex items-center gap-2">
          {data?.connected && !data.reconnectRequired ? (
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="mr-1 h-3 w-3" />All sources ready</Badge>
          ) : data?.connected ? (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">Drive permission needed</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">Setup required</Badge>
          )}
          <Button variant="outline" size="icon" aria-label="Refresh workspace settings" disabled={status.isFetching} onClick={() => void status.refetch()}>
            <RefreshCw className={`h-4 w-4 ${status.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {status.error ? (
        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-700 dark:text-red-300">Workspace settings are unavailable: {status.error.message}</p>
      ) : status.isLoading || !data ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading workspace settings...</div>
      ) : (
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="border-b border-border py-5 lg:border-b-0 lg:border-r lg:pr-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Connection</p>
                <p className="mt-1 text-sm font-medium text-foreground">{data.accountEmail || "No Google account connected"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.oauthClientConfigured ? `OAuth client ${data.oauthClientPreview}` : "Add a Google OAuth client to continue."}
                </p>
              </div>
              {data.connected ? (
                <div className="flex flex-wrap justify-end gap-2">
                  {data.reconnectRequired ? <Button size="sm" disabled={busy} onClick={() => beginOauth.mutate()}>
                    <ExternalLink className="h-3.5 w-3.5" />Grant Drive access
                  </Button> : null}
                  <Button variant="outline" size="sm" disabled={busy || data.connectionManagedByEnvironment} onClick={() => {
                    if (window.confirm("Disconnect Google Workspace and stop internal ingestion?")) disconnect.mutate();
                  }}>
                    <Unplug className="h-3.5 w-3.5" />Disconnect
                  </Button>
                </div>
              ) : data.oauthClientConfigured ? (
                <Button size="sm" disabled={busy} onClick={() => beginOauth.mutate()}>
                  <ExternalLink className="h-3.5 w-3.5" />Connect Google
                </Button>
              ) : null}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-foreground" htmlFor="gmail-callback-url">Authorized redirect URI</label>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Copy Gmail redirect URI" onClick={async () => {
                  await navigator.clipboard.writeText(callbackUrl);
                  toast.success("Redirect URI copied");
                }}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
              <code id="gmail-callback-url" className="mt-1 block select-all break-all rounded-md border border-border bg-background px-2.5 py-2 text-xs text-muted-foreground">{callbackUrl}</code>
            </div>

            {!data.oauthClientManagedByEnvironment && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-medium text-foreground">
                  Google OAuth client ID
                  <input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder={data.oauthClientConfigured ? "Replace configured client" : "Client ID"} autoComplete="off" className="h-9 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-foreground">
                  Google OAuth client secret
                  <input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} placeholder="Client secret" autoComplete="new-password" className="h-9 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary" />
                </label>
                <Button variant="outline" size="sm" className="sm:col-span-2 sm:justify-self-start" disabled={!canSaveClient} onClick={() => saveClient.mutate({ clientId: clientId.trim(), clientSecret: clientSecret.trim() })}>
                  {saveClient.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {data.oauthClientConfigured ? "Replace OAuth client" : "Save OAuth client"}
                </Button>
              </div>
            )}
          </div>

          <div className="py-5 lg:pl-5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Internal schedule</p>
            <div className="mt-3 flex items-center justify-between gap-4 rounded-md border border-border bg-background px-3 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Automatic ingestion</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Runs only while this server is online.</p>
              </div>
              <Switch checked={enabled} disabled={!data.canRun || busy} onCheckedChange={setEnabled} aria-label="Enable automatic workspace ingestion" />
            </div>

            <label className="mt-3 grid gap-1.5 text-xs font-medium text-foreground">
              Scan interval
              <select value={intervalMinutes} disabled={!data.canRun || busy} onChange={(event) => setIntervalMinutes(Number(event.target.value))} className="h-9 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary">
                {data.intervalOptions.map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} minutes` : minutes === 60 ? "Every hour" : minutes < 1_440 ? `Every ${minutes / 60} hours` : "Once a day"}</option>)}
              </select>
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={!data.canRun || busy} onClick={() => saveSchedule.mutate({ enabled, intervalMinutes: intervalMinutes as 5 | 15 | 30 | 60 | 120 | 240 | 720 | 1440 })}>
                {saveSchedule.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                Save interval
              </Button>
              <Button variant="outline" size="sm" disabled={!data.canRun || busy} onClick={() => runNow.mutate()}>
                {runNow.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Run now
              </Button>
            </div>

            <dl className="mt-4 divide-y divide-border rounded-md border border-border bg-background text-xs">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5"><dt className="text-muted-foreground">Next run</dt><dd className="text-right font-medium text-foreground">{data.runtime.blockedReason || formatRunTime(data.runtime.nextRunAt)}</dd></div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5"><dt className="text-muted-foreground">Last run</dt><dd className="text-right font-medium text-foreground">{formatRunTime(data.workspaceLatestRun?.startedAt)}</dd></div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5"><dt className="text-muted-foreground">Evidence index</dt><dd className="text-right font-medium text-foreground">{data.evidence.total} items / {data.evidence.linked} linked</dd></div>
              <div className="grid grid-cols-3 gap-2 px-3 py-2.5 text-center">
                <div><dt className="text-muted-foreground"><Mail className="mr-1 inline h-3 w-3" />Gmail</dt><dd className="mt-0.5 font-medium text-foreground">{data.evidence.bySource.gmail}</dd></div>
                <div><dt className="text-muted-foreground"><FolderOpen className="mr-1 inline h-3 w-3" />Drive</dt><dd className="mt-0.5 font-medium text-foreground">{data.evidence.bySource.google_drive}</dd></div>
                <div><dt className="text-muted-foreground">Trello</dt><dd className="mt-0.5 font-medium text-foreground">{data.evidence.bySource.trello}</dd></div>
              </div>
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
