import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Die echten Stufen der App (siehe useSubscription): free, light, pro – dazu Admin.
const TIERS = [["free", "Free"], ["light", "Light"], ["pro", "Pro"], ["admin", "Admin"]] as const;
const WINDOWS = [["hour", "pro Stunde"], ["week", "pro Woche"], ["month", "pro Monat"]] as const;
/** Vorschlag in Tokens. Leer = kein Limit. */
export const RECOMMENDED: Record<string, Record<string, string>> = {
  free: { hour: "60000", week: "400000", month: "1000000" },
  light: { hour: "250000", week: "2000000", month: "6000000" },
  pro: { hour: "800000", week: "8000000", month: "25000000" },
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

/** Admin: Pexels-Schlüssel, damit der App-Builder passende Stock-Fotos und -Videos (MP4) findet. */
export function MediaKeyAdmin() {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (value: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("labs", { body: { kind: "media_key_set", key: value } });
    setBusy(false);
    let msg = data?.error as string | undefined;
    const ctx = (error as { context?: Response } | null)?.context;
    if (!msg && ctx && typeof ctx.json === "function") msg = (await ctx.json().catch(() => null))?.error;
    if (error || msg) toast.error(msg || "Speichern fehlgeschlagen");
    else { toast.success(value ? "Pexels-Schlüssel gespeichert und geprüft" : "Pexels-Schlüssel entfernt"); setKey(""); }
  };
  return (
    <div className="glass mt-4 rounded-xl p-5">
      <h3 className="mb-1 font-display font-semibold">Fotos und Videos für den App-Builder</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Ohne Schlüssel sucht Mythos passende Medien bei Wikimedia Commons (frei, aber kleine Auswahl, Videos oft nicht hübsch).
        Mit einem kostenlosen Pexels-Schlüssel (pexels.com/api) findet er hochwertige Stock-Fotos und MP4-Videos zu fast jedem Thema.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input type="password" value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder="Pexels-API-Schlüssel" className="h-9 max-w-sm" autoComplete="off" />
        <Button size="sm" onClick={() => save(key)} disabled={busy || key.length < 20}>{busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Speichern</Button>
        <Button size="sm" variant="outline" onClick={() => save("")} disabled={busy}>Entfernen</Button>
      </div>
    </div>
  );
}
