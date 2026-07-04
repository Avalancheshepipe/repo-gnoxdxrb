// Geometry helpers so canvas nodes are placed/organized cleanly instead of
// piling up on top of each other.

export type Pt = { x: number; y: number };

export const CANVAS_COL_W = 300;
export const CANVAS_ROW_H = 210;

/** True when two node bounding boxes overlap (with optional margin). */
export function positionsOverlap(a: Pt, b: Pt, margin = 30): boolean {
  return (
    Math.abs(a.x - b.x) < CANVAS_COL_W - margin &&
    Math.abs(a.y - b.y) < CANVAS_ROW_H - margin
  );
}

export function overlapsAny(pos: Pt, existing: Pt[], margin = 30): boolean {
  return existing.some((p) => positionsOverlap(pos, p, margin));
}

/** Returns the first grid cell that doesn't overlap any existing node. */
export function findFreeSlot(existing: Pt[]): Pt {
  const overlaps = (x: number, y: number) =>
    existing.some((p) => positionsOverlap({ x, y }, p));

  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * CANVAS_COL_W;
      const y = row * CANVAS_ROW_H;
      if (!overlaps(x, y)) return { x, y };
    }
  }
  // Fallback: stagger below everything.
  const maxY = existing.reduce((m, p) => Math.max(m, p.y), 0);
  return { x: 0, y: maxY + CANVAS_ROW_H };
}

/** Neat grid positions for a list of node ids (used by "Tidy up"). */
export function gridLayout(ids: string[], cols = 4): Record<string, Pt> {
  const out: Record<string, Pt> = {};
  ids.forEach((id, i) => {
    out[id] = {
      x: (i % cols) * CANVAS_COL_W,
      y: Math.floor(i / cols) * CANVAS_ROW_H,
    };
  });
  return out;
}
