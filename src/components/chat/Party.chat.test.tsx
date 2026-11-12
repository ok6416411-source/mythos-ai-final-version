// Imposter & Wer bin ich laufen komplett im Baustein: keine Chat-Nachrichten, Mitspieler über versteckte KI.
import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import MarkdownMessage from "@/components/MarkdownMessage";
import { SMART_UI_SEND } from "@/components/chat/SmartUI";

const block = (o: unknown) => "```mythos-ui\n" + JSON.stringify(o) + "\n```\n";
const btn = (re: RegExp) => [...document.querySelectorAll("button")].find((b) => re.test(b.textContent || "")) as HTMLButtonElement | undefined;
const flush = async () => { for (let i = 0; i < 30; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

describe("Party-Spiele im Baustein", () => {
  beforeEach(() => { localStorage.clear(); document.body.innerHTML = ""; });

  it("Imposter: startet lokal, Bots fragen dich, Abstimmung und Auflösung – ohne Chat-Nachricht", async () => {
    const sent: string[] = [];
    const on = (e: Event) => sent.push((e as CustomEvent<string>).detail);
    window.addEventListener(SMART_UI_SEND, on);
    (window as any).mythosAskHidden = async (p: string) => {
      if (/Abstimmung/.test(p)) return '{"Amber":{"vote":"Bolt","why":"zu vage"},"Bolt":{"vote":"Amber","why":"komisch"},"Spark":{"vote":"Bolt","why":"verdächtig"}}';
      if (/JSON/.test(p)) return '{"to":"Du","q":"Wo findet man das?"}';
      return "Meistens draußen, würde ich sagen.";
    };
    render(<MarkdownMessage content={block({ type: "gamesetup", game: "imposter", players: 4 })} />);
    await act(async () => { btn(/Imposter starten/)!.click(); });
    await flush();
    expect(document.querySelector(".msui-pg-role")).toBeTruthy();
    expect(document.body.textContent).toMatch(/fragt dich/);
    const inputs = document.querySelectorAll<HTMLInputElement>(".msui-pg-panel input");
    inputs[0].value = "Eher im Sommer";
    await act(async () => { (document.querySelectorAll(".msui-pg-target")[0] as HTMLButtonElement).click(); });
    inputs[1].value = "Magst du das?";
    await act(async () => { btn(/Antworten & fragen/)!.click(); });
    await flush();
    await act(async () => { btn(/Jetzt abstimmen/)!.click(); });
    await act(async () => { btn(/👉 Bolt/)!.click(); });
    await flush();
    expect(document.body.textContent).toMatch(/Gewonnen|Verloren/);
    expect(document.body.textContent).toMatch(/Das Wort war/);
    expect(sent).toHaveLength(0);
    window.removeEventListener(SMART_UI_SEND, on);
  });

  it("Wer bin ich: Bot fragt dich über seine Karte, Raten beendet das Spiel", async () => {
    (window as any).mythosAskHidden = async (p: string) => (/JSON/.test(p) ? '{"q":"Bin ich ein Mensch?"}' : "Nein.");
    render(<MarkdownMessage content={block({ type: "gamesetup", game: "werbinich", players: 2 })} />);
    await act(async () => { btn(/Wer bin ich/)!.click(); });
    await act(async () => { btn(/starten/)!.click(); });
    await flush();
    // Je nach Startspieler: entweder Bot fragt (Ja/Nein) oder du bist dran
    if (btn(/✅ Ja/)) { await act(async () => { btn(/✅ Ja/)!.click(); }); await flush(); }
    const st = JSON.parse(Object.keys(localStorage).filter((k) => k.endsWith("-game")).map((k) => localStorage.getItem(k))[0]!);
    const g = document.querySelectorAll<HTMLInputElement>(".msui-pg-panel input")[1];
    g.value = st.cards.Du;
    await act(async () => { btn(/Raten/)!.click(); });
    await flush();
    expect(document.body.textContent).toMatch(/erraten/);
  });
});
