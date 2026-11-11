import { aiFetch, aiText } from "../_shared/ai.ts";
import { admitTask, recordUsage, validTaskId, limitInfo } from "../_shared/tokens.ts";
import { usageFromOpenAi, addUsage, type TokenUsage } from "../_shared/usageParse.ts";

// Verbrauch dieser Anfrage (alle Schritte und Helfer zusammen).
let usageAcc: TokenUsage | null = null;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PLUGIN_CATEGORY_PREFIX, searchServerKnowledge } from "../_shared/serverKnowledge.ts";
import { MYTHOS_ABILITIES, MYTHOS_WORK_RULES, relevantCraftKnowledge, wantsLongOutput } from "../_shared/craftKnowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOLS: any[] = [
  {
    type: "function",
    function: {
      name: "read_webpage",
      description: "Lädt eine Webseite und liefert ihren Text (für Details nach einer Web-Suche, Doku-Seiten, Artikel).",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "recall_memory",
      description: "Durchsucht, was du über den User weißt (Erinnerungen aus früheren Chats: Projekte, Vorlieben, Namen).",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_minecraft_server_status",
      description: "Holt den Live-Status von mythoscraft.online: online/offline, Spielerzahl, MOTD, Version.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Sucht in der internen Mythoscraft-Knowledge-Base nach Artikeln (Regeln, Commands, Plugins, FAQ).",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Suchbegriff" } },
        required: ["query"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Sucht im Web nach aktuellen Infos. Nutze für Plugin-Docs, Minecraft-News, allgemeine Recherche.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"], additionalProperties: false,
      },
    },
  },
];

let currentUserId: string | null = null;

