// Veröffentlichte Apps unter /build/<name> – gemeinsam für App-Builder (labs) und Code-App/CLI (cli-auth).
// Gespeichert im privaten Storage-Bucket „mythos-labs“ (Migrationen über GitHub laufen in Lovable Cloud nicht).
export type AppEntry = { slug: string; title: string; html: string; user_id: string; author: string; project_id?: string; created_at: string; updated_at: string };
export type MyApp = { slug: string; title: string; project_id?: string; updated_at: string };
const BUCKET = "mythos-labs";
const RESERVED = new Set(["new", "neu", "app", "apps", "admin", "api", "build", "login", "auth", "mythos", "www", "index", "null", "undefined", "s", "galerie", "settings", "edit", "share", "public", "assets", "static"]);
export const cleanSlug = (v: unknown) => String(v ?? "").trim().toLowerCase();
export function slugProblem(slug: string): string | null {
  if (slug.length < 3) return "Mindestens 3 Zeichen";
  if (slug.length > 40) return "Höchstens 40 Zeichen";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "Nur Kleinbuchstaben, Zahlen und Bindestriche (kein Bindestrich am Anfang/Ende)";
  if (RESERVED.has(slug)) return "Dieser Name ist reserviert";
  return null;
}
export const appPath = (slug: string) => `apps/${slug}.json`;
export const myAppsPath = (uid: string) => `apps-by-user/${uid}.json`;

let ready = false;
async function bucket(admin: any) {
  if (!ready) { const { error } = await admin.storage.createBucket(BUCKET, { public: false }); if (error && !/exist/i.test(error.message)) console.warn("[apps] createBucket", error.message); ready = true; }
  return admin.storage.from(BUCKET);
}
export async function getJson<T>(admin: any, path: string): Promise<T | null> {
  const { data, error } = await (await bucket(admin)).download(path);
  if (error || !data) return null;
  try { return JSON.parse(await data.text()) as T; } catch { return null; }
}
export async function putJson(admin: any, path: string, value: unknown) {
  const { error } = await (await bucket(admin)).upload(path, new Blob([JSON.stringify(value)], { type: "application/json" }), { upsert: true, contentType: "application/json" });
  if (error) throw new Error(error.message);
}

/** Veröffentlichen/aktualisieren. Gibt { ok, slug } oder { error, status } zurück. */
export async function publishApp(admin: any, user: { id: string; email?: string | null }, o: { slug: unknown; title?: unknown; html: unknown; author?: unknown; project_id?: unknown }) {
  const slug = cleanSlug(o.slug);
  const problem = slugProblem(slug);
  if (problem) return { error: problem, status: 400 };
  const html = String(o.html || "");
  if (html.length < 50 || html.length > 1_500_000) return { error: "Die App ist leer oder zu groß (max. 1,5 MB).", status: 400 };
  const existing = await getJson<AppEntry>(admin, appPath(slug));
  if (existing && existing.user_id !== user.id) return { error: "Dieser Name ist schon vergeben.", status: 409 };
  const mine = (await getJson<MyApp[]>(admin, myAppsPath(user.id))) || [];
  if (!existing && mine.length >= 50) return { error: "Du hast schon 50 veröffentlichte Apps. Nimm zuerst eine offline.", status: 400 };
  const nowIso = new Date().toISOString();
  const title = String(o.title || slug).trim().slice(0, 80);
  const entry: AppEntry = { slug, title, html, user_id: user.id, author: String(o.author || user.email?.split("@")[0] || "Mythos-Nutzer").slice(0, 40), project_id: o.project_id ? String(o.project_id).slice(0, 60) : existing?.project_id, created_at: existing?.created_at || nowIso, updated_at: nowIso };
  await putJson(admin, appPath(slug), entry);
  // Kurz danach nochmal lesen: haben zwei gleichzeitig denselben Namen genommen, gewinnt der, der drinsteht.
  const check = await getJson<AppEntry>(admin, appPath(slug));
  if (check && check.user_id !== user.id) return { error: "Dieser Name wurde gerade vergeben.", status: 409 };
  await putJson(admin, myAppsPath(user.id), [{ slug, title, project_id: entry.project_id, updated_at: nowIso }, ...mine.filter((m) => m.slug !== slug)].slice(0, 60));
  return { ok: true, slug, updated_at: nowIso, existed: !!existing };
}
