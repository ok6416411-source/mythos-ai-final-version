// App-Builder im Stil von Lovable und Base44: links der Chat, rechts die Live-Vorschau und der Code.
// Die KI baut eine komplette, eigenständige index.html; spätere Wünsche ändern nur die betroffenen Stellen (SUCHEN/ERSETZEN).
// Projekte liegen im Browser und werden mit dem Konto abgeglichen; veröffentlichte Apps stehen unter /build/<name>.
import { authHeader } from "@/lib/authHeader";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowUp, Check, Code2, Copy, Download, ExternalLink, Eye, FileCode2, Loader2, MessageSquare,
  Monitor, Plus, RefreshCw, RotateCcw, Smartphone, Square, Trash2, Paperclip, Globe, Rocket, X, CloudOff, Cloud, Film,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { isAllowed } from "@/lib/mythosModels";
import { copyText } from "@/lib/copyText";
import { CONTINUE_PROMPT, MAX_CONTINUE, looksCut, stitch } from "@/lib/codeContinue";
import { applyEdits, changedLines, countEditStarts, hasEditMarkers, parseEdits, repairPrompt } from "@/lib/htmlPatch";

type Att = { url: string; name: string; mime: string };
type BMsg = { role: "user" | "assistant"; content: string; html?: string; note?: string; at: string; atts?: Att[]; sources?: { url: string; title: string }[] };
type Project = { id: string; name: string; html: string; messages: BMsg[]; updated: string; slug?: string; publishedAt?: string };

const EXAMPLES = [
  "Eine Landingpage für mein Café mit Speisekarte und Kontaktformular",
  "Ein Snake-Spiel mit Highscore",
  "Eine To-do-App mit Kategorien und Dunkelmodus",
  "Ein Portfolio für eine Fotografin mit Bildergalerie",
];

const SYSTEM = `Du bist der App-Builder von Mythos AI, vergleichbar mit Lovable oder Base44.
Du baust Web-Apps als EINE eigenständige Datei index.html.
Regeln:
- Antworte zuerst mit höchstens zwei kurzen Sätzen, was du baust oder änderst.
- Danach kommt genau EIN Codeblock \`\`\`html mit der KOMPLETTEN Datei, von <!DOCTYPE html> bis </html>. Nie kürzen, nie „…“ oder „Rest bleibt gleich“.
- Alles in einer Datei: CSS in <style>, JavaScript in <script>. Erlaubt sind CDN-Bibliotheken (z. B. Tailwind über https://cdn.tailwindcss.com).
- Modernes, sauberes Design, responsiv fürs Handy, sinnvolle Beispielinhalte statt Platzhaltertext.
- Bilder: nutze https://picsum.photos/seed/<wort>/800/600 oder Emojis/SVG, keine erfundenen Dateien.
- Daten speicherst du bei Bedarf in localStorage.
- Keine Erklärung des Codes nach dem Block.

BILDER UND VIDEOS:
- Hat der Nutzer Dateien hochgeladen (stehen in seiner Nachricht unter „Hochgeladene Dateien“), dann verwende GENAU diese Adressen – unverändert, vollständig, in src="…". Bilder siehst du zusätzlich selbst: beschreibe/platziere sie passend (Logo in den Kopf, Fotos in Galerie/Hero usw.).
- Bild einbauen: <img src="ADRESSE" alt="kurze Beschreibung" loading="lazy" style="width:100%;height:auto;object-fit:cover">. Als Hintergrund: background:url("ADRESSE") center/cover.
- Video einbauen: <video src="ADRESSE" controls playsinline preload="metadata" style="width:100%;border-radius:12px"></video>. Als stummer Hintergrund: autoplay muted loop playsinline (ohne controls).
- YouTube nur, wenn der Nutzer einen Link gibt: <iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" allowfullscreen style="width:100%;aspect-ratio:16/9;border:0"></iframe>.
- Stehen unten „PASSENDE MEDIEN ZUM THEMA“, sind das geprüfte, zum Thema passende Fotos/Videos: Verwende GENAU diese Adressen (vollständig, unverändert) und wähle nach dem Titel aus, was inhaltlich passt. Stehen in den „RECHERCHE-ERGEBNISSEN“ Bild-Adressen, darfst du auch die verwenden.
- VIDEOS: Verwende AUSSCHLIESSLICH Video-Adressen aus den hochgeladenen Dateien oder aus „PASSENDE MEDIEN ZUM THEMA“. NIEMALS eine Video-Adresse aus dem Gedächtnis (Beispiel-/Testvideos zeigen irgendetwas völlig anderes). Gibt es keine passende Adresse: KEIN <video> einbauen – stattdessen eine schöne CSS/SVG-Animation oder ein Foto, und sag in deinem Satz, dass der Nutzer ein eigenes Video über die Büroklammer hochladen kann.
- FOTOS: ERFINDE NIEMALS Adressen zu Bilddateien. Gibt es keine Vorgabe und keine Liste, nimm für reine Stimmungsbilder https://picsum.photos/seed/STICHWORT/BREITE/HOEHE (lädt immer, zeigt aber ein zufälliges Motiv – also nicht für Bilder, die etwas Bestimmtes zeigen müssen). Für Icons, Logos und Illustrationen zeichne Inline-SVG.
- Jedes <img> bekommt onerror="this.style.display='none'" oder einen farbigen Ersatz, damit nie ein kaputtes Bild zu sehen ist.

INTERNET:
- Stehen unten „RECHERCHE-ERGEBNISSE“, stammen sie frisch aus dem Internet. Nutze daraus echte Fakten, Texte, Namen, Preise und Adressen statt Erfundenem, und erfinde nichts dazu, was dort nicht steht.`;

