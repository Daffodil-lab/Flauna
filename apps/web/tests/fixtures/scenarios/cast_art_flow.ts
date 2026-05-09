import type { MockWSServer } from "../mock_ws_server";
import { makeGameState } from "../factories";

// Phase 5 cast-art flow: PC casts an art → cutscene fires → MP debited → narrative.

export function installCastArtScenario(server: MockWSServer): void {
  const state = makeGameState({
    characters: [
      {
        id: "char-pc",
        name: "アリス",
        player_id: "player-me",
        faction: "pc",
        mp: 5,
        mp_max: 5,
        position: [3, 3],
      },
      {
        id: "char-npc",
        name: "怨霊武者",
        faction: "npc",
        position: [4, 3],
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
      send({
        type: "event",
        event_id: next(),
        timestamp: now(),
        event_name: "art_cast",
        payload: { art_name: "霊弾発射", caster_id: "char-pc" },
      });
      send({
        type: "state_update",
        event_id: next(),
        timestamp: now(),
        version: 2,
        patch: [
          { op: "replace", path: "/characters/0/mp", value: 3 },
          { op: "replace", path: "/characters/1/hp", value: 1 },
        ],
      });
      send({
        type: "gm_narrative",
        event_id: next(),
        timestamp: now(),
        text: "霊弾が宙を裂き、怨霊武者を貫いた。",
        is_streaming: false,
      });
    }
  });
}
