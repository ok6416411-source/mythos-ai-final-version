// ============================================================================
// Mythos-Modellkatalog – EINZIGE Quelle für Namen, Versionen, Aufwände, Farben
// und die echte Technik dahinter. Website (src/lib/mythosModels.ts), Server
// (chat, v1-messages, Katalog-Prompt), Desktop-App und CLI lesen alle hier.
//
// Ein Modell wird besser/aktualisiert?  → `version` erhöhen und einen Eintrag
// in `changelog` schreiben. Der Name ändert sich dann überall automatisch,
// und die KI kennt die Neuerung.
// Reines TypeScript ohne Deno-/Vite-Importe, damit es überall läuft.
// ============================================================================

export type Tier = "free" | "light" | "pro";
export type EffortId = "instant" | "low" | "normal" | "high" | "ultra" | "ultracode" | "giga";

export type EffortMeta = { label: string; hint: string; style: string; memory: boolean };

export const EFFORTS: Record<EffortId, EffortMeta> = {
  instant: { label: "Instant", hint: "Sofort, 1–2 Sätze", memory: false,
    style: "Modus INSTANT: Antworte in maximal 1-2 Sätzen. Keine Vorrede, keine Überschriften, keine Listen, keine Rückfragen, kein Markdown außer Code-Blöcken. Direkt die Antwort, sofort." },
  low: { label: "Low", hint: "Schnell & knapp", memory: false,
    style: "Modus LOW: Antworte kurz und direkt — ein kleiner Absatz oder max. 3 Bullets. Keine Einleitung, kein Fazit." },
  normal: { label: "Normal", hint: "Ausbalanciert", memory: true,
    style: "Modus NORMAL: Ausbalanciert — klar strukturiert, angemessen ausführlich, mit kurzem Beispiel wenn hilfreich." },
  high: { label: "High", hint: "Gründlich & durchdacht", memory: true,
    style: "Modus HIGH: Denke gründlich durch, prüfe Randfälle, strukturiere mit Überschriften/Bullets und begründe deine Empfehlung." },
  ultra: { label: "Ultra", hint: "Tiefes Reasoning", memory: true,
    style: "Modus ULTRA: Maximal sorgfältig — Annahmen offenlegen, Alternativen vergleichen, tiefe, vollständige und präzise Antwort mit klarer Struktur." },
  ultracode: { label: "Ultra Code", hint: "Komplette Implementierungen", memory: true,
    style: "Modus ULTRA CODE: Vollständige, lauffähige Implementierungen, Fehlerbehandlung, Tests/Beispiele und kurze Architektur-Begründung." },
  giga: { label: "Giga Code", hint: "Ganze Projekte, maximal", memory: true,
    style: "Modus GIGA CODE: Projekt-Qualität — Architektur, vollständiger Code, Edge-Cases, Tests, Performance- und Security-Hinweise." },
};

/** Echte Technik hinter einem Modell+Aufwand (nur serverseitig sichtbar). */
export type Tune = {
  model: string;
  reasoning?: "none" | "low" | "medium" | "high";
  fast?: boolean;
  maxOut: number;
  web: boolean;
  temperature?: number;
  lean?: boolean;
  depth?: boolean;
};

export type FamilyEffort = { id: EffortId; minTier: Tier; tune: Tune };

export type ModelFamily = {
  id: string;            // stabile ID (nie ändern – steckt in gespeicherten Chats)
  name: string;          // „Spark“
  version: string;       // „1“ → bei Verbesserung erhöhen
  minTier: Tier;
  kind: "chat" | "code";
  rank: number;          // 1 = schwächstes … 5 = stärkstes (für Vergleiche)
  scores: { speed: number; smart: number; code: number; creative: number }; // 1–5 für den Modell-Vergleich
  desc: string;
  strengths: string;     // für die KI: wofür dieses Modell ideal ist
  theme: { a: string; b: string; glow: string; fx: "ripple" | "sparks" | "lightning" | "ember" | "orbit" };
  efforts: FamilyEffort[];
  changelog: { version: string; date: string; text: string }[];
};

const T = (model: string, maxOut: number, o: Partial<Tune> = {}): Tune => ({ model, maxOut, web: true, ...o });
const E = (id: EffortId, minTier: Tier, tune: Tune): FamilyEffort => ({ id, minTier, tune });

