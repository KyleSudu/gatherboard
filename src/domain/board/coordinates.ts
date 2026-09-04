import type { Point, Viewport } from "./types";

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;

type RectOrigin = Pick<DOMRect, "left" | "top">;

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Converts a pointer position in browser pixels into a stable point in board space. */
export function screenToBoardCoordinates(
  point: Point,
  rect: RectOrigin,
  viewport: Viewport,
): Point {
  return {
    x: (point.x - rect.left - viewport.x) / viewport.zoom,
    y: (point.y - rect.top - viewport.y) / viewport.zoom,
  };
}

/** Changes zoom while keeping the board point beneath the cursor visually stationary. */
export function zoomViewportAtPoint(
  viewport: Viewport,
  requestedZoom: number,
  screenPoint: Point,
  rect: RectOrigin,
): Viewport {
  const zoom = clampZoom(requestedZoom);
  const boardPoint = screenToBoardCoordinates(screenPoint, rect, viewport);

  return {
    zoom,
    x: screenPoint.x - rect.left - boardPoint.x * zoom,
    y: screenPoint.y - rect.top - boardPoint.y * zoom,
  };
}
