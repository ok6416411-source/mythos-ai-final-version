import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, X, Code2, Eye, Box } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { copyText } from "@/lib/copyText";
import { extOf, fmtSize, isImageName, openBlob, saveBlob } from "@/lib/chatFiles";
import { fmtTime } from "@/lib/videoFrames";

export type ViewFile = {
  name: string; content: string; base64: boolean; blob: Blob | null; note?: string;
  /** Datei liegt online (z. B. eigener Anhang): Vorschau direkt von dieser Adresse */
  url?: string; mime?: string;
  /** Video: Einzelbilder, die Mythos angesehen hat */
  frames?: { url: string; t: number }[]; duration?: number;
};

const BBModelViewer = lazy(() => import("@/components/preview/BBModelViewer"));
const previewable = (name: string) => /^(html?|svg|md|png|jpe?g|gif|webp|ico|bbmodel)$/.test(extOf(name));

/** Seitenfenster für eine Datei (wie bei Claude): Vorschau, Code, Kopieren, Download. */
export default function FileViewer({ file, onClose }: { file: ViewFile | null; onClose: () => void }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const name = file?.name ?? "";
  const e = extOf(name);
  const canPreview = !!file && !file.url && previewable(name);
  useEffect(() => { setTab(canPreview ? "preview" : "code"); setCopied(false); }, [file, canPreview]);
  const imgUrl = useMemo(() => (file?.blob && isImageName(name) ? URL.createObjectURL(file.blob) : null), [file, name]);
  useEffect(() => () => { if (imgUrl) URL.revokeObjectURL(imgUrl); }, [imgUrl]);

  const copy = async () => {
    if (!file) return;
    if (!(await copyText(file.content))) { toast.error("Kopieren hat nicht geklappt."); return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lines = file && !file.base64 ? file.content.split("\n") : [];

  return (
    <Sheet open={!!file} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[min(860px,92vw)] [&>button]:hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate font-sans text-[15px] font-semibold">{name.split("/").pop()}</SheetTitle>
            <SheetDescription className="truncate text-xs">
              {name.includes("/") ? name + " · " : ""}{e.toUpperCase() || "Datei"}{file?.blob ? ` · ${fmtSize(file.blob.size)}` : ""}{file?.note ? ` · ${file.note}` : ""}
            </SheetDescription>
          </div>
          {canPreview && !file?.base64 && (
            <div className="mr-1 flex rounded-lg border border-border p-0.5 text-xs">
              <button type="button" onClick={() => setTab("preview")} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${tab === "preview" ? "bg-muted text-foreground" : "text-muted-foreground"}`}><Eye className="h-3.5 w-3.5" /> Vorschau</button>
              <button type="button" onClick={() => setTab("code")} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${tab === "code" ? "bg-muted text-foreground" : "text-muted-foreground"}`}><Code2 className="h-3.5 w-3.5" /> Code</button>
            </div>
          )}
          {!file?.base64 && !file?.url && (
            <button type="button" onClick={copy} title="Kopieren" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          )}
          {file?.blob && /^(html?|pdf|svg)$/.test(e) && (
            <button type="button" onClick={() => openBlob(file.blob!)} title="In neuem Tab öffnen" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ExternalLink className="h-4 w-4" /></button>
          )}
          {file?.url && (
            <a href={file.url} target="_blank" rel="noopener noreferrer" title="In neuem Tab öffnen" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ExternalLink className="h-4 w-4" /></a>
          )}
          <button type="button" disabled={!file?.blob && !file?.url} onClick={() => { if (file?.blob) saveBlob(name, file.blob); else if (file?.url) { const a = document.createElement("a"); a.href = file.url; a.download = name; a.target = "_blank"; a.rel = "noopener"; a.click(); } }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> Herunterladen
          </button>
          <button type="button" onClick={onClose} title="Schließen" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-background">
          {file?.url ? (
            <RemoteFile file={file} />
          ) : file && tab === "preview" && canPreview ? (
            e === "bbmodel" ? (
              <Suspense fallback={<div className="h-full animate-pulse bg-white/[0.03]" />}><BBModelViewer json={file.content} /></Suspense>
            ) : imgUrl ? (
              <div className="flex h-full items-center justify-center p-6"><img src={imgUrl} alt={name} className="max-h-full max-w-full rounded-md [image-rendering:pixelated]" /></div>
            ) : e === "svg" ? (
              <div className="flex h-full items-center justify-center p-6" dangerouslySetInnerHTML={{ __html: file.content.replace(/<script[\s\S]*?<\/script>/gi, "") }} />
            ) : e === "md" ? (
              <pre className="whitespace-pre-wrap p-5 font-sans text-sm leading-relaxed">{file.content}</pre>
            ) : (
              <iframe title={name} srcDoc={file.content} className="h-full w-full border-0 bg-white"
                sandbox="allow-scripts allow-downloads allow-forms allow-modals allow-popups allow-pointer-lock" />
            )
          ) : file?.base64 ? (
            <div className="p-6 text-sm text-muted-foreground">Binärdatei – zum Ansehen herunterladen.</div>
          ) : e === "bbmodel" ? (
            <div className="space-y-3 p-6 text-sm">
              <div className="flex items-center gap-2 font-medium"><Box className="h-4 w-4" /> Blockbench-Modell</div>
              <p className="text-muted-foreground">Herunterladen und in Blockbench mit <b>Datei → Öffnen</b> laden (oder einfach ins Blockbench-Fenster ziehen). {file?.note}</p>
            </div>
          ) : (
            <pre className="p-0 text-[12.5px] leading-[1.65]">
              <code className="grid">
                {lines.map((l, i) => (
                  <span key={i} className="flex hover:bg-muted/40">
                    <span className="w-12 shrink-0 select-none pr-3 text-right text-muted-foreground/50">{i + 1}</span>
                    <span className="whitespace-pre pr-4">{l || " "}</span>
                  </span>
                ))}
              </code>
            </pre>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Online liegende Datei (eigener Anhang): Bild, Video (+ Einzelbilder), PDF, Text. */
function RemoteFile({ file }: { file: ViewFile }) {
  const mime = file.mime || "";
  const [text, setText] = useState<string | null>(null);
  const isText = /^text\/|json|xml|csv|markdown/.test(mime) || /\.(txt|md|json|csv|js|ts|py|html|css|yml|yaml)$/i.test(file.name);
  useEffect(() => {
    setText(null);
    if (!isText || !file.url) return;
    fetch(file.url).then(r => r.text()).then(t => setText(t.slice(0, 200_000))).catch(() => setText("(Konnte die Datei nicht laden.)"));
  }, [file.url, isText]);

  if (mime.startsWith("image/")) return <div className="flex h-full items-center justify-center p-6"><img src={file.url} alt={file.name} className="max-h-full max-w-full rounded-md" /></div>;
  if (mime.startsWith("video/") || file.frames?.length) {
    return (
      <div className="space-y-5 p-5">
        {file.url && mime.startsWith("video/") && <video src={file.url} controls className="max-h-[50vh] w-full rounded-lg bg-black" />}
        {file.frames && file.frames.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">Was Mythos gesehen hat · {file.frames.length} Einzelbilder{file.duration ? ` aus ${file.duration.toFixed(1)} s` : ""}</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {file.frames.map((f, i) => (
                <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="group relative overflow-hidden rounded-md border border-border">
                  <img src={f.url} alt={`Bild bei ${fmtTime(f.t)}`} loading="lazy" className="aspect-video w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10.5px] text-white">{fmtTime(f.t)}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  if (mime === "application/pdf" || /\.pdf$/i.test(file.name)) return <iframe title={file.name} src={file.url} className="h-full w-full border-0" />;
  if (isText) return <pre className="whitespace-pre-wrap p-5 text-[12.5px] leading-relaxed">{text ?? "Lädt …"}</pre>;
  return <div className="p-6 text-sm text-muted-foreground">Keine Vorschau für diesen Dateityp – über „Herunterladen“ öffnen.</div>;
}
