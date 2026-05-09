from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Client → Server messages
# ---------------------------------------------------------------------------


class JoinRoom(BaseModel):
    action: Literal["join_room"]
    player_id: str
    room_id: str
    auth_token: str
    last_seen_event_id: int


class SubmitTurnAction(BaseModel):
    action: Literal["submit_turn_action"]
    player_id: str
    room_id: str
    client_request_id: str
    expected_version: int
    turn_action: dict[str, Any]  # Full TurnAction shape defined in Phase 1+


class SubmitEvasion(BaseModel):
    action: Literal["submit_evasion"]
    player_id: str
    room_id: str
    client_request_id: str
    pending_id: str
    dice_result: int


class SubmitDeathAvoidance(BaseModel):
    action: Literal["submit_death_avoidance"]
    player_id: str
    room_id: str
    client_request_id: str
    pending_id: str
    choice: Literal["avoid_death", "respawn", "accept_death"]


class PlayerStatement(BaseModel):
    action: Literal["player_statement"]
    player_id: str
    room_id: str
    client_request_id: str
    text: str
    # §5-2-5 chat scope. Optional with default "all" so older clients/servers
    # remain compatible. "whisper" requires `to_player_id` to identify the
    # recipient; for "all" / "party" the field is null.
    scope: Literal["all", "party", "whisper"] = "all"
    to_player_id: str | None = None


ClientMessage = Annotated[
    JoinRoom | SubmitTurnAction | SubmitEvasion | SubmitDeathAvoidance | PlayerStatement,
    Field(discriminator="action"),
]


# ---------------------------------------------------------------------------
# Server → Client messages
# ---------------------------------------------------------------------------


class SessionRestore(BaseModel):
    type: Literal["session_restore"]
    event_id: int
    timestamp: str
    mode: Literal["incremental", "full_sync"]
    current_state: dict[str, Any]
    missed_events: list[dict[str, Any]] = []


class StateUpdate(BaseModel):
    type: Literal["state_update"]
    event_id: int
    timestamp: str
    version: int
    patch: list[dict[str, Any]]


class StateFull(BaseModel):
    type: Literal["state_full"]
    event_id: int
    timestamp: str
    version: int
    state: dict[str, Any]


class GmNarrative(BaseModel):
    type: Literal["gm_narrative"]
    event_id: int
    timestamp: str
    text: str
    is_streaming: bool = False
    # §5-2-5 narrative scope, mirroring PlayerStatement so the chat panel can
    # filter by tab. Optional / defaults to "all" for back-compat.
    scope: Literal["all", "party", "whisper"] = "all"
    to_player_id: str | None = None


class GameEventMessage(BaseModel):
    type: Literal["event"]
    event_id: int
    timestamp: str
    event_name: str
    payload: dict[str, Any]


class AiThinking(BaseModel):
    type: Literal["ai_thinking"]
    event_id: int
    timestamp: str
    stage: str


class EvadeRequired(BaseModel):
    type: Literal["evade_required"]
    event_id: int
    timestamp: str
    pending_id: str
    attacker_id: str
    target_id: str
    deadline_seconds: int


class DeathAvoidanceRequired(BaseModel):
    type: Literal["death_avoidance_required"]
    event_id: int
    timestamp: str
    pending_id: str
    target_character_id: str
    target_player_id: str
    incoming_damage: int
    damage_type: str
    katashiro_required: int
    katashiro_remaining: int
    deadline_seconds: int


class AiFallbackNotice(BaseModel):
    type: Literal["ai_fallback_notice"]
    event_id: int
    timestamp: str
    reason: str


class SessionLost(BaseModel):
    type: Literal["session_lost"]
    event_id: int
    timestamp: str
    reason: str


class ErrorMessage(BaseModel):
    type: Literal["error"]
    event_id: int
    timestamp: str
    code: str
    message: str
    detail: dict[str, Any] | None = None
    client_request_id: str | None = None


ServerMessage = Annotated[
    SessionRestore
    | StateUpdate
    | StateFull
    | GmNarrative
    | GameEventMessage
    | AiThinking
    | EvadeRequired
    | DeathAvoidanceRequired
    | AiFallbackNotice
    | SessionLost
    | ErrorMessage,
    Field(discriminator="type"),
]
