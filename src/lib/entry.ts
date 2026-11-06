// Wie jemand zu Mythos AI gekommen ist. Nur wer über den Minecraft-Link (/mc oder /minecraft)
// kommt, bekommt das Minecraft-Onboarding und startet im Support-Modus.
// Alle anderen: normales Onboarding und General-Modus.
const KEY = "mythos.entry";

export type Entry = "mc" | "general";

export function getEntry(): Entry {
  try { return localStorage.getItem(KEY) === "mc" ? "mc" : "general"; } catch { return "general"; }
}

export function setEntry(e: Entry) {
  try { localStorage.setItem(KEY, e); } catch { /* egal */ }
}

/** Standard-Modus für neue Chats. */
export const defaultChatMode = () => (getEntry() === "mc" ? "support" : "general");
