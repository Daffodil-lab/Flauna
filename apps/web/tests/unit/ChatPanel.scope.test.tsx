import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
  act,
} from "@testing-library/react";
import React from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../src/i18n/index";
import ChatPanel from "../../src/components/chat/ChatPanel";
import { useChatStore, useGameStore, useUIStore } from "../../src/stores";

const baseGameState = {
  room_id: "r",
  version: 1,
  seed: 1,
  phase: "combat" as const,
  machine_state: "IDLE",
  turn_order: [],
  current_turn_index: 0,
  round_number: 1,
  characters: [
    {
      id: "char-1",
      name: "Alice",
      player_id: "player-me",
      faction: "pc",
    },
    {
      id: "char-2",
      name: "Bob",
      player_id: "player-bob",
      faction: "pc",
    },
  ],
  map_size: [10, 10],
  obstacles: [],
  current_turn_summary: null,
  pending_actions: [],
};

beforeEach(async () => {
  await i18n.changeLanguage("ja");
  useChatStore.setState({ entries: [] });
  useGameStore.setState({ gameState: baseGameState } as never);
  // Ensure default tab + scope between tests; localStorage is also cleared in
  // afterEach to avoid persistence bleed.
  useUIStore.setState({ chatScope: "all", chatTabFilter: "all_tabs" } as never);
});

afterEach(() => {
  cleanup();
  useChatStore.setState({ entries: [] });
  useGameStore.setState({ gameState: null } as never);
  useUIStore.setState({ chatScope: "all", chatTabFilter: "all_tabs" } as never);
  window.localStorage.clear();
});

function renderPanel(
  onSend: (
    text: string,
    scope: "all" | "party" | "whisper",
    toPlayerId?: string | null,
  ) => void = () => {},
  myPlayerId: string | null = "player-me",
) {
  return render(
    React.createElement(
      I18nextProvider,
      { i18n },
      React.createElement(ChatPanel, {
        onSendStatement: onSend,
        myPlayerId,
      }),
    ),
  );
}

