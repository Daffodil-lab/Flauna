import { create } from "zustand";
import { nanoid } from "nanoid";
import type { ChatEntry, ChatKind, ChatScope } from "../types";

export interface AddEntryOptions {
  scope?: ChatScope;
  toPlayerId?: string | null;
  fromPlayerId?: string | null;
}

interface ChatStore {
  entries: ChatEntry[];
  addEntry: (
    kind: ChatKind,
    text: string,
    timestamp?: string,
    isStreaming?: boolean,
    options?: AddEntryOptions,
  ) => void;
  updateLastNarrative: (
    text: string,
    isStreaming: boolean,
    options?: AddEntryOptions,
  ) => void;
  clear: () => void;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  entries: [],

  addEntry: (kind, text, timestamp, isStreaming, options) =>
    set((s) => ({
      entries: [
        ...s.entries,
        {
          id: nanoid(),
          kind,
          text,
          timestamp: timestamp ?? new Date().toISOString(),
          isStreaming,
          scope: options?.scope ?? "all",
          toPlayerId: options?.toPlayerId ?? null,
          fromPlayerId: options?.fromPlayerId ?? null,
        },
      ],
    })),

  updateLastNarrative: (text, isStreaming, options) => {
    const entries = get().entries;
    const last = entries[entries.length - 1];
    if (last?.kind === "gm_narrative" && last.isStreaming) {
      set({
        entries: [
          ...entries.slice(0, -1),
          {
            ...last,
            text,
            isStreaming,
            scope: options?.scope ?? last.scope ?? "all",
            toPlayerId: options?.toPlayerId ?? last.toPlayerId ?? null,
            fromPlayerId: options?.fromPlayerId ?? last.fromPlayerId ?? null,
          },
        ],
      });
    } else {
      get().addEntry("gm_narrative", text, undefined, isStreaming, options);
    }
  },

  clear: () => set({ entries: [] }),
}));
