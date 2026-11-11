// Mythos Labs: Backend für Live-Arena, Foto zu App, KI-Team, Tagesrückblick und Mythos-Marktplatz.
// Gespeichert wird (wie bei "remote") in einem privaten Storage-Bucket statt in eigenen Tabellen,
// weil Migrationen, die über GitHub kommen, in Lovable Cloud nicht ausgeführt werden.
// POST { kind, ... }
import { createClient } from "npm:@supabase/supabase-js@2.103.3";
import { aiChat } from "../_shared/ai.ts";
import { relevantCraftKnowledge } from "../_shared/craftKnowledge.ts";
import { generateImage } from "../_shared/image.ts";
import { webSearch, readPage, safeUrl, commonsMedia, pexelsMedia, type Media } from "../_shared/web.ts";
import { publishApp } from "../_shared/apps.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUCKET = "mythos-labs";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const { error } = await admin.storage.createBucket(BUCKET, { public: false });
  if (error && !/exist/i.test(error.message)) console.warn("[labs] createBucket", error.message);
  bucketReady = true;
}
async function get<T>(path: string): Promise<T | null> {
  await ensureBucket();
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  try { return JSON.parse(await data.text()) as T; } catch { return null; }
}
async function put(path: string, value: unknown) {
  await ensureBucket();
  const { error } = await admin.storage.from(BUCKET).upload(path, new Blob([JSON.stringify(value)], { type: "application/json" }), { upsert: true, contentType: "application/json" });
  if (error) throw new Error(error.message);
}

// Modelle, die in der Arena gegeneinander antreten (und die "ask" erlaubt).
const ARENA_MODELS: Record<string, string> = {
  "google/gemini-3.6-flash": "Gemini 3.6 Flash",
  "google/gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "openai/gpt-5.4-mini": "GPT-5.4 Mini",
  "openai/gpt-5.6-luna": "GPT-5.6 Luna",
};
const ASK_MODELS = new Set([...Object.keys(ARENA_MODELS), "google/gemini-3.1-pro-preview", "openai/gpt-5.4", "openai/gpt-5.5"]);
const DEFAULT_MODEL = "google/gemini-3.6-flash";

type Votes = Record<string, { wins: number; losses: number; ties: number }>;
type MarketEntry = {
  id: string; user_id: string; author: string; type: "app" | "image"; title: string; description: string;
  image_url?: string; likes: string[]; copies: number; created_at: string;
};
type MarketItem = MarketEntry & { html?: string; prompt?: string };
const INDEX = "market/index.json";
const itemPath = (id: string) => `market/items/${id}.json`;
const ID_RE = /^[0-9a-f-]{36}$/;

async function ask(body: any): Promise<string> {
  const model = ASK_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  if (!messages.length) throw new Error("Keine Nachricht");
  // App-Bau (Foto zu App, KI-Team, Cloud-PC): Bau-Wissen dazugeben und das stärkste verfügbare Modell nehmen.
  const sys = typeof body.system === "string" ? body.system.slice(0, 12000) : "";
  const lastUser = [...messages].reverse().find((m: any) => m?.role === "user");
  const lastText = typeof lastUser?.content === "string" ? lastUser.content : Array.isArray(lastUser?.content) ? lastUser.content.map((p: any) => p?.text || "").join(" ") : "";
  const building = /<!DOCTYPE html>|HTML-Dokument|lauffähig|\bApp\b/i.test(sys);
  const craft = building && !body.json ? relevantCraftKnowledge("app html " + lastText.slice(0, 2000), 3) : "";
  const out = [...(sys ? [{ role: "system", content: sys + (craft ? "\n\n" + craft : "") }] : []), ...messages];
  const r = await aiChat({ model, messages: out, stream: false, ...(building ? { mythos_tier: "strong", mythos_max_tokens: 16000 } : {}), ...(body.json ? { response_format: { type: "json_object" } } : {}) });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(r.status === 429 ? "Gerade zu viele Anfragen, bitte kurz warten." : r.status === 402 ? "KI-Guthaben ist leer." : "KI nicht erreichbar: " + t.slice(0, 160));
  }
  const j = await r.json().catch(() => null);
  return j?.choices?.[0]?.message?.content ?? "";
}

