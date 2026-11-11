// Was Mythos selbst kann: Befehle und Bereiche der Website. Geht als Hinweis an jedes Modell im Chat,
// damit Mythos seine Fähigkeiten kennt, sie empfiehlt und nicht z. B. behauptet, er könne keine Bilder machen.
import { EFFORTS, MYTHOS_SELF, familyLabel, modelCatalogPrompt, resolveModelId } from "../../supabase/functions/_shared/modelCatalog";

export type CommandInfo = { cmd: string; args: string; desc: string; admin?: boolean };

const AREAS: [string, string][] = [
  ["/voice", "Live-Anruf mit Mythos (sprechen, dazwischenreden)"],
  ["/filmstudio", "Kurzfilm aus einer Idee mit Sprecher und Musik"],
  ["/cloud-pc", "Agent mit eigenem PC im Browser, live zuschauen"],
  ["/raeume", "Gemeinsame Räume: Gruppen-Chat mit Live-Cursorn, Notiz und Dateien"],
  ["/groups", "Gruppen-Chats"],
  ["/create", "App-Builder: Apps aus einer Beschreibung bauen"],
  ["/build", "Build-Ansicht für eigene Apps"],
  ["/agents", "Eigene Agenten anlegen"],
  ["/personas", "Personas (eigene Charaktere für den Chat)"],
  ["/memories", "Gedächtnis: was Mythos sich über dich merkt"],
  ["/twin", "Digitaler Zwilling"],
  ["/arena", "Zwei KI-Antworten im Vergleich"],
  ["/games", "KI-Spiele"],
  ["/welt", "Mythos-Welt"],
  ["/foto-app", "Foto-App"],
  ["/ki-team", "KI-Team"],
  ["/rueckblick", "Tagesrückblick mit Bild"],
  ["/marktplatz", "Marktplatz"],
  ["/entdecken", "Entdecken"],
  ["/mc-servers", "Minecraft-Server verbinden (MythosCraft)"],
  ["/browser", "Mythos Browser"],
  ["/code", "Mythos Code (Coding-Agent als Windows-App und CLI)"],
  ["/downloads", "Downloads: Browser, Notch, Code-App, CLI"],
  ["/docs", "API-Doku (Claude-kompatible Mythos-API)"],
  ["/dashboard", "Konto, Abo (Light 2,99 €, Pro 6,99 €) und API-Schlüssel"],
];

export function capabilitiesPrompt(commands: CommandInfo[], isAdmin = false): string {
  const cmds = commands.filter((c) => isAdmin || !c.admin).map((c) => `- \`${c.cmd}${c.args ? " " + c.args : ""}\` – ${c.desc}`);
  return [
    "## Deine Fähigkeiten (Mythos)",
    "Das hier kannst du wirklich. Empfiehl passende Befehle oder Seiten, erfinde keine anderen.",
    "Bilder/Grafiken: Du zeichnest sie selbst als SVG (Befehl /grafik oder einfach „zeichne …“) – sie erscheinen im Chat direkt als Bild. " +
      "Sag nie, dass du keine Bilder machen kannst.",
    "Vorlesen: Jede Antwort hat einen Lautsprecher-Knopf; Stimmen sind unter /voice wählbar.",
    "Dateien: Nutzer können Bilder und PDFs anhängen, du siehst und analysierst sie.",
    "",
    "### Chat-Befehle",
    ...cmds,
    "",
    "### Bereiche der Website",
    ...AREAS.map(([p, d]) => `- ${p} – ${d}`),
  ].join("\n");
}


/** Wer Mythos gerade ist (gewähltes Modell) + alles über Mythos AI – damit die KI sich richtig vorstellt,
 *  Modelle vergleichen und auch ein Quiz über sich selbst mit echten Fakten erstellen kann. */
export function identityPrompt(modelId: string): string {
  const { family, effort } = resolveModelId(modelId);
  const me = `${familyLabel(family)} · ${EFFORTS[effort.id].label}`;
  return [
    "## Wer du gerade bist (hat Vorrang vor älteren Angaben)",
    `Du bist **${familyLabel(family)}**, Aufwand **${EFFORTS[effort.id].label}** (${me}). Fragt jemand „Welches Modell bist du?“, antworte genau so.`,
    "Die alten Namen „Mythos v1“, „Mythos v2“, „MythosCode v1.1“ und „MythosCode v1.5“ gibt es nicht mehr – sie heißen jetzt Spark, Amber, Bolt und Atlas. Nenne nie einen anderen Anbieter oder ein fremdes Modell.",
    "",
    modelCatalogPrompt(),
    "",
    MYTHOS_SELF,
  ].join("\n");
}


