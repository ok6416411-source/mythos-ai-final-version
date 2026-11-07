import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Sparkles, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { previewDoc } from "@/lib/share";
import { prepareFile } from "@/lib/chatFileParts";
import { copyText } from "@/lib/copyText";
import Logo from "@/components/Logo";

const BBModelViewer = lazy(() => import("@/components/preview/BBModelViewer"));
type Item = { id: string; name: string; title: string; content: string; prompt?: string; author?: string; created_at?: string };

/** Öffentliche Seite für geteilte Ergebnisse – ohne Login. */
export default function SharePage() {
  const { id } = useParams();
  const [item, setItem] = useState<Item | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    supabase.functions.invoke("labs", { body: { kind: "share_get", id } }).then(({ data, error }) => {
      if (data?.item) { setItem(data.item); document.title = data.item.title + " · Mythos AI"; }
      else setErr(data?.error || (error ? "Link konnte nicht geladen werden." : "Nicht gefunden"));
    });
  }, [id]);
  const isModel = !!item && /\.bbmodel$/i.test(item.name);
  const model = isModel && item ? prepareFile(item.name, item.content, false).content : "";
  const remix = item?.prompt ? `/app?q=${encodeURIComponent(item.prompt)}` : "/app";

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0b0d12] text-white">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <Link to="/" className="shrink-0"><Logo size="sm" /></Link>
        <div className="min-w-0 flex-1">
          {item ? <><p className="truncate text-sm font-medium">{item.title}</p><p className="truncate text-xs text-white/50">von {item.author || "Mythos-Nutzer"} · mit Mythos AI gebaut</p></>
            : <div className="h-3 w-40 animate-pulse rounded-full bg-white/10" />}
        </div>
        <button onClick={async () => { await copyText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5">
          {copied ? <Check className="inline h-3.5 w-3.5" /> : <Copy className="inline h-3.5 w-3.5" />} Link
        </button>
        <Link to={remix} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black hover:opacity-90"><Sparkles className="h-3.5 w-3.5" /> Mit Mythos nachbauen</Link>
      </header>
      <div className="relative min-h-0 flex-1">
        {err ? <p className="grid h-full place-items-center text-white/60">{err}</p>
          : !item ? <div className="h-full animate-pulse bg-white/[0.03]" />
          : isModel ? <Suspense fallback={null}><BBModelViewer json={model} /></Suspense>
          : /\.(html?|svg)$/i.test(item.name) ? <iframe title={item.title} srcDoc={previewDoc(item.name, item.content)} sandbox="allow-scripts allow-pointer-lock allow-popups allow-forms" allow="fullscreen; autoplay; gamepad" className="h-full w-full border-0 bg-white" />
          : <pre className="h-full overflow-auto p-5 font-mono text-xs text-white/85">{item.content}</pre>}
      </div>
    </div>
  );
}
