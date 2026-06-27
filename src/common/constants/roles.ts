// Typed as readonly string[] (not `as const`) so `.includes()` accepts any
// ParticipantRole-like string without callers needing a cast.
export const ADMIN_ROLES: readonly string[] = ['owner', 'admin'];
