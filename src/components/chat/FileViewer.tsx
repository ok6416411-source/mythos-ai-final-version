import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, X, Code2, Eye, Box } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { copyText } from "@/lib/copyText";
import { extOf, fmtSize, isImageName, openBlob, saveBlob } from "@/lib/chatFiles";

export type ViewFile = { name: string; content: string; base64: boolean; blob: Blob | null; note?: string };

const previewable = (name: string) => /^(html?|svg|md|png|jpe?g|gif|webp|ico)$/.test(extOf(name));

/** Seitenfenster für eine Datei (wie bei Claude): Vorschau, Code, Kopieren, Download. */
export default function FileViewer({ file, onClose }: { file: ViewFile | null; onClose: () => void }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const name = file?.name ?? "";
  const e = extOf(name);
  const canPreview = !!file && previewable(name);
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
          {!file?.base64 && (
            <button type="button" onClick={copy} title="Kopieren" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          )}
          {file?.blob && /^(html?|pdf|svg)$/.test(e) && (
            <button type="button" onClick={() => openBlob(file.blob!)} title="In neuem Tab öffnen" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ExternalLink className="h-4 w-4" /></button>
          )}
          <button type="button" disabled={!file?.blob} onClick={() => file?.blob && saveBlob(name, file.blob)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> Herunterladen
          </button>
          <button type="button" onClick={onClose} title="Schließen" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-background">
          {file && tab === "preview" && canPreview ? (
            imgUrl ? (
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
