import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { createAppStore, setLocalBoardId } from "./state";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  setLocalBoardId("draft");
  window.history.replaceState({}, "", "/");
});

function renderApp() {
  const store = createAppStore();
  return {
    store,
    user: userEvent.setup(),
    ...render(
      <Provider store={store}>
        <App syncEnabled={false} />
      </Provider>,
    ),
  };
}

describe("Gatherboard", () => {
  it("creates, edits, recolors, deletes, and restores a note", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: /^Add note$/ }));
    const note = screen.getAllByTestId(/^note-/).at(-1)!;
    const text = within(note).getByLabelText("Note text");
    await user.type(text, "A testable idea");
    await user.tab();

    await user.selectOptions(
      within(note).getByRole("combobox", { name: /color for/i }),
      "pink",
    );
    expect(note).toHaveClass("sticky-note-pink");

    await user.click(within(note).getByRole("button", { name: /delete/i }));
    expect(screen.queryByText("A testable idea")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByDisplayValue("A testable idea")).toBeInTheDocument();
  });

  it("moves a focused note with Alt and arrow keys", async () => {
    const { store, user } = renderApp();
    const note = screen.getByTestId("note-welcome");
    note.focus();

    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");

    expect(
      store.getState().board.present.notes.find(({ id }) => id === "welcome")
        ?.position.x,
    ).toBe(106);
    expect(screen.getByText("Note moved")).toBeInTheDocument();
  });

  it("commits one note movement when a pointer drag ends", () => {
    const { store } = renderApp();
    const handle = screen.getByRole("button", {
      name: /^Drag Double-click the board/,
    });

    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: 150,
      clientY: 130,
    });
    fireEvent.pointerUp(handle, {
      pointerId: 1,
      clientX: 150,
      clientY: 130,
    });

    const board = store.getState().board;
    expect(
      board.present.notes.find(({ id }) => id === "welcome")?.position,
    ).toEqual({ x: 146, y: 126 });
    expect(board.past).toHaveLength(1);
  });

  it("hydrates a previously saved board", () => {
    const store = createAppStore({
      document: {
        notes: [
          {
            id: "persisted",
            text: "Loaded from storage",
            color: "green",
            position: { x: 20, y: 30 },
          },
        ],
      },
      viewport: { x: 10, y: 15, zoom: 1.2 },
    });

    render(
      <Provider store={store}>
        <App syncEnabled={false} />
      </Provider>,
    );

    expect(screen.getByDisplayValue("Loaded from storage")).toBeInTheDocument();
    expect(screen.getByLabelText("Current zoom")).toHaveTextContent("120%");
  });

  it("creates only one board when Strict Mode replays effects", async () => {
    const store = createAppStore();
    const board = {
      id: "1b2dcdf3-7c07-4dc2-8818-318e46cb42cd",
      title: "Server board",
      document: store.getState().board.present,
      viewport: store.getState().board.viewport,
      createdAt: "2026-09-04T12:00:00.000Z",
      updatedAt: "2026-09-04T12:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(board), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <StrictMode>
        <Provider store={store}>
          <App />
        </Provider>
      </StrictMode>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Board title")).toHaveValue("Server board"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe(`/boards/${board.id}`);
  });

  it("keeps the local board usable when the server is offline", async () => {
    const store = createAppStore();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Offline")));

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(
      await screen.findByText(
        /server is unavailable.*local board is still usable/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(screen.getByTestId("note-welcome")).toBeInTheDocument();
  });

  it("shows an error when a shared board does not exist", async () => {
    window.history.replaceState(
      {},
      "",
      "/boards/1b2dcdf3-7c07-4dc2-8818-318e46cb42cd",
    );
    const store = createAppStore();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Board not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(await screen.findByText("Board not found")).toBeInTheDocument();
    expect(screen.getByText("Save failed")).toBeInTheDocument();
  });
});
