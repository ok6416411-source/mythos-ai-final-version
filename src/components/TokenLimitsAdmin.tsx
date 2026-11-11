import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TIERS = [["free", "Free"], ["plus", "Plus"], ["pro", "Pro"], ["ultra", "Ultra"], ["admin", "Admin"]] as const;
const WINDOWS = [["hour", "pro Stunde"], ["week", "pro Woche"], ["month", "pro Monat"]] as const;
/** Vorschlag in Tokens. Leer = kein Limit. */
export const RECOMMENDED: Record<string, Record<string, string>> = {
  free: { hour: "60000", week: "400000", month: "1000000" },
  plus: { hour: "250000", week: "2000000", month: "6000000" },
  pro: { hour: "600000", week: "6000000", month: "20000000" },
  ultra: { hour: "1500000", week: "15000000", month: "50000000" },
  admin: { hour: "", week: "", month: "" },
};
const key = (tier: string, win: string) => `token_limit_${tier}_${win}`;
const pretty = (v: string) => { const n = Number(v); return !v || !Number.isFinite(n) ? "kein Limit" : n >= 1e6 ? (n / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " Mio." : n >= 1e3 ? Math.round(n / 1e3) + " Tsd." : String(n); };

/** Admin: Token-Limits je Abo-Stufe für Stunde, Woche und Monat (rollierende Zeitfenster). */
export default function TokenLimitsAdmin() {
  const [vals, setVals] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const load = async () => {
    const { data, error } = await supabase.from("app_settings").select("key,value").like("key", "token_limit_%");
    if (error) { toast.error("Limits konnten nicht geladen werden", { description: error.message }); setVals({}); return; }
    setVals(Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? ""])));
  };
  useEffect(() => { load(); }, []);
  const set = (k: string, v: string) => setVals((p) => ({ ...(p || {}), [k]: v.replace(/[^\d]/g, "") }));
  const save = async (next = vals) => {
    if (!next) return;
    setSaving(true);
    const rows = TIERS.flatMap(([t]) => WINDOWS.map(([w]) => ({ key: key(t, w), value: next[key(t, w)] || "", updated_at: new Date().toISOString() })));
    const { error } = await supabase.from("app_settings").upsert(rows);
    setSaving(false);
    if (error) toast.error("Speichern fehlgeschlagen", { description: error.message });
    else { toast.success("Limits gespeichert – gelten sofort für neue Aufgaben"); load(); }
  };
  const recommend = () => { const next: Record<string, string> = { ...(vals || {}) }; TIERS.forEach(([t]) => WINDOWS.forEach(([w]) => { next[key(t, w)] = RECOMMENDED[t][w]; })); setVals(next); };

  return (
    <div className="glass rounded-xl p-5">
      <div className="mb-1 flex items-center gap-2"><Gauge className="h-4 w-4" /><h3 className="font-display font-semibold">Token-Limits</h3></div>
      <p className="mb-4 text-xs text-muted-foreground">
        Wie viele MythosAI-Tokens eine Stufe in der letzten Stunde, in den letzten 7 Tagen und in den letzten 30 Tagen verbrauchen darf – über Website, App, CLI und API zusammen.
        Leer = kein Limit. Ist ein Limit erreicht, werden laufende Aufgaben noch fertig gemacht; nur neue Aufgaben warten.
      </p>
      {!vals ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2 pr-3 font-medium">Stufe</th>{WINDOWS.map(([w, l]) => <th key={w} className="pb-2 pr-3 font-medium">Tokens {l}</th>)}</tr></thead>
            <tbody>
              {TIERS.map(([t, label]) => (
                <tr key={t} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium">{label}</td>
                  {WINDOWS.map(([w]) => (
                    <td key={w} className="py-2 pr-3">
                      <Input inputMode="numeric" value={vals[key(t, w)] ?? ""} onChange={(e) => set(key(t, w), e.target.value)} placeholder="kein Limit" className="h-9 tabular-nums" aria-label={`${label} ${w}`} />
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{pretty(vals[key(t, w)] ?? "")}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => save()} disabled={saving || !vals}>{saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Speichern</Button>
        <Button size="sm" variant="outline" onClick={recommend} disabled={!vals}>Empfohlene Werte eintragen</Button>
      </div>
    </div>
  );
}
