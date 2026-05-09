import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore, useUIStore } from "../../stores";

interface Props {
  onAttack: (targetId: string) => void;
  onDetailAttack: (targetId: string) => void;
  onCastArt: (targetId: string) => void;
}

export default function ContextMenu({
  onAttack,
  onDetailAttack,
  onCastArt,
}: Props) {
  const { t } = useTranslation();
  const { contextMenuCharId, contextMenuPos, closeContextMenu } = useUIStore();
  const { gameState } = useGameStore();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // §17 a11y: remember whoever opened the menu so we can put focus back when
  // it closes — otherwise keyboard users get stranded on <body> after Esc.
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!contextMenuCharId) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [closeContextMenu, contextMenuCharId]);

  // §17 a11y: focus the first menuitem when the menu opens (roving tabindex),
  // and restore focus to the opener once the menu unmounts.
  useEffect(() => {
    if (!contextMenuCharId) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    openerRef.current = opener;
    const items = ref.current?.querySelectorAll<HTMLButtonElement>(
      "[role='menuitem']",
    );
    items?.[0]?.focus();
    return () => {
      const target = openerRef.current;
      openerRef.current = null;
      if (target && document.contains(target)) {
        target.focus();
      }
    };
  }, [contextMenuCharId]);

  if (!contextMenuCharId || !contextMenuPos) return null;

  const char = gameState?.characters.find((c) => c.id === contextMenuCharId);
  if (!char) return null;

  const focusItemAt = (index: number) => {
    const items = ref.current?.querySelectorAll<HTMLButtonElement>(
      "[role='menuitem']",
    );
    if (!items || items.length === 0) return;
    const wrapped = ((index % items.length) + items.length) % items.length;
    items[wrapped]?.focus();
  };

  const focusedIndex = (): number => {
    const items = ref.current?.querySelectorAll<HTMLButtonElement>(
      "[role='menuitem']",
    );
    if (!items) return -1;
    const active = document.activeElement;
    return Array.prototype.indexOf.call(items, active);
  };

  // §17 a11y: arrow-key roving + Esc to close + Tab closes per WAI-ARIA menu.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeContextMenu();
      return;
    }
    if (e.key === "Tab") {
      // Per WAI-ARIA menu pattern, Tab moves focus out of the menu and closes it.
      closeContextMenu();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = focusedIndex();
      focusItemAt(idx < 0 ? 0 : idx + 1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = focusedIndex();
      focusItemAt(idx < 0 ? -1 : idx - 1);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      focusItemAt(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      focusItemAt(-1);
    }
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-labelledby={titleId}
      // §17 a11y: explicit vertical orientation matches the ArrowUp/ArrowDown
      // roving so SR users hear the navigation axis up-front.
      aria-orientation="vertical"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      data-testid="context-menu"
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded shadow-lg text-white text-sm py-1 min-w-36 outline-none"
      style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
    >
      <div
        id={titleId}
        className="px-3 py-1 text-gray-400 font-semibold text-xs border-b border-gray-700"
      >
        {char.name}
      </div>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="w-full text-left px-3 py-1.5 hover:bg-gray-700 focus:bg-gray-700 focus:outline-none"
        onClick={() => {
          onAttack(contextMenuCharId);
          closeContextMenu();
        }}
      >
        {t("room.contextMenu.attack")}
      </button>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="w-full text-left px-3 py-1.5 hover:bg-gray-700 focus:bg-gray-700 focus:outline-none text-yellow-300"
        onClick={() => {
          onDetailAttack(contextMenuCharId);
          closeContextMenu();
        }}
      >
        {t("room.contextMenu.detailAttack")}{" "}
        <span aria-hidden="true">⚙</span>
      </button>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="w-full text-left px-3 py-1.5 hover:bg-gray-700 focus:bg-gray-700 focus:outline-none text-purple-300"
        onClick={() => {
          onCastArt(contextMenuCharId);
          closeContextMenu();
        }}
        data-testid="ctx-cast-art"
      >
        {t("room.contextMenu.castArt")}{" "}
        <span aria-hidden="true">✦</span>
      </button>
      <div className="border-t border-gray-700 my-0.5" role="separator" />
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="w-full text-left px-3 py-1.5 hover:bg-gray-700 focus:bg-gray-700 focus:outline-none"
        onClick={closeContextMenu}
      >
        {t("room.contextMenu.detail")}
      </button>
    </div>
  );
}
