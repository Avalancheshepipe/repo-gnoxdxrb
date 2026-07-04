// AI generation of the project FLOW GRAPH (откуда → куда) and canvas advisory
// suggestions. Budget-disciplined: a single cheap-model call per request, on
// demand only (never on render), capped output tokens, results persisted to
// CanvasDoc.flowGraph so they are stable + shared across the whole project.

import { generateObject, generateText } from "ai";
import { z } from "zod";
import { parseFlowGraph, type FlowGraph, type FlowGraphNode } from "@/lib/flow-graph";
import { statusFromDb } from "@/lib/task-mappers";
import { chatModel, assertAiGatewayConfigured } from "@/server/ai/gateway";
import { assertWithinBudget } from "@/server/ai/run";
import { prisma } from "@/server/db";
import { env } from "@/server/env";

type ProjectTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  position: number;
};

const genSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().describe("short stable slug, e.g. 'discovery' or 'task-setup'"),
        title: z.string().describe("short label shown on the canvas"),
        subtitle: z.string().optional().describe("one short clarifying line"),
        kind: z
          .enum(["start", "stage", "milestone", "goal", "task"])
          .optional(),
        taskId: z
          .string()
          .optional()
          .describe("required when kind is task — use the exact task id from the list"),
      }),
    )
    .min(2)
    .max(24),
  edges: z
    .array(z.object({ source: z.string(), target: z.string() }))
    .max(32),
});

const STATUS_ORDER = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;

async function loadProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      organizationId: true,
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          position: true,
        },
        orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
        take: 60,
      },
    },
  });
  if (!project) throw new Error("Project not found");
  return project;
}

function tasksDigest(tasks: ProjectTask[]): string {
  if (tasks.length === 0) return "(no tasks yet)";
  return tasks
    .map(
      (t) =>
        `- id:${t.id} "${t.title}" [${statusFromDb(t.status)}/${t.priority.toLowerCase()}]`,
    )
    .join("\n");
}

function taskNodeId(taskId: string): string {
  return `task-${taskId.slice(-10)}`;
}

/** Ensure every inbox task appears as a flow node; wire orphans into the chain. */
function mergeTaskNodes(graph: FlowGraph, tasks: ProjectTask[]): FlowGraph {
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const ids = new Set(nodes.map((n) => n.id));
  const covered = new Set(
    nodes.filter((n) => n.taskId).map((n) => n.taskId as string),
  );

  for (const t of tasks) {
    if (covered.has(t.id)) continue;
    let id = taskNodeId(t.id);
    while (ids.has(id)) id = `${id}-${t.id.slice(-4)}`;
    ids.add(id);
    covered.add(t.id);
    nodes.push({
      id,
      title: t.title,
      subtitle: `${statusFromDb(t.status)}/${t.priority.toLowerCase()}`,
      kind: "task",
      taskId: t.id,
    });
  }

  const targets = new Set(edges.map((e) => e.target));
  const roots = nodes.filter((n) => !targets.has(n.id));
  const tail = nodes.find((n) => !edges.some((e) => e.source === n.id));

  for (const t of tasks) {
    const node = nodes.find((n) => n.taskId === t.id);
    if (!node) continue;
    const hasEdge = edges.some((e) => e.source === node.id || e.target === node.id);
    if (hasEdge) continue;
    const anchor = tail && tail.id !== node.id ? tail : roots[0];
    if (anchor && anchor.id !== node.id) {
      edges.push({ source: anchor.id, target: node.id });
    }
  }

  return parseFlowGraph({ ...graph, nodes, edges });
}

/** Deterministic left→right chain when the model call fails or returns too little. */
function buildFallbackFlow(tasks: ProjectTask[]): FlowGraph {
  const sorted = [...tasks].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status as (typeof STATUS_ORDER)[number]) -
        STATUS_ORDER.indexOf(b.status as (typeof STATUS_ORDER)[number]) ||
      a.position - b.position,
  );

  const nodes: FlowGraphNode[] = [
    { id: "start", title: "Старт", kind: "start" },
  ];
  const edges: { source: string; target: string }[] = [];
  let prev = "start";

  for (const t of sorted) {
    const id = taskNodeId(t.id);
    nodes.push({
      id,
      title: t.title,
      subtitle: `${statusFromDb(t.status)}/${t.priority.toLowerCase()}`,
      kind: "task",
      taskId: t.id,
    });
    edges.push({ source: prev, target: id });
    prev = id;
  }

  nodes.push({ id: "goal", title: "Цель", kind: "goal" });
  edges.push({ source: prev, target: "goal" });

  return parseFlowGraph({
    nodes,
    edges,
    generatedAt: new Date().toISOString(),
  });
}

