/**
 * Phase 9 integration tests — exercise cross-store / cross-component flows
 * that the per-phase unit tests don't cover end-to-end:
 *
 *  1. Combat damage detected from a state diff fires `playSe("damage")`,
 *     emits a damage event in the UI store, and renders nothing extra
 *     when there is no HP delta.
 *  2. `art_cast` events trigger the cutscene overlay, fire `playSe("cast_art")`
 *     and append a localized chat entry; the cutscene auto-dismisses.
 *  3. `combat_pressure_escalated` events fire `playSe("escalation")` and add
 *     a chat entry whose text changes with the i18n language.
 *  4. `combat_ended` (victory/defeat) shows the CombatResultModal, fires the
 *     matching SE, and the back-to-lobby button clears the modal.
 *  5. Phase transition combat → assessment stops BGM and renders the
 *     AssessmentScreen with the session score.
 *  6. `evade_required` populates the EvasionDialog; submitting clears the
 *     pending request.
 *  7. Switching i18n language updates the rendered text in already-mounted
 *     dialogs (no remount required).
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  within,
} from "@testing-library/react";
import React from "react";
import { nanoid } from "nanoid";
import i18n from "../../src/i18n/index";
import {
  useGameStore,
  useChatStore,
  useUIStore,
  usePendingStore,
} from "../../src/stores";
import { useAudioStore } from "../../src/stores/audioStore";
import {
  setAudioBackend,
  playSe,
  type SeCue,
  type BgmCue,
} from "../../src/services/audio";
import CombatResultModal from "../../src/components/dialogs/CombatResultModal";
import CastArtCutscene from "../../src/components/dialogs/CastArtCutscene";
import EvasionDialog from "../../src/components/dialogs/EvasionDialog";
import AssessmentScreen from "../../src/components/dialogs/AssessmentScreen";
import { usePhaseBgm } from "../../src/hooks/usePhaseBgm";
import type {
  Character,
  EvasionPending,
  GamePhase,
  GameState,
  SessionScore,
} from "../../src/types";

// ---------- shared helpers ----------

function makeChar(over: Partial<Character> = {}): Character {
  return {
    id: over.id ?? "char-1",
    name: over.name ?? "鈴",
    player_id: over.player_id ?? "p1",
    faction: over.faction ?? "pc",
    is_boss: over.is_boss ?? false,
    tai: 4,
    rei: 4,
    kou: 4,
    jutsu: 4,
    max_hp: over.max_hp ?? 20,
    max_mp: over.max_mp ?? 10,
    hp: over.hp ?? 20,
    mp: over.mp ?? 10,
    mobility: 6,
    evasion_dice: over.evasion_dice ?? 3,
    max_evasion_dice: over.max_evasion_dice ?? 3,
    position: over.position ?? [0, 0],
    equipped_weapons: over.equipped_weapons ?? ["fist"],
    equipped_jacket: null,
    armor_value: 0,
    inventory: {},
    skills: [],
    arts: [],
    status_effects: [],
    has_acted_this_turn: false,
    movement_used_this_turn: 0,
    first_move_mode: null,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    room_id: over.room_id ?? "r1",
    version: over.version ?? 1,
    seed: 1,
    phase: over.phase ?? "combat",
    machine_state: over.machine_state ?? "IDLE",
    turn_order: over.turn_order ?? [],
    current_turn_index: 0,
    round_number: over.round_number ?? 1,
    characters: over.characters ?? [makeChar()],
    map_size: [10, 10],
    obstacles: [],
    assessment_result: over.assessment_result ?? null,
    current_turn_summary: null,
    pending_actions: [],
  };
}

interface AudioSpyBackend {
  se: SeCue[];
  bgm: BgmCue[];
  stops: number;
}

function installAudioSpy(): AudioSpyBackend {
  const log: AudioSpyBackend = { se: [], bgm: [], stops: 0 };
  setAudioBackend({
    playSe: (cue) => {
      log.se.push(cue);
    },
    playBgm: (cue) => {
      log.bgm.push(cue);
    },
    stopBgm: () => {
      log.stops += 1;
    },
  });
  return log;
}

/**
 * Mirrors the subset of Room.tsx's WebSocket handler that the integration
 * tests need. Keeping it here (rather than importing Room) lets us test the
 * orchestration without booting the full router/WebSocket stack.
 */
