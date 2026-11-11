// „Modell-Animationseffekte“: Das Design passt sich live dem gewählten Modell an.
// Die Einstellung liegt in den Nutzer-Metadaten (mythos_fx) und gilt damit für Website,
// Desktop-App und CLI mit demselben Konto (App/CLI lesen sie über cli-auth „prefs“).
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mythosTheme, parseMythosId, type MythosTheme } from "@/lib/mythosModels";

export type FxState = { on: boolean; model: string; at: number };

let state: FxState = (() => {
  try { return { on: false, model: "", at: 0, ...JSON.parse(localStorage.getItem("mythos.fx") || "{}") }; }
  catch { return { on: false, model: "", at: 0 }; }
})();
const subs = new Set<() => void>();
const emit = () => { subs.forEach((f) => f()); applyFx(); };

function set(next: Partial<FxState>, push = true) {
  state = { ...state, ...next, at: push ? Date.now() : (next.at ?? state.at) };
  try { localStorage.setItem("mythos.fx", JSON.stringify(state)); } catch { /* egal */ }
  emit();
  if (push) save();
}

let saveT: ReturnType<typeof setTimeout> | undefined;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      await supabase.auth.updateUser({ data: { mythos_fx: { on: state.on, model: state.model, at: state.at } } });
    } catch { /* offline – später erneut */ }
  }, 600);
}

/** Vom Konto holen (andere Geräte haben evtl. geändert). Neuere Änderung gewinnt. */
export async function pullFx() {
  try {
    const { data } = await supabase.auth.getUser();
    const r = data.user?.user_metadata?.mythos_fx as FxState | undefined;
    if (r && typeof r.at === "number" && r.at > state.at) set({ on: !!r.on, model: String(r.model || ""), at: r.at }, false);
  } catch { /* egal */ }
}

export const setFxEnabled = (on: boolean) => set({ on });
export function setFxModel(id: string) { if (id && id !== state.model) set({ model: id }); }

export function useModelFx(): FxState {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
}

/** Holt die Einstellung beim Start, bei Rückkehr zum Tab und alle 20 s, solange sie an ist. */
export function useFxSync() {
  useEffect(() => {
    pullFx();
    applyFx();
    const onVis = () => { if (document.visibilityState === "visible") pullFx(); };
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => { if (state.on && document.visibilityState === "visible") pullFx(); }, 20000);
    const { data: sub } = supabase.auth.onAuthStateChange(() => pullFx());
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(t); sub.subscription.unsubscribe(); };
  }, []);
}

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** CSS-Variablen + Klassen am <html> setzen. */
export function applyFx() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const on = state.on && !!parseMythosId(state.model);
  root.classList.toggle("mfx-on", on);
  for (const c of Array.from(root.classList)) if (c.startsWith("mfx-fx-")) root.classList.remove(c);
  if (!on) return;
  const t = mythosTheme(state.model);
  root.style.setProperty("--mfx-a", t.a);
  root.style.setProperty("--mfx-b", t.b);
  root.style.setProperty("--mfx-glow", t.glow);
  root.classList.add("mfx-fx-" + t.fx);
}

/** Auswahl-Animation über die ganze App (läuft immer, auch ohne Live-Design). */
export function playModelSelect(theme: MythosTheme, origin?: { x: number; y: number }) {
  if (typeof document === "undefined" || reduced()) return;
  // Läuft die Partikel-Engine, zusätzlich eine echte Explosion im neuen Modell-Stil
  setTimeout(() => (window as unknown as { MythosFx?: { burst: (x: number, y: number, s?: number) => void } }).MythosFx?.burst(origin?.x ?? innerWidth / 2, origin?.y ?? 60, 1.4), 60);
  const el = document.createElement("div");
  el.className = "mfx-select mfx-select-" + theme.fx;
  el.style.setProperty("--sa", theme.a);
  el.style.setProperty("--sb", theme.b);
  el.style.setProperty("--sg", theme.glow);
  el.style.setProperty("--sx", (origin?.x ?? innerWidth / 2) + "px");
  el.style.setProperty("--sy", (origin?.y ?? 60) + "px");
  // ein paar Partikel für den Funken-/Blitz-/Glut-Effekt
  for (let i = 0; i < 18; i++) {
    const p = document.createElement("i");
    const ang = (i / 18) * Math.PI * 2, dist = 120 + Math.random() * 260;
    p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    p.style.setProperty("--dy", Math.sin(ang) * dist + "px");
    p.style.animationDelay = Math.random() * 120 + "ms";
    el.appendChild(p);
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}
