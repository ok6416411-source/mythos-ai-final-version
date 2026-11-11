import { aiFetch } from "../_shared/ai.ts";
import { resolveModelId, familyLabel, EFFORTS as CATALOG_EFFORTS } from "../_shared/modelCatalog.ts";
import { explainErrors, generateImage, PROVIDER_LABEL } from "../_shared/image.ts";
import { classifyImageRequest, isImageRequest, maybeImageRequest, resolveImagePrompt } from "../_shared/imageIntent.ts";
import { mythosIdentity, mythosIdentityReminder } from "../_shared/identity.ts";
import { MYTHOS_CATALOG, MYTHOS_FILES } from "../_shared/catalog.ts";
import { CRAFT_CATEGORY_PREFIX, abilities, learnedRules, relevantCraftKnowledge, wantsLongOutput, workRules, type CraftOverrides } from "../_shared/craftKnowledge.ts";
import { PLUGIN_CATEGORY_PREFIX, formatServerArticles, isServerQuestion, relevantServerArticles, serverKnowledgeText } from "../_shared/serverKnowledge.ts";
import { createClient } from "npm:@supabase/supabase-js@2.103.3";
import { tierOf as planTierOf, admitTask, recordUsage, validTaskId, limitInfo, LIMIT_HEADERS } from "../_shared/tokens.ts";
import { forwardUsageStream } from "../_shared/usageStream.ts";
import { prepareVideos } from "../_shared/video.ts";
import type { TokenUsage } from "../_shared/usageParse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const enc = new TextEncoder();
const sse = (obj: unknown) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
const sseDone = () => enc.encode("data: [DONE]\n\n");

async function webResearch(query: string, apiKey: string): Promise<string> {
  // Use Lovable AI with google_search tool for grounded research
  const r = await aiFetch("gateway", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Du bist ein Recherche-Agent. Suche im Web, vergleiche Quellen, liefere strukturierte Antwort mit Markdown-Überschriften und Bullet-Points. Nenne Quellen als Links am Ende." },
        { role: "user", content: query },
      ],
      tools: [{ type: "function", function: { name: "google_search", description: "Search the web", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } }],
    }),
  });
  if (!r.ok) return `Recherche fehlgeschlagen (${r.status}).`;
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "Keine Antwort.";
}

// ============== MYTHOS MODEL CATALOG ==============
// Identität kommt zentral aus _shared/identity.ts
type Tune = {
  model: string;
  reasoning?: "none" | "low" | "medium" | "high";
  fast?: boolean;      // OpenAI priority serving tier -> tiefere Latenz
  maxOut?: number;     // Output-Cap -> Instant/Low antworten spürbar schneller
  web?: boolean;       // darf live im Web suchen
  temperature?: number;
  memory?: boolean;   // darf Langzeit-Erinnerungen laden
  lean?: boolean;     // Spar-Modus: minimaler System-Prompt, kurzer Kontext
  depth?: boolean;    // Denk-Tiefe: extra Reasoning-Anleitung im Prompt
};
type Resolved = Tune & { effortLabel: string; familyLabel: string; style: string };

// Modelle, Aufwände und echte Technik kommen aus dem gemeinsamen Katalog (_shared/modelCatalog.ts).
function resolveMythos(id: unknown): Resolved {
  const { family, effort } = resolveModelId(id);
  const meta = CATALOG_EFFORTS[effort.id];
  return { ...effort.tune, memory: meta.memory, familyLabel: familyLabel(family), effortLabel: meta.label, style: meta.style };
}


