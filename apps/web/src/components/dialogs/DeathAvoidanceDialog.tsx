import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore, usePendingStore } from "../../stores";
import { useDeadlineUrgency } from "../../hooks/useDeadlineUrgency";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import type { DeathAvoidanceChoice } from "../../types";

interface Props {
  onSubmit: (pendingId: string, choice: DeathAvoidanceChoice) => void;
}

export default function DeathAvoidanceDialog({ onSubmit }: Props) {
  const { t } = useTranslation();
  const request = usePendingStore((s) => s.deathAvoidanceRequest);
  const { gameState } = useGameStore();
  const [choice, setChoice] = useState<DeathAvoidanceChoice>("avoid_death");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const focusedOnceRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const target = gameState?.characters.find(
    (c) => c.id === request?.target_character_id,
  );
  const katashiroHeld = target?.inventory["katashiro"] ?? 0;
  const hasEnough = katashiroHeld >= (request?.katashiro_required ?? 2);

  // Reset countdown + default choice in render the moment a new pending lands,
  // so the very first paint already has submit enabled (autofocus can take).
  const [trackedPendingId, setTrackedPendingId] = useState<string | null>(null);
  const currentPendingId = request?.pending_id ?? null;
  if (currentPendingId !== trackedPendingId) {
    setTrackedPendingId(currentPendingId);
    setSecondsLeft(request?.deadline_seconds ?? 0);
    setChoice(hasEnough ? "avoid_death" : "accept_death");
    focusedOnceRef.current = false;
  }

  useEffect(() => {
    if (!request) return;
    const id = setInterval(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [request]);

  // Callback ref keeps focus deterministic — the player can confirm with Enter
  // the moment the dialog mounts, before the §16 alarm runs out.
  const submitRef = useCallback((node: HTMLButtonElement | null) => {
    if (node && !focusedOnceRef.current) {
      focusedOnceRef.current = true;
      node.focus();
    }
  }, []);

  const urgency = useDeadlineUrgency(secondsLeft, request !== null);
  useFocusTrap(overlayRef, request !== null);

  if (!request) return null;

  const handleSubmit = () => {
    if (urgency.isExpired) return;
    onSubmit(request.pending_id, choice);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "TEXTAREA" || tag === "SELECT") return;
    e.preventDefault();
    handleSubmit();
  };

  const n = request.katashiro_required;

  const borderClass = urgency.isExpired
    ? "border-gray-500 opacity-80"
    : urgency.isCritical
      ? "border-red-500 animate-pulse"
      : "border-red-500";
  const timerClass = urgency.isExpired
    ? "text-gray-400"
    : urgency.isCritical
      ? "text-red-400 font-bold animate-pulse"
      : urgency.isWarning
        ? "text-orange-400 font-semibold"
        : "text-yellow-400";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="death-avoidance-dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div
        data-testid="death-avoidance-dialog"
        className={`bg-gray-900 border rounded-lg p-6 w-96 text-white ${borderClass}`}
      >
        <h2
          id="death-avoidance-dialog-title"
          className="text-lg font-bold text-red-400 mb-4"
        >
          <span aria-hidden="true">💀</span>{" "}
          {t("room.deathAvoidance.title")}
        </h2>

        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">
              {t("room.deathAvoidance.incomingDamage")}
            </span>
            <span className="text-red-300 font-bold">
              {request.incoming_damage}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">
              {t("room.deathAvoidance.currentHp")}
            </span>
            <span>{target?.hp ?? "?"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">
              {t("room.deathAvoidance.katashiroRemaining")}
            </span>
            <span>{katashiroHeld}枚</span>
          </div>
          <div className="flex justify-between">
            <span
              data-testid="death-avoidance-timer"
              className={timerClass}
              aria-live={urgency.isCritical ? "assertive" : "polite"}
            >
              {urgency.isExpired
                ? t("room.deathAvoidance.expired")
                : t("room.deathAvoidance.timeLeft", { s: secondsLeft })}
            </span>
          </div>
        </div>

        <div
          className="space-y-2 mb-5"
          role="radiogroup"
          aria-label={t("room.deathAvoidance.choicesGroupLabel")}
          data-testid="death-avoidance-choices"
        >
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="death-choice"
              value="avoid_death"
              checked={choice === "avoid_death"}
              onChange={() => setChoice("avoid_death")}
              disabled={!hasEnough}
              className="mt-0.5"
            />
            <span className={!hasEnough ? "text-gray-500" : ""}>
              {t("room.deathAvoidance.avoidDeath", { n })}
              {!hasEnough && (
                <span className="ml-1 text-red-400 text-xs">
                  ({t("room.deathAvoidance.noKatashiro")})
                </span>
              )}
            </span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="death-choice"
              value="respawn"
              checked={choice === "respawn"}
              onChange={() => setChoice("respawn")}
              disabled={!hasEnough}
              className="mt-0.5"
            />
            <span className={!hasEnough ? "text-gray-500" : ""}>
              {t("room.deathAvoidance.respawn", { n })}
              {!hasEnough && (
                <span className="ml-1 text-red-400 text-xs">
                  ({t("room.deathAvoidance.noKatashiro")})
                </span>
              )}
            </span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="death-choice"
              value="accept_death"
              checked={choice === "accept_death"}
              onChange={() => setChoice("accept_death")}
              className="mt-0.5"
            />
            <span className="text-red-300">{t("room.deathAvoidance.accept")}</span>
          </label>
        </div>

        <button
          ref={submitRef}
          data-testid="death-avoidance-submit"
          onClick={handleSubmit}
          disabled={urgency.isExpired}
          className="w-full bg-red-700 hover:bg-red-600 text-white rounded py-2 font-semibold disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {t("room.deathAvoidance.submit")}
        </button>
      </div>
    </div>
  );
}
