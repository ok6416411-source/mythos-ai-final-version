import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Daumen hoch/runter unter einer Antwort. Bei „runter“ kurz fragen, was falsch war –
 *  daraus schlägt die KI eine Regel vor, die der Admin übernehmen kann. */
export default function FeedbackButtons({ question, answer, messageId }: { question: string; answer: string; messageId?: string }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  const send = async (v: "up" | "down", comment = "") => {
    setVote(v);
    const { error } = await supabase.functions.invoke("cli-auth", {
      body: { action: "feedback", vote: v, comment, question: question.slice(0, 2000), answer: answer.slice(0, 6000), message_id: messageId },
    });
    if (error) { toast.error("Feedback konnte nicht gespeichert werden."); return; }
    setSent(true);
    if (v === "down") toast.success("Danke! Mythos lernt daraus.");
  };

  return (
    <>
      <button type="button" disabled={sent} onClick={() => send("up")} title="Gute Antwort" className={`p-1.5 rounded-md hover:bg-white/5 ${vote === "up" ? "text-foreground" : ""}`}>
        <ThumbsUp className="h-3.5 w-3.5" fill={vote === "up" ? "currentColor" : "none"} />
      </button>
      <button type="button" disabled={sent} onClick={() => { setVote("down"); setAsking(true); }} title="Schlechte Antwort" className={`p-1.5 rounded-md hover:bg-white/5 ${vote === "down" ? "text-foreground" : ""}`}>
        <ThumbsDown className="h-3.5 w-3.5" fill={vote === "down" ? "currentColor" : "none"} />
      </button>
      {asking && !sent && (
        <form className="ml-1 flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); setAsking(false); void send("down", text.trim()); }}>
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Was war falsch?" maxLength={400}
            className="h-7 w-56 rounded-full border border-border bg-transparent px-3 text-xs text-foreground outline-none focus:border-foreground/40" />
          <button type="submit" className="h-7 rounded-full bg-foreground px-3 text-xs font-medium text-background">Senden</button>
        </form>
      )}
    </>
  );
}