function needsWeb(text: string): { need: boolean; query: string } {
  const t = text.toLowerCase();
  if (t.startsWith("/")) return { need: false, query: "" };
  const patterns = [
    /\b(aktuell|aktuelle|aktuellen|heute|gestern|neueste|neuste|news|nachrichten|gerade eben|momentan)\b/,
    /\b(wetter|preis|preise|kurs|aktie|bitcoin|ergebnis|spielstand|tabelle|release|version|update)\b/,
    /\b(suche|google|recherchier|recherchiere|schau nach|im internet|online nach)\b/,
    /\b(wann (kommt|ist|war)|wer ist|wer hat|wieviel kostet|wie viel kostet)\b/,
    /https?:\/\//,
  ];
  if (patterns.some(r => r.test(t))) return { need: true, query: text.slice(0, 300) };
  return { need: false, query: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, mode = "support", conversationId, personaId, taskId: requestedTaskId, model: requestedModel, mythos, voice: voiceMode, build } = await req.json();
    if (!Array.isArray(messages) || !messages.length || messages.length > 200) return new Response(JSON.stringify({ error: "Nachrichten fehlen oder Verlauf zu groß" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const resolved = resolveMythos(mythos);
    const ALLOWED_MODELS = new Set([
      "openai/gpt-5.5-pro",
      "openai/gpt-5.5",
      "openai/gpt-5.4",
      "google/gemini-3.1-pro-preview",
    ]);
    const chatModel = (typeof requestedModel === "string" && ALLOWED_MODELS.has(requestedModel))
      ? requestedModel
      : resolved.model;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
    const { data: claims } = await supabase.auth.getClaims(bearer);
    const clientUserId = claims?.claims?.sub;
    if (!clientUserId) return new Response(JSON.stringify({ error: "Bitte zuerst anmelden." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (conversationId) {
      const { data: own } = await supabase.from("conversations").select("user_id").eq("id", conversationId).maybeSingle();
      if (!own || own.user_id !== clientUserId) return new Response(JSON.stringify({ error: "Chat nicht gefunden." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Modell- und Aufwand-Freigabe nach Plan (Free/Light/Pro) – serverseitig, nicht nur in der Oberfläche.
    {
      const R: Record<string, number> = { free: 0, light: 1, pro: 2, admin: 2 };
      const pick = resolveModelId(mythos);
      const plan = R[await planTierOf(supabase, clientUserId).catch(() => "free")] ?? 0;
      if (plan < R[pick.family.minTier] || plan < R[pick.effort.minTier]) {
        const need = R[pick.family.minTier] === 2 || R[pick.effort.minTier] === 2 ? "Pro" : "Light";
        return new Response(JSON.stringify({ error: `${familyLabel(pick.family)} · ${CATALOG_EFFORTS[pick.effort.id].label} braucht Mythos ${need}.` }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    const admission = await admitTask(supabase, clientUserId, validTaskId(requestedTaskId) ?? crypto.randomUUID(), "web");
    const taskId = admission.taskId;
    if (!admission.allowed) return new Response(JSON.stringify(limitInfo(admission)), { status: 429, headers: { ...corsHeaders, ...LIMIT_HEADERS, "Content-Type": "application/json" } });

    const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
    const lastTextRaw = lastUser?.content;
    // content can be either a string or multimodal array (text + images). Extract text part for command parsing.
    const lastText: string = typeof lastTextRaw === "string"
      ? lastTextRaw.trim()
      : Array.isArray(lastTextRaw)
        ? (lastTextRaw.find((p: any) => p.type === "text")?.text || "").trim()
        : "";

    // Ganze Dateien (HTML-Seiten, Spiele, Apps) brauchen viel Platz: kleine Output-Caps schneiden sie sonst mitten im Code ab.
    if (/```|<\/?(?:html|body|div|script)\b|\b(?:html|css|javascript|typescript|react|code|programmier|webseite|website|landingpage|spiel|game|app|skript|script|funktion)\b/i.test(lastText)) {
      resolved.maxOut = Math.max(resolved.maxOut ?? 0, 16000);
      resolved.style = `${resolved.style ?? ""} Ausnahme: Verlangt der Nutzer Code oder eine Datei, liefere sie immer vollständig und lauffähig, ohne Kürzungen, Auslassungen oder Platzhalter wie „…“.`;
    }

    // ============== SLASH COMMANDS ==============
    // /identity <name>
    const idMatch = lastText.match(/^\/identity\s+(.+)$/i);
    if (idMatch && conversationId) {
      const newId = idMatch[1].trim().slice(0, 60);
      await supabase.from("conversations").update({ identity_override: newId }).eq("id", conversationId);
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(sse({ choices: [{ delta: { content: `✨ Identität gewechselt zu **${newId}**. Ab jetzt antworte ich als ${newId} in diesem Chat.` } }] }));
          c.enqueue(sseDone()); c.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // /image <prompt> – oder automatisch erkannt ("generiere mir das als Bild").
    // Bezüge wie "das" werden mit dem Chatverlauf zu einem vollständigen Prompt aufgelöst.
    // Keine Bild-KI mehr: Bild-Wünsche beantwortet Mythos selbst mit gezeichneten Grafiken (SVG/Canvas)
    // im normalen Chat – siehe GRAPHICS im Fachwissen. Der alte Bild-Pfad bleibt aus.
    const imgMatch = null as RegExpMatchArray | null;
    const hasImageAttachment = Array.isArray(lastTextRaw) && lastTextRaw.some((p: any) => p?.type === "image_url");
    // Im App-Builder ist "Bildergalerie" o. ä. ein Code-Wunsch, kein Bild-Wunsch.
    const autoImage = false && !build && !hasImageAttachment && isImageRequest(lastText);
    // Unklar ("generiere das als Fußball Trikot"): die KI entscheidet mit dem Verlauf und liefert gleich den Prompt.
    const classified = false && !build && !hasImageAttachment && maybeImageRequest(lastText)
      ? await classifyImageRequest(lastText, messages, LOVABLE_API_KEY)
      : null;
    if (imgMatch || autoImage || classified) {
      const request = imgMatch ? imgMatch[1].trim() : lastText;
      // Kurze oder bezügliche /image-Befehle ("/image das") ebenfalls über den Verlauf auflösen.
      const needsContext = !classified && (autoImage || request.split(/\s+/).length <= 3);
      const stream = new ReadableStream({
        async start(c) {
          // Kommentarzeilen halten die Verbindung offen, während langsame Backups rechnen.
          const ping = setInterval(() => { try { c.enqueue(enc.encode(": ping\n\n")); } catch { /* zu */ } }, 10_000);
          try {
            c.enqueue(sse({ imagePending: { prompt: classified ?? request } }));
            const prompt = classified ?? (needsContext ? await resolveImagePrompt(request, messages, LOVABLE_API_KEY) : request);
            c.enqueue(sse({ tool: `🎨 Generiere Bild: ${prompt}`, imagePending: { prompt } }));
            const { url, provider, error } = await generateImage(prompt, LOVABLE_API_KEY);
            if (url) {
              c.enqueue(sse({ image: { url, prompt } }));
              c.enqueue(sse({ choices: [{ delta: { content: `\n*Generiert mit ${PROVIDER_LABEL[provider ?? "nano-banana"]} — ${prompt}*` } }] }));
            } else {
              console.error("[/image] failed:", error);
              const reasons = explainErrors(error);
              const hint = /safety|blocked|filter/i.test(error || "")
                ? "Das Modell hat den Prompt abgelehnt (Safety-Filter). Versuch eine neutralere Beschreibung."
                : "Nano Banana und FLUX sind gerade nicht erreichbar.";
              c.enqueue(sse({ imageFailed: { prompt, reasons }, choices: [{ delta: { content: `❌ Bild-Generierung fehlgeschlagen. ${hint}\n\n${reasons.map((r) => `- ${r}`).join("\n")}` } }] }));
            }
          } finally {
            clearInterval(ping);
            c.enqueue(sseDone()); c.close();
          }
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // /music <style/description>
    const musicMatch = lastText.match(/^\/music\s+(.+)$/i);
    if (musicMatch) {
      const desc = musicMatch[1].trim();
      const stream = new ReadableStream({
        async start(c) {
          c.enqueue(sse({ tool: `🎵 Komponiere Funk-Track: ${desc}` }));
          const r = await aiFetch("gateway", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You design funk music patterns inspired by artists like FUNK SERENO, Brazilian funk, and 70s funk. Output ONLY valid JSON, no markdown." },
                { role: "user", content: `Design a funk groove for: "${desc}". Return JSON exactly in this shape:\n{\n  "title": "string",\n  "bpm": 95-130,\n  "key": "C|D|E|F|G|A|B",\n  "bars": 8,\n  "bass": [16 numbers, midi notes 28-50, 0=rest],\n  "kick":  [16 0/1 values],\n  "snare": [16 0/1 values],\n  "hihat": [16 0/1 values],\n  "stab":  [16 numbers, midi notes 60-75, 0=rest],\n  "vibe": "short description"\n}\nMake it groovy and danceable. Syncopated bass. Snares on 5,13. Kicks on 1,7,11. Hats sixteenths.` },
              ],
              response_format: { type: "json_object" },
            }),
          });
          let pattern: any = null;
          if (r.ok) {
            const j = await r.json();
            try { pattern = JSON.parse(j.choices?.[0]?.message?.content || "{}"); } catch {}
          }
          if (pattern && pattern.bass) {
            c.enqueue(sse({ music: pattern }));
            c.enqueue(sse({ choices: [{ delta: { content: `\n🎶 **${pattern.title || "Funk Groove"}** — ${pattern.bpm} BPM in ${pattern.key || "C"}\n\n*${pattern.vibe || desc}*\n\n▶️ Drück Play oben um's zu hören.` } }] }));
          } else {
            c.enqueue(sse({ choices: [{ delta: { content: "❌ Konnte den Groove nicht komponieren. Nochmal versuchen?" } }] }));
          }
          c.enqueue(sseDone()); c.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // /translate <lang> <text>  OR  /translate <lang>  (translates last assistant msg)
    const trMatch = lastText.match(/^\/translate\s+(\S+)(?:\s+([\s\S]+))?$/i);
    if (trMatch) {
      const lang = trMatch[1];
      let toTranslate = trMatch[2]?.trim();
      if (!toTranslate) {
        const lastAssist = [...messages].reverse().find((m: any) => m.role === "assistant");
        toTranslate = typeof lastAssist?.content === "string" ? lastAssist.content : "";
      }
      const stream = new ReadableStream({
        async start(c) {
          c.enqueue(sse({ tool: `🌍 Übersetze nach ${lang}` }));
          const r = await aiFetch("gateway", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: `Übersetze den folgenden Text nach ${lang}. Behalte Markdown-Formatierung bei. Antworte NUR mit der Übersetzung.` },
                { role: "user", content: toTranslate || "(leer)" },
              ],
              stream: true,
            }),
          });
          if (!r.ok || !r.body) { c.enqueue(sse({ choices: [{ delta: { content: "❌ Übersetzung fehlgeschlagen." } }] })); c.enqueue(sseDone()); c.close(); return; }
          const reader = r.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            c.enqueue(value);
          }
          c.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // /summarize  (summarizes whole conversation)
    if (/^\/summarize\b/i.test(lastText)) {
      const convoText = messages.slice(-30).map((m: any) =>
        `${m.role.toUpperCase()}: ${typeof m.content === "string" ? m.content : "[multimodal]"}`
      ).join("\n");
      const stream = new ReadableStream({
        async start(c) {
          c.enqueue(sse({ tool: "📝 Fasse Konversation zusammen" }));
          const r = await aiFetch("gateway", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "Fasse die Konversation als strukturierte Markdown-Notiz zusammen: **TL;DR**, **Wichtige Punkte** (Bullets), **Offene Fragen / ToDos**." },
                { role: "user", content: convoText },
              ],
              stream: true,
            }),
          });
          if (!r.ok || !r.body) { c.enqueue(sse({ choices: [{ delta: { content: "❌ Zusammenfassung fehlgeschlagen." } }] })); c.enqueue(sseDone()); c.close(); return; }
          const reader = r.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            c.enqueue(value);
          }
          c.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // /research <query>
    const resMatch = lastText.match(/^\/research\s+(.+)$/i);
    if (resMatch) {
      const query = resMatch[1].trim();
      const stream = new ReadableStream({
        async start(c) {
          c.enqueue(sse({ tool: `Deep Research: ${query}` }));
          const result = await webResearch(query, LOVABLE_API_KEY);
          for (const chunk of result.match(/.{1,40}/gs) || [result]) {
            c.enqueue(sse({ choices: [{ delta: { content: chunk } }] }));
            await new Promise(r => setTimeout(r, 15));
          }
          c.enqueue(sseDone()); c.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // ============== NORMAL CHAT ==============
    // Gespräch, Persona und Erinnerungen gleichzeitig laden statt nacheinander (spart Wartezeit vor der Antwort).
    let identityOverride: string | null = null;
    let convUserId: string | null = clientUserId || null;
    const loadMemories = (uid: string) => supabase.from("user_memories").select("content,category").eq("user_id", uid).order("created_at", { ascending: false }).limit(400);
    const wantMemory = resolved.memory !== false;
    const [convRes, personaRes, memRes] = await Promise.all([
      conversationId ? supabase.from("conversations").select("identity_override,user_id").eq("id", conversationId).maybeSingle() : Promise.resolve({ data: null }),
      personaId ? supabase.from("ai_personas").select("name,system_prompt,is_public,user_id,use_count").eq("id", personaId).maybeSingle() : Promise.resolve({ data: null }),
      wantMemory && clientUserId ? loadMemories(clientUserId) : Promise.resolve({ data: null }),
    ]);
    const conv = convRes.data as { identity_override: string | null; user_id: string } | null;
    identityOverride = conv?.identity_override ?? null;
    if (conv?.user_id) convUserId = conv.user_id;

    // Load persona if requested
    let personaPrompt: string | null = null;
    let personaName: string | null = null;
    const p = personaRes.data as { name: string; system_prompt: string; is_public: boolean; user_id: string; use_count: number | null } | null;
    if (p && (p.is_public || p.user_id === convUserId)) {
      personaPrompt = p.system_prompt;
      personaName = p.name;
      // Zähler im Hintergrund erhöhen, die Antwort wartet nicht darauf.
      supabase.from("ai_personas").update({ use_count: (p.use_count ?? 0) + 1 }).eq("id", personaId).then(() => {}, () => {});
    }

    // Load user memories
    let memoryBlock = "";
    if (convUserId && wantMemory) {
      // Meist schon oben mitgeladen; nur wenn der Chat jemand anderem gehört, neu laden.
      const { data: mems } = convUserId === clientUserId ? memRes : await loadMemories(convUserId);
      if (mems && mems.length > 0) {
        // Passend zur Frage auswählen: die 10 neuesten + die 20 relevantesten (Wort-Treffer mit den letzten Nachrichten).
        const ctx = (Array.isArray(messages) ? messages.slice(-4) : []).map((m: any) => typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((x: any) => x?.text || "").join(" ") : "").join(" ").toLowerCase();
        const words = [...new Set(ctx.split(/[^\p{L}\p{N}]+/u).filter((w: string) => w.length > 3))];
        const score = (c: string) => { const t = c.toLowerCase(); return words.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0); };
        const newest = mems.slice(0, 10);
        const relevant = mems.slice(10).map((m: any) => ({ m, s: score(String(m.content)) })).filter((x: any) => x.s > 0).sort((a: any, b: any) => b.s - a.s).slice(0, 20).map((x: any) => x.m);
        const picked = [...relevant, ...newest];
        memoryBlock = `\n\n## Was du über den User weißt (aus früheren Chats)\n${picked.map((m: any) => `- (${m.category}) ${m.content}`).join("\n")}\n\nNutze dieses Wissen natürlich in deinen Antworten — beziehe dich nicht ständig drauf, sondern wirke einfach so als kenntest du den User.`;
      }
    }

    let system: string;
    if (personaPrompt) {
      system = `${personaPrompt}\n\nAntworte in der Sprache des Users (default Deutsch). Nutze Markdown wenn sinnvoll.${memoryBlock}`;
    } else if (identityOverride) {
      system = `Du bist **${identityOverride}**. Du antwortest in dieser Persona, behältst aber alle nützlichen Fähigkeiten. Antworte in der Sprache des Users (default Deutsch). Nutze Markdown.${memoryBlock}`;
    } else if (mode === "support") {
      const { data: kb } = await supabase
        .from("knowledge_articles").select("title,category,body").eq("is_published", true);
      // Plugin-Artikel kommen aus dem Code (serverKnowledge.ts); im Admin eingespielte Kopien nicht doppelt senden.
      const kbAll = (kb || []).filter((a: any) => !String(a.category || "").startsWith(PLUGIN_CATEGORY_PREFIX) && !String(a.category || "").startsWith(CRAFT_CATEGORY_PREFIX))
        .map((a: any) => `### [${a.category}] ${a.title}\n${a.body}`).join("\n\n---\n\n");
      // Spar-Modus: Wissensbasis stark gekürzt -> deutlich weniger Tokens pro Anfrage.
      const kbText = resolved.lean ? kbAll.slice(0, 1500) : kbAll;
      const pluginText = resolved.lean
        ? `## Server-Wissen MythosCraft (aus dem Server-Plugin, verbindlich)\n${formatServerArticles(relevantServerArticles(lastText, 3))}`
        : serverKnowledgeText();

      system = `Du bist **Mythos AI**, der offizielle Support-Assistent für den Minecraft-Server **mythoscraft.online** (SMP).
Antworte freundlich, präzise und auf Deutsch. Nutze Markdown.

Slash-Commands die der User nutzen kann: \`/identity <name>\`, \`/image <prompt>\`, \`/music <vibe>\`, \`/research <thema>\`.

${pluginText}

Weitere Artikel aus der Knowledge Base (bei Widerspruch gilt das Plugin-Wissen oben):

${kbText || "(keine weiteren Artikel)"}

Wenn etwas weder oben noch in den Artikeln steht: ehrlich sagen und auf Discord oder \`/helpop\` im Spiel verweisen.${memoryBlock}`;
    } else {
      system = `Du bist Mythos AI, ein freundlicher, kompetenter KI-Assistent. Antworte präzise und in der Sprache des Users (default: Deutsch). Nutze Markdown.

Du hast diese Slash-Commands zur Verfügung (sag dem User Bescheid wenn passend):
- \`/identity <name>\` — wechselt deine Persona in diesem Chat
- \`/image <beschreibung>\` — generiert ein Bild. Der User kann auch einfach schreiben „generiere mir das als Bild“, das wird automatisch erkannt und aus dem Verlauf aufgelöst.
- \`/music <stil/vibe>\` — erzeugt einen Song

Du KANNST Bilder erzeugen: Bild-Wünsche erledigt die App automatisch. Sag nie, dass du keine Bilder anzeigen oder erstellen kannst, und schick den User nicht zu /image.
Die App schickt dir oft eine vollständige Liste deiner Befehle und Bereiche mit; nutze sie, wenn der User fragt, was du kannst.
- \`/research <thema>\` — Deep Research mit Web-Suche

Bilder & PDFs: Du kannst hochgeladene Bilder direkt sehen und analysieren.${memoryBlock}`;
      // Fragen zum MythosCraft-Server auch im normalen Chat mit Plugin-Wissen beantworten.
      if (isServerQuestion(lastText)) {
        system += `\n\n## Server-Wissen MythosCraft (mythoscraft.online, aus dem Server-Plugin, verbindlich)\nNutze nur dieses Wissen für Server-Fragen und erfinde nichts dazu. Fehlt etwas: ehrlich sagen und auf Discord oder \`/helpop\` verweisen.\n\n${formatServerArticles(relevantServerArticles(lastText, resolved.lean ? 2 : 5))}`;
      }
    }

    if (voiceMode) system += `\n\n## Sprach-Modus\nDeine Antwort wird laut vorgelesen. Antworte daher in gesprochener Sprache: kurze Sätze, maximal 3-5 Sätze, keine Listen, keine Emojis, kein Markdown, keine Links, keine Code-Blöcke.`;
    const identityOpts = {
      modelLabel: resolved.familyLabel,
      effortLabel: resolved.effortLabel,
      surface: "app" as const,
      persona: personaName ?? identityOverride ?? null,
      lang: "de" as const,
    };
    const depthHint = resolved.depth
      ? `\n\n## Denk-Tiefe\nDenke vor dem Antworten still Schritt für Schritt durch: Ziel klären, Annahmen prüfen, Randfälle und Alternativen abwägen, dann die beste Lösung begründet ausgeben. Zeige den Denkprozess nicht rohkopiert, sondern nur das saubere Ergebnis mit kurzer Begründung.`
      : "";
    // Arbeitsweise + eigene Fähigkeiten + passendes Fachwissen (bbmodel, Skins, Web, Plugins).
    // Thema aus den letzten User-Nachrichten, damit Folgefragen („mach die Krempe breiter“) es behalten.
    const recentUser = (Array.isArray(messages) ? messages : [])
      .filter((m: any) => m?.role === "user").slice(-3)
      .map((m: any) => typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((p: any) => p?.text || "").join(" ") : "")
      .join("\n");
    // Im Admin eingespielte/bearbeitete KI-Wissens-Artikel (Kategorie ki-…) haben Vorrang vor dem Code.
    const overrides: CraftOverrides = {};
    if (!voiceMode) {
      const { data: kiRows } = await supabase.from("knowledge_articles").select("category,body")
        .eq("is_published", true).like("category", `${CRAFT_CATEGORY_PREFIX}%`);
      for (const r of (kiRows || []) as { category: string; body: string }[]) overrides[r.category] = r.body;
    }
    const craft = voiceMode ? "" : relevantCraftKnowledge(recentUser, resolved.lean ? 1 : 3, overrides);
    const learned = learnedRules(overrides);
    if (!voiceMode) system += `\n\n${workRules(overrides)}${resolved.lean ? "" : `\n\n${abilities(overrides)}`}${learned ? `\n\n${learned}` : ""}${craft ? `\n\n${craft}` : ""}`;
    // Code/Dateien brauchen Platz: sonst wird z. B. eine .bbmodel oder ein Spiel mittendrin abgeschnitten.
    if (wantsLongOutput(lastText) && resolved.maxOut && !resolved.lean) {
      resolved.maxOut = Math.max(resolved.maxOut, String(chatModel).startsWith("openai/") ? 16000 : 24000);
      // Dateien/Code: gründlich statt schnell – Denk-Anleitung an, und erst planen, dann schreiben.
      resolved.depth = true;
      if (!resolved.reasoning || resolved.reasoning === "none" || resolved.reasoning === "low") resolved.reasoning = "medium";
      system += `\n\n## Diese Anfrage braucht Sorgfalt\nNimm dir Zeit: erst still planen (Aufbau, alle Teile, Maße, Randfälle), dann vollständig ausarbeiten, dann im Kopf prüfen. Schicke NICHTS am Anfang der Antwort – keine Datei, kein Code-Block vor der kurzen Erklärung. Die Datei(en) kommen erst ganz am Ende, komplett und detailreich.`;
    }

    // Spar-Modus (Instant/Low): Katalog- und Datei-Blöcke weglassen -> viel kleinerer Prompt.
    system = resolved.lean
      ? `${mythosIdentity(identityOpts)}\n\n${system}\n\n## Antwort-Aufwand: ${resolved.effortLabel}\n${resolved.style}`
      : `${mythosIdentity(identityOpts)}\n\n${MYTHOS_CATALOG}\n\n${MYTHOS_FILES}\n\n${system}\n\n## Antwort-Aufwand: ${resolved.effortLabel}\n${resolved.style}${depthHint}\n\n${mythosIdentityReminder(identityOpts)}`;


    // ---- optional live web search (streamed status first) ----
    // Instant/Low suchen nie im Web -> keine Extra-Latenz.
    const web = needsWeb(lastText);
    let webContext = "";
    let searchQuery = "";
    if (web.need && resolved.web !== false) {
      searchQuery = web.query;
    }

    // Instant hält den Kontext klein -> deutlich schnellere Time-to-first-token.
    const histLimit = resolved.effortLabel === "Instant" ? 4 : resolved.effortLabel === "Low" ? 8 : 40;
    const trimmed = Array.isArray(messages) ? messages.slice(-histLimit) : messages;
    const outMessages: any[] = [{ role: "system", content: system }, ...trimmed];
    const hasVideo = outMessages.some((m: any) => Array.isArray(m?.content) && m.content.some((p: any) => p?.type === "video_url"));

    const isOpenAI = String(chatModel).startsWith("openai/");
    const body: Record<string, unknown> = {
      model: chatModel,
      messages: outMessages,
      stream: true,
    };
    if (resolved.reasoning) body.reasoning_effort = resolved.reasoning;
    // Dateien/Code/gründliche Stufen: ohne Gateway an das stärkste verfügbare Modell (siehe _shared/ai.ts).
    if (resolved.depth) body.mythos_tier = "strong";
    if (resolved.fast && isOpenAI) body.service_tier = "priority";
    if (resolved.maxOut) {
      if (isOpenAI) body.max_completion_tokens = resolved.maxOut;
      else body.max_tokens = resolved.maxOut;
    }
    if (resolved.temperature !== undefined && !isOpenAI) body.temperature = resolved.temperature;


    const startUpstream = async () => {
      const r = await aiFetch("gateway", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return r;
    };
    const finishUsage = async (c: ReadableStreamDefaultController<Uint8Array>, usage: TokenUsage | null) => {
      await recordUsage(supabase, { userId: clientUserId, taskId, source: "web", model: chatModel, usage });
      c.enqueue(sse({ mythos_usage: usage ? { input_tokens: usage.input, output_tokens: usage.output, total_tokens: usage.total, measured: true } : { measured: false }, task_id: taskId }));
    };

    if (searchQuery) {
      const stream = new ReadableStream({
        async start(c) {
          c.enqueue(sse({ search: searchQuery }));
          try {
            webContext = await webResearch(searchQuery, LOVABLE_API_KEY);
          } catch (_e) { webContext = ""; }
          if (hasVideo) await prepareVideos(outMessages, LOVABLE_API_KEY, (ev) => c.enqueue(sse(ev)));
          if (webContext) {
            outMessages[0] = {
              role: "system",
              content: `${system}\n\n## Frische Web-Ergebnisse (gerade recherchiert)\n${webContext.slice(0, 6000)}\n\nNutze diese Ergebnisse für deine Antwort und nenne die Quellen kurz.`,
            };
            body.messages = outMessages;
          }
          const r = await startUpstream();
          if (!r.ok || !r.body) {
            c.enqueue(sse({ choices: [{ delta: { content: "❌ Antwort fehlgeschlagen. Bitte nochmal versuchen." } }] }));
            c.enqueue(sseDone()); c.close(); return;
          }
          const usage = await forwardUsageStream(r.body, value => c.enqueue(value));
          await finishUsage(c, usage);
          c.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Sofort antworten und Verbindung mit Pings offen halten, während das Modell startet/nachdenkt.
    // So wartet der Browser nie auf leere Leitung, und jedes Wort erscheint, sobald es da ist.
    const enc = new TextEncoder();
    const live = new ReadableStream({
      async start(c) {
        let open = true;
        const ping = setInterval(() => { if (open) try { c.enqueue(enc.encode(": ping\n\n")); } catch { /* closed */ } }, 4000);
        c.enqueue(enc.encode(": start\n\n"));
        try {
          // Angehängte Videos sieht sich die KI selbst an (Bild + Ton); Fortschritt erscheint als Arbeitsschritte.
          if (hasVideo) await prepareVideos(outMessages, LOVABLE_API_KEY, (ev) => c.enqueue(sse(ev)));
          const resp = await startUpstream();
          if (!resp.ok || !resp.body) {
            const t = await resp.text().catch(() => "");
            console.error("Gateway error:", resp.status, t.slice(0, 300));
            const msg = resp.status === 429 ? "⏳ Gerade sehr viele Anfragen – bitte gleich nochmal senden."
              : resp.status === 402 ? "⚠️ KI-Guthaben aufgebraucht und die Reserve hat nicht geantwortet."
              : "❌ Antwort fehlgeschlagen. Bitte nochmal versuchen.";
            c.enqueue(sse({ choices: [{ delta: { content: msg } }] })); c.enqueue(sseDone());
          } else {
            const usage = await forwardUsageStream(resp.body, value => c.enqueue(value));
            await finishUsage(c, usage);
          }
        } catch (e) {
          console.error("stream error:", e);
          try { c.enqueue(sse({ choices: [{ delta: { content: "\n\n❌ Verbindung zur KI unterbrochen." } }] })); c.enqueue(sseDone()); } catch { /* closed */ }
        } finally {
          open = false; clearInterval(ping);
          try { c.close(); } catch { /* closed */ }
        }
      },
    });
    return new Response(live, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