export const MODEL_FAMILIES: ModelFamily[] = [
  {
    id: "pebble", name: "Pebble", version: "1", minTier: "free", kind: "chat", rank: 1, scores: { speed: 5, smart: 1, code: 1, creative: 2 },
    desc: "Winzig & blitzschnell für kurze Fragen",
    strengths: "kurze Fakten, Umformulieren, schnelle Ja/Nein-Antworten",
    theme: { a: "#a8a29e", b: "#e7e5e4", glow: "rgba(214,211,209,.55)", fx: "ripple" },
    efforts: [
      E("instant", "free", T("google/gemini-3.1-flash-lite", 160, { web: false, temperature: 0.2, lean: true })),
      E("low", "free", T("google/gemini-3.1-flash-lite", 400, { web: false, temperature: 0.4, lean: true })),
      E("normal", "free", T("google/gemini-3.1-flash-lite", 1400, { web: false, temperature: 0.6, lean: true })),
    ],
    changelog: [{ version: "1", date: "2026-11-11", text: "Neu: kleinstes und schnellstes Mythos-Modell." }],
  },
  {
    id: "v1", name: "Spark", version: "1", minTier: "free", kind: "chat", rank: 2, scores: { speed: 4, smart: 3, code: 2, creative: 4 },
    desc: "Schneller Allrounder für Alltag & Support",
    strengths: "Alltag, Support, Texte, Erklärungen, Recherche",
    theme: { a: "#facc15", b: "#fb923c", glow: "rgba(250,204,21,.5)", fx: "sparks" },
    efforts: [
      E("instant", "free", T("google/gemini-3.1-flash-lite", 220, { web: false, temperature: 0.3, lean: true })),
      E("low", "free", T("google/gemini-3.1-flash-lite", 550, { web: false, temperature: 0.5, lean: true })),
      E("normal", "free", T("google/gemini-3.6-flash", 3200, { temperature: 0.7 })),
      E("high", "free", T("google/gemini-3.1-pro-preview", 7000, { temperature: 0.7, depth: true })),
      E("ultra", "light", T("openai/gpt-5.5", 10000, { reasoning: "medium", depth: true })),
    ],
    changelog: [{ version: "1", date: "2026-11-11", text: "Neuer Name (vorher Mythos v1)." }],
  },
  {
    id: "code11", name: "Bolt", version: "1.2", minTier: "free", kind: "code", rank: 3, scores: { speed: 4, smart: 3, code: 4, creative: 3 },
    desc: "Code, Debugging & Technik",
    strengths: "Programmieren im Alltag, Bugs fixen, Skripte, kleine bis mittlere Apps",
    theme: { a: "#22d3ee", b: "#6366f1", glow: "rgba(34,211,238,.5)", fx: "lightning" },
    efforts: [
      E("instant", "free", T("openai/gpt-5.4-nano", 300, { reasoning: "none", web: false, lean: true })),
      E("low", "free", T("openai/gpt-5.4-mini", 700, { reasoning: "none", fast: true, web: false, lean: true })),
      E("normal", "free", T("openai/gpt-5.4", 4400, { reasoning: "low" })),
      E("high", "free", T("openai/gpt-5.4", 8000, { reasoning: "high", depth: true })),
      E("ultra", "light", T("openai/gpt-5.5", 12000, { reasoning: "medium", depth: true })),
      E("ultracode", "light", T("openai/gpt-5.5", 18000, { reasoning: "high", depth: true })),
    ],
    changelog: [
      { version: "1.1", date: "2026-10-01", text: "Erste Version (MythosCode v1.1)." },
      { version: "1.2", date: "2026-11-11", text: "Profi-Coding-Wissen für alle Projektarten (Web-Apps, Backends, Python, Bots), ehrliche Abschlussberichte, Schleifen-Erkennung." },
    ],
  },
  {
    id: "v2", name: "Amber", version: "2", minTier: "pro", kind: "chat", rank: 4, scores: { speed: 2, smart: 5, code: 4, creative: 5 },
    desc: "Flaggschiff — stärkstes Reasoning",
    strengths: "schwierige Analysen, Strategie, Mathe, lange Texte, Planung",
    theme: { a: "#f59e0b", b: "#c2410c", glow: "rgba(245,158,11,.55)", fx: "ember" },
    efforts: [
      E("instant", "pro", T("openai/gpt-5.6-luna", 300, { reasoning: "none", web: false, lean: true })),
      E("low", "pro", T("openai/gpt-5.6-luna", 750, { reasoning: "none", fast: true, web: false, lean: true })),
      E("normal", "pro", T("openai/gpt-5.6-sol", 7000, { reasoning: "medium", fast: true, depth: true })),
      E("high", "pro", T("openai/gpt-5.6-sol", 14000, { reasoning: "high", fast: true, depth: true })),
      E("ultra", "pro", T("openai/gpt-5.6-sol", 28000, { reasoning: "high", depth: true })),
    ],
    changelog: [{ version: "2", date: "2026-11-11", text: "Neuer Name (vorher Mythos v2)." }],
  },
  {
    id: "code15", name: "Atlas", version: "1.6", minTier: "pro", kind: "code", rank: 5, scores: { speed: 2, smart: 5, code: 5, creative: 4 },
    desc: "Profi-Code für ganze Projekte",
    strengths: "große Features, Architektur, ganze Projekte, Refactorings, Agent-Arbeit in App & CLI",
    theme: { a: "#34d399", b: "#0ea5e9", glow: "rgba(52,211,153,.5)", fx: "orbit" },
    efforts: [
      E("instant", "pro", T("openai/gpt-5.6-luna", 400, { reasoning: "none", web: false, lean: true })),
      E("low", "pro", T("openai/gpt-5.6-terra", 900, { reasoning: "none", fast: true, web: false, lean: true })),
      E("normal", "pro", T("openai/gpt-5.6-sol", 6000, { reasoning: "low", fast: true })),
      E("high", "pro", T("openai/gpt-5.6-sol", 11000, { reasoning: "medium", fast: true, depth: true })),
      E("ultra", "pro", T("openai/gpt-5.6-sol", 18000, { reasoning: "high", depth: true })),
      E("giga", "pro", T("openai/gpt-5.6-sol", 32000, { reasoning: "high", depth: true })),
    ],
    changelog: [
      { version: "1.5", date: "2026-10-01", text: "Erste Version (MythosCode v1.5)." },
      { version: "1.6", date: "2026-11-11", text: "Profi-Coding-Wissen für alle Projektarten, echtes Veröffentlichen (publish), Projektordner-Prüfung, Schleifen-Erkennung." },
    ],
  },
];

