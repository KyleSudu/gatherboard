import { describe, expect, it } from "vitest";

import {
  clampZoom,
  screenToBoardCoordinates,
  zoomViewportAtPoint,
} from "./coordinates";

describe("board coordinate helpers", () => {
  it("converts screen coordinates after pan and zoom", () => {
    expect(
      screenToBoardCoordinates(
        { x: 350, y: 260 },
        { left: 50, top: 20 },
        { x: 100, y: 40, zoom: 2 },
      ),
    ).toEqual({ x: 100, y: 100 });
  });

  it("keeps the board point beneath the cursor fixed while zooming", () => {
    const rect = { left: 20, top: 30 };
    const cursor = { x: 420, y: 330 };
    const current = { x: 40, y: 20, zoom: 1 };
    const before = screenToBoardCoordinates(cursor, rect, current);
    const next = zoomViewportAtPoint(current, 1.5, cursor, rect);

    expect(screenToBoardCoordinates(cursor, rect, next)).toEqual(before);
    expect(next.zoom).toBe(1.5);
  });

  it("clamps zoom to the supported range", () => {
    expect(clampZoom(0.1)).toBe(0.5);
    expect(clampZoom(3)).toBe(2);
  });
});
