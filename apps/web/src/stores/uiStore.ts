import { create } from "zustand";
import type { ChatScope } from "../types";

// §5-2-5 chat tab filter. "all_tabs" shows every entry regardless of scope;
// the other values mirror ChatScope. Persisted in localStorage so the user's
// last-used tab survives reloads (matches the audioStore persistence pattern).
export type ChatTabFilter = "all_tabs" | ChatScope;
const CHAT_UI_STORAGE_KEY = "flauna.chatUi.v1";
interface PersistedChatUi {
  chatScope: ChatScope;
  chatTabFilter: ChatTabFilter;
}
const DEFAULT_CHAT_UI: PersistedChatUi = {
  chatScope: "all",
  chatTabFilter: "all_tabs",
};

function loadPersistedChatUi(): PersistedChatUi {
  if (typeof window === "undefined") return DEFAULT_CHAT_UI;
  try {
    const raw = window.localStorage.getItem(CHAT_UI_STORAGE_KEY);
    if (!raw) return DEFAULT_CHAT_UI;
    const parsed = JSON.parse(raw) as Partial<PersistedChatUi>;
    const scope: ChatScope =
      parsed.chatScope === "party" || parsed.chatScope === "whisper"
        ? parsed.chatScope
        : "all";
    const filter: ChatTabFilter =
      parsed.chatTabFilter === "party" ||
      parsed.chatTabFilter === "whisper" ||
      parsed.chatTabFilter === "all"
        ? parsed.chatTabFilter
        : "all_tabs";
    return { chatScope: scope, chatTabFilter: filter };
  } catch {
    return DEFAULT_CHAT_UI;
  }
}

function persistChatUi(state: PersistedChatUi): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAT_UI_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

type ActiveModal =
  | "evasion"
  | "action_detail"
  | "character_detail"
  | "settings"
  | "cast_art"
  | null;
export type CombatResult = "victory" | "defeat" | null;

export interface DamageEvent {
  id: string;
  charId: string;
  amount: number;
  gridX: number;
  gridY: number;
}

export interface CastArtCutscene {
  id: string;
  artName: string;
  casterName: string;
}

/**
 * Spec §9-2: while the server emits `ai_thinking`, show a "GM考え中" banner
 * (max 10s). `actorId` is optional — only present for `deciding_action` stage.
 */
export interface AiThinkingIndicatorState {
  stage: string;
  actorId: string | null;
  receivedAt: number;
}

interface UIStore {
  mapZoom: number;
  selectedCharId: string | null;
  contextMenuCharId: string | null;
  contextMenuPos: { x: number; y: number } | null;
  activeModal: ActiveModal;
  damageEvents: DamageEvent[];
  combatResult: CombatResult;
  /** Target char ID for the ActionDetailModal (opened via "詳細攻撃"). */
  actionDetailTargetId: string | null;
  /** Pre-selected target char ID for CastArtModal (null = caster picks). */
  castArtTargetId: string | null;
  /** Active cast-art cutscene overlay (Phase 5 演出). */
  castArtCutscene: CastArtCutscene | null;
  /** Phase 8: side panel visibility on narrow screens (md and below). */
  sideMenuOpen: boolean;
  chatPanelOpen: boolean;
  /** Phase 9 UX (§9-2): "GM考え中" banner state, null when idle. */
  aiThinking: AiThinkingIndicatorState | null;
  /** §5-2-5 send-target scope picked in the chat panel. */
  chatScope: ChatScope;
  /** §5-2-5 receive-side filter (which tab is active). */
  chatTabFilter: ChatTabFilter;

  setMapZoom: (zoom: number) => void;
  setSelectedChar: (id: string | null) => void;
  openContextMenu: (charId: string, pos: { x: number; y: number }) => void;
  closeContextMenu: () => void;
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
  openActionDetail: (targetId: string) => void;
  openCastArt: (targetId: string | null) => void;
  triggerCastArtCutscene: (cutscene: CastArtCutscene) => void;
  clearCastArtCutscene: () => void;
  addDamageEvent: (event: DamageEvent) => void;
  removeDamageEvent: (id: string) => void;
  setCombatResult: (result: CombatResult) => void;
  toggleSideMenu: () => void;
  toggleChatPanel: () => void;
  closeMobilePanels: () => void;
  setAiThinking: (stage: string, actorId: string | null) => void;
  clearAiThinking: () => void;
  setChatScope: (scope: ChatScope) => void;
  setChatTabFilter: (filter: ChatTabFilter) => void;
}

const __initialChatUi = loadPersistedChatUi();

export const useUIStore = create<UIStore>()((set) => ({
  mapZoom: 40,
  selectedCharId: null,
  contextMenuCharId: null,
  contextMenuPos: null,
  activeModal: null,
  damageEvents: [],
  combatResult: null,
  actionDetailTargetId: null,
  castArtTargetId: null,
  castArtCutscene: null,
  sideMenuOpen: false,
  chatPanelOpen: false,
  aiThinking: null,
  chatScope: __initialChatUi.chatScope,
  chatTabFilter: __initialChatUi.chatTabFilter,

  setMapZoom: (zoom) => set({ mapZoom: Math.min(64, Math.max(30, zoom)) }),
  setSelectedChar: (id) => set({ selectedCharId: id }),
  openContextMenu: (charId, pos) =>
    set({ contextMenuCharId: charId, contextMenuPos: pos }),
  closeContextMenu: () =>
    set({ contextMenuCharId: null, contextMenuPos: null }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null, castArtTargetId: null }),
  openActionDetail: (targetId) =>
    set({ actionDetailTargetId: targetId, activeModal: "action_detail" }),
  openCastArt: (targetId) =>
    set({ castArtTargetId: targetId, activeModal: "cast_art" }),
  triggerCastArtCutscene: (cutscene) => set({ castArtCutscene: cutscene }),
  clearCastArtCutscene: () => set({ castArtCutscene: null }),
  addDamageEvent: (event) =>
    set((s) => ({ damageEvents: [...s.damageEvents, event] })),
  removeDamageEvent: (id) =>
    set((s) => ({ damageEvents: s.damageEvents.filter((e) => e.id !== id) })),
  setCombatResult: (result) => set({ combatResult: result }),
  toggleSideMenu: () =>
    set((s) => ({ sideMenuOpen: !s.sideMenuOpen, chatPanelOpen: false })),
  toggleChatPanel: () =>
    set((s) => ({ chatPanelOpen: !s.chatPanelOpen, sideMenuOpen: false })),
  closeMobilePanels: () => set({ sideMenuOpen: false, chatPanelOpen: false }),
  setAiThinking: (stage, actorId) =>
    set({ aiThinking: { stage, actorId, receivedAt: Date.now() } }),
  clearAiThinking: () => set({ aiThinking: null }),
  setChatScope: (scope) =>
    set((s) => {
      persistChatUi({ chatScope: scope, chatTabFilter: s.chatTabFilter });
      return { chatScope: scope };
    }),
  setChatTabFilter: (filter) =>
    set((s) => {
      persistChatUi({ chatScope: s.chatScope, chatTabFilter: filter });
      return { chatTabFilter: filter };
    }),
}));

export const __CHAT_UI_STORAGE_KEY = CHAT_UI_STORAGE_KEY;