function assertAiGateway(): void {
  assertAiGatewayConfigured();
}

/**
 * Generate (and persist) the project's flow graph from its context + tasks.
 * Returns the sanitized graph. Throws only on missing project / budget cap.
 */
export async function generateProjectFlow(projectId: string): Promise<FlowGraph> {
  assertAiGateway();
  const project = await loadProject(projectId);
  await assertWithinBudget(project.organizationId);

  const tasks = project.tasks as ProjectTask[];
  let graph: FlowGraph;

  if (tasks.length === 0 && !(project.description?.trim().length ?? 0)) {
    throw new Error("Add project context or tasks before generating a flow.");
  }

  try {
    const system = [
      "You design a concise LEFT→RIGHT project flow graph for a team canvas.",
      "Output nodes and directed edges from project start to goal.",
      "",
      "REQUIRED:",
      "- Include EVERY task from the task list as its own node (kind: task, taskId: exact id).",
      "- You may also add stage/milestone nodes between tasks when they clarify the journey.",
      "- Mark the first conceptual node kind 'start' (or use the first task) and the last 'goal'.",
      "- Edges must follow logical progression: dependencies, status order (todo→in-progress→review→done).",
      "- Mostly a left→right chain; branches allowed for parallel work.",
      "- Node ids: short stable slugs; edges reference those ids.",
      "- Use the SAME language as the project context for titles.",
    ].join(" ");

    const prompt = [
      `Project: ${project.name}`,
      "",
      "Context (goal, in the team's words):",
      project.description?.trim() || "(no description provided)",
      "",
      "Tasks (each MUST appear as a task node with matching taskId):",
      tasksDigest(tasks),
    ].join("\n");

    const { object } = await generateObject({
      model: chatModel(env.AI_GATEWAY_DOC_MODEL),
      schema: genSchema,
      system,
      prompt,
      maxOutputTokens: 900,
    });

    graph = parseFlowGraph({
      ...object,
      generatedAt: new Date().toISOString(),
    });
    graph = mergeTaskNodes(graph, tasks);
  } catch (err) {
    console.error("[generateProjectFlow] AI failed, using fallback layout", err);
    graph = buildFallbackFlow(tasks);
  }

  if (graph.nodes.length < 2) {
    graph = buildFallbackFlow(tasks);
  }

  await prisma.canvasDoc.upsert({
    where: { projectId },
    update: { flowGraph: graph },
    create: { projectId, flowGraph: graph },
  });

  return graph;
}

/**
 * Short advisory suggestions ("что можно добавить / продумать") about the
 * current flow + tasks. Cheap single call, capped tokens. Returns bullet lines.
 */
export async function suggestForFlow(
  projectId: string,
  locale: "ru" | "en",
): Promise<string[]> {
  assertAiGateway();
  const project = await loadProject(projectId);
  await assertWithinBudget(project.organizationId);

  const doc = await prisma.canvasDoc
    .findUnique({ where: { projectId }, select: { flowGraph: true } })
    .catch(() => null);
  const graph = parseFlowGraph(doc?.flowGraph);

  const lang =
    locale === "en"
      ? "Answer in English."
      : "Отвечай по-русски.";

  const system = [
    "You are a pragmatic project advisor looking at a flow graph and the tasks.",
    "Give 3–5 short, concrete suggestions: what to add, what to think through,",
    "risks or missing steps in this system. One idea per line, no preamble.",
    lang,
  ].join(" ");

  const prompt = [
    `Project: ${project.name}`,
    `Context: ${project.description?.trim() || "(none)"}`,
    "",
    "Flow nodes:",
    graph.nodes.length
      ? graph.nodes
          .map((n) => {
            const tag = n.taskId ? " [task]" : "";
            return `- ${n.title}${n.subtitle ? ` — ${n.subtitle}` : ""}${tag}`;
          })
          .join("\n")
      : "(no flow generated yet)",
    "",
    "Tasks:",
    tasksDigest(project.tasks as ProjectTask[]),
  ].join("\n");

  const { text } = await generateText({
    model: chatModel(env.AI_GATEWAY_RESEARCH_MODEL),
    system,
    prompt,
    maxOutputTokens: 400,
  });

  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 6);
}