/** Gibt es schon eine Datei, wird sie gezielt geändert statt neu geschrieben (schneller, nichts geht verloren). */
const EDIT_RULES = `

ÄNDERN STATT NEU SCHREIBEN (gilt, sobald unten eine „Aktuelle index.html“ steht):
- Gib NICHT die ganze Datei aus. Schreib nach deinen ein bis zwei Sätzen EINEN Codeblock \`\`\`edit, der nur die geänderten Stellen enthält – je Stelle ein Block in genau dieser Form:
<<<<<<< SUCHEN
(2–8 Zeilen, Zeichen für Zeichen aus der aktuellen Datei kopiert, inklusive Einrückung; das Stück darf in der Datei nur EINMAL vorkommen)
=======
(der neue Text, der dieses Stück ersetzt)
>>>>>>> ERSETZEN
- Mehrere Stellen = mehrere Blöcke nacheinander im selben \`\`\`edit-Codeblock, in der Reihenfolge der Datei. Blöcke dürfen sich nicht überschneiden.
- Etwas Neues einfügen: Nimm die Zeile davor als SUCHEN und wiederhole sie im neuen Text, gefolgt vom Neuen. Etwas löschen: den neuen Text leer lassen.
- Ändere nur, was für den Wunsch nötig ist. Alles andere bleibt unangetastet – Design, Texte und Funktionen, nach denen nicht gefragt wurde, nicht umbauen.
- Denk an alle betroffenen Stellen: neues Element → auch sein CSS und sein JavaScript (je ein eigener Block).
- Nur wenn fast alles anders wird (komplett neues Design, andere App), gib stattdessen EINEN Codeblock \`\`\`html mit der kompletten neuen Datei aus.`;

const key = (uid?: string) => `mythos.build.${uid ?? "gast"}`;
const now = () => new Date().toISOString();
const newId = () => Math.random().toString(36).slice(2, 10);

function load(uid?: string): Project[] {
  try { return JSON.parse(localStorage.getItem(key(uid)) || "[]"); } catch { return []; }
}
function save(uid: string | undefined, list: Project[]) {
  try { localStorage.setItem(key(uid), JSON.stringify(list.slice(0, 30))); } catch { toast.error("Speicher voll: alte Projekte löschen"); }
}

