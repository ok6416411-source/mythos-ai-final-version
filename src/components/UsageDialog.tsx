import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type Summary = { tier: string; usage: Record<string, number>; limits: Record<string, number | null> };

const ROWS: { key: "hour" | "week" | "month"; label: string; hint: string }[] = [
  { key: "hour", label: "Aktuelle Stunde", hint: "Rollierend – zählt die letzten 60 Minuten" },
  { key: "week", label: "Diese Woche", hint: "Rollierend – die letzten 7 Tage" },
  { key: "month", label: "Dieser Monat", hint: "Rollierend – die letzten 30 Tage" },
];

const fmt = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " Mio." : n >= 1e3 ? Math.round(n / 1e3) + " Tsd." : String(Math.round(n)));
const TIER: Record<string, string> = { free: "Free", light: "Light", pro: "Pro", admin: "Admin" };

/** Ersatzweg ohne Server-Funktion: Stufe, Limits und eigener Verbrauch direkt aus der Datenbank. */
async function usageFromDb(): Promise<Summary> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const db = supabase as unknown as { from: (t: string) => any };
  const [roles, sub, rows] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", user.id),
    db.from("subscriptions").select("tier,expires_at").eq("user_id", user.id).maybeSingle(),
    db.from("mythos_token_usage").select("total_tokens,measured,created_at").eq("user_id", user.id).gte("created_at", since).limit(20000),
  ]);
  if (rows.error) throw new Error(rows.error.message);
  const tier = roles.data?.some((r: { role: string }) => r.role === "admin") ? "admin"
    : sub.data?.tier && (!sub.data.expires_at || new Date(sub.data.expires_at) > new Date()) ? String(sub.data.tier) : "free";
  const now = Date.now(), usage = { hour: 0, week: 0, month: 0, unmeasured: 0 };
  for (const r of (rows.data || []) as { total_tokens: number | null; measured: boolean; created_at: string }[]) {
    const age = now - new Date(r.created_at).getTime(), n = Number(r.total_tokens) || 0;
    usage.month += n; if (age < 7 * 864e5) usage.week += n; if (age < 3600e3) usage.hour += n; if (!r.measured) usage.unmeasured++;
  }
  const { data: lim } = await db.from("app_settings").select("key,value").like("key", `token_limit_${tier}_%`);
  const limits: Record<string, number | null> = { hour: null, week: null, month: null };
  for (const r of (lim || []) as { key: string; value: string | null }[]) { const k = r.key.split("_").pop()!; const n = Number(r.value); if (k in limits && r.value && Number.isFinite(n)) limits[k] = n; }
  return { tier, usage, limits };
}

/** Verbrauch wie bei Claude: Balken pro Zeitfenster, Prozent und Limit. */
export default function UsageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!open) return;
    let dead = false;
    setData(null); setError("");
    (async () => {
      // 1. Weg: Server (rechnet alles zusammen). 2. Weg, falls der nicht antwortet: eigene Zeilen direkt lesen (erlaubt per RLS).
      let why = "";
      try {
        const { data: d, error: e } = await supabase.functions.invoke("cli-auth", { body: { action: "usage_me" } });
        if (!e && d?.tokens) { if (!dead) setData(d.tokens as Summary); return; }
        const ctx = (e as { context?: Response } | null)?.context;
        why = (d?.error as string) || (ctx && typeof ctx.json === "function" ? (await ctx.json().catch(() => null))?.error : "") || e?.message || "";
      } catch (e) { why = e instanceof Error ? e.message : String(e); }
      try {
        const s = await usageFromDb();
        if (!dead) setData(s);
      } catch (e) {
        if (dead) return;
        const msg = /Unbekannte Aktion/i.test(why) ? "Die Server-Funktion „cli-auth“ ist noch eine alte Fassung – bitte in Lovable neu bereitstellen." : why || (e instanceof Error ? e.message : "");
        setError("Verbrauch gerade nicht abrufbar." + (msg ? " (" + msg + ")" : ""));
      }
    })();
    return () => { dead = true; };
  }, [open, nonce]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-sans text-lg font-semibold">Nutzung</DialogTitle>
          <DialogDescription>
            {data ? <>Plan: <b className="text-foreground">{TIER[data.tier] || data.tier}</b> · MythosAI-Tokens über Website, App, CLI und API</> : "MythosAI-Tokens über Website, App, CLI und API"}
          </DialogDescription>
        </DialogHeader>
        {!data && !error && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {error && (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={() => setNonce((n) => n + 1)} className="mt-3 rounded-full border border-border px-3.5 py-1.5 text-sm hover:bg-muted">Nochmal versuchen</button>
          </div>
        )}
        {data && (
          <div className="space-y-6 py-2">
            {ROWS.map(r => {
              const used = Number(data.usage?.[r.key] || 0);
              const limit = data.limits?.[r.key];
              const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
              const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-foreground";
              return (
                <div key={r.key}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.hint}</div>
                    </div>
                    <div className="shrink-0 text-right text-sm tabular-nums">
                      {limit ? <><b>{Math.round(pct)} %</b> <span className="text-muted-foreground">genutzt</span></> : <span className="text-muted-foreground">kein Limit</span>}
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full transition-all ${color}`} style={{ width: limit ? `${Math.max(pct, used ? 1.5 : 0)}%` : "0%" }} />
                  </div>
                  <div className="mt-1 text-xs tabular-nums text-muted-foreground">{fmt(used)} {limit ? `von ${fmt(limit)}` : ""} Tokens</div>
                </div>
              );
            })}
            {!!data.usage?.unmeasured && <p className="text-xs text-muted-foreground">{data.usage.unmeasured} Anfragen ohne gemessene Tokens (Anbieter hat keine Werte geliefert).</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
