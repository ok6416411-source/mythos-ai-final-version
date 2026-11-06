import { useEffect, useRef, useState } from "react";

// Hintergrund der Startseite: sofort ein Standbild (hero-poster.jpg, ~40 KB), das Video (Polarlicht-Band
// in Logo-Farben, halbe Geschwindigkeit) blendet weich ein, sobald es läuft – kein langes Warten auf Schwarz.
// 4K nur auf sehr großen Bildschirmen mit schneller Verbindung, sonst Full HD.
const src = () => {
  if (typeof window === "undefined") return "/hero.mp4";
  const conn = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const fast = !conn || (!conn.saveData && (conn.effectiveType ?? "4g") === "4g");
  return fast && window.screen.width * (window.devicePixelRatio || 1) > 3000 ? "/hero-4k.mp4" : "/hero.mp4";
};

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
  const [playing, setPlaying] = useState(false);
  useEffect(() => { if (ref.current) ref.current.playbackRate = 0.5; }, []);
  return (
    <div aria-hidden className={`${className} overflow-hidden pointer-events-none`}>
      <img src="/hero-poster.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-bottom" fetchPriority="high" />
      <video ref={ref} src={src()} poster="/hero-poster.jpg"
        className={`absolute inset-0 w-full h-full object-cover object-bottom transition-opacity duration-700 ${playing ? "opacity-100" : "opacity-0"}`}
        muted autoPlay loop playsInline preload="auto" onPlaying={() => { if (ref.current) ref.current.playbackRate = 0.5; setPlaying(true); }} />
    </div>
  );
}
