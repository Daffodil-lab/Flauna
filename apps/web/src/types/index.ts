export type Faction = "pc" | "enemy" | "neutral";
export type FirstMoveMode = "normal" | "tactical_maneuver" | "attack_focus";
export type MachineState =
  | "IDLE"
  | "RESOLVING_ACTION"
  | "AWAITING_PLAYER_INPUT"
  | "NARRATING"
  | "PAUSED";
export type GamePhase = "briefing" | "exploration" | "combat" | "assessment";
export type ConnectionStatus =
  | "CONNECTING"
  | "AUTHENTICATING"
  | "ACTIVE"
  | "DISCONNECTED"
  | "SESSION_LOST";

export interface StatusEffect {
  name: string;
  duration: number;
  payload: Record<string, number | string | boolean>;
}

export interface Character {
  id: string;
  name: string;
  player_id: string | null;
  faction: Faction;
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
  equipped_jacket: string | null;
  armor_value: number;
  inventory: Record<string, number>;
  skills: string[];
  arts: string[];
  status_effects: StatusEffect[];
  has_acted_this_turn: boolean;
  movement_used_this_turn: number;
  first_move_mode: FirstMoveMode | null;
}

export type BarrierEffect =
  | "barrier_wall"
  | "armor_dissolve"
  | "evasion_block"
  | "attack_opportunity";

export interface Pillar {
  id: string;
  owner_id: string;
  position: [number, number];
  is_active: boolean;
}

export interface Wire {
  id: string;
  pillar_a_id: string;
  pillar_b_id: string;
}

export interface Barrier {
  id: string;
  wire_id: string;
  effect: BarrierEffect;
  owner_id: string;
  is_active: boolean;
}

export interface MapObject {
  id: string;
  position: [number, number];
  strength: number;
  armor: number;
  label: string;
}

export type PressureLevel = "normal" | "hard" | "ultra_hard";

export interface CombatPressure {
  level: PressureLevel;
  zero_damage_rounds: number;
  pc_to_boss_damage: number;
  boss_to_pc_damage: number;
}

export type Grade = "S" | "A" | "B" | "C" | "D";
export type SessionOutcome = "victory" | "defeat";

export interface SessionScore {
  outcome: SessionOutcome;
  rounds_taken: number;
  pcs_alive: number;
  pcs_total: number;
  enemies_defeated: number;
  enemies_total: number;
  grade: Grade;
}

export type GrowthType = "skill" | "art";

export interface GrowthProposal {
  character_id: string;
  grow_type: GrowthType;
  name: string;
}

export interface GameState {
  room_id: string;
  version: number;
  seed: number;
  phase: GamePhase;
  machine_state: MachineState;
  turn_order: string[];
  current_turn_index: number;
  round_number: number;
  characters: Character[];
  map_size: [number, number];
  obstacles: [number, number][];
  pillars?: Pillar[];
  wires?: Wire[];
  barriers?: Barrier[];
  objects?: MapObject[];
  combat_pressure?: CombatPressure;
  assessment_result?: SessionScore | null;
  growth_proposals?: GrowthProposal[];
  current_turn_summary: unknown | null;
  pending_actions: unknown[];
}

export interface EvasionPending {
  pending_id: string;
  attacker_id: string;
  target_id: string;
  deadline_seconds: number;
}

export type DeathAvoidanceChoice = "avoid_death" | "respawn" | "accept_death";

export type ArtName =
  | "加護防壁"
  | "反閃歩法"
  | "霊力放出"
  | "霊弾発射"
  | "呪祝詛詞"
  | "式神使役";
export type ArtTargetType = "none" | "single" | "area" | "self";

export interface ArtMeta {
  name: ArtName;
  mp_cost: number;
  target_type: ArtTargetType;
  description: string;
}

export interface CastArtPayload {
  art_name: ArtName;
  target?: string;
  center_position?: [number, number];
}

export interface DeathAvoidancePending {
  pending_id: string;
  target_character_id: string;
  target_player_id: string;
  incoming_damage: number;
  damage_type: string;
  katashiro_required: number;
  katashiro_remaining: number;
  deadline_seconds: number;
}

export type ChatKind = "gm_narrative" | "player_statement" | "system";
// §5-2-5 chat scope. Default "all" for back-compat; "whisper" carries a
// recipient player id; "party" is shared with PCs only (system messages are
// always "all").
export type ChatScope = "all" | "party" | "whisper";

export interface ChatEntry {
  id: string;
  kind: ChatKind;
  text: string;
  timestamp: string;
  isStreaming?: boolean;
  scope?: ChatScope;
  toPlayerId?: string | null;
  // For "whisper" entries we also need to know the speaker so the chat panel
  // can render only messages the current viewer is authorised to see.
  fromPlayerId?: string | null;
}

export interface TurnAction {
  moves?: Array<[number, number]>;
  attack?: {
    target_id: string;
    weapon_id: string;
    style: string;
  };
  end_turn?: boolean;
}
