"use client";

import {
  BaseEdge,
  getSmoothStepPath,
  Position,
  type EdgeProps,
} from "@xyflow/react";
import { memo } from "react";

const STROKE_WIDTH = 2;
/** Move endpoints outward so the stroke ends on the border, not inside the glass card. */
const EDGE_OUTSET = STROKE_WIDTH / 2 + 0.5;
const STEP_OFFSET = 0;

const HANDLE_DIR: Record<Position, { x: number; y: number }> = {
  [Position.Top]: { x: 0, y: -1 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Bottom]: { x: 0, y: 1 },
  [Position.Left]: { x: -1, y: 0 },
};

function outsetFromNode(
  x: number,
  y: number,
  position: Position,
  pixels: number,
): { x: number; y: number } {
  const d = HANDLE_DIR[position];
  return { x: x + d.x * pixels, y: y + d.y * pixels };
}

function JulowSmoothStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
  style,
  markerEnd,
  markerStart,
  interactionWidth,
}: EdgeProps) {
  const source = outsetFromNode(sourceX, sourceY, sourcePosition, EDGE_OUTSET);
  const target = outsetFromNode(targetX, targetY, targetPosition, EDGE_OUTSET);

  const [path] = getSmoothStepPath({
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
    offset: STEP_OFFSET,
  });

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{ strokeWidth: STROKE_WIDTH, ...style }}
      markerEnd={markerEnd}
      markerStart={markerStart}
      interactionWidth={interactionWidth}
    />
  );
}

export const flowEdgeTypes = {
  smoothstep: memo(JulowSmoothStepEdge),
};
