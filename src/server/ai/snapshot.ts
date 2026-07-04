import { parseFlowGraph } from "@/lib/flow-graph";
import { handleFromEmail } from "@/lib/mentions";
import { dbBriefToContent, parseAgentBrief } from "@/lib/task-mappers";
import { capabilityLabels, normalizeAgentTools } from "@/server/ai/capabilities";
import { prisma } from "@/server/db";

const STATUS_LABEL: Record<string, string> = {
  TODO: "todo",
  IN_PROGRESS: "in-progress",
  REVIEW: "review",
  DONE: "done",
};

type SnapshotOpts = {
  projectId?: string | null;
  /** When set, the snapshot focuses on a single task (clarifying questions). */
  taskId?: string | null;
  userId: string;
  userName: string;
  userEmail?: string;
};

function taskLine(t: {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  project: { name: string };
  assignees: {
    user: { name: string | null } | null;
    agent: { name: string } | null;
  }[];
}): string {
  const who = t.assignees
    .map((x) => x.agent?.name ?? x.user?.name)
    .filter(Boolean)
    .join(", ");
  const due = t.dueDate ? `, due ${t.dueDate.toISOString().slice(0, 10)}` : "";
  return `- "${t.title}" [${STATUS_LABEL[t.status] ?? t.status}/${t.priority.toLowerCase()}] (id: ${t.id}) in ${t.project.name}${who ? `, assigned: ${who}` : ""}${due}`;
}

/**
 * Builds a compact, real-data snapshot of the workspace for the agent's system
 * prompt. Scoped to one organization (the caller must have verified membership).
 * Crucially it identifies the CURRENT USER so the agent never confuses "my
 * tasks" (the human's) with its own.
 */
