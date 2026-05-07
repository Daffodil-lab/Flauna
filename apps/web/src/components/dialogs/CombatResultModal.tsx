import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../stores";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface Props {
  onBackToLobby: () => void;
}

export default function CombatResultModal({ onBackToLobby }: Props) {
  const { t } = useTranslation();
  const { combatResult, setCombatResult } = useUIStore();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const focusedOnceRef = useRef(false);
  const isOpen = combatResult !== null;

  const buttonRef = useCallback((node: HTMLButtonElement | null) => {
    if (node && !focusedOnceRef.current) {
      focusedOnceRef.current = true;
      node.focus();
    }
  }, []);

  useFocusTrap(overlayRef, isOpen);

  if (!isOpen) {
    focusedOnceRef.current = false;
    return null;
  }

  const isVictory = combatResult === "victory";

  const dismiss = () => {
    setCombatResult(null);
    onBackToLobby();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "TEXTAREA" || tag === "SELECT" || tag === "INPUT") return;
    e.preventDefault();
    dismiss();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="combat-result-title"
      data-testid="combat-result-modal"
      onKeyDown={handleKeyDown}
    >
      <div
        className={`rounded-xl p-8 w-80 text-center shadow-2xl border-2 ${
          isVictory
            ? "bg-gray-900 border-yellow-400"
            : "bg-gray-900 border-red-600"
        }`}
      >
        <div
          aria-hidden="true"
          className={`text-5xl mb-4 ${isVictory ? "text-yellow-400" : "text-red-500"}`}
        >
          {isVictory ? "⚔" : "💀"}
        </div>
        <h2
          id="combat-result-title"
          className={`text-2xl font-bold mb-2 ${isVictory ? "text-yellow-300" : "text-red-400"}`}
        >
          {isVictory ? t("combat.victory") : t("combat.defeat")}
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          {isVictory ? t("combat.victoryMsg") : t("combat.defeatMsg")}
        </p>
        <button
          ref={buttonRef}
          onClick={dismiss}
          data-testid="combat-result-back"
          className="w-full bg-gray-700 hover:bg-gray-600 text-white rounded py-2 font-semibold"
        >
          {t("combat.backToLobby")}
        </button>
      </div>
    </div>
  );
}
