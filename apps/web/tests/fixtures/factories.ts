// Shared GameState / Character factories used by integration tests and the
// MockWSServer scenario fixtures. Trimmed-down shape suitable for state_full
// payloads — extend as scenarios grow.

export interface FactoryCharacter {
  id: string;
  name: string;
  player_id?: string | null;
  faction?: "pc" | "npc";
  hp?: number;
  hp_max?: number;
  mp?: number;
  mp_max?: number;
  position?: [number, number];
  status_effects?: string[];
  weapons?: unknown[];
  arts?: unknown[];
  evade_dice_remaining?: number;
  evade_dice_max?: number;
  katashiro_remaining?: number;
  growth_points?: number;
  is_alive?: boolean;
}

export function makeCharacter(over: FactoryCharacter): Record<string, unknown> {
  return {
    id: over.id,
    name: over.name,
    player_id: over.player_id ?? null,
    faction: over.faction ?? "pc",
    hp: over.hp ?? 8,
    hp_max: over.hp_max ?? 8,
    mp: over.mp ?? 5,
    mp_max: over.mp_max ?? 5,
    position: over.position ?? [0, 0],
    status_effects: over.status_effects ?? [],
    weapons: over.weapons ?? [],
    arts: over.arts ?? [],
    evade_dice_remaining: over.evade_dice_remaining ?? 5,
    evade_dice_max: over.evade_dice_max ?? 5,
    katashiro_remaining: over.katashiro_remaining ?? 7,
    growth_points: over.growth_points ?? 0,
    is_alive: over.is_alive ?? true,
  };
}

export function makeGameState(
  over: Partial<{
    room_id: string;
    version: number;
    phase: "briefing" | "exploration" | "combat" | "assessment";
    machine_state: string;
    characters: FactoryCharacter[];
    turn_order: string[];
    current_turn_index: number;
    round_number: number;
    map_size: [number, number];
    obstacles: [number, number][];
  }> = {},
): Record<string, unknown> {
  const characters = (over.characters ?? []).map(makeCharacter);
  const turnOrder = over.turn_order ?? characters.map((c) => c.id as string);
  return {
    room_id: over.room_id ?? "room-test",
    version: over.version ?? 1,
    seed: 1,
    phase: over.phase ?? "combat",
    machine_state: over.machine_state ?? "WAITING_FOR_ACTION",
    turn_order: turnOrder,
    current_turn_index: over.current_turn_index ?? 0,
    round_number: over.round_number ?? 1,
    characters,
    map_size: over.map_size ?? [10, 10],
    obstacles: over.obstacles ?? [],
    pillars: [],
    wires: [],
    barriers: [],
    objects: [],
    current_turn_summary: null,
    pending_actions: [],
  };
}
