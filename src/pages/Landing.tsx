import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Globe, Youtube, MessageCircle } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";

// Startseite im „Observe“-Stil: ein Bildschirm, ruhiges Hintergrundvideo (0,5×), Liquid-Glass,
// Instrument Serif nur in der Überschrift, sonst schwarz/weiß. Das Mythos-Logo bleibt unverändert.
// Eigenes Hintergrundvideo (public/hero.mp4): langsames, dunkles Polarlicht-Band in den Logo-Farben, 12 s nahtlose Schleife.
// Große/hochauflösende Bildschirme bekommen die 4K-Fassung, alle anderen Full HD (lädt schneller).
const VIDEO = typeof window !== "undefined" && window.screen.width * (window.devicePixelRatio || 1) > 2200 ? "/hero-4k.mp4" : "/hero.mp4";

const Landing = () => {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [q, setQ] = useState("");
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => { if (video.current) video.current.playbackRate = 0.5; }, []);
  useEffect(() => { if (user && profile?.start_in_chat) nav("/app", { replace: true }); }, [user, profile?.start_in_chat, nav]);

  const start = () => {
    const text = q.trim();
    if (!user) { nav(`/auth${text ? `?next=${encodeURIComponent(`/app?q=${encodeURIComponent(text)}`)}` : ""}`); return; }
    nav(text ? `/app?q=${encodeURIComponent(text)}` : "/app");
  };

  return (
    <div className="observe dark bg-black text-white min-h-[100dvh] selection:bg-white selection:text-black overflow-hidden">
      <section className="min-h-[100dvh] relative overflow-hidden flex flex-col">
        <video ref={video} src={VIDEO} className="absolute inset-0 w-full h-full object-cover object-bottom" muted autoPlay loop playsInline preload="auto" />

        <nav className="relative z-20 px-4 sm:px-6 py-6">
          <div className="liquid-glass rounded-full max-w-5xl mx-auto pl-5 sm:pl-6 pr-1.5 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LogoMark size="sm" className="h-6 w-6" />
              <span className="font-semibold text-lg tracking-tight">Mythos AI</span>
              <div className="hidden md:flex gap-8 ml-8">
                <Link to="/docs" className="text-white/80 hover:text-white text-sm font-medium transition-colors">Produkt</Link>
                <Link to="/downloads" className="text-white/80 hover:text-white text-sm font-medium transition-colors">Downloads</Link>
                <Link to="/impressum" className="text-white/80 hover:text-white text-sm font-medium transition-colors">Kontakt</Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {!user && <Link to="/auth" className="text-white text-sm font-medium hidden sm:inline">Anmelden</Link>}
              <button type="button" onClick={() => nav(user ? "/app" : "/auth")} className="bg-white rounded-full px-5 py-2 text-black text-sm font-medium whitespace-nowrap">
                {user ? "Zum Chat" : "Kostenlos starten"}
              </button>
            </div>
          </div>
        </nav>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center -translate-y-[12%] md:-translate-y-[20%]">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif-instrument tracking-tight md:whitespace-nowrap mb-4"
            style={{ textShadow: "0 0 72px rgba(0, 0, 0, 0.42), 0 4px 28px rgba(0, 0, 0, 0.28)" }}>
            Bau alles, was du <em className="italic">dir vorstellst</em>
          </h1>
          <p className="text-white/70 text-sm leading-relaxed max-w-2xl md:whitespace-nowrap mb-10"
            style={{ textShadow: "0 0 30px rgba(0, 0, 0, 0.32), 0 1px 10px rgba(0, 0, 0, 0.20)" }}>
            Code, Minecraft-Modelle, Bilder, Videos und Musik — eine KI, die dranbleibt, bis es fertig ist.
          </p>
          <form className="max-w-xl w-full" onSubmit={(e) => { e.preventDefault(); start(); }}>
            <div className="liquid-glass rounded-full pl-6 pr-1.5 py-1.5 flex items-center gap-3">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Frag Mythos irgendwas …" aria-label="Deine Frage an Mythos"
                className="bg-transparent border-none outline-none flex-1 min-w-0 text-white placeholder:text-white/90 text-sm" />
              <button type="submit" className="bg-white rounded-full px-6 py-3 text-black text-sm font-medium whitespace-nowrap hover:scale-105 transition-transform duration-300">
                Loslegen
              </button>
            </div>
          </form>
        </div>

        <div className="relative z-10 flex justify-center gap-4 pb-8">
          {[
            { href: "https://www.youtube.com/@MinePro641", icon: Youtube, label: "YouTube" },
            { href: "/downloads", icon: Download, label: "Downloads" },
            { href: "https://mythoscraft.online", icon: Globe, label: "Mythoscraft" },
            { href: "/mc", icon: MessageCircle, label: "Minecraft-Support" },
          ].map(({ href, icon: Icon, label }) => (
            <a key={label} href={href} title={label} aria-label={label} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
              className="liquid-glass-circle w-14 h-14 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/5 transition-all">
              <Icon className="h-5 w-5" />
            </a>
          ))}
        </div>
        <div className="relative z-10 flex justify-center gap-4 pb-4 text-[11px] text-white/50">
          <Link to="/impressum" className="hover:text-white">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-white">Datenschutz</Link>
          <Link to="/nutzungsbedingungen" className="hover:text-white">AGB</Link>
        </div>
      </section>
    </div>
  );
};

export default Landing;
