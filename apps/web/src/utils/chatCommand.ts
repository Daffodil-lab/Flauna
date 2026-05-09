/**
 * Chat palette command parser (spec §5-2-5 / §19 Phase 4 carry-over).
 *
 * The chat input doubles as a lightweight palette for shorthand stat
 * adjustments such as `:HP-3` or `:MP+1`. The parser is intentionally
 * client-side only — the WS schema only carries `player_statement`, so the
 * recognized command is still sent verbatim as a statement and the GM/server
 * is expected to interpret it. Surfacing structured data here lets future UI
 * (preview chip, validation, history) and any backend interpreter share one
 * source of truth for the syntax.
 */
export type StatTarget = "HP" | "MP";

export interface StatCommand {
  kind: "stat";
  stat: StatTarget;
  /** Signed delta. `:HP-3` → -3, `:MP+1` → +1. */
  delta: number;
  raw: string;
}

export interface PlainText {
  kind: "text";
  raw: string;
}

export type ChatCommand = StatCommand | PlainText;

const STAT_RE = /^:(HP|MP)([+-])(\d{1,3})$/i;

/**
 * Recognize `:HP-3` / `:MP+1` style shorthand. Anything else (including the
 * empty string, freeform sentences, or commands with extra trailing tokens)
 * is returned as `text` so callers can still send it via `player_statement`.
 */
export function parseChatCommand(input: string): ChatCommand {
  const trimmed = input.trim();
  const m = STAT_RE.exec(trimmed);
  if (!m) return { kind: "text", raw: input };
  const [, statRaw, sign, magnitudeRaw] = m;
  if (!statRaw || !sign || !magnitudeRaw) return { kind: "text", raw: input };
  const stat = statRaw.toUpperCase() as StatTarget;
  const signFactor = sign === "-" ? -1 : 1;
  const magnitude = Number.parseInt(magnitudeRaw, 10);
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return { kind: "text", raw: input };
  }
  return { kind: "stat", stat, delta: signFactor * magnitude, raw: trimmed };
}
