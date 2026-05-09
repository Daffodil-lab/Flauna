import type { MockWSServer } from "../mock_ws_server";
import { makeGameState } from "../factories";

// Phase 9 long session: the MockWSServer drives N artificial turns to validate
// that the client survives extended play (memory, listener leaks, scroll
// stickiness, etc.). Default N=30.

export function installLongSessionScenario(
  server: MockWSServer,
  turns = 30,
): void {
  const state = makeGameState({
    characters: [
      {
        id: "char-pc",
        name: "アリス",
        player_id: "player-me",
        faction: "pc",
      },
      {
        id: "char-npc",
        name: "怨霊",
        faction: "npc",
        hp: 999,
        hp_max: 999,
      },
    ],
  });

  let eventId = 1;
  const next = () => eventId++;
  const now = () => new Date().toISOString();
  let turnCount = 0;

  server.onMessage((msg, send) => {
    if (msg.action === "join_room") {
      send({
        type: "session_restore",
        event_id: next(),
        timestamp: now(),
        mode: "full_sync",
        current_state: state,
        missed_events: [],
      });
      send({
        type: "state_full",
        event_id: next(),
        timestamp: now(),
        version: 1,
        state,
      });
      send({
        type: "event",
        event_id: next(),
        timestamp: now(),
        event_name: "turn_start",
        payload: { actor_id: "char-pc" },
      });
      return;
    }
    if (msg.action === "submit_turn_action") {
      turnCount += 1;
      send({
        type: "gm_narrative",
        event_id: next(),
        timestamp: now(),
        text: `ターン ${turnCount}: 攻撃が命中。`,
        is_streaming: false,
      });
      if (turnCount < turns) {
        send({
          type: "event",
          event_id: next(),
          timestamp: now(),
          event_name: "turn_start",
          payload: { actor_id: "char-pc" },
        });
      } else {
        send({
          type: "event",
          event_id: next(),
          timestamp: now(),
          event_name: "combat_ended",
          payload: { outcome: "victory" },
        });
      }
    }
  });
}
