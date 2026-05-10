import type { MockWSServer } from "../mock_ws_server";
import { makeGameState } from "../factories";

// Phase 5 barrier flow: pillar place → wire → barrier formed → narrative.

export function installBarrierScenario(server: MockWSServer): void {
  const baseState = makeGameState({
    characters: [
      {
        id: "char-pc",
        name: "アリス",
        player_id: "player-me",
        faction: "pc",
        position: [2, 2],
      },
      {
        id: "char-npc",
        name: "怨霊",
        faction: "npc",
        position: [5, 5],
      },
    ],
  });

  let eventId = 1;
  const next = () => eventId++;
  const now = () => new Date().toISOString();

  server.onMessage((msg, send) => {
    if (msg.action === "join_room") {
      send({
        type: "session_restore",
        event_id: next(),
        timestamp: now(),
        mode: "full_sync",
        current_state: baseState,
        missed_events: [],
      });
      send({
        type: "state_full",
        event_id: next(),
        timestamp: now(),
        version: 1,
        state: baseState,
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
      send({
        type: "state_update",
        event_id: next(),
        timestamp: now(),
        version: 2,
        patch: [
          {
            op: "add",
            path: "/pillars",
            value: [{ id: "p1", position: [2, 3] }],
          },
        ],
      });
      send({
        type: "state_update",
        event_id: next(),
        timestamp: now(),
        version: 3,
        patch: [
          {
            op: "add",
            path: "/wires",
            value: [{ id: "w1", from: "p1", to: "p2" }],
          },
        ],
      });
      send({
        type: "gm_narrative",
        event_id: next(),
        timestamp: now(),
        text: "結界が編まれ、淡い光が空間を覆った。",
        is_streaming: false,
      });
    }
  });
}