async function runTool(name: string, args: any, supabase: any): Promise<string> {
  if (name === "read_webpage") {
    try {
      const url = String(args.url || "");
      if (!/^https?:\/\//i.test(url)) return JSON.stringify({ error: "Ungültige URL" });
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 MythosAI" }, signal: AbortSignal.timeout(15000) });
      const html = await r.text();
      const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
      return JSON.stringify({ url, status: r.status, text: text.slice(0, 12000) });
    } catch { return JSON.stringify({ error: "Seite nicht erreichbar" }); }
  }
  if (name === "recall_memory") {
    if (!currentUserId) return JSON.stringify({ message: "Nicht angemeldet – keine Erinnerungen" });
    const { data } = await supabase.from("user_memories").select("content,category").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(300);
    const words = String(args.query || "").toLowerCase().split(/\W+/).filter((w: string) => w.length > 2);
    const scored = (data || []).map((m: any) => ({ m, score: words.reduce((n: number, w: string) => n + (String(m.content).toLowerCase().includes(w) ? 1 : 0), 0) }))
      .sort((a: any, b: any) => b.score - a.score).slice(0, 12).map((x: any) => x.m);
    return JSON.stringify(scored.length ? scored : { message: "Nichts gespeichert" });
  }
  if (name === "get_minecraft_server_status") {
    try {
      const r = await fetch("https://api.mcsrvstat.us/3/mythoscraft.online");
      const d = await r.json();
      if (!d.online) return JSON.stringify({ online: false, message: "Server ist offline" });
      return JSON.stringify({
        online: true,
        players: { online: d.players?.online ?? 0, max: d.players?.max ?? 0, list: d.players?.list?.map((p: any) => p.name).slice(0, 20) || [] },
        version: d.version,
        motd: d.motd?.clean?.join(" ") || "",
        software: d.software,
      });
    } catch (e) { return JSON.stringify({ error: "Status nicht abrufbar" }); }
  }
  if (name === "search_knowledge_base") {
    const q = (args.query as string).toLowerCase();
    const { data } = await supabase.from("knowledge_articles").select("title,category,body").eq("is_published", true);
    const plugin = searchServerKnowledge(q, 4).map((a) => ({ title: a.title, category: a.category, body: a.body, quelle: "Server-Plugin (verbindlich)" }));
    const db = (data || []).filter((a: any) => !String(a.category || "").startsWith(PLUGIN_CATEGORY_PREFIX))
      .filter((a: any) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
    const matches = [...plugin, ...db].slice(0, 6);
    return JSON.stringify(matches.length ? matches : { message: "Nichts gefunden" });
  }
  if (name === "web_search") {
    try {
      const r = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`, { headers: { "User-Agent": "Mozilla/5.0" } });
      const html = await r.text();
      const results: any[] = [];
      const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([^<]+)/g;
      let m; let i = 0;
      while ((m = re.exec(html)) !== null && i < 5) { results.push({ url: m[1], title: m[2], snippet: m[3].replace(/<[^>]+>/g, "") }); i++; }
      return JSON.stringify(results.length ? results : { message: "Keine Suchergebnisse" });
    } catch { return JSON.stringify({ error: "Web-Suche fehlgeschlagen" }); }
  }
  return JSON.stringify({ error: "Unknown tool" });
}

const MODEL = "google/gemini-3-flash-preview";
const STRONG = "google/gemini-3.1-pro-preview";
const short = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u.slice(0, 40); } };
const toolLabel = (name: string, args: any) =>
  name === "get_minecraft_server_status" ? "Server-Status von Mythoscraft abgefragt"
    : name === "search_knowledge_base" ? `In der Wissensbasis nachgeschaut: „${args.query}“`
    : name === "read_webpage" ? `Seite gelesen: ${short(String(args.url || ""))}`
    : name === "recall_memory" ? `In Erinnerungen gesucht: „${args.query}“`
    : `Im Web gesucht: „${args.query}“`;

/** Ein Agent: ruft Werkzeuge auf, bis er antwortet. Liefert die Antwort (oder "" bei Fehler). */
async function agentLoop(convo: any[], key: string, supabase: any, onTool: (label: string) => void, maxSteps = 8, model = MODEL, onInterim?: (text: string) => void): Promise<string> {
  for (let step = 0; step < maxSteps; step++) {
    // Letzte Runde: keine Werkzeuge mehr, jetzt antworten.
    const last = step === maxSteps - 1;
    const r = await aiFetch("gateway", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: convo, ...(last ? {} : { tools: TOOLS, tool_choice: "auto" }), max_tokens: 24000 }),
    });
    if (!r.ok) throw new Error(r.status === 429 ? "Rate limit erreicht" : r.status === 402 ? "AI-Credits aufgebraucht" : "Fehler beim AI Gateway");
    const j = await r.json();
    usageAcc = addUsage(usageAcc, usageFromOpenAi(j));
    const msg = j.choices?.[0]?.message;
    if (!msg) return "";
    if (msg.tool_calls?.length) {
      // Zwischenstand, den das Modell vor den Werkzeugen schreibt, sofort zeigen (wie bei Claude).
      if (onInterim && typeof msg.content === "string" && msg.content.trim()) onInterim(msg.content.trim());
      convo.push(msg);
      for (const tc of msg.tool_calls) {
        const args = JSON.parse(tc.function.arguments || "{}");
        onTool(toolLabel(tc.function.name, args));
        convo.push({ role: "tool", tool_call_id: tc.id, content: await runTool(tc.function.name, args, supabase) });
      }
      continue;
    }
    return msg.content || "";
  }
  return "";
}

/** Gegenprüfung wie im Review: ein ANDERES Modell sucht echte Fehler; gibt es welche, wird einmal gezielt nachgebessert. */
async function reviewAndRepair(question: string, answer: string, system: string, key: string, step: (label: string) => void): Promise<string> {
  try {
    const verdict = (await aiText({
      model: STRONG, mythos_route: "alt", max_tokens: 1500, temperature: 0.2,
      messages: [
        { role: "system", content: "Du bist ein strenger Prüfer (Senior-Entwickler). Prüfe das ERGEBNIS gegen die ANFRAGE – nur auf ECHTE Fehler: Code, der so nicht läuft (Syntax, nicht definierte Funktionen/Variablen, falsche Bibliotheks-Aufrufe, fehlende Importe oder Dateien), abgeschnittene oder mit Platzhaltern („…“, „Rest bleibt gleich“) gekürzte Dateien, Anforderungen der Anfrage, die fehlen oder falsch umgesetzt sind. Keine Stil- oder Geschmackskritik. Ist alles in Ordnung, antworte exakt: OK. Sonst eine nummerierte Liste (höchstens 6 Punkte): genaue Stelle + was falsch ist + wie es richtig wäre." },
        { role: "user", content: "ANFRAGE:\n" + question.slice(0, 4000) + "\n\nERGEBNIS:\n" + answer },
      ],
    }, key)).trim();
    if (!verdict || verdict.length < 15 || /^(ok\b|alles (ok|in ordnung))/i.test(verdict)) { step("Gegenprüfung durch zweites Modell bestanden"); return answer; }
    step("Gegenprüfung hat etwas gefunden – wird behoben");
    const fixed = await aiText({
      model: STRONG, mythos_tier: "strong", max_tokens: 24000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
        { role: "assistant", content: answer },
        { role: "user", content: "Ein Prüfer hat diese Punkte gemeldet:\n" + verdict.slice(0, 3000) + "\n\nPrüfe jeden Punkt selbst am Code. Behebe alle, die stimmen, und gib dann die VOLLSTÄNDIGE korrigierte Antwort aus (jede Datei komplett, nichts kürzen, den Prüfer nicht erwähnen). Stimmt kein Punkt, gib deine Antwort unverändert aus." },
      ],
    }, key);
    // Nie eine verstümmelte Fassung übernehmen.
    return fixed && fixed.length > answer.length * 0.7 ? fixed : answer;
  } catch { return answer; }
}

/** Helfer wie bei Claude: Aufgabe in unabhängige Teile zerlegen.
 *  kind "research": Teile recherchieren parallel, danach fasst Mythos zusammen.
 *  kind "build": viele/gleichartige Ergebnisse (z. B. 5 Modelle, mehrere Seiten) – jeder Helfer baut seins komplett. */
async function planSubtasks(question: string, key: string): Promise<{ kind: "single" | "research" | "build"; subtasks: { title: string; task: string }[] }> {
  const r = await aiFetch("gateway", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{
        role: "user",
        content: "Entscheide, ob die Anfrage auf parallele Helfer aufgeteilt werden sollte.\n" +
          "- \"single\": eine zusammenhängende Aufgabe (auch große Einzel-Dateien, Smalltalk, eine Frage).\n" +
          "- \"research\": mehrere UNABHÄNGIGE Recherche-Teile (2–4), die parallel gesucht werden können.\n" +
          "- \"build\": mehrere gleichartige oder unabhängige Ergebnisse, die einzeln gebaut werden müssen (z. B. „5 Hüte als .bbmodel“, „je eine Seite für A, B, C“) – ein Helfer pro Ergebnis (2–5).\n" +
          'Antworte NUR mit JSON: {"kind":"single|research|build","subtasks":[{"title":"kurz","task":"genaue, eigenständige Aufgabe inkl. aller nötigen Infos aus der Anfrage"}]}\n\nANFRAGE:\n' + question,
      }],
    }),
  });
  if (!r.ok) return { kind: "single", subtasks: [] };
  const text = (await r.json()).choices?.[0]?.message?.content || "";
  try {
    const j = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const subtasks = Array.isArray(j.subtasks) ? j.subtasks.filter((s: any) => s?.task).slice(0, 5) : [];
    const kind = j.kind === "build" || j.kind === "research" ? j.kind : "single";
    return { kind: subtasks.length >= 2 ? kind : "single", subtasks };
  } catch { return { kind: "single", subtasks: [] }; }
}

const lastUserText = (messages: any[]) => {
  const m = [...messages].reverse().find((x) => x.role === "user");
  if (!m) return "";
  return typeof m.content === "string" ? m.content : (m.content || []).map((p: any) => p.text || "").join(" ");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const sendEvent = (obj: any) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const sendDelta = (text: string) => sendEvent({ choices: [{ delta: { content: text } }] });
      const streamText = async (text: string) => {
        for (let i = 0; i < text.length; i += 80) { sendDelta(text.slice(i, i + 80)); await new Promise((r) => setTimeout(r, 6)); }
      };

      try {
        const { messages, taskId: requestedTaskId } = await req.json();
        usageAcc = null;
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        // Wer fragt? (für recall_memory)
        try {
          const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
          const { data: u } = await supabase.auth.getUser(jwt);
          currentUserId = u?.user?.id || null;
        } catch { currentUserId = null; }
        const step = (label: string) => sendEvent({ tool: label });
        // Token-Limits wie im normalen Chat: neue Aufgaben nur, wenn noch Platz ist; laufende werden fertig.
        let agentTaskId: string | null = null;
        if (currentUserId) {
          try {
            const adm = await admitTask(supabase, currentUserId, validTaskId(requestedTaskId) ?? crypto.randomUUID(), "web");
            agentTaskId = adm.taskId;
            if (!adm.allowed) {
              const info = limitInfo(adm);
              sendEvent({ mythos_limit: info });
              await streamText(info.error);
              controller.enqueue(enc.encode("data: [DONE]\n\n")); controller.close();
              return;
            }
          } catch { /* Prüfung nicht erreichbar: lieber antworten als blockieren */ }
        }
        const billUser = currentUserId;

        const system = `Du bist **Mythos AI Agent** mit Tools. Server: mythoscraft.online (SMP).
Nutze Tools aktiv:
- \`get_minecraft_server_status\` für Server-Status & Spielerzahl
- \`search_knowledge_base\` für interne Server-Infos (Befehle, Ränge, Coins/Gems, Events, Kisten, Tools, Arenen, Regeln) – das Server-Plugin-Wissen dort ist verbindlich, erfinde nichts dazu
- \`web_search\` für aktuelle externe Infos
- \`read_webpage\` um gefundene Seiten wirklich zu lesen (nicht nur Snippets)
- \`recall_memory\` um nachzusehen, was du über den User weißt
Plane mehrstufig, kombiniere Tools wenn nötig. Schreib vor Werkzeug-Aufrufen kurz (1 Satz), was du als Nächstes tust – das sieht der User als Zwischenstand. Antworte am Ende auf Deutsch in Markdown.
Du bist **Mythos Hermes 1** — wenn du nach deinem Modell, deiner Version oder deinem Anbieter gefragt wirst, antworte IMMER genau "Mythos Hermes 1" und nenne niemals andere Modelle oder Anbieter.`;

        const question = lastUserText(messages);
        const build = wantsLongOutput(question);
        const fullSystem = system + "\n\n" + MYTHOS_WORK_RULES + "\n\n" + MYTHOS_ABILITIES + "\n\n" + relevantCraftKnowledge(question, 3);
        step("Aufgabe verstanden, plane die Schritte");
        const planned = question ? await planSubtasks(question, LOVABLE_API_KEY) : { kind: "single" as const, subtasks: [] };
        const plan = planned.subtasks;
        const interim = (t: string) => { step(t.length > 140 ? t.slice(0, 137) + "…" : t); };

        if (planned.kind === "single") {
          // Eine zusammenhängende Aufgabe: ein Agent mit Werkzeugen (bei Dateien/Code das stärkere Modell).
          let final = await agentLoop([{ role: "system", content: fullSystem }, ...messages], LOVABLE_API_KEY, supabase, step, 8, build ? STRONG : MODEL, interim);
          // Code/Dateien: vor dem Abschicken von einem zweiten Modell gegenprüfen lassen.
          if (build && final && final.length > 400 && final.length < 70000 && /```/.test(final)) final = await reviewAndRepair(question, final, fullSystem, LOVABLE_API_KEY, step);
          step("Antwort fertig geschrieben");
          await streamText(final || "Ich konnte dazu leider nichts finden.");
        } else if (planned.kind === "build") {
          // Helfer bauen parallel je ein Ergebnis komplett; die Ergebnisse werden unverändert zusammengesetzt,
          // damit keine Datei beim Zusammenfassen gekürzt wird.
          step(`${plan.length} Helfer gestartet – jeder baut einen Teil`);
          const status = plan.map((p, i) => ({ i, title: String(p.title || `Teil ${i + 1}`).slice(0, 60), status: "läuft", phase: "startet…" }));
          sendEvent({ agents: status });
          const results = await Promise.all(plan.map(async (p, i) => {
            const sub = [
              { role: "system", content: fullSystem + "\n\nDu bist Helfer " + (i + 1) + " von " + plan.length + ". Baue NUR dein Ergebnis – vollständig, detailreich, mit Datei-Block am Ende. Keine Einleitung, keine Zusammenfassung der anderen Teile." },
              { role: "user", content: "Gesamtanfrage: " + question + "\n\nDein Teil: " + p.task },
            ];
            try {
              const text = await agentLoop(sub, LOVABLE_API_KEY, supabase, (label) => { status[i].phase = label; sendEvent({ agents: status }); }, 4, STRONG);
              status[i].status = "fertig"; status[i].phase = "";
              sendEvent({ agents: status });
              step(`Helfer ${i + 1} fertig: ${status[i].title}`);
              return text;
            } catch (e) {
              status[i].status = "fehler"; status[i].phase = e instanceof Error ? e.message : "Fehler";
              sendEvent({ agents: status });
              return "";
            }
          }));
          step("Ergebnisse zusammengesetzt");
          const intro = `Ich habe die Aufgabe auf ${plan.length} Helfer aufgeteilt – hier sind alle Ergebnisse:\n\n`;
          await streamText(intro + plan.map((p, i) => `### ${status[i].title}\n\n${results[i] || "_(Dieser Helfer konnte nichts liefern – frag einfach nochmal danach.)_"}`).join("\n\n---\n\n"));
        } else {
          // Recherche: Helfer suchen parallel, danach fasst der Haupt-Agent zusammen.
          step(`${plan.length} Helfer recherchieren parallel`);
          const status = plan.map((p, i) => ({ i, title: String(p.title || `Teil ${i + 1}`).slice(0, 60), status: "läuft", phase: "startet…" }));
          sendEvent({ agents: status });
          const results = await Promise.all(plan.map(async (p, i) => {
            const sub = [
              { role: "system", content: fullSystem + "\n\nDu bist Helfer " + (i + 1) + " von " + plan.length + ". Bearbeite NUR deine Teilaufgabe und antworte knapp mit den gefundenen Fakten und Quellen." },
              { role: "user", content: "Gesamtanfrage: " + question + "\n\nDeine Teilaufgabe: " + p.task },
            ];
            try {
              const text = await agentLoop(sub, LOVABLE_API_KEY, supabase, (label) => { status[i].phase = label; sendEvent({ agents: status }); }, 5);
              status[i].status = "fertig"; status[i].phase = "";
              sendEvent({ agents: status });
              return text;
            } catch (e) {
              status[i].status = "fehler"; status[i].phase = e instanceof Error ? e.message : "Fehler";
              sendEvent({ agents: status });
              return "";
            }
          }));
          const r = await aiFetch("gateway", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: MODEL,
              messages: [
                { role: "system", content: fullSystem },
                ...messages,
                { role: "user", content: "Ergebnisse deiner parallelen Teil-Agenten:\n\n" + plan.map((p, i) => `### ${status[i].title}\n${results[i] || "(kein Ergebnis)"}`).join("\n\n") +
                  "\n\nFasse das jetzt zu EINER vollständigen, gut strukturierten Antwort auf die ursprüngliche Anfrage zusammen (Markdown, Deutsch)." },
              ],
            }),
          });
          const final = r.ok ? (await r.json()).choices?.[0]?.message?.content || "" : "";
          step("Ergebnisse der Helfer zusammengefasst");
          await streamText(final || results.filter(Boolean).join("\n\n") || "⚠️ Die Agenten konnten keine Antwort liefern.");
        }

        if (billUser) await recordUsage(supabase, { userId: billUser, taskId: agentTaskId, source: "web", model: "agent", usage: usageAcc });
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (e) {
        console.error("agent error:", e);
        sendDelta("\n\n⚠️ Agent-Fehler: " + (e instanceof Error ? e.message : "unbekannt"));
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
});
