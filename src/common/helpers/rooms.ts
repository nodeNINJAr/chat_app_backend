export function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}
