import { Link } from "@tanstack/react-router";
import { Bike, Loader2, ShieldCheck, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { swiggyErrorMessage, useSwiggyConnection } from "@/hooks/useSwiggy";
import { formatIst } from "@/lib/ingestion/timezone";
import { cn } from "@/lib/utils";

export function SwiggyPrivacyNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] leading-relaxed text-muted-foreground", className)}>
      Live Swiggy results are fetched to answer your current request only. vybz keeps them for this session,
      does not add them to its own catalogue, and does not use them for analytics, advertising or model training.
      Your Swiggy sign-in stays on vybz's server and is never shown in your browser.
    </p>
  );
}

/** Connect / connected / reconnect states for the user's own Swiggy session. */
export function SwiggyConnect({ returnPath, compact = false }: { returnPath: string; compact?: boolean }) {
  const { signedIn, status, connect, disconnect } = useSwiggyConnection();

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-medium">Sign in to use live Swiggy</p>
        <p className="mt-1 text-xs text-muted-foreground">Your Swiggy session is linked to your vybz account.</p>
        <Button asChild size="sm" variant="ember" className="mt-3"><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  const s = status.data;
  const connected = !!s?.connected;
  const busy = connect.isPending || status.isLoading;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", connected && "border-teal/30 bg-teal/5")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-medium">
            <Bike className="size-4 text-primary-glow" />
            {connected ? "Swiggy connected" : s?.needsReconnect ? "Swiggy session ended" : "Connect Swiggy"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {connected
              ? `Live delivery and Dineout reservations are on${s?.expiresAt ? ` · session valid until ${formatIst(s.expiresAt)}` : ""}.`
              : s?.needsReconnect
                ? "Swiggy sessions last 5 days and can't be renewed automatically — reconnect to continue."
                : "See live restaurants, menus, Dineout availability and reservations from your own Swiggy account."}
          </p>
        </div>
        {connected ? (
          <Button size="sm" variant="glass" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
            {disconnect.isPending ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}Disconnect
          </Button>
        ) : (
          <Button size="sm" variant="ember" onClick={() => connect.mutate(returnPath)} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {s?.needsReconnect ? "Reconnect" : "Connect Swiggy"}
          </Button>
        )}
      </div>
      {connect.error && <p className="mt-2 text-xs text-destructive">{swiggyErrorMessage(connect.error).message}</p>}
      {!compact && (
        <div className="mt-3 flex items-start gap-2 border-t border-border pt-3">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-teal" />
          <SwiggyPrivacyNote />
        </div>
      )}
    </div>
  );
}
