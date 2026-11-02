import { describe, expect, it } from "vitest";
import { readChatRecovery, shouldFollowChat, writeChatRecovery } from "./chatRecovery";

describe("chat recovery", () => {
  it("restores a partially received answer without waiting for the server", () => {
    const messages = [{ role: "user", content: "Hallo" }, { role: "assistant", content: "Teilantwort" }];
    writeChatRecovery("a", "chat", messages);
    expect(readChatRecovery("a", "chat")).toEqual(messages);
  });
  it("does not expose another account's recovered chat", () => {
    writeChatRecovery("a", "private", [{ content: "privat" }]);
    expect(readChatRecovery("b", "private")).toEqual([]);
  });
  it("does not follow new tokens while the user reads earlier messages", () => {
    expect(shouldFollowChat(100, 2000, 600)).toBe(false);
    expect(shouldFollowChat(1400, 2000, 600)).toBe(true);
  });
});