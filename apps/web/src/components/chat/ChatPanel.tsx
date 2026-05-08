import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore, useGameStore, useUIStore } from "../../stores";
import type { ChatEntry } from "../../types";

// Spec §17 keeps the chat panel as a labelled landmark, with the id/aria-controls
// handshake against the Header toggle so SR users learn the disclosure
// relationship and can close from the keyboard with Escape.
export const CHAT_PANEL_ID = "chatpanel-panel";

function EntryRow({ entry }: { entry: ChatEntry }) {
  const { t } = useTranslation();
  // §17 a11y: speaker prefix was hard-coded English which screen readers in
  // Japanese pronounced awkwardly ("ジー・エム"). Pull it from i18n so SR users
  // hear the localized speaker label.
  const prefix =
    entry.kind === "gm_narrative"
      ? t("room.chat.speaker.gm")
      : entry.kind === "system"
        ? t("room.chat.speaker.system")
        : t("room.chat.speaker.you");
  const color =
    entry.kind === "gm_narrative"
      ? "text-purple-300"
      : entry.kind === "system"
        ? "text-gray-400"
        : "text-blue-300";

  return (
    <div
      className="mb-2 text-sm"
      aria-busy={entry.isStreaming || undefined}
    >
      <span className={`font-semibold ${color}`}>{prefix}: </span>
      <span className="text-gray-100">{entry.text}</span>
      {entry.isStreaming && (
        <span aria-hidden="true" className="animate-pulse text-gray-500 ml-1">
          …
        </span>
      )}
    </div>
  );
}

interface Props {
  onSendStatement: (text: string) => void;
}

const STICKY_THRESHOLD_PX = 32;

export default function ChatPanel({ onSendStatement }: Props) {
  const { t } = useTranslation();
  const entries = useChatStore((s) => s.entries);
  const { gameState } = useGameStore();
  const chatPanelOpen = useUIStore((s) => s.chatPanelOpen);
  const closeMobilePanels = useUIStore((s) => s.closeMobilePanels);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [input, setInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenIdRef = useRef<string | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    stickToBottomRef.current = true;
    setUnreadCount(0);
    lastSeenIdRef.current = entries[entries.length - 1]?.id ?? null;
  };

  useEffect(() => {
    const latest = entries[entries.length - 1];
    if (!latest) {
      lastSeenIdRef.current = null;
      setUnreadCount(0);
      return;
    }
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      lastSeenIdRef.current = latest.id;
      setUnreadCount(0);
      return;
    }
    const lastSeen = lastSeenIdRef.current;
    if (lastSeen === null) {
      setUnreadCount(entries.length);
      return;
    }
    const seenIdx = entries.findIndex((e) => e.id === lastSeen);
    setUnreadCount(seenIdx === -1 ? entries.length : entries.length - 1 - seenIdx);
  }, [entries]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < STICKY_THRESHOLD_PX;
    stickToBottomRef.current = nearBottom;
    if (nearBottom) {
      setUnreadCount(0);
      lastSeenIdRef.current = entries[entries.length - 1]?.id ?? null;
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || !gameState) return;
    onSendStatement(text);
    setInput("");
    scrollToBottom();
  };

  useEffect(() => {
    if (!chatPanelOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMobilePanels();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [chatPanelOpen, closeMobilePanels]);

  return (
    <>
      {chatPanelOpen && (
        <button
          type="button"
          aria-label={t("room.mobile.closeChatPanel")}
          onClick={closeMobilePanels}
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          data-testid="chatpanel-backdrop"
        />
      )}
      <aside
        id={CHAT_PANEL_ID}
        aria-label={t("room.chat.panelLabel")}
        data-testid="chatpanel"
        className={`w-64 bg-gray-900 text-white flex flex-col flex-shrink-0
          lg:relative lg:translate-x-0 lg:flex
          fixed inset-y-0 right-0 z-40 transition-transform
          ${chatPanelOpen ? "translate-x-0" : "translate-x-full"}
          lg:transform-none`}
      >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-testid="chatpanel-scroll"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={t("room.chat.logLabel")}
        className="flex-1 overflow-y-auto p-3 space-y-1 relative"
      >
        {entries.map((e) => (
          <EntryRow key={e.id} entry={e} />
        ))}
        <div ref={bottomRef} />
      </div>

      {unreadCount > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          data-testid="chatpanel-jump-to-latest"
          className="mx-2 mb-1 self-end text-xs bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1 shadow"
        >
          {t("room.chat.jumpToLatest", { n: unreadCount })}
        </button>
      )}

      <div className="border-t border-gray-700 p-2 flex gap-2">
        <input
          className="flex-1 bg-gray-800 rounded px-2 py-1 text-sm text-white placeholder-gray-500 outline-none"
          placeholder={t("room.messagePlaceholder")}
          aria-label={t("room.chat.inputLabel")}
          data-testid="chatpanel-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
        >
          {t("room.send")}
        </button>
      </div>
      </aside>
    </>
  );
}
