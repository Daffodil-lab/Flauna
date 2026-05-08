import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../src/i18n/index";
import Lobby from "../../src/routes/Lobby";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

beforeAll(async () => {
  await i18n.changeLanguage("ja");
});

beforeEach(() => {
  navigateMock.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderLobby() {
  return render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        I18nextProvider,
        { i18n },
        React.createElement(Lobby),
      ),
    ),
  );
}

describe("Phase 9 web: Lobby keyboard + a11y (§17)", () => {
  it("renders the join section as a form labeled by lobby.joinRoom", () => {
    renderLobby();
    const form = screen.getByRole("form", { name: "ルームに参加" });
    expect(form).toBeInTheDocument();
    // Sanity: the join button lives inside this form, not the create form.
    const joinButton = screen.getByTestId("lobby-join-button");
    expect(form.contains(joinButton)).toBe(true);
  });

  it("renders the create section as a form labeled by lobby.createRoom", () => {
    renderLobby();
    const form = screen.getByRole("form", { name: "ルームを作成" });
    expect(form).toBeInTheDocument();
    // Sanity: the player-name input lives inside the create form, not the join form.
    const playerName = screen.getByTestId("lobby-player-name");
    expect(form.contains(playerName)).toBe(true);
  });

  it("disables the join button while the room ID is empty", () => {
    renderLobby();
    const button = screen.getByTestId(
      "lobby-join-button",
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("enables the join button once a room ID is typed", () => {
    renderLobby();
    fireEvent.change(screen.getByTestId("lobby-room-id"), {
      target: { value: "room-xyz" },
    });
    const button = screen.getByTestId(
      "lobby-join-button",
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it("treats whitespace-only room IDs as empty (button stays disabled)", () => {
    renderLobby();
    fireEvent.change(screen.getByTestId("lobby-room-id"), {
      target: { value: "   " },
    });
    const button = screen.getByTestId(
      "lobby-join-button",
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("navigates on Enter inside the room ID input (form submit)", () => {
    renderLobby();
    const input = screen.getByTestId("lobby-room-id") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "room-abc" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(navigateMock).toHaveBeenCalledWith("/room/room-abc");
  });

  it("trims surrounding whitespace from the room ID before navigating", () => {
    renderLobby();
    const input = screen.getByTestId("lobby-room-id") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  room-trim  " } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(navigateMock).toHaveBeenCalledWith("/room/room-trim");
  });

  it("does not navigate when submitting an empty join form", () => {
    renderLobby();
    const input = screen.getByTestId("lobby-room-id") as HTMLInputElement;
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("persists the player name when joining (so the room screen sees it)", () => {
    renderLobby();
    fireEvent.change(screen.getByTestId("lobby-player-name"), {
      target: { value: "茜" },
    });
    fireEvent.change(screen.getByTestId("lobby-room-id"), {
      target: { value: "room-1" },
    });
    fireEvent.submit(
      (screen.getByTestId("lobby-room-id") as HTMLInputElement).closest(
        "form",
      ) as HTMLFormElement,
    );
    expect(navigateMock).toHaveBeenCalledWith("/room/room-1");
    expect(window.localStorage.getItem("flauna.playerName")).toBe("茜");
  });
});