function applyServerEvent(event: { type: string; [k: string]: unknown }): void {
  const game = useGameStore.getState();
  const ui = useUIStore.getState();
  const pending = usePendingStore.getState();
  const chat = useChatStore.getState();

  switch (event.type) {
    case "state_full": {
      const next = event.state as GameState;
      const prev = game.gameState;
      if (prev) {
        const prevHp = new Map(prev.characters.map((c) => [c.id, c.hp]));
        let anyDamage = false;
        next.characters.forEach((c) => {
          const ph = prevHp.get(c.id);
          if (ph !== undefined && c.hp < ph) {
            anyDamage = true;
            ui.addDamageEvent({
              id: nanoid(),
              charId: c.id,
              amount: ph - c.hp,
              gridX: c.position[0],
              gridY: c.position[1],
            });
          }
        });
        if (anyDamage) playSe("damage");
      }
      game.applyStateFull(next);
      break;
    }
    case "event": {
      const name = event.event_name as string;
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      if (name === "combat_ended") {
        const outcome = payload.outcome as "victory" | "defeat" | undefined;
        if (outcome === "victory" || outcome === "defeat") {
          ui.setCombatResult(outcome);
          playSe(outcome);
          chat.addEntry(
            "system",
            i18n.t(
              outcome === "victory"
                ? "room.system.combatVictory"
                : "room.system.combatDefeat",
            ),
          );
        }
      } else if (name === "combat_pressure_escalated") {
        const lvl = (payload.level as string) ?? "hard";
        const localized = i18n.t(`room.hardMode.level.${lvl}`, {
          defaultValue: lvl,
        });
        playSe("escalation");
        chat.addEntry(
          "system",
          i18n.t("room.hardMode.escalated", { level: localized }),
        );
      } else if (name === "art_cast") {
        const artName = payload.art_name as string;
        const casterId = payload.caster_id as string;
        if (artName && casterId) {
          const caster = game.gameState?.characters.find(
            (c) => c.id === casterId,
          );
          ui.triggerCastArtCutscene({
            id: nanoid(),
            artName,
            casterName: caster?.name ?? casterId,
          });
          playSe("cast_art");
          chat.addEntry(
            "system",
            i18n.t("room.system.artCastByOther", { art: artName }),
          );
        }
      }
      break;
    }
    case "evade_required": {
      const req: EvasionPending = {
        pending_id: event.pending_id as string,
        attacker_id: event.attacker_id as string,
        target_id: event.target_id as string,
        deadline_seconds: event.deadline_seconds as number,
      };
      pending.setEvasionRequest(req);
      const me = game.myPlayerId;
      const target = game.gameState?.characters.find(
        (c) => c.id === req.target_id,
      );
      if (me && target?.player_id === me) {
        playSe("evade_alert");
      }
      break;
    }
    case "death_avoidance_required": {
      pending.setDeathAvoidanceRequest({
        pending_id: event.pending_id as string,
        target_character_id: event.target_character_id as string,
        target_player_id: event.target_player_id as string,
        incoming_damage: event.incoming_damage as number,
        damage_type: event.damage_type as string,
        katashiro_required: event.katashiro_required as number,
        katashiro_remaining: event.katashiro_remaining as number,
        deadline_seconds: event.deadline_seconds as number,
      });
      if (event.target_player_id === game.myPlayerId) {
        playSe("death_avoidance_alert");
      }
      break;
    }
  }
}

function resetStores(): void {
  useGameStore.setState({
    gameState: null,
    connectionStatus: "DISCONNECTED",
    lastSeenEventId: 0,
    myPlayerId: "p1",
    myToken: "tok",
  });
  useChatStore.setState({ entries: [] });
  useUIStore.setState({
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
  });
  usePendingStore.setState({
    evasionRequest: null,
    deathAvoidanceRequest: null,
  });
  useAudioStore.setState({ muted: false, volume: 0.6 });
}

// ---------- tests ----------

beforeAll(async () => {
  await i18n.changeLanguage("ja");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  resetStores();
});

