import type { Edge, Node } from "@xyflow/react";
import {
  findFreeSlot,
  overlapsAny,
  type Pt as LayoutPt,
} from "@/lib/canvas-layout";
import { taskChainFlow, type FlowGraph } from "@/lib/flow-graph";
import { canvasNodes as seedCanvasNodes } from "@/lib/workspace-data";

// The canvas renders the AI-generated project TASK CHAIN (откуда → куда):
// a project CONTEXT node on the left feeds a left→right chain of the project's
// active tasks toward the goal. Stage/milestone nodes, documents/notes and
// done/archived tasks are hidden here (kept in the DB/agent context). Positions
// are restored from the shared boardLayout when present, otherwise computed.

export type ProjectNodeData = {
  kind: "project";
  name: string;
  description: string;
};
export type FlowStepData = {
  kind: "flow";
  title: string;
  subtitle: string;
  nodeKind: string;
  taskId?: string;
};
export type NoteNodeData = {
  kind: "note";
  title: string;
  body: string;
  nodeType: string;
};

export type CanvasNodeData = ProjectNodeData | FlowStepData | NoteNodeData;

export type Pt = { x: number; y: number };

export const COL_W = 300;
export const ROW_H = 160;
export const CONTEXT_X = -COL_W - 90;
export const CONTEXT_Y = 40;

export const FLOW_PREFIX = "flow:";
export function flowNodeId(id: string): string {
  return `${FLOW_PREFIX}${id}`;
}

/** Board-managed nodes (context + AI flow steps) persist via saveLayout. */
export function isBoardNodeId(id: string): boolean {
  return id === "__project" || id.startsWith(FLOW_PREFIX);
}

export type CanvasNoteInput = {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  x: number;
  y: number;
};

/** Titles from demo/seed canvas data — never render as user notes. */
const SEED_CANVAS_TITLES = new Set(
  seedCanvasNodes.map((n) => n.title.toLowerCase()),
);

export function isUserCanvasNote(note: { type: string; title: string }): boolean {
  if (note.type !== "note") return false;
  return !SEED_CANVAS_TITLES.has(note.title.toLowerCase());
}

const edgeStyle = {
  stroke: "color-mix(in oklch, var(--accent) 55%, transparent)",
  strokeWidth: 2,
};

export type BoardLayout = Record<string, Pt>;

function isFinitePt(p: Pt | undefined): p is Pt {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

/**
 * Left→right grid positions for the context node + AI flow steps. Column =
 * longest path from a root (node with no incoming edge); rows stack within a
 * column. Cycle-guarded so malformed graphs can never loop forever.
 */
export function computeFlowLayout(flow: FlowGraph): BoardLayout {
  const positions: BoardLayout = {
    __project: { x: CONTEXT_X, y: CONTEXT_Y },
  };
  const ids = flow.nodes.map((n) => n.id);
  if (ids.length === 0) return positions;

  const incoming = new Map<string, string[]>();
  for (const id of ids) incoming.set(id, []);
  for (const e of flow.edges) {
    if (!incoming.has(e.target) || !incoming.has(e.source)) continue;
    incoming.get(e.target)!.push(e.source);
  }

  const depth = new Map<string, number>();
  const computeDepth = (id: string, stack: Set<string>): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    if (stack.has(id)) return 0; // cycle guard
    stack.add(id);
    let d = 0;
    for (const src of incoming.get(id) ?? []) {
      d = Math.max(d, computeDepth(src, stack) + 1);
    }
    stack.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const id of ids) computeDepth(id, new Set());

  const byCol = new Map<number, string[]>();
  for (const id of ids) {
    const c = depth.get(id) ?? 0;
    const arr = byCol.get(c) ?? [];
    arr.push(id);
    byCol.set(c, arr);
  }
  for (const [col, list] of byCol) {
    list.forEach((id, i) => {
      positions[flowNodeId(id)] = { x: col * COL_W, y: i * ROW_H };
    });
  }
  return positions;
}

/** Merge saved positions with computed layout; resolve overlaps. */
export function resolveNodePositions(args: {
  computed: BoardLayout;
  saved: BoardLayout;
  notes: CanvasNoteInput[];
}): BoardLayout {
  const { computed, saved, notes } = args;
  const result: BoardLayout = {};
  const placed: LayoutPt[] = [];

  const place = (id: string, preferred: Pt | undefined, fallback: Pt) => {
    const savedPos = isFinitePt(saved[id]) ? saved[id] : undefined;
    const preferredPos = isFinitePt(preferred) ? preferred : undefined;
    const fallbackPos = isFinitePt(fallback) ? fallback : { x: 0, y: 0 };
    let pos = savedPos ?? preferredPos ?? fallbackPos;
    if (overlapsAny(pos, placed)) {
      pos =
        preferredPos && !savedPos && !overlapsAny(preferredPos, placed)
          ? preferredPos
          : findFreeSlot(placed);
    }
    result[id] = pos;
    placed.push(pos);
  };

  for (const id of Object.keys(computed)) {
    place(id, computed[id], findFreeSlot(placed));
  }
  for (const note of notes.filter(isUserCanvasNote)) {
    place(`note-${note.id}`, { x: note.x, y: note.y }, findFreeSlot(placed));
  }
  return result;
}

/**
 * Build the React Flow nodes/edges for the canvas: a context node feeding the
 * AI flow graph (left→right) plus user notes, with restored/computed positions.
 */
export function buildFlowBoard(args: {
  project: { name: string; description: string };
  flow: FlowGraph;
  /** Task ids to hide from the chain (done + archived). */
  hiddenTaskIds?: Set<string>;
  savedLayout?: BoardLayout;
}): { nodes: Node<CanvasNodeData>[]; edges: Edge[]; layout: BoardLayout } {
  const { project, savedLayout = {} } = args;
  // Reduce to the ordered task chain: only start/goal/active-task nodes.
  const flow = taskChainFlow(args.flow, args.hiddenTaskIds ?? new Set());
  const computed = computeFlowLayout(flow);
  const layout = resolveNodePositions({ computed, saved: savedLayout, notes: [] });

  const nodes: Node<CanvasNodeData>[] = [];
  const edges: Edge[] = [];

  nodes.push({
    id: "__project",
    type: "projectNode",
    position: layout.__project ?? { x: CONTEXT_X, y: CONTEXT_Y },
    data: {
      kind: "project",
      name: project.name,
      description: project.description,
    },
    draggable: true,
  });

  for (const n of flow.nodes) {
    const id = flowNodeId(n.id);
    nodes.push({
      id,
      type: "flowNode",
      position: layout[id] ?? computed[id] ?? { x: 0, y: 0 },
      data: {
        kind: "flow",
        title: n.title,
        subtitle: n.subtitle ?? "",
        nodeKind: n.kind ?? "stage",
        taskId: n.taskId,
      },
      draggable: true,
    });
  }

  // Context feeds the root steps (those with no incoming edge).
  const hasIncoming = new Set(flow.edges.map((e) => e.target));
  for (const n of flow.nodes) {
    if (hasIncoming.has(n.id)) continue;
    edges.push({
      id: `e-ctx-${n.id}`,
      source: "__project",
      target: flowNodeId(n.id),
      type: "smoothstep",
      animated: true,
      style: edgeStyle,
    });
  }
  for (const e of flow.edges) {
    edges.push({
      id: `e-${e.source}-${e.target}`,
      source: flowNodeId(e.source),
      target: flowNodeId(e.target),
      type: "smoothstep",
      animated: true,
      style: edgeStyle,
    });
  }

  return { nodes, edges, layout };
}
