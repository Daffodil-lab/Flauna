/**
 * Tiny game-state factories for E2E. Mirrors the shape used by the GM
 * backend's `state_full` / `session_restore` payloads (see WS schema §2-1
 * and §2-3) but without the Pydantic-side defaults.
 */
import { PLAYER_ID, ROOM_ID } from "./mockBackend";

export interface E2ECharacter {
  id: string;
  name: string;
  player_id: string | null;
  faction: string;
  is_boss: boolean;
  tai: number;
  rei: number;
  kou: number;
  jutsu: number;
  max_hp: number;
  max_mp: number;
  hp: number;
  mp: number;
  mobility: number;
  evasion_dice: number;
  max_evasion_dice: number;
  position: [number, number];
  equipped_weapons: string[];
  equipped_jacket: null;
  armor_value: number;
  inventory: Record<string, number>;
  skills: string[];
  arts: string[];
  status_effects: { name: string; duration: number }[];
  has_acted_this_turn: boolean;
  movement_used_this_turn: number;
  first_move_mode: null;
}

export function makeChar(over: Partial<E2ECharacter> = {}): E2ECharacter {
  return {
    id: "char-pc",
    name: "鈴",
    player_id: PLAYER_ID,
    faction: "pc",
    is_boss: false,
    tai: 4,
    rei: 4,
    kou: 4,
    jutsu: 4,
    max_hp: 20,
    max_mp: 10,
    hp: 20,
    mp: 10,
    mobility: 6,
    evasion_dice: 3,
    max_evasion_dice: 3,
    position: [0, 0],
    equipped_weapons: ["fist"],
    equipped_jacket: null,
    armor_value: 0,
    inventory: {},
    skills: [],
    arts: [],
    status_effects: [],
    has_acted_this_turn: false,
    movement_used_this_turn: 0,
    first_move_mode: null,
    ...over,
  };
}

export interface E2EGameState {
  room_id: string;
  version: number;
  seed: number;
  phase: string;
  machine_state: string;
  turn_order: string[];
  current_turn_index: number;
  round_number: number;
  characters: E2ECharacter[];
  map_size: [number, number];
  obstacles: unknown[];
  assessment_result: null;
  current_turn_summary: null;
  pending_actions: unknown[];
}

export function makeState(over: Partial<E2EGameState> = {}): E2EGameState {
  const characters = over.characters ?? [
    makeChar(),
    makeChar({
      id: "char-enemy",
      name: "怨霊",
      player_id: null,
      faction: "enemy",
      hp: 8,
      max_hp: 8,
      position: [2, 0],
    }),
  ];
  return {
    room_id: ROOM_ID,
    version: 1,
    seed: 42,
    phase: "combat",
    machine_state: "IDLE",
    turn_order: characters.map((c) => c.id),
    current_turn_index: 0,
    round_number: 1,
    characters,
    map_size: [10, 10],
    obstacles: [],
    assessment_result: null,
    current_turn_summary: null,
    pending_actions: [],
    ...over,
  };
}

let eventCounter = 1000;
export function nextEventId(): number {
  return ++eventCounter;
}
