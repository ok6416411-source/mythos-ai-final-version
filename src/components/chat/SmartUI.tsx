import { useEffect, useRef, useState } from "react";
import "@/lib/mythos-code-shared/smartui.js";
import { copyText } from "@/lib/copyText";

type SmartUIApi = {
  render: (raw: string, opts: Record<string, unknown>) => HTMLElement;
  parse: (raw: string) => unknown;
  PROMPT: string;
};
export const smartUI = (window as unknown as { MythosSmartUI: SmartUIApi }).MythosSmartUI;
export const SMART_UI_PROMPT = smartUI.PROMPT;

/** ```mythos-ui-Blöcke aus Text entfernen (zum Kopieren und Vorlesen). */
export const stripSmartUI = (text: string) => text.replace(/```mythos-ui[\s\S]*?(?:```|$)/g, "").replace(/\n{3,}/g, "\n\n").trim();

/** Im Web-Chat werden Checklisten unten angeheftet; im Verlauf steht dann nur ein Hinweis. */
export const smartUIOptions = { pinChecklists: false };

/** Klick auf einen Button in der Oberfläche schickt den Text als neue Nachricht (Chat.tsx hört darauf). */
export const SMART_UI_SEND = "mythos:smartui-send";

// Fertig gebaute Oberflächen werden aufgehoben und wiederverwendet. Der Chat zeichnet Nachrichten ständig neu
// (beim Tippen, Streamen, Scrollen) – ohne das würden Quiz, Auswahl und Rechner dabei jedes Mal zurückgesetzt.
const built = new Map<string, HTMLElement[]>();
const MAX_BUILT = 80;
function elementFor(raw: string, make: () => HTMLElement): HTMLElement {
  const list = built.get(raw) || [];
  // Gleicher Block steht evtl. mehrfach im Chat: nur ein Exemplar nehmen, das gerade nirgends angezeigt wird.
  const free = list.find((el) => !el.isConnected);
  if (free) return free;
  const el = make();
  built.delete(raw); built.set(raw, [...list, el]);
  if (built.size > MAX_BUILT) built.delete(built.keys().next().value as string);
  return el;
}

/** Intelligente Oberfläche aus einem ```mythos-ui-Block. */
export default function SmartUI({ raw }: { raw: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const complete = !!smartUI.parse(raw);
  // Bleibt der Block 4 s gleich und ist trotzdem kein JSON, ist er kaputt (statt ewig „wird gebaut…“).
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (complete) return;
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 4000);
    return () => clearTimeout(t);
  }, [raw, complete]);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const make = (streaming: boolean) => smartUI.render(raw, {
      streaming,
      send: (text: string) => window.dispatchEvent(new CustomEvent(SMART_UI_SEND, { detail: text })),
      openLink: (url: string) => window.open(url, "_blank", "noopener"),
      copy: (text: string) => { void copyText(text); },
      pinChecklists: smartUIOptions.pinChecklists,
    });
    // Vollständiger Block: einmal bauen, danach immer dasselbe Element zeigen (Zustand bleibt erhalten).
    const el = complete ? elementFor(raw, () => make(false)) : make(!settled);
    if (box.firstChild !== el || box.childNodes.length !== 1) box.replaceChildren(el);
  }, [raw, settled, complete]);
  return <div ref={ref} className="not-prose" />;
}
