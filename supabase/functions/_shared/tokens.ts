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

export async function admitTask(db: any, userId: string, taskId: string, source: string) {
  const tier = await tierOf(db, userId);
  const { data, error } = await db.rpc("mythos_admit_task", { _user_id: userId, _task_id: taskId, _source: source, _tier: tier });
  if (error) { console.error("[tokens] admit failed", error.message); return { allowed: true, tier, degraded: true }; }
  return { ...(data as Record<string, unknown>), tier };
}

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
  for (const r of lim ?? []) { const k = String(r.key).split("_").pop()!; const n = Number(r.value); if (k in limits && r.value && Number.isFinite(n)) limits[k] = n; }
  return { tier, usage: data ?? { hour: 0, week: 0, month: 0, unmeasured: 0 }, limits };
}

export const limitMessage = "Dein MythosAI-Token-Limit ist erreicht. Laufende Aufgaben werden fertig gemacht; neue Aufgaben gehen wieder, sobald das Zeitfenster frei wird.";