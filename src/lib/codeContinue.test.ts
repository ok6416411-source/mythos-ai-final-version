import { describe, it, expect } from "vitest";
import { looksCut, stitch } from "./codeContinue";

describe("HTML-Fortsetzung", () => {
  it("erkennt abgeschnittenes HTML", () => {
    expect(looksCut("```html\n<html><body>")).toBe(true);
  });
  it("vollständiges HTML gilt nicht als abgeschnitten", () => {
    expect(looksCut("```html\n<html></html>\n```")).toBe(false);
  });
  it("entfernt doppelt geöffneten Codeblock beim Zusammenfügen", () => {
    expect(stitch("```html\n<div>", "```html\n</div></html>\n```")).toBe("</div></html>\n```");
  });
});
