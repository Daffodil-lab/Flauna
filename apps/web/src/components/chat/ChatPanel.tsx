import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore, useGameStore, useUIStore } from "../../stores";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { parseChatCommand } from "../../utils/chatCommand";
import type { ChatEntry, ChatScope } from "../../types";
import type { ChatTabFilter } from "../../stores/uiStore";

// Spec §17 keeps the chat panel as a labelled landmark, with the id/aria-controls
// handshake against the Header toggle so SR users learn the disclosure
// relationship and can close from the keyboard with Escape.
export const CHAT_PANEL_ID = "chatpanel-panel";

// §5-2-5 chat scope tabs. "all_tabs" is the union view; the rest mirror ChatScope.
const TAB_FILTERS: readonly ChatTabFilter[] = [
  "all_tabs",
  "all",
  "party",
  "whisper",
];
const SCOPE_OPTIONS: readonly ChatScope[] = ["all", "party", "whisper"];

function tabKey(filter: ChatTabFilter): string {
  return filter === "all_tabs"
    ? "room.chat.tab.allTabs"
    : `room.chat.tab.${filter}`;
}

function EntryRow({
  entry,
  whisperFromName,
  whisperToName,
}: {
  entry: ChatEntry;
  whisperFromName?: string | null;
  whisperToName?: string | null;
}) {
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

  const whisperTag =
    entry.scope === "whisper"
      ? whisperToName
        ? t("room.chat.whisperTo", { name: whisperToName })
        : whisperFromName
          ? t("room.chat.whisperFrom", { name: whisperFromName })
          : null
      : null;

  return (
    <div
      className="mb-2 text-sm"
      data-scope={entry.scope ?? "all"}
      aria-busy={entry.isStreaming || undefined}
    >
      <span className={`font-semibold ${color}`}>{prefix}: </span>
      <span className="text-gray-100">{entry.text}</span>
      {whisperTag && (
        <span className="ml-1 text-xs text-pink-300">{whisperTag}</span>
      )}
      {entry.isStreaming && (
        <span aria-hidden="true" className="animate-pulse text-gray-500 ml-1">
          …
        </span>
      )}
    </div>
  );
}

interface Props {
  onSendStatement: (
    text: string,
    scope: ChatScope,
    toPlayerId?: string | null,
  ) => void;
  myPlayerId?: string | null;
}

const STICKY_THRESHOLD_PX = 32;

