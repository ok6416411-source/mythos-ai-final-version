import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Schriften lokal ausliefern statt von Google Fonts (keine IP-Übertragung an Google, DSGVO).
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./index.css";
import { initPersistentSession } from "./lib/persistentSession";
import { preloadPipeline } from "./lib/transformersLoader";
import { installNoZoom } from "./lib/noZoom";

installNoZoom();
void initPersistentSession();

// Background-preload the smallest offline model on idle so /sentiment is
// instant and works fully offline after first visit. Skipped on slow/metered
// connections to respect the user's data plan.
const conn = (navigator as any).connection;
if (!conn || (!conn.saveData && !["slow-2g", "2g"].includes(conn.effectiveType))) {
  preloadPipeline({
    task: "sentiment-analysis",
    model: "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
    dtype: "fp32",
  });
}

// Guard service worker registration: never register inside Lovable preview iframe.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
} else if ("serviceWorker" in navigator) {
  // Lazy-load the virtual PWA register module only in production-like contexts.
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      let shown = false;
      let interacted = false;
      for (const ev of ["keydown", "pointerdown"]) addEventListener(ev, () => { interacted = true; }, { once: true, capture: true });
      const updateSW = registerSW({
        immediate: true,
        // Neue Version gefunden: NICHT automatisch neu laden (sonst gehen offene Antworten,
        // Formulare und Checklisten verloren). Der User entscheidet per Klick; sonst greift sie
        // beim nächsten Öffnen der App von selbst.
        onNeedRefresh() {
          // Direkt beim Öffnen (noch nichts getippt/geklickt): sofort auf die neue Version wechseln,
          // sonst sieht man kurz die alte Seite aus dem Offline-Speicher.
          // Aber höchstens einmal alle 5 Minuten – niemals eine Neulade-Schleife.
          const last = Number(sessionStorage.getItem("mythos.sw-reload") || 0);
          if (!interacted && performance.now() < 15_000 && Date.now() - last > 5 * 60_000) {
            sessionStorage.setItem("mythos.sw-reload", String(Date.now()));
            void updateSW(true); return;
          }
          if (shown) return;
          shown = true;
          import("sonner").then(({ toast }) => toast("Neue Version von Mythos AI ist da", {
            duration: Infinity,
            action: { label: "Neu laden", onClick: () => { void updateSW(true); } },
          })).catch(() => {});
        },
        onRegisteredSW(_url, reg) {
          if (!reg) return;
          const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
          setInterval(check, 30 * 60_000);
          document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
        },
      });
    })
    .catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
