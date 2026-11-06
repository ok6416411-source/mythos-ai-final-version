import { useEffect, useRef, useState } from "react";
import { LegalLinks } from "@/components/CookieConsent";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2, Send, MessageSquare, Image as ImageIcon, Music, Film, Code2, Phone, Download, LayoutDashboard, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Textarea } from "@/components/ui/textarea";
import { LogoMark } from "@/components/Logo";
import HeroVideo, { useForceDark } from "@/components/HeroVideo";
import Landing from "./Landing";

type RecentConv = { id: string; title: string; updated_at: string };

const QUICK = [
  { icon: ImageIcon, label: "Grafik zeichnen", prefix: "Zeichne als Grafik (SVG): " },
  { icon: Music, label: "Musik machen", prefix: "/music " },
  { icon: Film, label: "Video erstellen", prefix: "/video " },
  { icon: Code2, label: "Code schreiben", prefix: "Schreib mir Code für " },
];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Hallo";
  return "Guten Abend";
};

const timeAgo = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return d === 1 ? "gestern" : `vor ${d} Tagen`;
};

// Startseite für Eingeloggte: Eingabefeld, Schnellstart und die letzten Chats.
const LoggedInHome = () => {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [input, setInput] = useState("");
  const [recent, setRecent] = useState<RecentConv[] | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useForceDark();

  useEffect(() => {
    supabase.from("conversations").select("id,title,updated_at")
      .order("updated_at", { ascending: false }).limit(6)
      .then(({ data }) => setRecent((data as RecentConv[]) || []));
  }, [user]);

  const start = () => {
    const text = input.trim();
    if (!text) { nav("/app"); return; }
    nav(`/app?q=${encodeURIComponent(text)}`);
  };

  const name = profile?.display_name || user?.email?.split("@")[0] || "";

  return (
    <div className="dark bg-black text-white min-h-[100dvh] relative overflow-x-hidden selection:bg-white selection:text-black">
      {/* Gleicher Hintergrund und Stil wie die Startseite für Abgemeldete (Observe) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-black">
        <HeroVideo />
      </div>

      <nav className="relative z-20 px-4 sm:px-6 py-6">
        <div className="liquid-glass rounded-full max-w-5xl mx-auto pl-5 sm:pl-6 pr-1.5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <LogoMark size="sm" className="h-6 w-6" />
            <span className="font-semibold text-lg tracking-tight">Mythos AI</span>
            <div className="hidden md:flex gap-7 ml-8">
              {[["/app", "Chat"], ["/build", "Erstellen"], ["/entdecken", "Entdecken"], ["/downloads", "Downloads"]].map(([to, label]) => (
                <Link key={to} to={to} className="text-white/80 hover:text-white text-sm font-medium transition-colors">{label}</Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="hidden sm:flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white">
              <span className="h-7 w-7 rounded-full bg-white text-black text-xs font-semibold flex items-center justify-center">{name.slice(0, 2).toUpperCase()}</span>
              <span className="max-w-[140px] truncate">{name}</span>
            </Link>
            <Link to="/app" className="bg-white rounded-full px-5 py-2 text-black text-sm font-medium whitespace-nowrap">Zum Chat</Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pt-10 sm:pt-20 pb-16">
        <h1 className="font-serif-instrument text-5xl sm:text-6xl md:text-7xl tracking-tight text-center mb-10"
          style={{ textShadow: "0 0 72px rgba(0, 0, 0, 0.42), 0 4px 28px rgba(0, 0, 0, 0.28)" }}>
          {greeting()}{name ? <>, <em className="italic">{name}</em></> : null}
        </h1>

        <div className="liquid-glass rounded-[28px] p-3 pl-5">
          <Textarea
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); start(); } }}
            placeholder="Wie kann ich dir heute helfen?"
            rows={2}
            className="resize-none border-0 bg-transparent px-0 text-white placeholder:text-white/70 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <Link to="/voice" aria-label="Mythos anrufen" className="liquid-glass-circle h-10 w-10 rounded-full flex items-center justify-center text-white/80 hover:text-white">
              <Phone className="h-4 w-4" />
            </Link>
            <button onClick={start} className="bg-white rounded-full px-6 py-2.5 text-black text-sm font-medium hover:scale-105 transition-transform duration-300">
              Loslegen
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {QUICK.map(q => (
            <button
              key={q.label}
              onClick={() => { setInput(q.prefix); inputRef.current?.focus(); }}
              className="liquid-glass rounded-full px-4 py-2 text-sm text-white/80 hover:text-white transition-colors inline-flex items-center gap-2"
            >
              <q.icon className="h-4 w-4" /> {q.label}
            </button>
          ))}
        </div>

        <section className="mt-14">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-medium text-white/70">Letzte Chats</h2>
            <Link to="/app" className="text-sm text-white/70 hover:text-white inline-flex items-center gap-1">
              Alle Chats <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recent === null ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-white/60" /></div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-white/60 text-center py-6">Noch keine Chats. Schreib oben einfach los.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {recent.map(c => (
                <Link key={c.id} to={`/app/c/${c.id}`} className="liquid-glass rounded-full px-5 py-3 hover:bg-white/5 transition-colors flex items-center gap-3 min-w-0">
                  <MessageSquare className="h-4 w-4 text-white/60 shrink-0" />
                  <span className="truncate flex-1 text-sm">{c.title}</span>
                  <span className="text-xs text-white/50 shrink-0">{timeAgo(c.updated_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12 flex justify-center gap-4">
          {[
            { to: "/voice", icon: Phone, label: "Anrufen" },
            { to: "/downloads", icon: Download, label: "Downloads" },
            { to: "/dashboard", icon: LayoutDashboard, label: "Konto" },
          ].map(l => (
            <Link key={l.to} to={l.to} title={l.label} aria-label={l.label}
              className="liquid-glass-circle w-14 h-14 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/5 transition-all">
              <l.icon className="h-5 w-5" />
            </Link>
          ))}
        </section>
        <LegalLinks className="mt-10 [&_a]:text-white/50 [&_a:hover]:text-white" />
      </main>
    </div>
  );
};

// "/" zeigt Ausgeloggten die Landingpage und Eingeloggten ihre Startseite.
const Home = () => {
  const { user, loading, profile } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Landing />;
  if (profile?.start_in_chat) return <Navigate to="/app" replace />;
  return <LoggedInHome />;
};

export default Home;