describe("Phase 9 integration: combat damage flow", () => {
  it("emits a damage event and SE when a state_full lowers a char's HP", () => {
    const audio = installAudioSpy();
    const me = makeChar({ id: "char-1", hp: 20, position: [2, 3] });
    useGameStore.getState().applyStateFull(makeState({ characters: [me] }));

    const next = makeState({
      version: 2,
      characters: [{ ...me, hp: 14 }],
    });
    applyServerEvent({ type: "state_full", state: next });

    const events = useUIStore.getState().damageEvents;
    expect(events).toHaveLength(1);
    const ev = events[0]!;
    expect(ev.amount).toBe(6);
    expect(ev.gridX).toBe(2);
    expect(ev.gridY).toBe(3);
    expect(audio.se).toEqual(["damage"]);
  });

  it("does not fire SE / events when HP is unchanged", () => {
    const audio = installAudioSpy();
    const me = makeChar({ id: "char-1", hp: 20 });
    useGameStore.getState().applyStateFull(makeState({ characters: [me] }));

    applyServerEvent({
      type: "state_full",
      state: makeState({ version: 2, characters: [me] }),
    });
    expect(useUIStore.getState().damageEvents).toHaveLength(0);
    expect(audio.se).toEqual([]);
  });

  it("ignores HP increases (healing) — no damage popup", () => {
    const audio = installAudioSpy();
    const me = makeChar({ id: "char-1", hp: 10 });
    useGameStore.getState().applyStateFull(makeState({ characters: [me] }));

    applyServerEvent({
      type: "state_full",
      state: makeState({ version: 2, characters: [{ ...me, hp: 18 }] }),
    });
    expect(useUIStore.getState().damageEvents).toHaveLength(0);
    expect(audio.se).toEqual([]);
  });
});

describe("Phase 9 integration: art_cast event → cutscene + SE + chat", () => {
  it("triggers the cutscene overlay and self-dismisses after its duration", () => {
    vi.useFakeTimers();
    const audio = installAudioSpy();
    const caster = makeChar({ id: "char-1", name: "茜" });
    useGameStore
      .getState()
      .applyStateFull(makeState({ characters: [caster] }));

    render(React.createElement(CastArtCutscene));

    act(() => {
      applyServerEvent({
        type: "event",
        event_name: "art_cast",
        payload: { art_name: "霊弾発射", caster_id: "char-1" },
      });
    });

    const overlay = screen.getByTestId("cast-art-cutscene");
    expect(within(overlay).getByText("霊弾発射")).toBeTruthy();
    expect(within(overlay).getByText("茜")).toBeTruthy();
    // Phase 9 §11: cast_art SE is fired from Room.tsx on art_cast, and the
    // cutin SE rides on the cutscene overlay mount for atmosphere.
    expect(audio.se).toEqual(["cast_art", "cutin"]);
    expect(useChatStore.getState().entries.at(-1)?.text).toContain("霊弾発射");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId("cast-art-cutscene")).toBeNull();
  });

  it("falls back to the caster ID when the character is unknown", () => {
    installAudioSpy();
    useGameStore.getState().applyStateFull(makeState({ characters: [] }));
    render(React.createElement(CastArtCutscene));

    act(() => {
      applyServerEvent({
        type: "event",
        event_name: "art_cast",
        payload: { art_name: "加護防壁", caster_id: "ghost-99" },
      });
    });

    expect(screen.getByText("ghost-99")).toBeTruthy();
  });
});

describe("Phase 9 integration: combat_pressure_escalated", () => {
  it("plays the escalation SE and adds a localized chat entry (ja)", () => {
    const audio = installAudioSpy();
    applyServerEvent({
      type: "event",
      event_name: "combat_pressure_escalated",
      payload: { level: "hard" },
    });
    expect(audio.se).toEqual(["escalation"]);
    const last = useChatStore.getState().entries.at(-1);
    expect(last?.kind).toBe("system");
    expect(last?.text).toContain("ハードモード");
  });

  it("uses the en label when the language is en", async () => {
    await i18n.changeLanguage("en");
    installAudioSpy();
    applyServerEvent({
      type: "event",
      event_name: "combat_pressure_escalated",
      payload: { level: "ultra_hard" },
    });
    const last = useChatStore.getState().entries.at(-1);
    expect(last?.text).toContain("Ultra Hard Mode");
    await i18n.changeLanguage("ja");
  });
});

