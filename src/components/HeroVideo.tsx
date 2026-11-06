import { useEffect, useRef } from "react";

// Hintergrundvideo der Startseite (Polarlicht-Band in Logo-Farben), halbe Geschwindigkeit.
// Große/hochauflösende Bildschirme bekommen 4K, alle anderen Full HD.
const src = () => (typeof window !== "undefined" && window.screen.width * (window.devicePixelRatio || 1) > 2200 ? "/hero-4k.mp4" : "/hero.mp4");

/** Seiten mit Video-Hintergrund sind immer dunkel (sonst dunkle Schrift auf dunklem Video). */
export function useForceDark() {
  useEffect(() => {
    const h = document.documentElement;
    const had = h.classList.contains("dark");
    h.classList.add("dark"); h.classList.remove("light");
    return () => { if (!had) { h.classList.remove("dark"); if (!window.matchMedia("(prefers-color-scheme: dark)").matches) h.classList.add("light"); } };
  }, []);
}

export default function HeroVideo({ className = "absolute inset-0" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.playbackRate = 0.5; }, []);
  return (
    <video ref={ref} src={src()} aria-hidden className={`${className} w-full h-full object-cover object-bottom pointer-events-none`}
      muted autoPlay loop playsInline preload="auto" />
  );
}
