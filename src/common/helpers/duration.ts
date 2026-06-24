const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** Parses simple durations like "15m", "30d", "1h" into seconds. */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`invalid duration format: "${value}"`);
  }
  return Number(match[1]) * UNIT_SECONDS[match[2]];
}
