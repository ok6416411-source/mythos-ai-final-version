import { describe, expect, it } from "vitest";
import { checklistStatusPrompt, latestChecklist } from "./pinnedChecklist";

const ui = (o: unknown) => "Text\n```mythos-ui\n" + JSON.stringify(o) + "\n```\n";

describe("angeheftete Checkliste", () => {
  it("nimmt die neueste Version", () => {
    const msgs = [
      { role: "assistant", content: ui({ type: "checklist", id: "plan", title: "Plan", items: ["A", "B"] }) },
      { role: "user", content: "weiter" },
      { role: "assistant", content: ui({ blocks: [{ type: "checklist", id: "plan", title: "Plan", items: [{ text: "A", done: true }, { text: "B" }] }] }) },
    ];
    const l = latestChecklist(msgs)!;
    expect(l.id).toBe("plan");
    expect(l.items).toEqual([{ text: "A", done: true }, { text: "B", done: false }]);
    expect(checklistStatusPrompt(l, null)).toContain("1 von 2 erledigt");
  });
  it("erkennt Markdown-Aufgabenlisten", () => {
    const l = latestChecklist([{ role: "assistant", content: "## Plan\n- [x] Krempe\n- [ ] Krone\n\nText" }])!;
    expect(l.title).toBe("Plan");
    expect(l.items).toEqual([{ text: "Krempe", done: true }, { text: "Krone", done: false }]);
  });
  it("ohne Checkliste: null", () => {
    expect(latestChecklist([{ role: "assistant", content: "hallo" }])).toBeNull();
  });
});

import { needsAgent } from "@/pages/Chat";
describe("Agent-Weiche", () => {
  it("erkennt Recherche und viele Aufgaben", () => {
    expect(needsAgent("recherchier mir die neuesten Paper-Versionen")).toBe(true);
    expect(needsAgent("mach mir 5 verschiedene Hüte als bbmodel")).toBe(true);
    expect(needsAgent("schreib mir ein Gedicht über Katzen")).toBe(false);
  });
});
