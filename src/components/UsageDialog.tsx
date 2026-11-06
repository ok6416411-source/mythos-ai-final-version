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
const TIER: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro", ultra: "Ultra", admin: "Admin" };

/** Verbrauch wie bei Claude: Balken pro Zeitfenster, Prozent und Limit. */
export default function UsageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setData(null); setError("");
    supabase.functions.invoke("cli-auth", { body: { action: "usage_me" } })
      .then(({ data: d, error: e }) => {
        if (e || !d?.tokens) setError("Verbrauch gerade nicht abrufbar.");
        else setData(d.tokens as Summary);
      });
  }, [open]);

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
        {error && <p className="py-6 text-center text-sm text-muted-foreground">{error}</p>}
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
