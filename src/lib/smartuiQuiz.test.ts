import { describe, it, expect } from "vitest";
import "@/lib/mythos-code-shared/smartui.js";

const ui = (window as any).MythosSmartUI;
const quiz = JSON.stringify({
  type: "quiz",
  questions: [
    { question: "2+2?", options: ["3", "4"], answer: 1, explanation: "Vier." },
    { question: "Hauptstadt DE?", options: ["Berlin", "Bonn"], answer: 0 },
  ],
});

describe("Chat-Quiz", () => {
  it("markiert richtige Antwort und zählt Punkte", () => {
    const el: HTMLElement = ui.render(quiz, {});
    document.body.appendChild(el);
    const btns = [...el.querySelectorAll("button")].filter(b => ["3", "4", "Berlin", "Bonn"].includes(b.textContent || ""));
    btns.find(b => b.textContent === "4")!.click();
    btns.find(b => b.textContent === "Bonn")!.click();
    expect(el.textContent).toContain("Richtig");
    expect(el.textContent).toContain("1 von 2 richtig");
  });
});
