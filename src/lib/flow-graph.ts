// Shared, dependency-free types + sanitizer for the AI-generated project flow
// graph (откуда → куда). Used on both the server (generation/persistence) and
// the client (rendering), so it must not import React Flow or server modules.

export type FlowNodeKind = "start" | "stage" | "milestone" | "goal" | "task";

export type FlowGraphNode = {
  id: string;
  title: string;
  subtitle?: string;
  kind?: FlowNodeKind;
  /** When kind is "task", links this node to an inbox task id. */
  taskId?: string;
};

export type FlowGraphEdge = {
  source: string;
  target: string;
};

export type FlowGraph = {
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
  generatedAt?: string;
};

export const EMPTY_FLOW: FlowGraph = { nodes: [], edges: [] };

const KINDS: FlowNodeKind[] = ["start", "stage", "milestone", "goal", "task"];
const MAX_NODES = 40;
const MAX_EDGES = 48;

function clampStr(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Validate/normalize an unknown value (DB JSON or model output) into a clean
 * FlowGraph. Never throws. Drops malformed nodes/edges, dedupes node ids, and
 * keeps only edges whose endpoints exist.
 */
export function parseFlowGraph(value: unknown): FlowGraph {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { nodes: [], edges: [] };
  }
  const raw = value as {
    nodes?: unknown;
    edges?: unknown;
    generatedAt?: unknown;
  };

  const nodes: FlowGraphNode[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.nodes)) {
    for (const n of raw.nodes) {
      if (!n || typeof n !== "object") continue;
      const rec = n as Record<string, unknown>;
      const id = clampStr(rec.id, 80);
      const title = clampStr(rec.title, 120);
      if (!id || !title || seen.has(id)) continue;
      seen.add(id);
      const kindRaw = clampStr(rec.kind, 20) as FlowNodeKind;
      const taskId = clampStr(rec.taskId, 80) || undefined;
      nodes.push({
        id,
        title,
        subtitle: clampStr(rec.subtitle, 240) || undefined,
        kind: KINDS.includes(kindRaw) ? kindRaw : taskId ? "task" : "stage",
        taskId,
      });
      if (nodes.length >= MAX_NODES) break;
    }
  }

  const edges: FlowGraphEdge[] = [];
  const edgeSeen = new Set<string>();
  if (Array.isArray(raw.edges)) {
    for (const e of raw.edges) {
      if (!e || typeof e !== "object") continue;
      const rec = e as Record<string, unknown>;
      const source = clampStr(rec.source, 80);
      const target = clampStr(rec.target, 80);
      if (!source || !target || source === target) continue;
      if (!seen.has(source) || !seen.has(target)) continue;
      const key = `${source}->${target}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);
      edges.push({ source, target });
      if (edges.length >= MAX_EDGES) break;
    }
  }

  return {
    nodes,
    edges,
    generatedAt:
      typeof raw.generatedAt === "string" ? raw.generatedAt : undefined,
  };
}

/**
 * Reduce a flow graph to the ORDERED TASK CHAIN for the canvas: keep only
 * start / goal / task nodes (drop stage & milestone), drop done/archived tasks,
 * and bridge edges THROUGH the removed nodes so the surviving chain stays
 * connected (start → active tasks → goal). The full graph stays in the DB.
 */
export function taskChainFlow(
  flow: FlowGraph,
  hiddenTaskIds: Set<string> = new Set(),
): FlowGraph {
  const keep = (n: FlowGraphNode): boolean => {
    const kind = n.kind ?? (n.taskId ? "task" : "stage");
    if (kind === "stage" || kind === "milestone") return false;
    if (kind === "task" && n.taskId && hiddenTaskIds.has(n.taskId)) return false;
    return true;
  };
  const survivors = flow.nodes.filter(keep);
  const survivorIds = new Set(survivors.map((n) => n.id));

  const out = new Map<string, string[]>();
  for (const n of flow.nodes) out.set(n.id, []);
  for (const e of flow.edges) out.get(e.source)?.push(e.target);

  const edges: FlowGraphEdge[] = [];
  const seen = new Set<string>();
  for (const s of survivorIds) {
    const stack = [...(out.get(s) ?? [])];
    const visited = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      if (survivorIds.has(cur)) {
        if (cur !== s) {
          const key = `${s}->${cur}`;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({ source: s, target: cur });
          }
        }
        continue; // don't traverse past another surviving node
      }
      for (const nx of out.get(cur) ?? []) stack.push(nx);
    }
  }

  return { nodes: survivors, edges, generatedAt: flow.generatedAt };
}

/** Heuristic: does the project have enough signal for a meaningful graph? */
export function hasEnoughFlowContext(
  description: string | null | undefined,
  taskCount: number,
): boolean {
  const len = (description ?? "").trim().length;
  return len >= 40 || taskCount >= 3;
}