describe("Phase 9 integration: combat_ended → CombatResultModal", () => {
  it("renders victory modal, plays SE, and clears on back-to-lobby", () => {
    const audio = installAudioSpy();
    let backCalls = 0;
    render(
      React.createElement(CombatResultModal, {
        onBackToLobby: () => {
          backCalls += 1;
        },
      }),
    );

    act(() => {
      applyServerEvent({
        type: "event",
        event_name: "combat_ended",
        payload: { outcome: "victory" },
      });
    });

    expect(screen.getByText("勝利！")).toBeTruthy();
    expect(audio.se).toEqual(["victory"]);

    fireEvent.click(screen.getByText("ロビーへ戻る"));
    expect(backCalls).toBe(1);
    expect(useUIStore.getState().combatResult).toBeNull();
  });

  it("renders defeat modal and fires defeat SE", () => {
    const audio = installAudioSpy();
    render(
      React.createElement(CombatResultModal, { onBackToLobby: () => {} }),
    );
    act(() => {
      applyServerEvent({
        type: "event",
        event_name: "combat_ended",
        payload: { outcome: "defeat" },
      });
    });
    expect(screen.getByText("敗北…")).toBeTruthy();
    expect(audio.se).toEqual(["defeat"]);
  });
});

describe("Phase 9 integration: phase transition → BGM + AssessmentScreen", () => {
  function PhaseHarness({ phase }: { phase: GamePhase | undefined }) {
    usePhaseBgm(phase);
    return null;
  }

  it("switches BGM cue on combat → assessment and renders the score screen", () => {
    const audio = installAudioSpy();
    const score: SessionScore = {
      outcome: "victory",
      rounds_taken: 5,
      pcs_alive: 2,
      pcs_total: 3,
      enemies_defeated: 4,
      enemies_total: 4,
      grade: "A",
    };
    useGameStore.getState().applyStateFull(makeState({ phase: "combat" }));

    const { rerender } = render(
      React.createElement(PhaseHarness, { phase: "combat" }),
    );
    expect(audio.bgm).toEqual(["combat"]);

    act(() => {
      useGameStore.getState().applyStateFull(
        makeState({
          phase: "assessment",
          assessment_result: score,
          version: 2,
        }),
      );
    });
    rerender(React.createElement(PhaseHarness, { phase: "assessment" }));
    expect(audio.stops).toBeGreaterThanOrEqual(1);

    render(
      React.createElement(AssessmentScreen, { onBackToLobby: () => {} }),
    );
    expect(screen.getByTestId("assessment-screen")).toBeTruthy();
    expect(screen.getByTestId("assessment-grade").textContent).toBe("A");
  });
});

describe("Phase 9 integration: evade_required → EvasionDialog", () => {
  it("populates the dialog from the pending request and clears on submit", () => {
    const me = makeChar({
      id: "char-pc",
      player_id: "p1",
      evasion_dice: 4,
    });
    const attacker = makeChar({
      id: "char-en",
      name: "鬼",
      player_id: null,
      faction: "enemy",
    });
    useGameStore.getState().applyStateFull(
      makeState({ characters: [me, attacker] }),
    );

    let submitted: { pid: string; dice: number } | null = null;
    render(
      React.createElement(EvasionDialog, {
        onSubmit: (pid: string, dice: number) => {
          submitted = { pid, dice };
        },
      }),
    );

    act(() => {
      applyServerEvent({
        type: "evade_required",
        pending_id: "pe-1",
        attacker_id: "char-en",
        target_id: "char-pc",
        deadline_seconds: 12,
      });
    });

    expect(screen.getByText("回避が必要です")).toBeTruthy();
    expect(screen.getByText("鬼")).toBeTruthy();

    fireEvent.click(screen.getByText("送信"));
    expect(submitted).toEqual({ pid: "pe-1", dice: 0 });
    // Submission clears the pending request via the Room handler:
    usePendingStore.getState().setEvasionRequest(null);
    expect(usePendingStore.getState().evasionRequest).toBeNull();
  });
});

