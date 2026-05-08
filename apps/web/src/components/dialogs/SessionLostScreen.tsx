import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../../stores";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface Props {
  onBackToLobby: () => void;
}

export default function SessionLostScreen({ onBackToLobby }: Props) {
  const { t } = useTranslation();
  const { connectionStatus } = useGameStore();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const focusedOnceRef = useRef(false);
  const isOpen = connectionStatus === "SESSION_LOST";

  // Keep autofocus deterministic so a keyboard user can confirm with Enter the
  // moment the §9-3 lost-session screen mounts.
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "TEXTAREA" || tag === "SELECT" || tag === "INPUT") return;
    e.preventDefault();
    onBackToLobby();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-lost-title"
      aria-describedby="session-lost-message"
      data-testid="session-lost-screen"
      onKeyDown={handleKeyDown}
    >
      <div className="rounded-xl p-8 w-96 text-center shadow-2xl border-2 bg-gray-900 border-red-700">
        <div aria-hidden="true" className="text-5xl mb-4 text-red-500">
          ⚠
        </div>
        <h2
          id="session-lost-title"
          className="text-2xl font-bold mb-2 text-red-400"
        >
          {t("room.sessionLost.title")}
        </h2>
        <p
          id="session-lost-message"
          className="text-gray-400 text-sm mb-6 whitespace-pre-line"
        >
          {t("room.sessionLost.message")}
        </p>
        <button
          ref={buttonRef}
          onClick={onBackToLobby}
          data-testid="session-lost-back"
          className="w-full bg-gray-700 hover:bg-gray-600 text-white rounded py-2 font-semibold"
        >
          {t("room.sessionLost.backToLobby")}
        </button>
      </div>
    </div>
  );
}
