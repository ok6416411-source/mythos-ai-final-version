// MythosAI token accounting per user (website, desktop app, CLI, API).
// Tasks are admitted once; continuations of an admitted task are never blocked by limits.
import type { TokenUsage } from "./usageParse.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validTaskId = (v: unknown): string | null => typeof v === "string" && UUID.test(v) ? v.toLowerCase() : null;

export async function tierOf(db: any, userId: string): Promise<string> {
  const [{ data: roles }, { data: sub }] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId),
    db.from("subscriptions").select("tier,expires_at").eq("user_id", userId).maybeSingle(),
  ]);
  if (roles?.some((r: any) => r.role === "admin")) return "admin";
  if (sub?.tier && (!sub.expires_at || new Date(sub.expires_at) > new Date())) return String(sub.tier);
  return "free";
}

// Eine Aufgabe gilt als „läuft noch“, solange sie sich regelmäßig meldet. Danach zählt dieselbe Kennung als neue
// Aufgabe – sonst könnte man mit einer alten Kennung die Limits für immer umgehen.
const TASK_IDLE_MS = 45 * 60_000;      // so lange ohne Lebenszeichen darf eine laufende Aufgabe pausieren
const TASK_MAX_MS = 12 * 3600_000;     // so lange darf eine einzelne Aufgabe insgesamt weiterlaufen

export type Admission = { allowed: boolean; continued?: boolean; reason?: string; usage?: Record<string, number>; limits?: Record<string, number | null>; tier: string; taskId: string };

export async function admitTask(db: any, userId: string, taskId: string, source: string): Promise<Admission> {
  const tier = await tierOf(db, userId);
  // Abgelaufene Aufgabe? Dann unter neuer Kennung prüfen (das Limit gilt wieder).
  try {
    const { data: t } = await db.from("mythos_tasks").select("user_id,created_at,last_seen_at").eq("id", taskId).maybeSingle();
    if (t && t.user_id === userId) {
      const now = Date.now();
      if (now - new Date(t.last_seen_at).getTime() > TASK_IDLE_MS || now - new Date(t.created_at).getTime() > TASK_MAX_MS) taskId = crypto.randomUUID();
    }
  } catch { /* die Datenbank-Funktion entscheidet */ }
  const { data, error } = await db.rpc("mythos_admit_task", { _user_id: userId, _task_id: taskId, _source: source, _tier: tier });
  if (error) { console.error("[tokens] admit failed", error.message); throw new Error("MythosAI-Verbrauch konnte nicht geprüft werden. Bitte gleich erneut versuchen."); }
  return { ...(data as Record<string, unknown>), tier, taskId } as Admission;
}

const WINDOWS: { key: "hour" | "week" | "month"; label: string; free: string }[] = [
  { key: "hour", label: "Stunden-Limit", free: "in spätestens einer Stunde" },
  { key: "week", label: "Wochen-Limit", free: "innerhalb der nächsten Tage" },
  { key: "month", label: "Monats-Limit", free: "innerhalb der nächsten Wochen" },
];
const short = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " Mio." : n >= 1e3 ? Math.round(n / 1e3) + " Tsd." : String(Math.round(n)));

/** Antwort für „Limit erreicht“: welches Zeitfenster voll ist, wie viel verbraucht wurde und wann es weitergeht. */
export function limitInfo(a: { usage?: Record<string, number>; limits?: Record<string, number | null>; tier?: string }) {
  const hit = WINDOWS.filter((w) => { const l = Number(a.limits?.[w.key]); return l > 0 && Number(a.usage?.[w.key] || 0) >= l; });
  const w = hit[hit.length - 1]; // das längste volle Fenster bestimmt, wann es weitergeht
  const error = w
    ? `Dein MythosAI-${w.label} ist erreicht (${short(Number(a.usage?.[w.key] || 0))} von ${short(Number(a.limits?.[w.key]))} Tokens). Laufende Aufgaben werden noch fertig gemacht. Neue Aufgaben gehen ${w.free} wieder – das Fenster läuft mit.`
    : limitMessage;
  return { error, code: "token_limit", window: w?.key ?? null, windows: hit.map((x) => x.key), usage: a.usage ?? null, limits: a.limits ?? null, tier: a.tier ?? null };
}
export const LIMIT_HEADERS = { "x-mythos-limit": "token_limit", "Access-Control-Expose-Headers": "x-mythos-limit" };

export async function recordUsage(db: any, row: { userId: string; taskId: string | null; source: string; model: string; usage: TokenUsage | null }) {
  const u = row.usage;
  const { error } = await db.from("mythos_token_usage").insert({
    user_id: row.userId, task_id: row.taskId, source: row.source, model: row.model,
    input_tokens: u?.input ?? null, output_tokens: u?.output ?? null, total_tokens: u?.total ?? null, measured: !!u,
  });
  if (error) console.error("[tokens] record failed", error.message);
}

export async function usageSummary(db: any, userId: string) {
  const tier = await tierOf(db, userId);
  const [{ data }, { data: lim }] = await Promise.all([
    db.rpc("mythos_token_summary", { _user_id: userId }),
    db.from("app_settings").select("key,value").like("key", `token_limit_${tier}_%`),
  ]);
  const limits: Record<string, number | null> = { hour: null, week: null, month: null };
  for (const r of lim ?? []) { const k = String(r.key).split("_").pop(); const n = Number(r.value); if (k && k in limits && r.value && Number.isFinite(n)) limits[k] = n; }
  return { tier, usage: data ?? { hour: 0, week: 0, month: 0, unmeasured: 0 }, limits };
}

export const limitMessage = "Dein MythosAI-Token-Limit ist erreicht. Laufende Aufgaben werden fertig gemacht; neue Aufgaben gehen wieder, sobald das Zeitfenster frei wird.";