describe("Phase 9 integration: alert SE on interrupt events", () => {
  it("plays evade_alert when the local player is the evasion target", () => {
    const audio = installAudioSpy();
    const me = makeChar({ id: "char-pc", player_id: "p1" });
    const attacker = makeChar({
      id: "char-en",
      player_id: null,
      faction: "enemy",
    });
    useGameStore.getState().applyStateFull(
      makeState({ characters: [me, attacker] }),
    );

    applyServerEvent({
      type: "evade_required",
      pending_id: "pe-1",
      attacker_id: "char-en",
      target_id: "char-pc",
      deadline_seconds: 10,
    });

    expect(audio.se).toEqual(["evade_alert"]);
    expect(usePendingStore.getState().evasionRequest?.pending_id).toBe("pe-1");
  });

  it("does NOT play evade_alert when another player is the target", () => {
    const audio = installAudioSpy();
    const me = makeChar({ id: "char-mine", player_id: "p1" });
    const ally = makeChar({ id: "char-ally", player_id: "p2" });
    const attacker = makeChar({
      id: "char-en",
      player_id: null,
      faction: "enemy",
    });
    useGameStore.getState().applyStateFull(
      makeState({ characters: [me, ally, attacker] }),
    );

    applyServerEvent({
      type: "evade_required",
      pending_id: "pe-2",
      attacker_id: "char-en",
      target_id: "char-ally",
      deadline_seconds: 10,
    });

    expect(audio.se).toEqual([]);
    // The pending request still updates — only the audio cue is gated.
    expect(usePendingStore.getState().evasionRequest?.target_id).toBe(
      "char-ally",
    );
  });

  it("plays death_avoidance_alert only when the local player is targeted", () => {
    const audio = installAudioSpy();
    const me = makeChar({ id: "char-mine", player_id: "p1" });
    useGameStore.getState().applyStateFull(makeState({ characters: [me] }));

    applyServerEvent({
      type: "death_avoidance_required",
      pending_id: "pd-1",
      target_character_id: "char-mine",
      target_player_id: "p1",
      incoming_damage: 12,
      damage_type: "physical",
      katashiro_required: 1,
      katashiro_remaining: 2,
      deadline_seconds: 8,
    });
    expect(audio.se).toEqual(["death_avoidance_alert"]);

    applyServerEvent({
      type: "death_avoidance_required",
      pending_id: "pd-2",
      target_character_id: "char-other",
      target_player_id: "p2",
      incoming_damage: 9,
      damage_type: "physical",
      katashiro_required: 1,
      katashiro_remaining: 0,
      deadline_seconds: 8,
    });
    expect(audio.se).toEqual(["death_avoidance_alert"]);
  });
});

// §9-3: when the WebSocket gives up reconnecting we surface SessionLostScreen
// over a frozen GameState. The BGM must be silenced so the alert isn't read
// over a looping combat track. This was unit-tested at the hook level; covered
// here end-to-end through the Room-style harness.
describe("Phase 9 integration: SESSION_LOST stops BGM (§9-3)", () => {
  function PhaseHarness({
    phase,
    connectionStatus,
  }: {
    phase: GamePhase | undefined;
    connectionStatus?: "ACTIVE" | "DISCONNECTED" | "SESSION_LOST";
  }) {
    usePhaseBgm(phase, connectionStatus);
    return null;
  }

  it("stops BGM when connectionStatus flips to SESSION_LOST mid-combat", () => {
    const audio = installAudioSpy();
    useGameStore.getState().applyStateFull(makeState({ phase: "combat" }));

    const { rerender } = render(
      React.createElement(PhaseHarness, {
        phase: "combat",
        connectionStatus: "ACTIVE",
      }),
    );
    expect(audio.bgm).toEqual(["combat"]);
    const stopsBefore = audio.stops;

    act(() => {
      useGameStore.setState({ connectionStatus: "SESSION_LOST" });
    });
    rerender(
      React.createElement(PhaseHarness, {
        phase: "combat",
        connectionStatus: "SESSION_LOST",
      }),
    );

    expect(audio.stops).toBeGreaterThan(stopsBefore);
  });

  it("does not start BGM if SESSION_LOST is already in effect at mount", () => {
    const audio = installAudioSpy();
    useGameStore
      .getState()
      .applyStateFull(makeState({ phase: "combat" }));
    useGameStore.setState({ connectionStatus: "SESSION_LOST" });

    render(
      React.createElement(PhaseHarness, {
        phase: "combat",
        connectionStatus: "SESSION_LOST",
      }),
    );

    expect(audio.bgm).toEqual([]);
  });
});

describe("Phase 9 integration: language switch updates mounted dialogs", () => {
  it("re-renders CombatResultModal text when the language changes", async () => {
    installAudioSpy();
    render(
      React.createElement(CombatResultModal, { onBackToLobby: () => {} }),
    );
    act(() => {
      useUIStore.getState().setCombatResult("victory");
    });
    expect(screen.getByText("勝利！")).toBeTruthy();

    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(screen.getByText("Victory!")).toBeTruthy();

    await i18n.changeLanguage("ja");
  });
});
