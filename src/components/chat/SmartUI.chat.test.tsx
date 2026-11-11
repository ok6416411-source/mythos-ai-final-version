// Prüft die Bedienelemente so, wie sie im ECHTEN Chat stecken: in einer Markdown-Nachricht, die React
// ständig neu zeichnet (Tippen, Streamen). Der Zustand darf dabei nicht verloren gehen.
import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useState } from "react";
import MarkdownMessage from "@/components/MarkdownMessage";
import { SMART_UI_SEND } from "@/components/chat/SmartUI";

const block = (o: unknown) => "Hier:\n\n```mythos-ui\n" + JSON.stringify(o) + "\n```\n";
const quiz = { type: "quiz", title: "Mathe", questions: [
  { question: "2+2?", options: ["3", "4"], answer: 1, explanation: "Vier." },
  { question: "3·3?", options: ["9", "6"], answer: 0 },
] };
let redraw: () => void = () => {};
let setText: (t: string) => void = () => {};
function Chat({ first }: { first: string }) {
  const [n, setN] = useState(0);
  const [text, set] = useState(first);
  redraw = () => setN((x) => x + 1); setText = set;
  // wie im Chat: jede Eingabe zeichnet die Nachrichtenliste neu
  return <div data-n={n}><MarkdownMessage content={text} /></div>;
}
const btn = (root: HTMLElement, label: string) => [...root.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;

describe("Bedienelemente im echten Chat", () => {
  beforeEach(() => { localStorage.clear(); document.body.innerHTML = ""; });

  it("Quiz: Antwort bleibt nach Neuzeichnen, Punkte stimmen, Ergebnis geht an Mythos", () => {
    const sent: string[] = [];
    const on = (e: Event) => sent.push((e as CustomEvent<string>).detail);
    window.addEventListener(SMART_UI_SEND, on);
    const { container, unmount } = render(<Chat first={block(quiz)} />);
    act(() => btn(container, "4").click());
    expect(container.textContent).toContain("Richtig");
    for (let i = 0; i < 5; i++) act(() => redraw());           // Chat zeichnet neu (z. B. beim Tippen)
    expect(btn(container, "4").classList.contains("ok")).toBe(true);
    expect(container.textContent).toContain("1 von 1 richtig");
    act(() => btn(container, "6").click());
    act(() => redraw());
    expect(container.textContent).toContain("1 von 2 richtig – fertig!");
    expect(btn(container, "6").classList.contains("bad")).toBe(true);
    act(() => btn(container, "Ergebnis an Mythos schicken").click());
    expect(sent[0]).toMatch(/Quiz-Ergebnis „Mathe“: 1 von 2 richtig/);
    expect(sent[0]).toContain("3·3?");
    unmount();
    // Chat gewechselt und zurück (alles neu aufgebaut): Antworten sind noch da
    const again = render(<Chat first={block(quiz)} />);
    expect(again.container.textContent).toContain("1 von 2 richtig – fertig!");
    act(() => btn(again.container, "Nochmal").click());
    expect(btn(again.container, "4").disabled).toBe(false);
    window.removeEventListener(SMART_UI_SEND, on);
  });

  it("Während die Antwort noch gezeichnet wird: erst „wird gebaut“, dann bedienbar – und der Rest der Nachricht darf weiterlaufen", () => {
    const full = block(quiz);
    const { container } = render(<Chat first={full.slice(0, full.length - 40)} />);
    expect(container.textContent).toContain("Oberfläche wird gebaut");
    act(() => setText(full));
    act(() => btn(container, "4").click());
    act(() => setText(full + "\nUnd noch ein Satz, der danach gestreamt wird."));
    act(() => setText(full + "\nUnd noch ein Satz, der danach gestreamt wird. Und mehr."));
    expect(btn(container, "4").classList.contains("ok")).toBe(true);
    expect(container.textContent).toContain("Und mehr.");
  });

  it("Rückfrage: Auswahl und eigener Text bleiben beim Neuzeichnen, Abschicken verbindet mit dem Chat", () => {
    const sent: string[] = [];
    const on = (e: Event) => sent.push((e as CustomEvent<string>).detail);
    window.addEventListener(SMART_UI_SEND, on);
    const { container } = render(<Chat first={block({ type: "question", question: "Welcher Stil?", options: ["Dunkel", "Hell"], multi: true })} />);
    act(() => (container.querySelectorAll(".msui-q-opt")[0] as HTMLButtonElement).click());
    const input = container.querySelector(".msui-q-other") as HTMLInputElement;
    act(() => { input.value = "mit Blau"; input.dispatchEvent(new Event("input", { bubbles: true })); });
    for (let i = 0; i < 3; i++) act(() => redraw());
    expect(container.querySelectorAll(".msui-q-opt")[0].classList.contains("on")).toBe(true);
    expect((container.querySelector(".msui-q-other") as HTMLInputElement).value).toBe("mit Blau");
    act(() => (container.querySelector(".msui-q-send") as HTMLButtonElement).click());
    expect(sent).toEqual(["Antwort auf „Welcher Stil?“: Dunkel, mit Blau"]);
    act(() => redraw());
    expect(container.textContent).toContain("Beantwortet: Dunkel, mit Blau");
    window.removeEventListener(SMART_UI_SEND, on);
  });

  it("Auswahl/Tabs und Knöpfe: gewählter Reiter bleibt, Knopf schickt seinen Text", () => {
    const sent: string[] = [];
    const on = (e: Event) => sent.push((e as CustomEvent<string>).detail);
    window.addEventListener(SMART_UI_SEND, on);
    const { container } = render(<Chat first={block({ blocks: [
      { type: "choice", title: "Plan", options: [{ label: "A", text: "Text A" }, { label: "B", text: "Text B" }] },
      { type: "buttons", items: [{ label: "Mehr dazu", prompt: "Erzähl mehr" }] },
    ] })} />);
    act(() => (container.querySelectorAll(".msui-opt")[1] as HTMLButtonElement).click());
    for (let i = 0; i < 3; i++) act(() => redraw());
    expect(container.querySelector(".msui-pane")!.textContent).toContain("Text B");
    act(() => btn(container, "Mehr dazu").click());
    expect(sent).toEqual(["Erzähl mehr"]);
    window.removeEventListener(SMART_UI_SEND, on);
  });
  it("Auswahl (choice) lässt sich abschicken – wie die Projekt-Frage in der App", () => {
    const sent: string[] = [];
    const on = (e: Event) => sent.push((e as CustomEvent<string>).detail);
    window.addEventListener(SMART_UI_SEND, on);
    const { container } = render(<Chat first={block({ type: "choice", title: "Was wollen wir bauen?", label: "Wähle ein Projekt aus:", options: [{ label: "LunoMotionStudio", text: "UI für Film-Verwaltung" }, { label: "MeinSpiel", text: "3D-Mechaniken und Scoring" }] })} />);
    act(() => (container.querySelectorAll(".msui-opt")[1] as HTMLButtonElement).click());
    act(() => redraw());
    const go = container.querySelector(".msui-q-send") as HTMLButtonElement;
    expect(go.textContent).toBe("Weiter mit „MeinSpiel“");
    act(() => go.click());
    expect(sent).toEqual(["Antwort auf „Wähle ein Projekt aus:“: MeinSpiel – 3D-Mechaniken und Scoring"]);
    act(() => redraw());
    expect(container.textContent).toContain("Gewählt: MeinSpiel");
    window.removeEventListener(SMART_UI_SEND, on);
  });
});
