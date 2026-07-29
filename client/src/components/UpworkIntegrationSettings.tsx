import { useEffect, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Loader2, MessageSquare, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

export default function UpworkIntegrationSettings() {
  const utils = trpc.useUtils();
  const status = trpc.settings.getUpworkIntegration.useQuery(undefined, {
    retry: false,
    staleTime: 15_000,
    refetchInterval: 5 * 60_000,
  });
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("upwork");
    if (!result) return;
    if (result === "connected") {
      toast.success("Upwork messages connected", { description: params.get("account") || "The read-only message source is ready." });
      void status.refetch();
    } else {
      toast.error("Upwork connection failed", { description: params.get("upwork_message") || "Upwork did not complete the connection." });
    }
    params.delete("upwork");
    params.delete("account");
    params.delete("upwork_message");
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
  }, [status]);

  const refreshOperationalData = async () => {
    await Promise.all([
      status.refetch(),
      utils.replyMonitor.getStatus.invalidate(),
      utils.system.readiness.invalidate(),
    ]);
  };

  const saveClient = trpc.settings.saveUpworkOauthClient.useMutation({
    onSuccess: async (result) => {
      setClientId("");
      setClientSecret("");
      await refreshOperationalData();
      toast.success("Upwork OAuth client saved", {
        description: result.reconnectRequired ? "The previous connection was cleared. Connect Upwork again." : "The Upwork account can now be connected.",
      });
    },
    onError: (error) => toast.error("Upwork OAuth client was not saved", { description: error.message }),
  });

  const beginOauth = trpc.settings.beginUpworkOauth.useMutation({
    onSuccess: ({ authUrl }) => window.location.assign(authUrl),
    onError: (error) => toast.error("Upwork connection could not start", { description: error.message }),
  });

  const disconnect = trpc.settings.disconnectUpwork.useMutation({
    onSuccess: async () => {
      await refreshOperationalData();
      toast.success("Upwork messages disconnected");
    },
    onError: (error) => toast.error("Upwork was not disconnected", { description: error.message }),
  });

  const setMonitoring = trpc.settings.setUpworkMonitoring.useMutation({
    onSuccess: async ({ settings }) => {
      await refreshOperationalData();
      toast.success(settings.enabled ? "Upwork monitoring enabled" : "Upwork monitoring disabled", {
        description: settings.enabled ? "Reply Monitor will check read-only messages every 15 minutes." : "Scheduled Upwork scans are stopped.",
      });
    },
    onError: (error) => toast.error("Upwork monitoring was not updated", { description: error.message }),
  });

  const data = status.data;
  const busy = saveClient.isPending || beginOauth.isPending || disconnect.isPending || setMonitoring.isPending;
  const canSaveClient = clientId.trim().length >= 8 && clientSecret.trim().length >= 6 && !busy;
  const callbackUrl = data?.callbackUrl ?? `${window.location.origin}/api/integrations/upwork/callback`;

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><MessageSquare className="h-4 w-4 text-primary" />Upwork messages</h2>
          <p className="mt-1 text-sm text-muted-foreground">Official read-only OAuth and GraphQL connection for Reply Monitor.</p>
        </div>
        <div className="flex items-center gap-2">
          {data?.connected ? (
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="mr-1 h-3 w-3" />Connected</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">Setup required</Badge>
          )}
          <Button variant="outline" size="icon" aria-label="Refresh Upwork settings" disabled={status.isFetching} onClick={() => void status.refetch()}>
            <RefreshCw className={`h-4 w-4 ${status.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {status.error ? (
        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-700 dark:text-red-300">Upwork settings are unavailable: {status.error.message}</p>
      ) : status.isLoading || !data ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading Upwork settings...</div>
      ) : (
        <div className="space-y-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Connection</p>
              <p className="mt-1 text-sm font-medium text-foreground">{data.accountName || "No Upwork account connected"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.oauthClientConfigured ? `OAuth client ${data.oauthClientPreview}` : "Add an approved OAuth 2.0 API key to continue."}</p>
            </div>
            {data.connected ? (
              <Button variant="outline" size="sm" disabled={busy || data.connectionManagedByEnvironment} onClick={() => {
                if (window.confirm("Disconnect Upwork and stop message monitoring?")) disconnect.mutate();
              }}><Unplug className="h-3.5 w-3.5" />Disconnect</Button>
            ) : data.oauthClientConfigured ? (
              <Button size="sm" disabled={busy} onClick={() => beginOauth.mutate()}><ExternalLink className="h-3.5 w-3.5" />Connect Upwork</Button>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-foreground" htmlFor="upwork-callback-url">Callback URL</label>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Copy Upwork callback URL" onClick={async () => {
                await navigator.clipboard.writeText(callbackUrl);
                toast.success("Callback URL copied");
              }}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
            <code id="upwork-callback-url" className="mt-1 block select-all break-all rounded-md border border-border bg-background px-2.5 py-2 text-xs text-muted-foreground">{callbackUrl}</code>
          </div>

          {!data.oauthClientManagedByEnvironment && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-medium text-foreground">Upwork client ID
                <input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder={data.oauthClientConfigured ? "Replace configured client" : "Client ID"} autoComplete="off" className="h-9 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-foreground">Upwork client secret
                <input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} placeholder="Client secret" autoComplete="new-password" className="h-9 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary" />
              </label>
              <Button variant="outline" size="sm" className="sm:col-span-2 sm:justify-self-start" disabled={!canSaveClient} onClick={() => saveClient.mutate({ clientId: clientId.trim(), clientSecret: clientSecret.trim() })}>
                {saveClient.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{data.oauthClientConfigured ? "Replace OAuth client" : "Save OAuth client"}
              </Button>
            </div>
          )}

          <div className="rounded-md border border-border bg-background px-3 py-3">
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-sm font-medium text-foreground">Monitor every 15 minutes</p><p className="mt-0.5 text-xs text-muted-foreground">No posting, archiving, or message mutation.</p></div>
              <Switch checked={data.settings.enabled} disabled={!data.canEnable || busy} onCheckedChange={(enabled) => setMonitoring.mutate({ enabled })} aria-label="Enable Upwork message monitoring" />
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Required API permissions: {data.requiredPermissions.join(" and ")}.</p>
            <a className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline" href="https://www.upwork.com/developer/keys/apply" target="_blank" rel="noreferrer">Request or manage an Upwork API key<ExternalLink className="h-3 w-3" /></a>
          </div>
        </div>
      )}
    </section>
  );
}
