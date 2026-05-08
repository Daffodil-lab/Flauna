import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore, useUIStore } from "../../stores";
import { useFocusTrap } from "../../hooks/useFocusTrap";

type MeleeStyle = "none" | "連撃" | "精密攻撃" | "強攻撃" | "全力攻撃";
type MoveMode = "normal" | "attack_focus" | "tactical_maneuver";

interface AttackPayload {
  targetId: string;
  weaponId: string;
  style: MeleeStyle;
  moveMode: MoveMode;
  diceDistribution: number[];
}

interface Props {
  onSubmit: (payload: AttackPayload) => void;
}

const MELEE_STYLES: MeleeStyle[] = ["none", "連撃", "精密攻撃", "強攻撃", "全力攻撃"];
const MOVE_MODES: MoveMode[] = ["normal", "attack_focus", "tactical_maneuver"];

export default function ActionDetailModal({ onSubmit }: Props) {
  const { t } = useTranslation();
  const { activeModal, actionDetailTargetId, closeModal } = useUIStore();
  const { gameState, myPlayerId } = useGameStore();

  const [style, setStyle] = useState<MeleeStyle>("none");
  const [moveMode, setMoveMode] = useState<MoveMode>("normal");
  const [diceCount, setDiceCount] = useState(1);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const focusedOnceRef = useRef(false);
  const submitRef = useCallback((node: HTMLButtonElement | null) => {
    if (node && !focusedOnceRef.current) {
      focusedOnceRef.current = true;
      node.focus();
    }
  }, []);

  const isOpen = activeModal === "action_detail" && actionDetailTargetId !== null;
  useFocusTrap(overlayRef, isOpen);

  const myChar = gameState?.characters.find((c) => c.player_id === myPlayerId);
  const target = gameState?.characters.find((c) => c.id === actionDetailTargetId);
  const weaponId = myChar?.equipped_weapons[0] ?? "default";

  // Base dice from character's first weapon (simplified: tai as proxy).
  const maxDice = myChar?.tai ?? 4;

  const handleAutoDistribute = useCallback(() => {
    setDiceCount(maxDice);
  }, [maxDice]);

  const handleSubmit = useCallback(() => {
    if (!actionDetailTargetId) return;
    onSubmit({
      targetId: actionDetailTargetId,
      weaponId,
      style,
      moveMode,
      diceDistribution: [diceCount],
    });
    closeModal();
  }, [actionDetailTargetId, weaponId, style, moveMode, diceCount, onSubmit, closeModal]);

  if (!isOpen || !target || !myChar) {
    focusedOnceRef.current = false;
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    // Enter on form controls should not double-trigger submit.
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "TEXTAREA" || tag === "SELECT" || tag === "INPUT") return;
    e.preventDefault();
    handleSubmit();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-detail-title"
      data-testid="action-detail-modal"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-gray-900 border border-gray-600 rounded-lg p-6 w-96 text-white">
        <h2
          id="action-detail-title"
          className="text-lg font-bold text-white mb-4"
        >
          {t("room.action.title")}
        </h2>

        {/* Weapon */}
        <div className="mb-3">
          {/* §17 a11y: <label> requires a control association — use a div + */}
          {/* aria-labelledby so the read-only weapon value is named for SR. */}
          <div
            id="action-weapon-label"
            className="text-xs text-gray-400 block mb-1"
          >
            {t("room.action.weapon")}
          </div>
          <div
            className="bg-gray-800 rounded px-3 py-2 text-sm"
            aria-labelledby="action-weapon-label"
          >
            {weaponId}
          </div>
        </div>

        {/* Move mode */}
        <div className="mb-3">
          <div
            id="action-move-mode-label"
            className="text-xs text-gray-400 block mb-1"
          >
            {t("room.action.moveMode")}
          </div>
          <div
            className="space-y-1"
            role="radiogroup"
            aria-labelledby="action-move-mode-label"
            data-testid="action-move-mode-group"
          >
            {MOVE_MODES.map((m) => (
              <label key={m} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="moveMode"
                  value={m}
                  checked={moveMode === m}
                  onChange={() => setMoveMode(m)}
                  className="accent-yellow-500"
                />
                <span className="text-sm">{t(`room.action.moveMode.${m}`)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Style */}
        <div className="mb-3">
          <div
            id="action-style-label"
            className="text-xs text-gray-400 block mb-1"
          >
            {t("room.action.style")}
          </div>
          <div
            className="grid grid-cols-2 gap-1"
            role="radiogroup"
            aria-labelledby="action-style-label"
            data-testid="action-style-group"
          >
            {MELEE_STYLES.map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="style"
                  value={s}
                  checked={style === s}
                  onChange={() => setStyle(s)}
                  className="accent-yellow-500"
                />
                <span className="text-sm">{t(`room.action.style.${s}`)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Target */}
        <div className="mb-3">
          <div
            id="action-target-label"
            className="text-xs text-gray-400 block mb-1"
          >
            {t("room.action.target")}
          </div>
          <div
            className="bg-gray-800 rounded px-3 py-2 text-sm"
            aria-labelledby="action-target-label"
          >
            {target.name} (HP {target.hp}/{target.max_hp})
          </div>
        </div>

        {/* Dice distribution */}
        <div className="mb-4">
          <label
            htmlFor="action-detail-dice"
            className="text-xs text-gray-400 block mb-1"
          >
            {t("room.action.dice")}: {diceCount}
          </label>
          <input
            id="action-detail-dice"
            type="range"
            min={1}
            max={maxDice}
            value={diceCount}
            onChange={(e) => setDiceCount(Number(e.target.value))}
            aria-label={t("room.action.dice")}
            aria-valuetext={t("room.action.totalDice", {
              total: diceCount,
              max: maxDice,
            })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1</span>
            <span>{t("room.action.totalDice", { total: diceCount, max: maxDice })}</span>
            <span>{maxDice}</span>
          </div>
          <button
            onClick={handleAutoDistribute}
            className="mt-2 text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
          >
            {t("room.action.autoDistribute")}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={closeModal}
            data-testid="action-detail-cancel"
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded py-2 text-sm"
          >
            {t("room.action.cancel")}
          </button>
          <button
            ref={submitRef}
            onClick={handleSubmit}
            data-testid="action-detail-submit"
            className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded py-2 text-sm font-semibold"
          >
            {t("room.action.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