export const DEFAULT_MODEL_ID = "v1:normal";
export const DEFAULT_CODE_ID = "code15:high";

export const familyLabel = (f: ModelFamily) => `Mythos ${f.name} ${f.version}`;
export const findFamily = (id: string) => MODEL_FAMILIES.find((f) => f.id === id);

/** Akzeptiert „v2:high“, „mythos-v2“, „amber“, „Mythos Amber 2 · High“, „atlas:giga“ … */
export function resolveModelId(raw: unknown): { family: ModelFamily; effort: FamilyEffort; id: string } {
  let s = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  s = s.replace(/^mythos[-_ ]?/, "").replace(/\s*·\s*/g, ":").replace(/[-_ ]+/g, ":");
  let [f, e] = s.split(":").filter(Boolean);
  let fam = findFamily(f || "") || MODEL_FAMILIES.find((x) => x.name.toLowerCase() === f);
  if (!fam && f) {
    // Alte Namen und Kurzformen
    const legacy: Record<string, string> = { code: "code15", sonnet: "v1", opus: "v2", haiku: "pebble", lite: "pebble", v1: "v1", v2: "v2" };
    if (legacy[f]) fam = findFamily(legacy[f]);
  }
  fam = fam || findFamily("v1")!;
  // Versionsnummern im Namen („amber:2:high“) überspringen
  if (e && /^\d/.test(e)) e = s.split(":").filter(Boolean)[2];
  const eff = fam.efforts.find((x) => x.id === e) || fam.efforts.find((x) => x.id === "normal") || fam.efforts[0];
  return { family: fam, effort: eff, id: `${fam.id}:${eff.id}` };
}