/** HTML aus der Antwort holen, auch wenn der Block (noch) nicht geschlossen ist. */
function extractHtml(text: string): string | null {
  // Gezielte Änderungen (SUCHEN/ERSETZEN) sind keine ganze Datei.
  if (hasEditMarkers(text)) return null;
  const m = /```(?:html)?[^\n]*\n([\s\S]*?)(?:```|$)/i.exec(text);
  const code = m?.[1]?.trim();
  if (code && /<(!doctype|html|body|div|script|style)/i.test(code)) return code;
  const raw = /<!doctype html[\s\S]*/i.exec(text)?.[0];
  return raw ? raw.replace(/```\s*$/, "").trim() : null;
}
/** Die Vorschau läuft abgeschottet (ohne Zugriff auf dein Konto). Dort fehlt localStorage, darum ein Ersatz im Speicher. */
const STORAGE_SHIM = `<script>try{localStorage.length}catch(e){var m={},s={getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}};Object.defineProperty(window,"localStorage",{value:s});Object.defineProperty(window,"sessionStorage",{value:s})}</script>`;
const withShim = (h: string) => (/<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, (t) => t + STORAGE_SHIM) : STORAGE_SHIM + h);

/** Text der Antwort ohne den Codeblock (für die Chat-Blase). */
const proseOf = (text: string) => text.replace(/```[\s\S]*?(```|$)/g, "").replace(/<!doctype html[\s\S]*/i, "").trim();

function downloadFile(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/html;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function labsCall<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("labs", { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === "function" ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message || "Verbindungsfehler");
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
/** Braucht der Wunsch aktuelle oder echte Infos aus dem Internet? */
const needsWeb = (t: string) => /https?:\/\/|\bwww\.|recherch|im internet|im netz|google|such(e|st)? (nach|mal|im)|schau (nach|im)|nachschau|aktuell|neueste|neuesten|heute|dieses jahr|20(2[5-9]|3\d)|news|nachrichten|preise?\b|öffnungszeit|adresse von|website von|webseite von|echte (daten|infos|inhalte)|wer ist|was ist .* für ein|tabelle der|ergebnisse|spielplan|wetter|kurs\b|statistik/i.test(t);
const urlsIn = (t: string) => [...t.matchAll(/https?:\/\/[^\s)>"']+/g)].map((m) => m[0]).slice(0, 3);
/** Wunsch nach deutlich mehr Umfang oder einem grundlegenden Umbau (dann wird die ganze Datei neu geschrieben). */
const isGrowthAsk = (t: string) => /(viel|deutlich|wesentlich|noch|ganz viel|mega|krass)\s+mehr|mehr (sachen|inhalt|inhalte|infos|informationen|seiten|abschnitte|sektionen|funktionen|features|details|text|stuff|zeug)|füge?\b.*\b(viel|mehr|weitere|ganz)|erweiter|ausbau|bau.* aus\b|ausführlicher|umfangreicher|detaillierter|größer|mehr davon|mach mehr/i.test(t);
const isBigChange = (t: string) => isGrowthAsk(t) || /komplett|von grund auf|ganz neu|neu (machen|gestalten|designen|aufbauen)|redesign|überarbeite (alles|die ganze|das ganze)|alles (neu|anders|ändern)|ganz anders|professioneller|viel (besser|schöner|krasser|moderner)|krasser|hochwertiger/i.test(t);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const toSlug = (t: string) => t.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export default function Build() {
  const { user } = useAuth();
  const sub = useSubscription();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(""); // gerade gestreamte Antwort
  const [tab, setTab] = useState<"chat" | "preview" | "code">("chat"); // nur Handy
  const [view, setView] = useState<"preview" | "code">("preview"); // Desktop rechts
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const taskRef = useRef<string | null>(null);
  const [atts, setAtts] = useState<Att[]>([]);
  const [uploading, setUploading] = useState(false);
  const [webOn, setWebOn] = useState(false);      // „Im Internet nachsehen“ erzwingen (sonst automatisch bei Bedarf)
  const [stage, setStage] = useState("");          // Zwischenstand: „Sucht im Internet…“
  const [pubOpen, setPubOpen] = useState(false);
  const [cloud, setCloud] = useState<"" | "saving" | "saved" | "off">("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cloudReady = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Projekte: sofort aus dem Browser, dann mit dem Konto abgleichen (neuerer Stand gewinnt) – so sind sie auf jedem Gerät da.
  useEffect(() => {
    const local = load(user?.id);
    setProjects(local); cloudReady.current = false;
    if (!user?.id) return;
    let dead = false;
    labsCall<{ projects: Project[] }>({ kind: "builder_load" }).then((d) => {
      if (dead) return;
      const byId = new Map<string, Project>();
      for (const p of [...(d.projects || []), ...load(user.id)]) { const o = byId.get(p.id); if (!o || p.updated > o.updated) byId.set(p.id, p); }
      const merged = [...byId.values()].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 30);
      setProjects(merged); save(user.id, merged); cloudReady.current = true; setCloud("saved");
    }).catch(() => { cloudReady.current = false; setCloud("off"); });
    return () => { dead = true; };
  }, [user?.id]);
  // Änderungen kurz sammeln und dann im Konto sichern (nicht mitten im Schreiben der KI).
  useEffect(() => {
    if (!user?.id || !cloudReady.current || busy) return;
    setCloud("saving");
    const t = setTimeout(() => {
      labsCall({ kind: "builder_save", projects }).then(() => setCloud("saved")).catch(() => setCloud("off"));
    }, 2500);
    return () => clearTimeout(t);
  }, [projects, busy, user?.id]);
  const active = projects.find((p) => p.id === activeId) ?? null;
  const liveHtml = busy ? extractHtml(live) : null;
  const html = liveHtml ?? active?.html ?? "";
  // Vorschau erst aktualisieren, wenn die Datei fertig ist (halbe Seiten flackern sonst).
  const previewHtml = busy && liveHtml && !/<\/html>/i.test(liveHtml) ? active?.html ?? "" : html;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [active?.messages.length, live]);

  const update = (id: string, fn: (p: Project) => Project) => setProjects((list) => {
    const next = list.map((p) => (p.id === id ? fn(p) : p)).sort((a, b) => b.updated.localeCompare(a.updated));
    save(user?.id, next);
    return next;
  });

  const model = isAllowed("code15:high", sub.tier) ? "code15:high" : "v1:normal";

  /** Ein gestreamter Aufruf der Chat-Funktion; liefert den Text. */
  const call = async (messages: { role: string; content: unknown }[], prefix: string, ctrl: AbortController) => {
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ userId: user?.id, taskId: taskRef.current, mythos: model, mode: "general", build: true, messages }),
    });
    if (resp.status === 429) throw new Error(resp.headers.get("x-mythos-limit") ? ((await resp.json().catch(() => null))?.error || "Dein MythosAI-Token-Limit ist erreicht.") : "Zu viele Anfragen. Warte kurz.");
    if (!resp.ok || !resp.body) throw new Error(`Server-Fehler ${resp.status}`);
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, i).replace(/\r$/, ""); buf = buf.slice(i + 1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") continue;
        try {
          const c = JSON.parse(json).choices?.[0]?.delta?.content;
          if (c) { out += c; setLive(prefix + stitch(prefix, out)); }
        } catch { /* unvollständige Zeile */ }
      }
    }
    return out;
  };

  const send = async (text = input) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    let proj = active;
    if (!proj) {
      proj = { id: newId(), name: prompt.slice(0, 40), html: "", messages: [], updated: now() };
      const next = [proj, ...projects]; setProjects(next); save(user?.id, next); setActiveId(proj.id);
    }
    const id = proj.id;
    // Eine Kennung pro Auftrag: Fortsetzungen und Nachbesserungen zählen zur laufenden Aufgabe (werden trotz Limit fertig).
    taskRef.current = crypto.randomUUID();
    const sent = atts; setAtts([]);
    const userMsg: BMsg = { role: "user", content: prompt, at: now(), atts: sent.length ? sent : undefined };
    update(id, (p) => ({ ...p, messages: [...p.messages, userMsg], updated: now() }));
    setInput(""); setBusy(true); setLive(""); setTab("chat");

    // Verlauf ohne alte Codeblöcke, dafür die aktuelle Datei: spart Platz und die KI kennt immer den neuesten Stand.
    const kindOf = (a: Att) => (a.mime.startsWith("video/") ? "Video" : a.mime.startsWith("image/") ? "Bild" : "Datei");
    const withFiles = (m: BMsg) => m.content + (m.atts?.length ? "\n\nHochgeladene Dateien (genau diese Adressen im Code verwenden):\n" + m.atts.map((a) => `- ${a.name} (${kindOf(a)}): ${a.url}`).join("\n") : "");
    const history: { role: string; content: unknown }[] = [...proj.messages, userMsg].slice(-10).map((m) => ({ role: m.role, content: m.role === "assistant" ? proseOf(m.content) || "Datei aktualisiert." : withFiles(m) }));
    // Die gerade hochgeladenen Bilder sieht die KI auch selbst (nicht nur die Adresse).
    const pics = sent.filter((a) => a.mime.startsWith("image/")).slice(0, 4);
    if (pics.length) history[history.length - 1] = { role: "user", content: [{ type: "text", text: withFiles(userMsg) }, ...pics.map((a) => ({ type: "image_url", image_url: { url: a.url } }))] };
    const ctx = proj.html ? `\n\nAktuelle index.html:\n\`\`\`html\n${proj.html}\n\`\`\`` : "";
    const base = proj.html;
    const sysFor = (h: string) => SYSTEM + (h ? EDIT_RULES + `\n\nAktuelle index.html:\n\`\`\`html\n${h}\n\`\`\`` : "");
    // Großer Umbau („viel mehr“, „komplett neu“, „erweitere“ …): ganze Datei neu schreiben lassen statt einzelner Stellen –
    // sonst kommen nur ein paar Zeilen dazu, obwohl viel versprochen wird.
    const big = !!base && isBigChange(prompt);
    const rewriteFor = (h: string) => `\n\nGROSSER UMBAU: Der Nutzer will deutlich mehr bzw. etwas grundlegend Neues. Schreib die KOMPLETTE index.html neu (ein \`\`\`html-Codeblock, keine SUCHEN/ERSETZEN-Blöcke). Behalte alles Gute der aktuellen Datei (Inhalte, Texte, Funktionen, Medien-Adressen) und baue darauf auf. „Mehr“ heißt wirklich mehr: mindestens 4 neue, vollständig ausgearbeitete Abschnitte/Funktionen mit echtem Inhalt (keine Platzhalter, kein Lorem ipsum), dazu passendes CSS und JavaScript – die Datei wird dadurch deutlich länger als vorher (aktuell ${h.split("\n").length} Zeilen). Zähle in deinem Satz nur auf, was du WIRKLICH eingebaut hast.\n\nAktuelle index.html:\n\`\`\`html\n${h}\n\`\`\``;
    const messages: { role: string; content: unknown }[] = [{ role: "system", content: big ? SYSTEM + rewriteFor(base) : base ? sysFor(base) : SYSTEM + ctx }, ...history];
    // Bei Änderungs-Blöcken: abgeschnitten = offener Codeblock oder ein angefangener, nicht beendeter Block.
    const cut = (t: string) => (hasEditMarkers(t) ? ((t.match(/^\s*```/gm) || []).length % 2 === 1 || countEditStarts(t) > parseEdits(t).length) : looksCut(t));
    const ctrl = new AbortController(); abortRef.current = ctrl;
    let full = "";
    let sources: { url: string; title: string }[] | undefined;
    try {
      // Erst im Internet nachsehen, wenn der Wunsch es braucht (oder der Schalter an ist).
      if (webOn || needsWeb(prompt)) {
        setStage("Sucht im Internet…");
        try {
          const urls = urlsIn(prompt);
          const query = prompt.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
          const r = await labsCall<{ hits: { url: string; title: string; snippet: string }[]; pages: { url: string; title: string; text: string; images: string[] }[] }>({ kind: "web_research", query: urls.length && query.length < 12 ? "" : query, urls });
          if (r.pages?.length || r.hits?.length) {
            setStage(`Liest ${r.pages?.length || 0} Seiten…`);
            const block = "RECHERCHE-ERGEBNISSE (frisch aus dem Internet, " + new Date().toLocaleDateString("de-DE") + "):\n" +
              (r.hits || []).map((h, i) => `${i + 1}. ${h.title} – ${h.url}\n   ${h.snippet}`).join("\n") +
              (r.pages || []).map((pg) => `\n\n--- ${pg.title || pg.url} (${pg.url}) ---\n${pg.text}${pg.images?.length ? "\nBild-Adressen dieser Seite: " + pg.images.join(" , ") : ""}`).join("");
            messages[0] = { role: "system", content: String(messages[0].content) + "\n\n" + block.slice(0, 24000) };
            sources = [...(r.pages || []).map((pg) => ({ url: pg.url, title: pg.title || pg.url })), ...(r.hits || []).map((h) => ({ url: h.url, title: h.title }))].filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i).slice(0, 5);
          } else toast("Im Internet nichts Passendes gefunden – Mythos baut ohne Recherche.");
        } catch { toast("Internet-Suche gerade nicht erreichbar – Mythos baut ohne Recherche."); }
        setStage("");
      }
      // Passende Fotos/Videos zum Thema suchen, statt die KI Adressen raten zu lassen.
      const wantVideo = /video|film\b|clip|bewegtbild/i.test(prompt) && !sent.some((a) => a.mime.startsWith("video/"));
      const wantImage = (!base || /foto|bild|galerie|gallery|hero|hintergrund|image|photo|impression/i.test(prompt)) && !sent.some((a) => a.mime.startsWith("image/"));
      if (wantVideo || wantImage) {
        setStage(wantVideo ? "Sucht passende Videos und Fotos…" : "Sucht passende Fotos…");
        const add = (t: string) => { messages[0] = { role: "system", content: String(messages[0].content) + "\n\n" + t }; };
        try {
          const topic = (proj.name + " – " + prompt).slice(0, 500);
          const r = await labsCall<{ items: { type: string; url: string; title: string; width?: number; height?: number }[] }>({ kind: "media_search", prompt: topic, want: [...(wantVideo ? ["video"] : []), ...(wantImage ? ["image"] : [])] });
          const vids = (r.items || []).filter((m) => m.type === "video"), imgs = (r.items || []).filter((m) => m.type === "image");
          const line = (m: { url: string; title: string; width?: number; height?: number }) => `- „${m.title}“${m.width ? ` (${m.width}×${m.height})` : ""}: ${m.url}`;
          if (vids.length || imgs.length) add("PASSENDE MEDIEN ZUM THEMA (frei nutzbar; nur verwenden, was laut Titel wirklich passt):" + (vids.length ? "\nVideos:\n" + vids.map(line).join("\n") : "") + (imgs.length ? "\nFotos:\n" + imgs.map(line).join("\n") : "") + (wantVideo && !vids.length ? "\nVideos: KEINE gefunden – kein <video> einbauen (siehe Regel)." : ""));
          else if (wantVideo) add("PASSENDE MEDIEN ZUM THEMA: keine gefunden – kein <video> einbauen (siehe Regel).");
          if (wantVideo && !vids.length) toast("Kein passendes freies Video gefunden. Lade am besten dein eigenes über die Büroklammer hoch.", { duration: 7000 });
        } catch { if (wantVideo) add("PASSENDE MEDIEN ZUM THEMA: Suche nicht erreichbar – kein <video> einbauen (siehe Regel)."); }
        setStage("");
      }
      full = await call(messages, "", ctrl);
      for (let k = 0; k < MAX_CONTINUE && cut(full) && !ctrl.signal.aborted; k++) {
        const more = await call([...messages, { role: "assistant", content: full }, { role: "user", content: CONTINUE_PROMPT }], full, ctrl);
        if (!more) break;
        full += stitch(full, more);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message || "Verbindungsfehler");
    }
    let newHtml = extractHtml(full);
    let note: string | undefined;
    // Gezielte Änderungen anwenden; was nicht passt, lässt Mythos bis zu zweimal selbst nachbessern.
    if (full && base && hasEditMarkers(full)) {
      let r = applyEdits(base, parseEdits(full));
      let total = r.applied;
      try {
        for (let round = 0; round < 2 && r.failed.length && !ctrl.signal.aborted; round++) {
          setLive(proseOf(full) + "\n\n");
          const fix = await call([{ role: "system", content: sysFor(r.html) }, { role: "user", content: prompt }, { role: "assistant", content: proseOf(full) || "Änderungen gesendet." }, { role: "user", content: repairPrompt(r.failed) }], "", ctrl);
          const again = extractHtml(fix);
          if (again && /<\/html>/i.test(again)) { r = { html: again, applied: 1, failed: [] }; total++; break; }
          const rr = applyEdits(r.html, parseEdits(fix));
          total += rr.applied; r = rr;
        }
      } catch { /* was schon passt, bleibt */ }
      if (r.html !== base) {
        newHtml = r.html;
        const lines = changedLines(base, r.html);
        note = `${total} ${total === 1 ? "Stelle" : "Stellen"} geändert · ${lines} ${lines === 1 ? "Zeile" : "Zeilen"}` + (r.failed.length ? ` · ${r.failed.length} nicht übernommen` : "");
      }
      if (r.failed.length) toast.warning(r.html !== base ? `${r.failed.length} Änderung(en) passten nicht zur Datei. Sag einfach nochmal, was noch fehlt.` : "Die Änderungen passten nicht zur Datei. Versuch es bitte nochmal.");
    }
    // Viel versprochen, wenig geliefert? Dann einmal nachfassen und die ganze Datei ausbauen lassen.
    if (full && base && !ctrl.signal.aborted && (big || isGrowthAsk(prompt))) {
      const after = newHtml ?? base;
      const grew = after.length - base.length, lines = changedLines(base, after);
      if (grew < Math.max(1500, base.length * 0.2) && lines < 120) {
        try {
          setLive(""); setStage("Das war zu wenig – baut jetzt richtig aus…");
          const sys2 = { role: "system", content: SYSTEM + rewriteFor(after) };
          let big2 = await call([sys2, { role: "user", content: prompt }, { role: "assistant", content: proseOf(full) || "Erledigt." },
            { role: "user", content: `Das war viel zu wenig: Es sind nur ${lines} Zeilen dazugekommen bzw. geändert worden. Ich wollte DEUTLICH mehr. Schreib jetzt die komplette index.html neu und baue wirklich alles aus, was du angekündigt hast – jeder Abschnitt vollständig mit echtem Inhalt, CSS und JavaScript. Ein \`\`\`html-Codeblock.` }], "", ctrl);
          for (let k = 0; k < MAX_CONTINUE && looksCut(big2) && !ctrl.signal.aborted; k++) { const m2 = await call([sys2, { role: "user", content: prompt }, { role: "assistant", content: big2 }, { role: "user", content: CONTINUE_PROMPT }], big2, ctrl); if (!m2) break; big2 += stitch(big2, m2); }
          const h2 = extractHtml(big2);
          if (h2 && /<\/html>/i.test(h2) && h2.length > after.length) { newHtml = h2; full = big2; note = `komplett überarbeitet · ${base.split("\n").length} → ${h2.split("\n").length} Zeilen`; }
        } catch { /* der kleine Stand bleibt */ }
        setStage("");
      } else if (big && newHtml && !note) note = `komplett überarbeitet · ${base.split("\n").length} → ${newHtml.split("\n").length} Zeilen`;
    }
    if (full) {
      const done = !!newHtml && /<\/html>/i.test(newHtml);
      if (newHtml && !done) toast.warning("Die Datei ist noch nicht ganz fertig. Schreib „mach weiter“.");
      update(id, (p) => ({
        ...p,
        html: newHtml ?? p.html,
        messages: [...p.messages, { role: "assistant", content: full, html: newHtml ?? undefined, note, sources, at: now() }],
        updated: now(),
      }));
      if (newHtml && window.matchMedia("(max-width: 1023px)").matches) setTab("preview");
    }
    setLive(""); setStage(""); setBusy(false); abortRef.current = null;
  };

  const doCopy = async () => {
    if (!html) return;
    if (await copyText(html)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } else toast.error("Kopieren fehlgeschlagen");
  };
  const openTab = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const remove = (id: string) => {
    const next = projects.filter((p) => p.id !== id); setProjects(next); save(user?.id, next);
    if (activeId === id) setActiveId(null);
  };

  // Bilder und Videos hochladen: sie bekommen eine feste Adresse, die die KI in die App einbaut.
  const addFiles = async (files: FileList | File[] | null) => {
    const list = [...(files || [])].filter((f) => /^(image|video)\//.test(f.type)).slice(0, 6 - atts.length);
    if (!list.length || !user) { if (files && [...files].length) toast.error("Nur Bilder und Videos (höchstens 6)."); return; }
    setUploading(true);
    try {
      for (const f of list) {
        if (f.size > (f.type.startsWith("video/") ? 80 : 12) * 1024 * 1024) { toast.error(`${f.name} ist zu groß (Bilder bis 12 MB, Videos bis 80 MB).`); continue; }
        const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
        const path = `${user.id}/build/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("chat-uploads").upload(path, f, { contentType: f.type, cacheControl: "31536000" });
        if (error) { toast.error(`${f.name}: Hochladen fehlgeschlagen`, { description: error.message }); continue; }
        const url = supabase.storage.from("chat-uploads").getPublicUrl(path).data.publicUrl;
        setAtts((a) => [...a, { url, name: f.name, mime: f.type }]);
      }
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  // Veröffentlichen unter /build/<name>
  const [slug, setSlug] = useState("");
  const [slugState, setSlugState] = useState<{ s: "idle" | "checking" | "free" | "taken" | "bad"; msg?: string }>({ s: "idle" });
  const [publishing, setPublishing] = useState(false);
  const openPublish = () => { if (!active) return; setSlug(active.slug || toSlug(active.name)); setSlugState({ s: "idle" }); setPubOpen(true); };
  useEffect(() => {
    if (!pubOpen) return;
    if (slug.length < 3) { setSlugState({ s: "bad", msg: "Mindestens 3 Zeichen" }); return; }
    if (!SLUG_RE.test(slug)) { setSlugState({ s: "bad", msg: "Nur Kleinbuchstaben, Zahlen und Bindestriche" }); return; }
    setSlugState({ s: "checking" });
    let dead = false;
    const t = setTimeout(() => {
      labsCall<{ free: boolean; mine?: boolean; reason?: string }>({ kind: "app_check", slug }).then((r) => { if (!dead) setSlugState(r.free ? { s: "free", msg: r.mine ? "Gehört schon dir – wird aktualisiert" : "Ist frei" } : { s: /vergeben/i.test(r.reason || "") ? "taken" : "bad", msg: r.reason || "Nicht verfügbar" }); })
        .catch((e) => { if (!dead) setSlugState({ s: "bad", msg: (e as Error).message }); });
    }, 350);
    return () => { dead = true; clearTimeout(t); };
  }, [slug, pubOpen]);
  const appUrl = (sl: string) => `${location.origin}/build/${sl}`;
  const publish = async () => {
    if (!active?.html || slugState.s !== "free") return;
    setPublishing(true);
    try {
      // Wechselt der Name, wird der alte wieder frei.
      if (active.slug && active.slug !== slug) await labsCall({ kind: "app_unpublish", slug: active.slug }).catch(() => {});
      await labsCall({ kind: "app_publish", slug, title: active.name, html: active.html, project_id: active.id });
      update(active.id, (p) => ({ ...p, slug, publishedAt: now() }));
      await copyText(appUrl(slug));
      toast.success("Veröffentlicht – Link kopiert", { description: appUrl(slug) });
      setSlugState({ s: "free", msg: "Gehört schon dir – wird aktualisiert" });
    } catch (e) { toast.error((e as Error).message); setSlugState({ s: "taken", msg: (e as Error).message }); }
    finally { setPublishing(false); }
  };
  const unpublish = async () => {
    if (!active?.slug) return;
    setPublishing(true);
    try { await labsCall({ kind: "app_unpublish", slug: active.slug }); update(active.id, (p) => ({ ...p, slug: undefined, publishedAt: undefined })); toast.success("Offline genommen – der Name ist wieder frei"); setPubOpen(false); }
    catch (e) { toast.error((e as Error).message); }
    finally { setPublishing(false); }
  };

  const Btn = ({ onClick, title, children, disabled }: { onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean }) => (
    <button onClick={onClick} title={title} aria-label={title} disabled={disabled}
      className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-40 touch-manipulation">{children}</button>
  );

  const composer = (big = false) => (
    <form onSubmit={(e) => { e.preventDefault(); send(); }}
      className={`rounded-3xl border border-white/10 bg-white/[0.04] p-3 ${big ? "shadow-[0_8px_40px_hsl(0_0%_0%/0.4)]" : ""}`}>
      {atts.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {atts.map((a) => (
            <div key={a.url} className="group relative h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-black/40" title={a.name}>
              {a.mime.startsWith("image/") ? <img src={a.url} alt={a.name} className="h-full w-full object-cover" /> : <video src={a.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />}
              {a.mime.startsWith("video/") && <Film className="absolute bottom-1 left-1 h-3.5 w-3.5 text-white drop-shadow" />}
              <button type="button" onClick={() => setAtts((l) => l.filter((x) => x.url !== a.url))} aria-label={`${a.name} entfernen`} className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
      <textarea
        onPaste={(e) => { const fs = [...e.clipboardData.files]; if (fs.length) { e.preventDefault(); void addFiles(fs); } }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) { e.preventDefault(); send(); } }}
        rows={big ? 3 : 2}
        placeholder={active ? "Was soll sich ändern?" : "Beschreib deine App…"}
        className="w-full resize-none bg-transparent px-1 text-[16px] placeholder:text-muted-foreground focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1">
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || atts.length >= 6} title="Bilder oder Videos hochladen, die in die App sollen" aria-label="Bilder oder Videos hochladen"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-40">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setWebOn((v) => !v)} aria-pressed={webOn} title={webOn ? "Internet-Suche ist an: Mythos sieht vor dem Bauen im Internet nach" : "Im Internet nachsehen (sonst nur, wenn dein Wunsch es braucht)"}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs ${webOn ? "bg-white/15 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}>
            <Globe className="h-4 w-4" /> <span className="hidden sm:inline">Internet</span>
          </button>
          <span className="truncate px-1 text-xs text-muted-foreground">{model === "code15:high" ? "Mythos Atlas 1.5" : "Mythos Spark 1"}</span>
        </div>
        {busy ? (
          <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Stoppen" className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background">
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button type="submit" disabled={!input.trim() || uploading} aria-label="Senden" className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-30">
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );

  // Startseite: noch kein Projekt gewählt
  if (!active) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="flex items-center gap-2 px-4 py-3">
          <Link to="/app" className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Zurück"><ArrowLeft className="h-4 w-4" /></Link>
          <span className="font-medium">App-Builder</span>
        </header>
        <main className="mx-auto max-w-2xl px-4 pb-16 pt-10 sm:pt-20">
          <h1 className="mb-2 text-center font-serif text-4xl sm:text-5xl">Was willst du bauen?</h1>
          <p className="mb-8 text-center text-muted-foreground">Beschreib deine Idee. Mythos baut die App und zeigt sie dir sofort live.</p>
          {composer(true)}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => send(e)} className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-[13px] text-foreground/90 hover:bg-white/[0.08]">{e}</button>
            ))}
          </div>
          {projects.length > 0 && (
            <section className="mt-14">
              <h2 className="mb-3 text-sm text-muted-foreground">Deine Projekte</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {projects.map((p) => (
                  <div key={p.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                    <button onClick={() => setActiveId(p.id)} className="block w-full text-left">
                      <div className="pointer-events-none h-36 overflow-hidden bg-white">
                        {p.html && <iframe title={p.name} srcDoc={p.html} sandbox="" className="origin-top-left border-0" style={{ width: "400%", height: 576, transform: "scale(0.25)" }} tabIndex={-1} />}
                      </div>
                      <div className="px-3 py-2 text-sm">{p.name}<div className="text-xs text-muted-foreground">{new Date(p.updated).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</div></div>
                    </button>
                    <div className="flex justify-end px-2 pb-2"><Btn onClick={() => remove(p.id)} title="Projekt löschen"><Trash2 className="h-4 w-4" /></Btn></div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    );
  }

  const chatPane = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {active.messages.map((m, i) => m.role === "user" ? (
          <div key={i} className="ml-auto max-w-[85%] space-y-2">
            {m.atts && m.atts.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {m.atts.map((a) => (
                  <a key={a.url} href={a.url} target="_blank" rel="noreferrer" title={a.name} className="relative block h-14 w-14 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                    {a.mime.startsWith("image/") ? <img src={a.url} alt={a.name} loading="lazy" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-muted-foreground"><Film className="h-5 w-5" /></span>}
                  </a>
                ))}
              </div>
            )}
            <div className="whitespace-pre-wrap rounded-2xl bg-white/[0.08] px-4 py-2.5 text-[15px]">{m.content}</div>
          </div>
        ) : (
          <div key={i} className="space-y-2 text-[15px]">
            {proseOf(m.content) && <p className="whitespace-pre-wrap text-foreground/90">{proseOf(m.content)}</p>}
            {m.sources && m.sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5" /> Im Internet nachgesehen:
                {m.sources.map((src) => { let host = src.url; try { host = new URL(src.url).hostname.replace(/^www\./, ""); } catch { /* so lassen */ } return <a key={src.url} href={src.url} target="_blank" rel="noreferrer" title={src.title} className="rounded-full border border-white/10 px-2 py-0.5 hover:text-foreground">{host}</a>; })}
              </div>
            )}
            {m.html && (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <FileCode2 className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 min-w-0 truncate">index.html {active.html === m.html ? "(aktuell)" : ""}{m.note && <span className="ml-2 text-xs text-muted-foreground">{m.note}</span>}</span>
                {active.html !== m.html && (
                  <button onClick={() => update(active.id, (p) => ({ ...p, html: m.html!, updated: now() }))} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <RotateCcw className="h-3.5 w-3.5" /> Wiederherstellen
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="space-y-2 text-[15px]">
            {proseOf(live) && <p className="whitespace-pre-wrap text-foreground/90">{proseOf(live)}</p>}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="mythos-shimmer">{stage ? stage : liveHtml ? `Schreibt index.html (${liveHtml.split("\n").length} Zeilen)` : hasEditMarkers(live) ? `Ändert index.html gezielt (${countEditStarts(live)} ${countEditStarts(live) === 1 ? "Stelle" : "Stellen"})` : active?.html ? "Sucht die Stellen zum Ändern…" : "Plant die App…"}</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="p-3">{composer()}</div>
    </div>
  );

  const previewPane = (
    <div className="flex h-full min-h-0 items-start justify-center overflow-auto bg-[hsl(0_0%_6%)] p-0 lg:p-3">
      {previewHtml ? (
        <iframe
          key={reloadKey}
          title="Vorschau"
          srcDoc={withShim(previewHtml)}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          className={`h-full border-0 bg-white ${device === "phone" ? "w-[390px] max-w-full rounded-[28px] border-[6px] border-black lg:h-[780px]" : "w-full lg:rounded-xl"}`}
        />
      ) : (
        <div className="m-auto flex flex-col items-center gap-2 text-sm text-muted-foreground">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Eye className="h-5 w-5" />}
          {busy ? "Die Vorschau erscheint, sobald die Datei fertig ist." : "Noch keine Vorschau."}
        </div>
      )}
    </div>
  );

  const codePane = (
    <pre className="h-full min-h-0 overflow-auto bg-[hsl(0_0%_6%)] p-4 font-mono text-[12.5px] leading-relaxed text-foreground/90"><code>{html || "// Noch kein Code"}</code></pre>
  );

  const tools = (
    <div className="flex items-center gap-0.5">
      <Btn onClick={() => setReloadKey((k) => k + 1)} title="Vorschau neu laden" disabled={!html}><RefreshCw className="h-4 w-4" /></Btn>
      <Btn onClick={() => setDevice((d) => (d === "phone" ? "desktop" : "phone"))} title={device === "phone" ? "Desktop-Ansicht" : "Handy-Ansicht"}>
        {device === "phone" ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
      </Btn>
      <Btn onClick={doCopy} title="Code kopieren" disabled={!html}>{copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}</Btn>
      <Btn onClick={() => downloadFile("index.html", html)} title="index.html herunterladen" disabled={!html}><Download className="h-4 w-4" /></Btn>
      <Btn onClick={openTab} title="In neuem Tab öffnen" disabled={!html}><ExternalLink className="h-4 w-4" /></Btn>
    </div>
  );

  const seg = (v: string, cur: string, set: () => void, Icon: typeof Eye, label: string) => (
    <button onClick={set} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${v === cur ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-white/10 px-2 py-1.5 sm:px-3">
        <button onClick={() => setActiveId(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground" aria-label="Alle Projekte"><ArrowLeft className="h-4 w-4" /></button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{active.name}</span>
        <div className="hidden items-center gap-1 lg:flex">
          {seg("preview", view, () => setView("preview"), Eye, "Vorschau")}
          {seg("code", view, () => setView("code"), Code2, "Code")}
        </div>
        <div className="hidden lg:block">{tools}</div>
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex" title={cloud === "off" ? "Nur auf diesem Gerät gespeichert (Konto-Speicher gerade nicht erreichbar)" : "In deinem Konto gespeichert – auf jedem Gerät verfügbar"}>
          {cloud === "off" ? <CloudOff className="h-3.5 w-3.5" /> : cloud === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
          <span className="hidden md:inline">{cloud === "off" ? "Nur lokal" : cloud === "saving" ? "Speichert…" : "Gespeichert"}</span>
        </span>
        <button onClick={openPublish} disabled={!active.html || busy} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-40">
          <Rocket className="h-3.5 w-3.5" /> {active.slug ? "Veröffentlicht" : "Veröffentlichen"}
        </button>
        <Btn onClick={() => { setActiveId(null); setInput(""); }} title="Neues Projekt"><Plus className="h-4 w-4" /></Btn>
      </header>

      <Dialog open={pubOpen} onOpenChange={setPubOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>App veröffentlichen</DialogTitle>
          <DialogDescription>Such dir eine Adresse aus. Jeder mit dem Link kann die App öffnen – ohne Anmeldung.</DialogDescription>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs text-muted-foreground">Adresse</span>
            <div className="flex items-center overflow-hidden rounded-xl border border-border bg-muted/30 focus-within:border-foreground/40">
              <span className="shrink-0 pl-3 text-sm text-muted-foreground">{location.host}/build/</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-").slice(0, 40))} onKeyDown={(e) => { if (e.key === "Enter") void publish(); }}
                autoFocus spellCheck={false} autoCapitalize="none" placeholder="mein-cafe" className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm font-medium outline-none" aria-label="Name der Adresse" />
            </div>
          </label>
          <p className={`flex items-center gap-1.5 text-xs ${slugState.s === "free" ? "text-emerald-400" : slugState.s === "checking" || slugState.s === "idle" ? "text-muted-foreground" : "text-red-400"}`} role="status">
            {slugState.s === "checking" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Prüft, ob der Name frei ist…</> : slugState.s === "free" ? <><Check className="h-3.5 w-3.5" /> {slugState.msg}</> : slugState.s === "idle" ? "" : <><X className="h-3.5 w-3.5" /> {slugState.msg}</>}
          </p>
          {active.slug && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
              <div className="text-muted-foreground">Aktuell online{active.publishedAt ? ` (Stand ${new Date(active.publishedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })})` : ""}:</div>
              <a href={appUrl(active.slug)} target="_blank" rel="noreferrer" className="break-all font-medium underline-offset-2 hover:underline">{appUrl(active.slug)}</a>
              {active.publishedAt && active.updated > active.publishedAt && <div className="mt-1 text-amber-400">Du hast seitdem etwas geändert – „Aktualisieren“ bringt den neuen Stand online.</div>}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {active.slug && <button onClick={unpublish} disabled={publishing} className="mr-auto rounded-full border border-border px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">Offline nehmen</button>}
            {active.slug && <button onClick={async () => { await copyText(appUrl(active.slug!)); toast.success("Link kopiert"); }} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm hover:bg-muted"><Copy className="h-4 w-4" /> Link</button>}
            <button onClick={publish} disabled={publishing || slugState.s !== "free"} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40">
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} {active.slug === slug ? "Aktualisieren" : active.slug ? "Unter neuem Namen veröffentlichen" : "Veröffentlichen"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Handy: Umschalter Chat / Vorschau / Code */}
      <div className="flex items-center justify-between gap-1 border-b border-white/10 px-2 py-1.5 lg:hidden">
        <div className="flex gap-1">
          {seg("chat", tab, () => setTab("chat"), MessageSquare, "Chat")}
          {seg("preview", tab, () => setTab("preview"), Eye, "Vorschau")}
          {seg("code", tab, () => setTab("code"), Code2, "Code")}
        </div>
        {tab !== "chat" && tools}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className={`min-h-0 w-full border-white/10 lg:block lg:w-[420px] lg:shrink-0 lg:border-r ${tab === "chat" ? "block" : "hidden"}`}>{chatPane}</aside>
        <section className={`min-h-0 flex-1 lg:block ${tab === "chat" ? "hidden" : "block"}`}>
          <div className="h-full lg:hidden">{tab === "code" ? codePane : previewPane}</div>
          <div className="hidden h-full lg:block">{view === "code" ? codePane : previewPane}</div>
        </section>
      </div>
    </div>
  );
}