// ---------- App-Builder: veröffentlichte Apps unter /build/<name> ----------
type AppEntry = { slug: string; title: string; html: string; user_id: string; author: string; project_id?: string; created_at: string; updated_at: string };
const RESERVED = new Set(["new", "neu", "app", "apps", "admin", "api", "build", "login", "auth", "mythos", "www", "index", "null", "undefined", "s", "galerie", "settings", "edit", "share", "public", "assets", "static"]);
const cleanSlug = (v: unknown) => String(v ?? "").trim().toLowerCase();
function slugProblem(slug: string): string | null {
  if (slug.length < 3) return "Mindestens 3 Zeichen";
  if (slug.length > 40) return "Höchstens 40 Zeichen";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "Nur Kleinbuchstaben, Zahlen und Bindestriche (kein Bindestrich am Anfang/Ende)";
  if (RESERVED.has(slug)) return "Dieser Name ist reserviert";
  return null;
}
const appPath = (slug: string) => `apps/${slug}.json`;
const myAppsPath = (uid: string) => `apps-by-user/${uid}.json`;
type MyApp = { slug: string; title: string; project_id?: string; updated_at: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || "");

    // Angemeldeter Nutzer (für alles, was KI kostet oder etwas speichert).
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const user = auth?.user ?? null;

    // Öffentlich lesbar: Marktplatz-Liste und Arena-Rangliste.
    if (kind === "market_list") {
      const list = (await get<MarketEntry[]>(INDEX)) || [];
      return json({ items: list.map((e) => ({ ...e, likes: e.likes.length, liked: !!user && e.likes.includes(user.id), mine: !!user && e.user_id === user.id })) });
    }
    // Öffentlich: geteiltes Ergebnis per Link ansehen (ohne Login).
    if (kind === "share_get") {
      const id = String(body.id || "");
      if (!/^[a-z0-9]{6,16}$/.test(id)) return json({ error: "Unbekannter Link" }, 400);
      const item = await get<Record<string, unknown>>(`shares/${id}.json`);
      if (!item) return json({ error: "Dieser Link existiert nicht (mehr)." }, 404);
      return json({ item });
    }
    // Öffentlich: veröffentlichte App ansehen (ohne Login).
    if (kind === "app_get") {
      const slug = cleanSlug(body.slug);
      if (slugProblem(slug)) return json({ error: "Diese App gibt es nicht." }, 404);
      const app = await get<AppEntry>(appPath(slug));
      if (!app) return json({ error: "Diese App gibt es nicht (mehr)." }, 404);
      return json({ item: { slug: app.slug, title: app.title, html: app.html, author: app.author, updated_at: app.updated_at } });
    }
    if (kind === "arena_board") {
      const votes = (await get<Votes>("arena/votes.json")) || {};
      return json({ board: Object.entries(ARENA_MODELS).map(([id, label]) => ({ id, label, ...(votes[id] || { wins: 0, losses: 0, ties: 0 }) })) });
    }

    if (!user) return json({ error: "Bitte zuerst anmelden." }, 401);

    if (kind === "ask") return json({ text: await ask(body) });

    if (kind === "image") {
      const prompt = String(body.prompt || "").slice(0, 900);
      if (!prompt) return json({ error: "Kein Bild-Wunsch" }, 400);
      const r = await generateImage(prompt);
      return r.url ? json({ url: r.url }) : json({ error: "Bild konnte nicht erzeugt werden" }, 502);
    }

    if (kind === "arena_fight") {
      const prompt = String(body.prompt || "").slice(0, 4000);
      if (!prompt) return json({ error: "Keine Aufgabe" }, 400);
      const ids = Object.keys(ARENA_MODELS).sort(() => Math.random() - 0.5).slice(0, 2);
      const system = "Du bist ein hilfreicher KI-Assistent. Antworte in der Sprache des Nutzers (Standard Deutsch), klar und mit Markdown. Nenne niemals deinen Modellnamen oder Anbieter.";
      const answers = await Promise.all(ids.map((model) =>
        ask({ model, system, messages: [{ role: "user", content: prompt }] }).catch((e) => "⚠️ " + (e instanceof Error ? e.message : String(e)))));
      return json({ a: { id: ids[0], label: ARENA_MODELS[ids[0]], text: answers[0] }, b: { id: ids[1], label: ARENA_MODELS[ids[1]], text: answers[1] } });
    }

    if (kind === "arena_vote") {
      const a = String(body.a || ""), b = String(body.b || ""), winner = String(body.winner || "");
      if (!ARENA_MODELS[a] || !ARENA_MODELS[b] || a === b || !["a", "b", "tie"].includes(winner)) return json({ error: "Ungültige Abstimmung" }, 400);
      const votes = (await get<Votes>("arena/votes.json")) || {};
      for (const id of [a, b]) votes[id] = votes[id] || { wins: 0, losses: 0, ties: 0 };
      if (winner === "tie") { votes[a].ties++; votes[b].ties++; }
      else { const w = winner === "a" ? a : b, l = winner === "a" ? b : a; votes[w].wins++; votes[l].losses++; }
      await put("arena/votes.json", votes);
      return json({ ok: true });
    }

    // ---------- App-Builder ----------
    if (kind === "app_check") {
      const slug = cleanSlug(body.slug);
      const problem = slugProblem(slug);
      if (problem) return json({ free: false, reason: problem });
      const app = await get<AppEntry>(appPath(slug));
      if (!app) return json({ free: true });
      return app.user_id === user.id ? json({ free: true, mine: true, title: app.title }) : json({ free: false, reason: "Schon vergeben" });
    }
    if (kind === "app_publish") {
      const r = await publishApp(admin, user, { slug: body.slug, title: body.title, html: body.html, author: body.author, project_id: body.project_id });
      return "error" in r ? json({ error: r.error }, r.status) : json({ ok: true, slug: r.slug, updated_at: r.updated_at });
    }
    if (kind === "app_unpublish") {
      const slug = cleanSlug(body.slug);
      const app = slugProblem(slug) ? null : await get<AppEntry>(appPath(slug));
      if (!app || app.user_id !== user.id) return json({ error: "Diese App gehört dir nicht." }, 403);
      await admin.storage.from(BUCKET).remove([appPath(slug)]);
      const mine = (await get<MyApp[]>(myAppsPath(user.id))) || [];
      await put(myAppsPath(user.id), mine.filter((m) => m.slug !== slug));
      return json({ ok: true });
    }
    if (kind === "app_mine") return json({ items: (await get<MyApp[]>(myAppsPath(user.id))) || [] });
    // Projekte des Builders im Konto sichern (auf jedem Gerät verfügbar).
    if (kind === "builder_save") {
      const projects = Array.isArray(body.projects) ? body.projects.slice(0, 30) : null;
      if (!projects) return json({ error: "projects fehlt" }, 400);
      const text = JSON.stringify(projects);
      if (text.length > 6_000_000) return json({ error: "Zu viele/zu große Projekte – lösche alte." }, 413);
      await put(`builder/${user.id}.json`, { saved_at: new Date().toISOString(), projects });
      return json({ ok: true });
    }
    if (kind === "builder_load") {
      const d = await get<{ saved_at: string; projects: unknown[] }>(`builder/${user.id}.json`);
      return json({ projects: d?.projects || [], saved_at: d?.saved_at || null });
    }
    // Im Internet nachsehen: suchen und die besten Seiten lesen (für aktuelle Infos, echte Inhalte, Bild-Adressen).
    if (kind === "web_research") {
      const query = String(body.query || "").trim().slice(0, 200);
      const urls = (Array.isArray(body.urls) ? body.urls : []).map((u: unknown) => safeUrl(String(u))).filter(Boolean).slice(0, 3) as string[];
      const hits = query ? await webSearch(query, 5) : [];
      const toRead = [...urls, ...hits.map((h) => h.url)].filter((u, i, a) => a.indexOf(u) === i).slice(0, urls.length ? Math.max(urls.length, 3) : 3);
      const pages = (await Promise.all(toRead.map((u) => readPage(u, urls.includes(u) ? 9000 : 4000)))).filter(Boolean);
      return json({ hits, pages });
    }

    // Admin: Pexels-Schlüssel für bessere Stock-Fotos/-Videos hinterlegen (kostenlos auf pexels.com/api).
    if (kind === "media_key_set") {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      if (!roles?.some((r: { role: string }) => r.role === "admin")) return json({ error: "Nur für Admins." }, 403);
      const value = String(body.key || "").trim();
      if (value && value.length < 20) return json({ error: "Das sieht nicht nach einem Pexels-Schlüssel aus." }, 400);
      if (value) { const t = await pexelsMedia("bakery", "image", value, 1); if (!t.length) return json({ error: "Pexels hat den Schlüssel nicht angenommen." }, 400); }
      const { error } = await admin.from("app_secrets").upsert({ name: "PEXELS_API_KEY", value });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, active: !!value });
    }
    // Passende freie Fotos/Videos zum Thema finden (statt dass die KI Adressen aus dem Gedächtnis rät).
    if (kind === "media_search") {
      const prompt = String(body.prompt || "").slice(0, 600);
      const want = (Array.isArray(body.want) ? body.want : ["image"]).filter((t: unknown) => t === "image" || t === "video") as ("image" | "video")[];
      if (!prompt || !want.length) return json({ items: [], queries: [] });
      // Suchbegriffe auf Englisch aus dem Wunsch ableiten (die Bild-Datenbanken sind englisch verschlagwortet).
      let queries: string[] = [];
      try {
        const r = await aiChat({ model: "google/gemini-3.1-flash-lite", stream: false, response_format: { type: "json_object" }, max_tokens: 200, messages: [
          { role: "system", content: 'Der Nutzer baut eine Website/App und braucht passende Stock-Fotos oder -Videos. Gib JSON zurück: {"queries":["…","…","…"]} – drei kurze ENGLISCHE Suchbegriffe (je 1–3 Wörter), die genau das zeigen, worum es geht (Motiv, nicht die Website). Beispiel Bäckerei: ["bakery","baking bread","baker dough"]. Keine anderen Themen.' },
          { role: "user", content: prompt }] });
        const j = JSON.parse((await r.json())?.choices?.[0]?.message?.content || "{}");
        queries = (Array.isArray(j.queries) ? j.queries : []).map((q: unknown) => String(q).replace(/[^\w\s-]/g, "").trim().slice(0, 40)).filter(Boolean).slice(0, 3);
      } catch { /* unten: Rückfall */ }
      if (!queries.length && typeof body.fallback === "string") queries = [body.fallback.slice(0, 40)];
      if (!queries.length) return json({ items: [], queries: [] });
      let pexels = Deno.env.get("PEXELS_API_KEY") || "";
      if (!pexels) { try { const { data } = await admin.from("app_secrets").select("value").eq("name", "PEXELS_API_KEY").maybeSingle(); pexels = data?.value || ""; } catch { /* ohne */ } }
      const items: Media[] = [];
      for (const type of want) {
        const per = type === "video" ? 4 : 8;
        const lists = await Promise.all(queries.map((q) => (pexels ? pexelsMedia(q, type, pexels, per) : Promise.resolve([] as Media[])).then((a) => (a.length ? a : commonsMedia(q, type, per)))));
        // Reihum aus jeder Suche nehmen, damit die Auswahl abwechslungsreich ist.
        const seen = new Set<string>();
        for (let i = 0; i < per && [...seen].length < per; i++) for (const l of lists) { const m = l[i]; if (m && !seen.has(m.url) && seen.size < per) { seen.add(m.url); items.push(m); } }
      }
      return json({ items, queries });
    }
    if (kind === "share_create") {
      const fileName = String(body.name || "ergebnis.html").slice(0, 120);
      const content = String(body.content || "");
      const title = String(body.title || fileName).trim().slice(0, 80);
      if (content.length < 10 || content.length > 600_000) return json({ error: "Inhalt ist leer oder zu groß" }, 400);
      const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
      const author = String(body.author || user.email?.split("@")[0] || "Mythos-Nutzer").slice(0, 40);
      const prompt = String(body.prompt || "").slice(0, 1000);
      await put(`shares/${id}.json`, { id, name: fileName, title, content, prompt, author, user_id: user.id, created_at: new Date().toISOString() });
      // Optional zusätzlich in die öffentliche Galerie (Marktplatz)
      if (body.gallery && /\.(html?|svg)$/i.test(fileName)) {
        const html = /\.svg$/i.test(fileName) ? `<!doctype html><meta name=viewport content="width=device-width"><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0b0d12">${content}</body>` : content;
        const entry: MarketEntry = { id: crypto.randomUUID(), user_id: user.id, type: "app", title, author, description: prompt.slice(0, 300), likes: [], copies: 0, created_at: new Date().toISOString() };
        await put(itemPath(entry.id), { ...entry, html, prompt });
        const list = (await get<MarketEntry[]>(INDEX)) || [];
        await put(INDEX, [entry, ...list].slice(0, 500));
      }
      return json({ ok: true, id });
    }

    if (kind === "market_publish") {
      const type = body.type === "image" ? "image" : "app";
      const title = String(body.title || "").trim().slice(0, 80);
      const html = type === "app" ? String(body.html || "") : "";
      const image_url = type === "image" ? String(body.image_url || "") : "";
      if (!title) return json({ error: "Titel fehlt" }, 400);
      if (type === "app" && (html.length < 50 || html.length > 400_000)) return json({ error: "App ist leer oder zu groß" }, 400);
      if (type === "image" && !/^https:\/\//i.test(image_url)) return json({ error: "Bild-Link fehlt" }, 400);
      const entry: MarketEntry = {
        id: crypto.randomUUID(), user_id: user.id, type, title,
        author: String(body.author || user.email?.split("@")[0] || "Mythos-Nutzer").slice(0, 40),
        description: String(body.description || "").slice(0, 300),
        ...(image_url ? { image_url } : {}), likes: [], copies: 0, created_at: new Date().toISOString(),
      };
      await put(itemPath(entry.id), { ...entry, html, prompt: String(body.prompt || "").slice(0, 1000) });
      const list = (await get<MarketEntry[]>(INDEX)) || [];
      await put(INDEX, [entry, ...list].slice(0, 500));
      return json({ ok: true, id: entry.id });
    }

    if (kind === "market_get" || kind === "market_like" || kind === "market_take" || kind === "market_delete") {
      const id = String(body.id || "");
      if (!ID_RE.test(id)) return json({ error: "Unbekannter Eintrag" }, 400);
      const list = (await get<MarketEntry[]>(INDEX)) || [];
      const i = list.findIndex((e) => e.id === id);
      if (i < 0) return json({ error: "Nicht mehr im Marktplatz" }, 404);
      const e = list[i];
      if (kind === "market_get") {
        const item = await get<MarketItem>(itemPath(id));
        return json({ item: item ? { ...item, likes: item.likes.length } : null });
      }
      if (kind === "market_like") {
        e.likes = e.likes.includes(user.id) ? e.likes.filter((u) => u !== user.id) : [...e.likes, user.id];
      } else if (kind === "market_take") {
        e.copies++;
      } else {
        if (e.user_id !== user.id) return json({ error: "Nur eigene Einträge löschen" }, 403);
        list.splice(i, 1);
        await admin.storage.from(BUCKET).remove([itemPath(id)]);
      }
      await put(INDEX, list);
      const item = kind === "market_take" ? await get<MarketItem>(itemPath(id)) : null;
      return json({ ok: true, likes: e.likes.length, liked: e.likes.includes(user.id), item });
    }

    return json({ error: "Unbekannte Aktion" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
