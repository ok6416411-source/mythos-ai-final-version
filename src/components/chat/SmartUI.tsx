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

/** Klick auf einen Button in der Oberfläche schickt den Text als neue Nachricht (Chat.tsx hört darauf). */
export const SMART_UI_SEND = "mythos:smartui-send";

/** Intelligente Oberfläche aus einem ```mythos-ui-Block. */
export default function SmartUI({ raw }: { raw: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Bleibt der Block 4 s gleich und ist trotzdem kein JSON, ist er kaputt (statt ewig „wird gebaut…“).
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 4000);
    return () => clearTimeout(t);
  }, [raw]);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.replaceChildren(smartUI.render(raw, {
      streaming: !settled,
      send: (text: string) => window.dispatchEvent(new CustomEvent(SMART_UI_SEND, { detail: text })),
      openLink: (url: string) => window.open(url, "_blank", "noopener"),
      copy: (text: string) => { void copyText(text); },
    }));
  }, [raw, settled]);
  return <div ref={ref} className="not-prose" />;
}
