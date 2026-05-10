import type { MockWSServer } from "../mock_ws_server";
import { makeGameState } from "../factories";

// Phase 3 smoke flow: state_init → turn_start → submit_turn_action received →
// state_update → gm_narrative. The MockWSServer auto-replies based on the
// client message type so the spec only has to drive the UI.

export function installSmokeOneTurnScenario(server: MockWSServer): void {
  const baseState = makeGameState({
    characters: [
      {
        id: "char-pc",
        name: "アリス",
        player_id: "player-me",
        faction: "pc",
        position: [3, 3],
      },
      {
        id: "char-npc",
        name: "怨霊武者",
        player_id: null,
        faction: "npc",
        hp: 5,
        hp_max: 5,
        position: [4, 3],
      },
    ],
  });

  let eventId = 1;
  const nextEventId = () => eventId++;
  const now = () => new Date().toISOString();

  server.onMessage((msg, send) => {
    if (msg.action === "join_room") {
      send({
        type: "session_restore",
        event_id: nextEventId(),
        timestamp: now(),
        mode: "full_sync",
        current_state: baseState,
        missed_events: [],
      });
      send({
        type: "state_full",
        event_id: nextEventId(),
        timestamp: now(),
        version: 1,
        state: baseState,
      });
      send({
        type: "event",
        event_id: nextEventId(),
        timestamp: now(),
        event_name: "turn_start",
        payload: { actor_id: "char-pc" },
      });
      return;
    }
    if (msg.action === "submit_turn_action") {
      // Echo a minimal state_update + narrative.
      send({
        type: "state_update",
        event_id: nextEventId(),
        timestamp: now(),
        version: 2,
        patch: [
          {
            op: "replace",
            path: "/characters/1/hp",
            value: 2,
          },
        ],
      });
      send({
        type: "gm_narrative",
        event_id: nextEventId(),
        timestamp: now(),
        text: "アリスの祓串が怨霊武者を打ち据える。",
        is_streaming: false,
      });
    }
  });
}
