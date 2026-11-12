// 20-€-Draft: Start und Kartenstapel – unabhängig davon, ob das Modell den Baustein von selbst kennt.
const THEMES: { title: string; emoji: string; text: string }[] = [
  { title: "Fußball-Startelf", emoji: "⚽", text: "Die besten Spieler aller Zeiten" },
  { title: "Bester Burger", emoji: "🍔", text: "5 Zutaten, ein Traum" },
  { title: "Traumgarten", emoji: "🌳", text: "Pool, Grill, Baumhaus …" },
  { title: "Minecraft-Base", emoji: "⛏️", text: "Blöcke, Farmen, Mobs" },
  { title: "Rapper-Crew", emoji: "🎤", text: "Deutschrap-Legenden" },
  { title: "Traumauto", emoji: "🏎️", text: "Motor, Felgen, Extras" },
  { title: "Gaming-Setup", emoji: "🖥️", text: "PC, Stuhl, Monitor …" },
  { title: "Pizza", emoji: "🍕", text: "Teig, Soße, Beläge" },
  { title: "Superhelden-Team", emoji: "🦸", text: "Wer rettet die Welt?" },
  { title: "Urlaubstag", emoji: "🏝️", text: "Ort, Hotel, Aktivitäten" },
  { title: "NBA-Starting-Five", emoji: "🏀", text: "Basketball-Größen" },
  { title: "YouTuber-Team", emoji: "📹", text: "Wer macht das beste Video?" },
];

/** „Lass uns das 20-€-Spiel spielen“ & Co. */
export function isDraftStart(text: string): boolean {
  const t = text.toLowerCase();
  return /\b20\s*(€|euro|eur|dollar|\$)\s*-?\s*(spiel|game|draft|challenge)|\b(\$|€)\s*20\s*-?\s*(spiel|game|draft)|\bdraft[- ]?spiel\b/.test(t) && !/^starte das 20-€-draft/i.test(text.trim());
}

/** Themenwahl als fertiger Baustein (3 zufällige Themen). */
export function draftThemesReply(): string {
  const pick = [...THEMES].sort(() => Math.random() - 0.5).slice(0, 3);
  return "Lass uns spielen! 💶 Such dir ein Thema aus – oder gib unten ein eigenes ein.\n\n```mythos-ui\n" + JSON.stringify({ type: "draft", themes: pick }) + "\n```";
}

/** Thema aus „Starte das 20-€-Draft mit dem Thema „X“.“ */
export function draftTheme(text: string): string | null {
  const m = text.trim().match(/^starte das 20-€-draft mit dem thema „(.+?)“/i);
  return m ? m[1].trim() : null;
}

/** Genauer Auftrag an die KI für den Kartenstapel. */
export function draftDeckPrompt(theme: string): string {
  return [
    `Wir spielen das 20-€-Draft mit dem Thema «${theme}». Antworte mit EINEM kurzen, lockeren Satz und danach GENAU diesem Baustein (gültiges JSON, nur doppelte Anführungszeichen):`,
    "```mythos-ui",
    `{"type":"draft","theme":"${theme.replace(/"/g, "'")}","emoji":"<passendes Emoji>","budget":20,"slots":5,"deck":[{"name":"…","emoji":"…","value":9,"note":"kurzer Fakt oder Witz"}]}`,
    "```",
    "Regeln für den Stapel:",
    "- Genau 14 Karten, in zufälliger Reihenfolge.",
    "- Konkrete, echte Dinge/Personen/Marken zum Thema (keine Platzhalter wie „Spieler 1“).",
    "- Gemischte Qualität: etwa 4 Top-Karten (value 8–10), 5 solide (5–7), 5 schwache oder witzige (1–4).",
    "- note: höchstens 6 Wörter.",
    "- KEINE Regeln erklären, NICHT selbst im Text bieten, keine Optionen A/B – das Spiel läuft komplett im Baustein.",
  ].join("\n");
}