describe("Phase 9 web: ChatPanel scope tabs (§5-2-5)", () => {
  it("renders four scope tabs with role=tab and aria-selected on the active one", () => {
    renderPanel();
    const tablist = screen.getByTestId("chatpanel-tablist");
    expect(tablist.getAttribute("role")).toBe("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    const allTabs = screen.getByTestId("chatpanel-tab-all_tabs");
    expect(allTabs.getAttribute("aria-selected")).toBe("true");
  });

  it("filters entries to the selected tab", () => {
    useChatStore.setState({
      entries: [
        {
          id: "e1",
          kind: "player_statement",
          text: "公開メッセージ",
          timestamp: "t",
          scope: "all",
          fromPlayerId: "player-me",
          toPlayerId: null,
        },
        {
          id: "e2",
          kind: "player_statement",
          text: "パーティ専用",
          timestamp: "t",
          scope: "party",
          fromPlayerId: "player-me",
          toPlayerId: null,
        },
      ],
    } as never);

    renderPanel();
    expect(screen.getByText("公開メッセージ")).toBeTruthy();
    expect(screen.getByText("パーティ専用")).toBeTruthy();

    fireEvent.click(screen.getByTestId("chatpanel-tab-party"));
    expect(screen.queryByText("公開メッセージ")).toBeNull();
    expect(screen.getByText("パーティ専用")).toBeTruthy();
  });

  it("hides whispers not addressed to / sent by the viewer", () => {
    useChatStore.setState({
      entries: [
        {
          id: "w1",
          kind: "player_statement",
          text: "Bob → Charlie 秘話",
          timestamp: "t",
          scope: "whisper",
          fromPlayerId: "player-bob",
          toPlayerId: "player-charlie",
        },
        {
          id: "w2",
          kind: "player_statement",
          text: "Bob → Me 秘話",
          timestamp: "t",
          scope: "whisper",
          fromPlayerId: "player-bob",
          toPlayerId: "player-me",
        },
      ],
    } as never);

    renderPanel();
    fireEvent.click(screen.getByTestId("chatpanel-tab-whisper"));
    expect(screen.queryByText("Bob → Charlie 秘話")).toBeNull();
    expect(screen.getByText("Bob → Me 秘話")).toBeTruthy();
  });
});

describe("Phase 9 web: ChatPanel scope sending (§5-2-5)", () => {
  it("sends with scope=all by default", () => {
    const onSend = vi.fn();
    renderPanel(onSend);
    const input = screen.getByTestId("chatpanel-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hi" } });
    fireEvent.click(screen.getByTestId("chatpanel-send"));
    expect(onSend).toHaveBeenCalledWith("hi", "all", null);
  });

  it("sends with scope=party when the scope select changes", () => {
    const onSend = vi.fn();
    renderPanel(onSend);
    fireEvent.change(screen.getByTestId("chatpanel-scope-select"), {
      target: { value: "party" },
    });
    fireEvent.change(screen.getByTestId("chatpanel-input"), {
      target: { value: "party hi" },
    });
    fireEvent.click(screen.getByTestId("chatpanel-send"));
    expect(onSend).toHaveBeenCalledWith("party hi", "party", null);
  });

  it("requires a recipient before whisper send and forwards it", () => {
    const onSend = vi.fn();
    renderPanel(onSend);
    fireEvent.change(screen.getByTestId("chatpanel-scope-select"), {
      target: { value: "whisper" },
    });
    fireEvent.change(screen.getByTestId("chatpanel-input"), {
      target: { value: "psst" },
    });
    // Recipient not chosen yet → no call.
    fireEvent.click(screen.getByTestId("chatpanel-send"));
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("chatpanel-whisper-target"), {
      target: { value: "player-bob" },
    });
    fireEvent.click(screen.getByTestId("chatpanel-send"));
    expect(onSend).toHaveBeenCalledWith("psst", "whisper", "player-bob");
  });

  it("persists the chosen tab filter into localStorage", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("chatpanel-tab-party"));
    const stored = JSON.parse(
      window.localStorage.getItem("flauna.chatUi.v1") || "{}",
    );
    expect(stored.chatTabFilter).toBe("party");
  });

  it("persists the send scope into localStorage", () => {
    renderPanel();
    fireEvent.change(screen.getByTestId("chatpanel-scope-select"), {
      target: { value: "party" },
    });
    const stored = JSON.parse(
      window.localStorage.getItem("flauna.chatUi.v1") || "{}",
    );
    expect(stored.chatScope).toBe("party");
  });

  it("re-renders correctly when the active tab is the sent scope", () => {
    const onSend = vi.fn();
    renderPanel(onSend);
    fireEvent.click(screen.getByTestId("chatpanel-tab-party"));
    fireEvent.change(screen.getByTestId("chatpanel-scope-select"), {
      target: { value: "party" },
    });
    fireEvent.change(screen.getByTestId("chatpanel-input"), {
      target: { value: "team!" },
    });
    fireEvent.click(screen.getByTestId("chatpanel-send"));
    expect(onSend).toHaveBeenCalledWith("team!", "party", null);
  });
});

describe("Phase 9 web: ChatPanel scope a11y (§17)", () => {
  it("labels the recipient picker via aria-label", () => {
    renderPanel();
    fireEvent.change(screen.getByTestId("chatpanel-scope-select"), {
      target: { value: "whisper" },
    });
    const target = screen.getByTestId("chatpanel-whisper-target");
    expect(target.getAttribute("aria-label")).toBe("秘話の宛先");
  });

  it("uses aria-controls on tabs to point at the chat panel", () => {
    renderPanel();
    const tab = screen.getByTestId("chatpanel-tab-party");
    expect(tab.getAttribute("aria-controls")).toBe("chatpanel-panel");
  });

  it("announces whisper attribution in the rendered entry", () => {
    useChatStore.setState({
      entries: [
        {
          id: "w1",
          kind: "player_statement",
          text: "極秘",
          timestamp: "t",
          scope: "whisper",
          fromPlayerId: "player-bob",
          toPlayerId: "player-me",
        },
      ],
    } as never);
    renderPanel();
    act(() => {
      // touch tab to ensure render path — already on all_tabs which includes whispers
    });
    expect(
      screen.getByText("（Bob より秘話）", { exact: false }),
    ).toBeTruthy();
  });
});