/** Wissen für die KI: alle aktuellen Modelle, Aufwände und Neuerungen. */
export function modelCatalogPrompt(): string {
  const lines = MODEL_FAMILIES.map((f) => {
    const plan = f.minTier === "free" ? "kostenlos" : f.minTier === "light" ? "ab Light" : "Pro";
    const effs = f.efforts.map((e) => EFFORTS[e.id].label + (e.minTier !== f.minTier ? ` (${e.minTier === "pro" ? "Pro" : "ab Light"})` : "")).join(", ");
    return `- **${familyLabel(f)}** (${plan}, Stärke ${f.rank}/5) — ${f.desc}. Ideal für: ${f.strengths}. Aufwände: ${effs}.`;
  });
  const news = MODEL_FAMILIES.flatMap((f) => f.changelog.map((c) => ({ ...c, n: `${f.name} ${c.version}` })))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((c) => `- ${c.date} · ${c.n}: ${c.text}`);
  const effortDocs = (Object.keys(EFFORTS) as EffortId[]).map((k) => `- **${EFFORTS[k].label}** — ${EFFORTS[k].hint}`);
  return [
    "## Mythos-Modelle (aktueller Stand – von schwach/schnell nach stark)",
    ...lines,
    "",
    "## Aufwände (wie viel das Modell nachdenkt)",
    ...effortDocs,
    "",
    "## Neu bei den Modellen",
    ...news,
    "",
    "Empfehlung: Kurze Frage → Pebble/Spark · Instant/Low. Alltag → Spark · Normal. Code → Bolt (kostenlos) oder Atlas (Pro). Schwierige Analyse → Amber · High/Ultra. Ganzes Projekt → Atlas · Giga Code.",
    "Versionsnummern steigen, wenn ein Modell verbessert wird. Nenne Modelle immer mit Namen + Version.",
  ].join("\n");
}

/** Allgemeines Wissen über Mythos AI (Website + Server). */
export const MYTHOS_SELF = `## Wissen über Mythos AI (für Fragen, Vergleiche und Quizze über dich selbst)
- Mythos AI ist eine deutsche KI-Plattform von Mythoscraft mit Chat, Coding, Grafik, Musik, Video, Sprache und Minecraft-Anbindung.
- Pläne: Free (kostenlos, 20 Chats am Tag, Pebble/Spark/Bolt), Light (2,99 €/Monat, 150 Chats am Tag, Ultra-Aufwand bei Spark und Bolt, Bilder), Pro (6,99 €/Monat, unbegrenzt, Amber und Atlas, Musik, Video, Live-Anruf, Mythos Code App und CLI). Dazu gibt es Token-Limits pro Stunde, Woche und Monat – eine laufende Aufgabe wird trotzdem fertig.
- Modellfamilie von klein nach groß: Pebble → Spark → Bolt → Amber → Atlas. Versionsnummern steigen, wenn ein Modell verbessert wird. Aufwände: Instant, Low, Normal, High, Ultra, dazu Ultra Code (Bolt) und Giga Code (Atlas).
- Mythos Code: Coding-Agent als Windows-App und als CLI (npm), arbeitet mit Werkzeugen (Dateien lesen/schreiben, Befehle, Tests, Vorschau, Veröffentlichen unter /build/<name>), nur mit Pro.
- App-Builder (/build): Apps aus einer Beschreibung bauen, Dateien gezielt ändern, Vorschau, speichern und unter eigener Adresse veröffentlichen.
- Weitere Bereiche: Filmstudio (Kurzfilme), Cloud-PC (Agent mit eigenem PC), Räume (gemeinsam chatten), Personas, Gedächtnis, Arena (zwei Antworten im Vergleich), Spiele, Galerie, Mythos Browser-Erweiterung, Minecraft-Server-Anbindung (MythosCraft).
- Chat-Extras: klickbare Bausteine (Auswahl, Fragen, Quiz), Live-Vorschau für HTML/SVG/3D-Modelle, Teilen-Links (/s/…), Dateien als ZIP, Vorlesen, Modell-Animationseffekte (Design passt sich dem Modell an).
Ein Quiz über Mythos baust du nur aus diesen Fakten – erfinde nichts dazu.`;
