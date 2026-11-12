// 20-€-Draft im echten Chat: Themenwahl schickt den Start, das Spiel läuft bis zum Ende gegen Mythos.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import MarkdownMessage from "@/components/MarkdownMessage";
import { SMART_UI_SEND } from "@/components/chat/SmartUI";

const block = (o: unknown) => "```mythos-ui\n" + JSON.stringify(o) + "\n```\n";
const find = (label: RegExp) => [...document.querySelectorAll("button")].find((b) => label.test(b.textContent || "")) as HTMLButtonElement | undefined;

describe("20-€-Draft", () => {
  beforeEach(() => { localStorage.clear(); document.body.innerHTML = ""; });

  it("Themen: Klick und eigenes Thema starten das Spiel", () => {
    const sent: string[] = [];
    const on = (e: Event) => sent.push((e as CustomEvent<string>).detail);
    window.addEventListener(SMART_UI_SEND, on);
    render(<MarkdownMessage content={block({ type: "draft", themes: [{ title: "Burger", emoji: "🍔" }, "Startelf", "Garten"] })} />);
    act(() => { find(/Burger/)!.click(); });
    expect(sent[0]).toMatch(/Starte das 20-€-Draft mit dem Thema „Burger“/);
    window.removeEventListener(SMART_UI_SEND, on);
  });

  it("Spiel läuft gegen Mythos bis zum Ende, Budget und Plätze stimmen", () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const on = (e: Event) => sent.push((e as CustomEvent<string>).detail);
    window.addEventListener(SMART_UI_SEND, on);
    const deck = Array.from({ length: 14 }, (_, i) => ({ name: "Karte " + (i + 1), emoji: "🃏", value: (i % 10) + 1 }));
    render(<MarkdownMessage content={block({ type: "draft", theme: "Burger", budget: 20, slots: 5, deck })} />);
    for (let step = 0; step < 400 && !find(/Mythos soll entscheiden/); step++) {
      act(() => {
        // Ich: nehme jede Karte, erhöhe einmal um 1, sonst passen
        const take = find(/Nehmen für 1 €/); const plus = find(/\(\+1\)/); const pass = find(/^Passen$/);
        if (take) take.click(); else if (plus && Math.random() < 0.5) plus.click(); else if (pass) pass.click();
        vi.advanceTimersByTime(2000);
      });
    }
    expect(find(/Mythos soll entscheiden/)).toBeTruthy();
    const cash = [...document.querySelectorAll(".msui-dr-cash")].map((e) => Number(e.textContent!.replace(/\D/g, "")));
    cash.forEach((c) => { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(20); });
    const full = document.querySelectorAll(".msui-dr-slot.full").length;
    expect(full).toBe(10);
    act(() => { find(/Mythos soll entscheiden/)!.click(); });
    expect(sent.at(-1)).toMatch(/Draft „Burger“ ist vorbei/);
    act(() => { find(/Meine als Grafik/)!.click(); });
    expect(sent.at(-1)).toMatch(/^\/grafik .*1028×1028/);
    window.removeEventListener(SMART_UI_SEND, on);
    vi.useRealTimers();
  });
});