export default function ChatPanel({ onSendStatement, myPlayerId }: Props) {
  const { t } = useTranslation();
  const entries = useChatStore((s) => s.entries);
  const { gameState } = useGameStore();
  const chatPanelOpen = useUIStore((s) => s.chatPanelOpen);
  const closeMobilePanels = useUIStore((s) => s.closeMobilePanels);
  const chatScope = useUIStore((s) => s.chatScope);
  const setChatScope = useUIStore((s) => s.setChatScope);
  const chatTabFilter = useUIStore((s) => s.chatTabFilter);
  const setChatTabFilter = useUIStore((s) => s.setChatTabFilter);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [input, setInput] = useState("");
  const [whisperTarget, setWhisperTarget] = useState<string>("");
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenIdRef = useRef<string | null>(null);
  // §17 a11y: drop smooth scroll when the user requested reduced motion.
  const reducedMotion = usePrefersReducedMotion();
  const defaultScrollBehavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

  // Resolve PCs (excluding the viewer) for the whisper recipient picker.
  const otherPcs = useMemo(() => {
    if (!gameState) return [] as { id: string; name: string }[];
    return gameState.characters
      .filter((c) => c.faction === "pc" && c.player_id && c.player_id !== myPlayerId)
      .map((c) => ({ id: c.player_id as string, name: c.name }));
  }, [gameState, myPlayerId]);

  // §5-2-5 receive-side filter: hide whispers not addressed to / sent by viewer,
  // and apply the active tab filter.
  const visibleEntries = useMemo(() => {
    return entries.filter((e) => {
      const scope = e.scope ?? "all";
      if (scope === "whisper") {
        const involvesMe =
          (e.fromPlayerId && e.fromPlayerId === myPlayerId) ||
          (e.toPlayerId && e.toPlayerId === myPlayerId) ||
          // System / GM whispers without sender id but addressed to me
          (!e.fromPlayerId && e.toPlayerId === myPlayerId);
        if (!involvesMe) return false;
      }
      if (chatTabFilter === "all_tabs") return true;
      return scope === chatTabFilter;
    });
  }, [entries, chatTabFilter, myPlayerId]);

  const scrollToBottom = (behavior: ScrollBehavior = defaultScrollBehavior) => {
    bottomRef.current?.scrollIntoView({ behavior });
    stickToBottomRef.current = true;
    setUnreadCount(0);
    lastSeenIdRef.current = visibleEntries[visibleEntries.length - 1]?.id ?? null;
  };

  useEffect(() => {
    const latest = visibleEntries[visibleEntries.length - 1];
    if (!latest) {
      lastSeenIdRef.current = null;
      setUnreadCount(0);
      return;
    }
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: defaultScrollBehavior });
      lastSeenIdRef.current = latest.id;
      setUnreadCount(0);
      return;
    }
    const lastSeen = lastSeenIdRef.current;
    if (lastSeen === null) {
      setUnreadCount(visibleEntries.length);
      return;
    }
    const seenIdx = visibleEntries.findIndex((e) => e.id === lastSeen);
    setUnreadCount(
      seenIdx === -1 ? visibleEntries.length : visibleEntries.length - 1 - seenIdx,
    );
  }, [visibleEntries, defaultScrollBehavior]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < STICKY_THRESHOLD_PX;
    stickToBottomRef.current = nearBottom;
    if (nearBottom) {
      setUnreadCount(0);
      lastSeenIdRef.current = visibleEntries[visibleEntries.length - 1]?.id ?? null;
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || !gameState) return;
    const recipient =
      chatScope === "whisper" ? (whisperTarget || null) : null;
    if (chatScope === "whisper" && !recipient) return; // require pick
    onSendStatement(text, chatScope, recipient);
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

  const lookupName = (playerId: string | null | undefined): string | null => {
    if (!playerId || !gameState) return null;
    const ch = gameState.characters.find((c) => c.player_id === playerId);
    return ch?.name ?? playerId;
  };

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
          role="tablist"
          aria-label={t("room.chat.tablistLabel")}
          data-testid="chatpanel-tablist"
          className="flex border-b border-gray-700 text-xs"
        >
          {TAB_FILTERS.map((f) => {
            const selected = f === chatTabFilter;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={CHAT_PANEL_ID}
                data-testid={`chatpanel-tab-${f}`}
                onClick={() => setChatTabFilter(f)}
                className={`flex-1 py-1 ${
                  selected
                    ? "bg-gray-800 text-white border-b-2 border-blue-400"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {t(tabKey(f))}
              </button>
            );
          })}
        </div>

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
          {visibleEntries.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              whisperFromName={
                e.scope === "whisper" && e.fromPlayerId !== myPlayerId
                  ? lookupName(e.fromPlayerId)
                  : null
              }
              whisperToName={
                e.scope === "whisper" && e.fromPlayerId === myPlayerId
                  ? lookupName(e.toPlayerId)
                  : null
              }
            />
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

        <div className="border-t border-gray-700 p-2 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs">
            <label
              htmlFor="chatpanel-scope"
              className="text-gray-400 shrink-0"
            >
              {t("room.chat.scopeLabel")}
            </label>
            <select
              id="chatpanel-scope"
              data-testid="chatpanel-scope-select"
              value={chatScope}
              onChange={(e) => setChatScope(e.target.value as ChatScope)}
              className="bg-gray-800 text-white rounded px-1 py-0.5"
            >
              {SCOPE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`room.chat.scope.${s}`)}
                </option>
              ))}
            </select>
            {chatScope === "whisper" && (
              <select
                aria-label={t("room.chat.whisperToLabel")}
                data-testid="chatpanel-whisper-target"
                value={whisperTarget}
                onChange={(e) => setWhisperTarget(e.target.value)}
                className="bg-gray-800 text-white rounded px-1 py-0.5 flex-1"
              >
                <option value="">{t("room.chat.whisperPickRecipient")}</option>
                {otherPcs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-gray-800 rounded px-2 py-1 text-sm text-white placeholder-gray-500 outline-none"
              placeholder={t("room.messagePlaceholder")}
              aria-label={t("room.chat.inputLabel")}
              aria-describedby="chatpanel-palette-hint"
              data-testid="chatpanel-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button
              onClick={handleSend}
              data-testid="chatpanel-send"
              className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
            >
              {t("room.send")}
            </button>
          </div>
          {(() => {
            const parsed = parseChatCommand(input);
            if (parsed.kind !== "stat") return null;
            const delta =
              parsed.delta > 0 ? `+${parsed.delta}` : `${parsed.delta}`;
            return (
              <p
                data-testid="chatpanel-command-chip"
                aria-label={t("room.chat.commandRecognizedLabel")}
                className="self-start text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-200"
              >
                {t("room.chat.commandRecognized", { stat: parsed.stat, delta })}
              </p>
            );
          })()}
          <p
            id="chatpanel-palette-hint"
            data-testid="chatpanel-palette-hint"
            aria-label={t("room.chat.paletteHintLabel")}
            className="text-xs text-gray-500"
          >
            {t("room.chat.paletteHint")}
          </p>
        </div>
      </aside>
    </>
  );
}