export async function buildWorkspaceSnapshot(
  organizationId: string,
  opts: SnapshotOpts,
): Promise<string> {
  const { projectId, taskId, userId, userName, userEmail } = opts;
  // Project scopes the agent's zone of responsibility: when a project is active,
  // tasks shown are that project's only (agents don't cross project contexts).
  const taskProjectFilter = projectId
    ? { organizationId, id: projectId }
    : { organizationId };

  const taskSelect = {
    id: true,
    title: true,
    status: true,
    priority: true,
    dueDate: true,
    project: { select: { name: true } },
    assignees: {
      select: {
        user: { select: { name: true } },
        agent: { select: { name: true } },
      },
    },
  } as const;

  const [
    org,
    agents,
    members,
    projects,
    myTasks,
    tasks,
    automations,
    canvasNodes,
    flowDoc,
    focusTask,
  ] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
      prisma.agent.findMany({
        where: { organizationId },
        select: {
          name: true,
          role: true,
          status: true,
          tools: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.member.findMany({
        where: { organizationId },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.project.findMany({
        where: { organizationId, archived: false },
        select: {
          id: true,
          name: true,
          description: true,
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.task.findMany({
        where: {
          project: taskProjectFilter,
          archivedAt: null,
          assignees: { some: { userId } },
        },
        select: taskSelect,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.task.findMany({
        where: { project: taskProjectFilter, archivedAt: null },
        select: taskSelect,
        orderBy: { createdAt: "desc" },
        // Bulk ops ("move all in-progress → review") need to SEE every task, so
        // list generously when scoped to a single project.
        take: projectId ? 200 : 60,
      }),
      prisma.automation.findMany({
        where: { organizationId },
        select: { name: true, enabled: true, aiManaged: true },
        orderBy: { createdAt: "asc" },
      }),
      projectId
        ? prisma.canvasNode.findMany({
            where: { projectId },
            select: { title: true, type: true },
            orderBy: { createdAt: "asc" },
            take: 30,
          })
        : Promise.resolve([]),
      projectId
        ? prisma.canvasDoc
            .findUnique({
              where: { projectId },
              select: { flowGraph: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
      taskId
        ? prisma.task.findFirst({
            where: { id: taskId, project: { organizationId } },
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              priority: true,
              dueDate: true,
              agentBrief: true,
              project: { select: { name: true } },
              assignees: {
                select: {
                  user: { select: { name: true } },
                  agent: { select: { name: true } },
                },
              },
              agentBriefs: {
                select: {
                  agentId: true,
                  instructions: true,
                  tool: true,
                  config: true,
                  updatedAt: true,
                  agent: { select: { name: true } },
                },
              },
            },
          })
        : Promise.resolve(null),
    ]);

  const lines: string[] = [];
  lines.push(`# Workspace: ${org?.name ?? "Workspace"}`);

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  lines.push(
    "",
    "## Today's date",
    `- Today is ${weekday}, ${todayIso}.`,
    "- Resolve any relative deadline the user gives (today/сегодня, tomorrow/завтра,",
    `  "до пятницы", "через 2 дня", "next week") into a concrete ISO date`,
    "  (YYYY-MM-DD) based on this, and pass it as the proposal's dueDate.",
  );

  const userHandle = userEmail ? handleFromEmail(userEmail) : null;
  lines.push(
    "",
    "## The person you are chatting with (the user)",
    `- Name: ${userName}${userEmail ? ` (${userEmail})` : ""}`,
    ...(userHandle
      ? [`- Their @handle: @${userHandle} — use this to assign them ("me"/"я").`]
      : []),
    `- IMPORTANT: When the user says "I", "me", "my", "my tasks", "my status",`,
    `  they mean ${userName} — the HUMAN above, NOT you the agent and NOT any`,
    `  other agent. Answer about ${userName}'s own work in that case.`,
  );

  lines.push("", `## ${userName}'s tasks (assigned to the user)`);
  if (myTasks.length === 0) {
    lines.push(`- ${userName} is not assigned to any tasks right now.`);
  } else {
    for (const t of myTasks) lines.push(taskLine(t));
  }

  lines.push(
    "",
    "## AI agent (your workspace assistant — this is NOT the user)",
    "- You are the workspace's universal agent. You can split large objectives",
    "  into parallel sub-tasks using the `split_task` tool.",
  );
  if (agents.length === 0) lines.push("- (none yet)");
  for (const a of agents) {
    const caps = capabilityLabels(normalizeAgentTools(a.tools), "en");
    const capText = caps.length ? ` · can: ${caps.join(", ")}` : "";
    lines.push(
      `- ${a.name} (${a.status.toLowerCase()}): ${a.role}${capText}`,
    );
  }

  lines.push(
    "",
    "## People in this workspace (public info — share names, roles, tags, tasks; NEVER secrets/passwords)",
  );
  if (members.length === 0) lines.push("- (none)");
  for (const m of members) {
    const name = m.user.name ?? m.user.email;
    lines.push(
      `- ${name} (${m.user.email}, tag @${handleFromEmail(m.user.email)}) — ${m.role}`,
    );
  }

  lines.push(
    "",
    "## Tagging / mentions",
    "- Users tag people or agents with @handle (the handles listed above).",
    "- A person's handle = the start of their email login; an agent's = the first",
    "  word of its name. When asked, explain who can be tagged and their @handle.",
    "- When the user @mentions an AGENT, delegate the relevant objective to it.",
  );

  lines.push("", "## Projects");
  if (projects.length === 0) lines.push("- (none)");
  for (const p of projects) {
    const active = projectId && p.id === projectId ? " [active]" : "";
    lines.push(`- ${p.name} — ${p._count.tasks} tasks${active}`);
  }

  const activeProject = projectId
    ? projects.find((p) => p.id === projectId)
    : undefined;

  lines.push(
    "",
    "## Active project (your current zone of responsibility)",
    activeProject
      ? `- You are working in "${activeProject.name}". Everything below (tasks, canvas, flow) is scoped to THIS project. Do not act on or invent work from other projects.`
      : "- No project is currently active/selected. If the user's request depends on a specific project (creating/working on tasks, project context), ASK them which project they mean instead of guessing.",
  );

  if (activeProject?.description) {
    lines.push(
      "",
      `## Context for project "${activeProject.name}" (use this to understand the goal)`,
      activeProject.description.slice(0, 1500),
    );
  }

  if (focusTask) {
    const who = focusTask.assignees
      .map((x) => x.agent?.name ?? x.user?.name)
      .filter(Boolean)
      .join(", ");
    const perAgentBriefs = (focusTask.agentBriefs ?? []).map(dbBriefToContent);
    const legacyBrief = parseAgentBrief(focusTask.agentBrief);
    lines.push(
      "",
      "## THIS conversation is about a specific task — focus on it",
      `- Task: "${focusTask.title}" (id: ${focusTask.id}) in ${focusTask.project.name}`,
      `- Status: ${STATUS_LABEL[focusTask.status] ?? focusTask.status} · Priority: ${focusTask.priority.toLowerCase()}${
        focusTask.dueDate ? ` · Due ${focusTask.dueDate.toISOString().slice(0, 10)}` : ""
      }`,
      who ? `- Assigned to: ${who}` : "- No assignees yet.",
      `- Description: ${focusTask.description?.slice(0, 1200) || "(none)"}`,
    );
    if (perAgentBriefs.length > 0) {
      lines.push(
        "- Per-agent briefs on this task (each assigned agent's task-specific context):",
      );
      for (const b of perAgentBriefs) {
        const bits = [
          b.tool ? `capability: ${b.tool}` : "",
          b.instructions ? `instructions: ${b.instructions.slice(0, 600)}` : "",
          b.knowledge ? `knowledge: ${b.knowledge.slice(0, 400)}` : "",
        ].filter(Boolean);
        lines.push(
          `  - ${b.agentName || "agent"}: ${bits.length ? bits.join(" · ") : "(no details yet)"}`,
        );
      }
    } else if (legacyBrief?.instructions || legacyBrief?.knowledge || legacyBrief?.tool) {
      lines.push(
        "- Brief from the user:",
        legacyBrief.instructions
          ? `  - Instructions: ${legacyBrief.instructions.slice(0, 800)}`
          : "",
        legacyBrief.tool ? `  - Requested capability: ${legacyBrief.tool}` : "",
        legacyBrief.knowledge
          ? `  - Extra knowledge: ${legacyBrief.knowledge.slice(0, 800)}`
          : "",
      );
    }
    lines.push(
      "- If you have enough to proceed, propose the concrete action. If something is",
      "  unclear or missing, ASK the user a specific clarifying question in this chat.",
    );
  }

  lines.push("", "## All recent tasks (with assignees)");
  if (tasks.length === 0) lines.push("- (none)");
  for (const t of tasks) lines.push(taskLine(t));

  lines.push("", "## Automations");
  if (automations.length === 0) lines.push("- (none)");
  for (const a of automations) {
    lines.push(
      `- ${a.name} — ${a.enabled ? "on" : "off"}${a.aiManaged ? " (AI-managed)" : ""}`,
    );
  }

  if (projectId) {
    const flow = parseFlowGraph(flowDoc?.flowGraph);
    if (flow.nodes.length > 0) {
      lines.push("", "## Project flow graph (AI: откуда → куда)");
      for (const n of flow.nodes) {
        lines.push(`- ${n.title}${n.subtitle ? ` — ${n.subtitle}` : ""}`);
      }
    }
    lines.push("", "## Canvas notes (active project)");
    if (canvasNodes.length === 0) lines.push("- (empty)");
    for (const n of canvasNodes) lines.push(`- [${n.type.toLowerCase()}] ${n.title}`);
  }

  return lines.join("\n");
}
