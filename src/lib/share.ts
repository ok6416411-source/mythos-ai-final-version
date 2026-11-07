import { supabase } from "@/integrations/supabase/client";
import { copyText } from "@/lib/copyText";

/** Ergebnis öffentlich teilen: gibt einen Link zurück, den jeder ohne Login öffnen kann. */
export async function shareResult(o: { name: string; content: string; title?: string; prompt?: string; gallery?: boolean }): Promise<string> {
  const { data, error } = await supabase.functions.invoke("labs", { body: { kind: "share_create", ...o } });
  if (error || !data?.id) throw new Error(data?.error || "Teilen hat nicht geklappt – ist die labs-Funktion neu bereitgestellt?");
  const url = `${location.origin}/s/${data.id}`;
  await copyText(url);
  return url;
}

/** Vorschau-fähiger Inhalt (HTML/SVG/bbmodel) als iframe-Dokument. */
export function previewDoc(name: string, content: string): string {
  if (/\.svg$/i.test(name) || /^\s*<svg/i.test(content)) return `<!doctype html><meta name=viewport content="width=device-width"><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0b0d12">${content}</body>`;
  return content;
}
