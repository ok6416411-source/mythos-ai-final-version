export const chatStorageKey = (userId: string, conversationId: string) =>
  `mythos.chat-recovery:${userId}:${conversationId}`;

export function readChatRecovery<T>(userId: string, conversationId: string): T[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(chatStorageKey(userId, conversationId)) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function writeChatRecovery(userId: string, conversationId: string, messages: unknown[]) {
  try { sessionStorage.setItem(chatStorageKey(userId, conversationId), JSON.stringify(messages)); }
  catch { /* Storage can be unavailable or full; never interrupt a response. */ }
}

export const shouldFollowChat = (scrollTop: number, scrollHeight: number, clientHeight: number) =>
  scrollHeight - scrollTop - clientHeight < 96;