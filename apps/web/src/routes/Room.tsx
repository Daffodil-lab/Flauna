import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { nanoid } from "nanoid";
import { TacexWebSocket } from "../services/websocket";
import { joinRoom } from "../services/api";
import { playSe } from "../services/audio";
import {
  rememberSubmit,
  resubmitWithCurrentVersion,
  clearLastSubmit,
  type TurnActionPayload,
} from "../services/turnActionResender";
import {
  clearSession,
  loadPlayerName,
  loadSession,
  saveSession,
} from "../services/sessionPersistence";
import { usePhaseBgm } from "../hooks/usePhaseBgm";
import { useTurnStartSe } from "../hooks/useTurnStartSe";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useReconnectToast } from "../hooks/useReconnectToast";
import {
  useGameStore,
  useChatStore,
  useUIStore,
  usePendingStore,
  useToastStore,
} from "../stores";
import { actionForError, messageForError } from "../utils";
import { Header, SideMenu } from "../components/layout";
import { ToastContainer, AiThinkingIndicator } from "../components/common";
import { ChatPanel } from "../components/chat";
import { GameMap, ContextMenu } from "../components/map";
import { QuickActionBar, ActionDetailModal } from "../components/action";
import {
  EvasionDialog,
  CombatResultModal,
  DeathAvoidanceDialog,
  CastArtModal,
  CastArtCutscene,
  AssessmentScreen,
  SessionLostScreen,
} from "../components/dialogs";
import type {
  GameState,
  EvasionPending,
  DeathAvoidancePending,
  DeathAvoidanceChoice,
  CastArtPayload,
} from "../types";
import type { ServerMessage } from "@flauna/ws-schema";
import {
  applySessionRestorePendings,
  type SessionRestoreLike,
} from "../services/sessionRestore";

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const {
    gameState,
    applyStateFull,
    setConnectionStatus,
    setLastSeenEventId,
    setAuth,
    myPlayerId,
    lastSeenEventId,
  } = useGameStore();
  const { addEntry, updateLastNarrative } = useChatStore();
  const {
    openContextMenu,
    openActionDetail,
    openCastArt,
    triggerCastArtCutscene,
    addDamageEvent,
    setCombatResult,
    setAiThinking,
    clearAiThinking,
  } = useUIStore();
  const {
    setEvasionRequest,
    setDeathAvoidanceRequest,
    setSubmittingTurnAction,
  } = usePendingStore();
  const pushToast = useToastStore((s) => s.pushToast);

  // Track previous HP values to detect damage for popups
  const prevHpRef = useRef<Record<string, number>>({});

  const wsRef = useRef<TacexWebSocket | null>(null);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as ServerMessage;
      if (!msg || typeof msg !== "object" || !("type" in msg)) return;

      if ("event_id" in msg && typeof msg.event_id === "number") {
        setLastSeenEventId(msg.event_id);
      }

      // §9-2: any progress event from the server means the AI wait is over,
      // so drop the "GM考え中" banner unless this very message is another
      // ai_thinking stage (e.g. deciding_action → narrating).
      if (msg.type !== "ai_thinking") {
        clearAiThinking();
      }

      switch (msg.type) {
        case "session_restore": {
          const state = msg.current_state as unknown as GameState;
          applyStateFull(state);
          setConnectionStatus("ACTIVE");
          addEntry("system", t("room.system.sessionRestored"));
          // Seed initial HP tracking
          const hpMap: Record<string, number> = {};
          state.characters.forEach((c) => { hpMap[c.id] = c.hp; });
          prevHpRef.current = hpMap;

          applySessionRestorePendings(msg as unknown as SessionRestoreLike, {
            myPlayerId,
            setEvasionRequest,
            setDeathAvoidanceRequest,
            addSystemEntry: (text) => addEntry("system", text),
            t,
            playSe,
          });
          break;
        }
        case "state_full": {
          // Server confirmed a state advance — any in-flight submit_turn_action
          // is now resolved (accepted or superseded), so drop the indicator.
          setSubmittingTurnAction(false);
          const state = msg.state as unknown as GameState;

          // Detect HP decreases → emit damage popups
          let anyDamage = false;
          state.characters.forEach((char) => {
            const prevHp = prevHpRef.current[char.id];
            if (prevHp !== undefined && char.hp < prevHp) {
              anyDamage = true;
              addDamageEvent({
                id: nanoid(),
                charId: char.id,
                amount: prevHp - char.hp,
                gridX: char.position[0],
                gridY: char.position[1],
              });
            }
          });
          if (anyDamage) playSe("damage");
          // Update HP map
          const hpMap: Record<string, number> = {};
          state.characters.forEach((c) => { hpMap[c.id] = c.hp; });
          prevHpRef.current = hpMap;

          applyStateFull(state);
          setConnectionStatus("ACTIVE");
          break;
        }
        case "state_update": {
          // Phase 3+: incremental JSON patch — ignored until then
          break;
        }
        case "gm_narrative": {
          updateLastNarrative(msg.text, msg.is_streaming ?? false);
          break;
        }
        case "event": {
          if (msg.event_name === "combat_ended") {
            const outcome = (msg.payload as { outcome?: string }).outcome;
            if (outcome === "victory" || outcome === "defeat") {
              setCombatResult(outcome);
              playSe(outcome);
              addEntry(
                "system",
                t(
                  outcome === "victory"
                    ? "room.system.combatVictory"
                    : "room.system.combatDefeat",
                ),
              );
            }
          } else if (msg.event_name === "combat_pressure_escalated") {
            playSe("escalation");
            const lvl = (msg.payload as { level?: string }).level ?? "hard";
            const localized = t(`room.hardMode.level.${lvl}`, {
              defaultValue: lvl,
            });
            addEntry(
              "system",
              t("room.hardMode.escalated", { level: localized }),
            );
          } else if (msg.event_name === "art_cast") {
            const p = msg.payload as {
              art_name?: string;
              caster_id?: string;
            };
            if (p.art_name && p.caster_id) {
              const caster = useGameStore
                .getState()
                .gameState?.characters.find((c) => c.id === p.caster_id);
              triggerCastArtCutscene({
                id: nanoid(),
                artName: p.art_name,
                casterName: caster?.name ?? p.caster_id,
              });
              playSe("cast_art");
              addEntry(
                "system",
                t("room.system.artCastByOther", { art: p.art_name }),
              );
            }
          } else {
            addEntry(
              "system",
              t("room.system.event", { name: msg.event_name }),
            );
          }
          break;
        }
        case "ai_thinking": {
          // Spec §9-2: surface "GM考え中" as a banner, not a chat line, so the
          // indicator can stand out and self-clear on the next progress event.
          const actorId =
            "actor_id" in msg && typeof msg.actor_id === "string"
              ? msg.actor_id
              : null;
          setAiThinking(msg.stage, actorId);
          break;
        }
        case "evade_required": {
          const req: EvasionPending = {
            pending_id: msg.pending_id,
            attacker_id: msg.attacker_id,
            target_id: msg.target_id,
            deadline_seconds: msg.deadline_seconds,
          };
          setEvasionRequest(req);
          // Targeted player needs to react fast — fire an alert cue so the
          // dialog isn't missed when looking away from the screen.
          if (
            myPlayerId &&
            useGameStore
              .getState()
              .gameState?.characters.find((c) => c.id === msg.target_id)
              ?.player_id === myPlayerId
          ) {
            playSe("evade_alert");
          }
          break;
        }
        case "death_avoidance_required": {
          const daReq: DeathAvoidancePending = {
            pending_id: msg.pending_id,
            target_character_id: msg.target_character_id,
            target_player_id: msg.target_player_id,
            incoming_damage: msg.incoming_damage,
            damage_type: msg.damage_type,
            katashiro_required: msg.katashiro_required,
            katashiro_remaining: msg.katashiro_remaining,
            deadline_seconds: msg.deadline_seconds,
          };
          setDeathAvoidanceRequest(daReq);
          if (msg.target_player_id === myPlayerId) {
            playSe("death_avoidance_alert");
          }
          break;
        }
        case "ai_fallback_notice": {
          addEntry(
            "system",
            t("room.system.aiFallback", { reason: msg.reason }),
          );
          break;
        }
        case "session_lost": {
          setConnectionStatus("SESSION_LOST");
          addEntry(
            "system",
            t("room.system.sessionDisconnected", { reason: msg.reason }),
          );
          break;
        }
        case "error": {
          const action = actionForError(msg.code);
          addEntry(
            "system",
            t("room.system.error", { code: msg.code, message: msg.message }),
          );
          if (msg.code === "VERSION_MISMATCH") {
            const ok = resubmitWithCurrentVersion({
              send: (p) => wsRef.current?.send(p),
              getCurrentVersion: () =>
                useGameStore.getState().gameState?.version,
              newRequestId: () => nanoid(),
            });
            // On successful resubmit the action is still in flight; only drop
            // the indicator when we give up.
            if (!ok) setSubmittingTurnAction(false);
            pushToast({
              message: t(
                ok
                  ? "room.notice.versionMismatchRetry"
                  : "room.notice.versionMismatchGiveUp",
              ),
              severity: ok ? "info" : "warn",
            });
            break;
          }
          // Any other server-side error rejects the in-flight submission.
          setSubmittingTurnAction(false);
          if (action.kind === "silent") break;
          const localized = messageForError(t, msg.code);
          pushToast({ message: localized, severity: action.severity });
          if (action.kind === "navigate") {
            if (roomId) clearSession(roomId);
            wsRef.current?.close();
            navigate("/");
          }
          break;
        }
      }
    },
    [
      applyStateFull,
      setConnectionStatus,
      addEntry,
      updateLastNarrative,
      setEvasionRequest,
      setDeathAvoidanceRequest,
      setSubmittingTurnAction,
      setLastSeenEventId,
      addDamageEvent,
      setCombatResult,
      triggerCastArtCutscene,
      setAiThinking,
      clearAiThinking,
      pushToast,
      navigate,
      roomId,
      t,
      myPlayerId,
    ],
  );

  useEffect(() => {
    if (!roomId) return;

    (async () => {
      try {
        const cached = loadSession(roomId);
        let playerId: string;
        let playerToken: string;
        if (cached) {
          playerId = cached.player_id;
          playerToken = cached.player_token;
        } else {
          const playerName = loadPlayerName() ?? "プレイヤー";
          const joinResp = await joinRoom(roomId, { player_name: playerName });
          playerId = joinResp.player_id;
          playerToken = joinResp.player_token;
          saveSession(roomId, {
            player_id: playerId,
            player_token: playerToken,
            player_name: playerName,
          });
        }
        setAuth(playerId, playerToken);

        const wsUrl = `ws://${window.location.host}/room/${roomId}`;
        const ws = new TacexWebSocket(wsUrl, handleMessage, (status) => {
          // Once SESSION_LOST is set, stop overwriting it with transient
          // socket-level status updates so the lost-session screen stays put.
          if (useGameStore.getState().connectionStatus === "SESSION_LOST") {
            return;
          }
          if (status === "connected") {
            ws.send({
              action: "join_room",
              player_id: playerId,
              room_id: roomId,
              auth_token: playerToken,
              last_seen_event_id: lastSeenEventId,
            });
            setConnectionStatus("AUTHENTICATING");
          } else if (status === "disconnected") {
            setConnectionStatus("DISCONNECTED");
          } else {
            setConnectionStatus("CONNECTING");
          }
        });
        wsRef.current = ws;
        ws.connect();
      } catch {
        navigate("/");
      }
    })();

    return () => {
      wsRef.current?.close();
      clearLastSubmit();
      setSubmittingTurnAction(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  usePhaseBgm(gameState?.phase);
  useTurnStartSe(gameState, myPlayerId);

  const online = useOnlineStatus();
  useReconnectToast(online);
  const prevOnlineRef = useRef<boolean>(online);
  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = online;
    if (wasOnline && !online) {
      pushToast({ message: t("room.notice.offline"), severity: "warn" });
    } else if (!wasOnline && online) {
      pushToast({ message: t("room.notice.backOnline"), severity: "info" });
      wsRef.current?.reconnectNow();
    }
  }, [online, pushToast, t]);

  const sendWs = useCallback((payload: unknown) => {
    wsRef.current?.send(payload);
  }, []);

  const sendTurnAction = useCallback(
    (payload: TurnActionPayload) => {
      rememberSubmit(payload);
      setSubmittingTurnAction(true);
      sendWs(payload);
    },
    [sendWs, setSubmittingTurnAction],
  );

  const handleEndTurn = useCallback(() => {
    if (!gameState || !myPlayerId) return;
    sendTurnAction({
      action: "submit_turn_action",
      player_id: myPlayerId,
      room_id: gameState.room_id,
      client_request_id: nanoid(),
      expected_version: gameState.version,
      turn_action: { end_turn: true },
    });
  }, [gameState, myPlayerId, sendTurnAction]);

  const handleSendStatement = useCallback(
    (text: string) => {
      if (!gameState || !myPlayerId) return;
      sendWs({
        action: "player_statement",
        player_id: myPlayerId,
        room_id: gameState.room_id,
        client_request_id: nanoid(),
        text,
      });
      addEntry("player_statement", text);
    },
    [gameState, myPlayerId, sendWs, addEntry],
  );

  const handleSubmitEvasion = useCallback(
    (pendingId: string, diceResult: number) => {
      if (!gameState || !myPlayerId) return;
      sendWs({
        action: "submit_evasion",
        player_id: myPlayerId,
        room_id: gameState.room_id,
        client_request_id: nanoid(),
        pending_id: pendingId,
        dice_result: diceResult,
      });
      setEvasionRequest(null);
    },
    [gameState, myPlayerId, sendWs, setEvasionRequest],
  );

  const handleSubmitDeathAvoidance = useCallback(
    (pendingId: string, choice: DeathAvoidanceChoice) => {
      if (!gameState || !myPlayerId) return;
      sendWs({
        action: "submit_death_avoidance",
        player_id: myPlayerId,
        room_id: gameState.room_id,
        client_request_id: nanoid(),
        pending_id: pendingId,
        choice,
      });
      setDeathAvoidanceRequest(null);
    },
    [gameState, myPlayerId, sendWs, setDeathAvoidanceRequest],
  );

  const handleAttack = useCallback(
    (targetId: string) => {
      if (!gameState || !myPlayerId) return;
      const myChar = gameState.characters.find(
        (c) => c.player_id === myPlayerId,
      );
      if (!myChar) return;
      const weaponId = myChar.equipped_weapons[0] ?? "default";
      sendTurnAction({
        action: "submit_turn_action",
        player_id: myPlayerId,
        room_id: gameState.room_id,
        client_request_id: nanoid(),
        expected_version: gameState.version,
        turn_action: {
          main_action: {
            type: "melee_attack",
            weapon_id: weaponId,
            targets: [targetId],
            style: "none",
            dice_distribution: [],
          },
        },
      });
    },
    [gameState, myPlayerId, sendTurnAction],
  );

  const handleDetailAttack = useCallback(
    (targetId: string) => {
      openActionDetail(targetId);
    },
    [openActionDetail],
  );

  const handleDetailAttackSubmit = useCallback(
    (payload: {
      targetId: string;
      weaponId: string;
      style: string;
      moveMode: string;
      diceDistribution: number[];
    }) => {
      if (!gameState || !myPlayerId) return;
      const firstMove =
        payload.moveMode !== "normal"
          ? { path: [], mode: payload.moveMode }
          : undefined;
      sendTurnAction({
        action: "submit_turn_action",
        player_id: myPlayerId,
        room_id: gameState.room_id,
        client_request_id: nanoid(),
        expected_version: gameState.version,
        turn_action: {
          actor_id: gameState.characters.find((c) => c.player_id === myPlayerId)?.id ?? "",
          ...(firstMove ? { first_move: firstMove } : {}),
          main_action: {
            type: "melee_attack",
            weapon_id: payload.weaponId,
            targets: [payload.targetId],
            style: payload.style,
            dice_distribution: payload.diceDistribution,
          },
        },
      });
    },
    [gameState, myPlayerId, sendTurnAction],
  );

  const handleOpenCastArt = useCallback(
    (targetId: string | null) => {
      openCastArt(targetId);
    },
    [openCastArt],
  );

  const handleSubmitCastArt = useCallback(
    (payload: CastArtPayload) => {
      if (!gameState || !myPlayerId) return;
      const myChar = gameState.characters.find(
        (c) => c.player_id === myPlayerId,
      );
      if (!myChar) return;
      sendTurnAction({
        action: "submit_turn_action",
        player_id: myPlayerId,
        room_id: gameState.room_id,
        client_request_id: nanoid(),
        expected_version: gameState.version,
        turn_action: {
          actor_id: myChar.id,
          main_action: {
            type: "cast_art",
            art_name: payload.art_name,
            ...(payload.target ? { target: payload.target } : {}),
            ...(payload.center_position
              ? { center_position: payload.center_position }
              : {}),
          },
        },
      });
      triggerCastArtCutscene({
        id: nanoid(),
        artName: payload.art_name,
        casterName: myChar.name,
      });
      addEntry(
        "system",
        t("room.system.artCastSelf", { art: payload.art_name }),
      );
    },
    [gameState, myPlayerId, sendTurnAction, triggerCastArtCutscene, addEntry, t],
  );

  const handleCharRightClick = useCallback(
    (charId: string, pos: { x: number; y: number }) => {
      openContextMenu(charId, pos);
    },
    [openContextMenu],
  );

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <SideMenu />

        {/* Spec §17: the central play surface is the page's <main> landmark
            so SR users can jump straight to it past the banner/aside chrome. */}
        <main
          aria-label={t("room.main.label")}
          data-testid="room-main"
          className="relative flex flex-col flex-1 overflow-hidden"
        >
          <AiThinkingIndicator />
          <GameMap onCharRightClick={handleCharRightClick} />
          <QuickActionBar onEndTurn={handleEndTurn} />
        </main>

        <ChatPanel onSendStatement={handleSendStatement} />
      </div>

      <ContextMenu
        onAttack={handleAttack}
        onDetailAttack={handleDetailAttack}
        onCastArt={handleOpenCastArt}
      />
      <ActionDetailModal onSubmit={handleDetailAttackSubmit} />
      <CastArtModal onSubmit={handleSubmitCastArt} />
      <CastArtCutscene />
      <EvasionDialog onSubmit={handleSubmitEvasion} />
      <DeathAvoidanceDialog onSubmit={handleSubmitDeathAvoidance} />
      <CombatResultModal
        onBackToLobby={() => {
          if (roomId) clearSession(roomId);
          navigate("/");
        }}
      />
      <AssessmentScreen
        onBackToLobby={() => {
          if (roomId) clearSession(roomId);
          navigate("/");
        }}
      />
      <SessionLostScreen
        onBackToLobby={() => {
          wsRef.current?.close();
          if (roomId) clearSession(roomId);
          navigate("/");
        }}
      />
      <ToastContainer />
    </div>
  );
}
