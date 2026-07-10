import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { FormEvent, ReactNode, useState } from "react";
import { toast } from "sonner";

export function OwnerAccessGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const [token, setToken] = useState("");
  const [oauthError, setOauthError] = useState<string | null>(null);

  const localLogin = trpc.auth.localLogin.useMutation({
    onSuccess: async () => {
      toast.success("Owner access unlocked");
      setToken("");
      await utils.auth.me.invalidate();
      await auth.refresh();
    },
    onError: (error) => {
      toast.error("Local unlock failed", { description: error.message });
    },
  });

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Checking owner access...
      </div>
    );
  }

  if (auth.user) {
    return <>{children}</>;
  }

  function handleLocalUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;
    localLogin.mutate({ token: trimmed });
  }

  function handleHostedLogin() {
    try {
      setOauthError(null);
      window.location.href = getLoginUrl();
    } catch (error) {
      setOauthError(error instanceof Error ? error.message : "Hosted OAuth login is not configured.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <Card className="w-full max-w-md rounded-md border-slate-200 bg-white shadow-sm">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold tracking-normal">Owner access required</CardTitle>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Joyce's work dashboard contains pay, client, Trello, and daily operating records. Unlock it before viewing or changing the workspace.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-3" onSubmit={handleLocalUnlock}>
            <div className="space-y-2">
              <Label htmlFor="local-owner-token">Local access token</Label>
              <Input
                id="local-owner-token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="current-password"
                placeholder="Enter owner token"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
              disabled={!token.trim() || localLogin.isPending}
            >
              {localLogin.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Unlock dashboard
            </Button>
          </form>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs uppercase text-slate-400">
            <div className="h-px bg-slate-200" />
            <span>or</span>
            <div className="h-px bg-slate-200" />
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={handleHostedLogin}>
            Use hosted OAuth
          </Button>
          {oauthError && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {oauthError}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
