import {
  streamText,
  stepCountIs,
  tool,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { z } from "zod";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { executeResearch } from "@/server/ai/actions";
import {
  describeTools,
  normalizeAgentTools,
  proposalToolNames,
} from "@/server/ai/capabilities";
import { assertWithinBudget } from "@/server/ai/run";
import { chatModel, assertAiGatewayConfigured } from "@/server/ai/gateway";
import { estimateCostUsd } from "@/server/ai/cost";
import { proposalTools, readTools } from "@/server/ai/proposal-tools";
import { buildWorkspaceSnapshot } from "@/server/ai/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatBody = {
  organizationId?: string;
  agentId?: string;
  projectId?: string;
  /** When set, the conversation is scoped to a single task. */
  taskId?: string;
  threadId?: string;
  message?: string;
  locale?: "ru" | "en";
};

const PROPOSAL_NAMES = new Set(Object.keys(proposalTools));

const VERB: Record<string, string> = {
  propose_create_task: "Create task",
  propose_update_task: "Update task",
  propose_assign_task: "Assign agent",
  propose_bulk_update_tasks: "Update tasks",
  propose_archive_task: "Archive task",
  propose_canvas_node: "Add canvas node",
  propose_create_automation: "Create automation",
  propose_delegate: "Split task into sub-tasks",
  propose_delegate_task: "Start task work",
  propose_create_document: "Create document",
  propose_report: "Compile report",
  propose_review: "Review task",
  propose_test: "Validate task",
  propose_send_email: "Send email",
};

function enc(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

/** Non-empty content for persistence + replay (providers reject null/empty
 * assistant content). Summarizes proposals when the turn had no prose. */
function assistantContent(
  text: string,
  proposals: { kind: string }[],
): string {
  const trimmed = text.trim();
  if (trimmed) return trimmed;
  if (proposals.length) {
    return `Proposed: ${proposals.map((p) => VERB[p.kind] ?? p.kind).join(", ")}.`;
  }
  return "(no response)";
}

function systemPrompt(
  agent: { name: string; role: string; systemPrompt: string },
  snapshot: string,
  opts: {
    userName: string;
    locale: "ru" | "en";
    capabilities: string[];
    taskScoped?: boolean;
  },
): string {
  const lang =
    opts.locale === "en"
      ? "Always reply in English."
      : "Always reply in Russian (по-русски). All your prose, task titles, " +
        "descriptions, canvas node text and proposals must be in Russian.";
  return [
    agent.systemPrompt,
    "",
    `You are ${agent.name}, operating inside Julow — an AI-native team workspace.`,
    "You can see the live state of THIS workspace below. Only discuss and act on",
    "what belongs to this workspace; never invent tasks, projects, or data.",
    "",
    "## Language",
    `- ${lang}`,
    "",
    "## Your REAL, enabled capabilities",
    "These are the ONLY things you can actually do. If asked what you can do or",
    "what you participate in, answer truthfully from THIS list — never invent",
    "capabilities you don't have:",
    ...opts.capabilities,
    "",
    "## Who is who",
    `- The user you're chatting with is ${opts.userName} (a human).`,
    `- "I/me/my/my tasks/my status" ALWAYS refers to ${opts.userName}. When asked`,
    `  about their tasks, use the "${opts.userName}'s tasks" section — do NOT report`,
    "  your own or another agent's tasks as if they were the user's.",
    "- If asked about a specific agent or person, report that one's tasks instead.",
    "",
    "## Answering",
    "- Reply in clear, well-structured GitHub-flavored Markdown (headings, lists,",
    "  bold, code, tables). Be concise but complete.",
    "- You are the single universal agent with all capabilities. There is no",
    "  multi-agent team — you handle research, documents, reports, reviews, and",
    "  general work yourself.",
    "",
    "## Links — STRICT (always real Markdown links, never bold)",
    "- Whenever you refer to a specific task (especially when the user asks for a",
    "  LINK to a task), output a REAL Markdown link to it using its exact id from",
    "  the snapshot: `[Task title](/app/inbox?task=THE_ID)`.",
    "- NEVER write a task reference as bold/plain text (e.g. **Task title**). A bold",
    "  title is NOT a link and is wrong. If you know the id, you MUST produce the",
    "  `[...](/app/inbox?task=ID)` link. These open inside the app in the same tab.",
    "- If you don't have the task's id, use `search_tasks` to find it, then link it.",
    "- The SAME rule applies to documents, files and any URL: ALWAYS write them as",
    "  Markdown links `[name](url)` so they render as clickable blue links. NEVER",
    "  present a file name or URL as bold or plain text.",
    "",
    "## Taking action — STRICT RULES",
    "Whenever the user asks you to DO something (create/add/make/update/change/",
    "move/assign/automate/schedule), you MUST call the matching tool.",
    "The tools are how the user confirms and how the action actually happens.",
    "",
    "Tool map (call exactly one or more of these to act):",
    "- Create a task            → call `propose_create_task`",
    "- Change ONE task's status/priority/description/deadline → call `propose_update_task`",
    "- RENAME a task → call `propose_update_task` with `newTitle`",
    "- Change MANY tasks at once (e.g. 'move all in-progress to review') → call",
    "  `propose_bulk_update_tasks`",
    "- Archive / restore a task → call `propose_archive_task` (or",
    "  `propose_bulk_update_tasks` with `changes.archive` for many)",
    "- Assign people/agents to a task → call `propose_assign_task` (or set",
    "  `assignees` on create/update)",
    "- REMOVE / unassign a performer → call `propose_assign_task` (or",
    "  `propose_update_task`) with `removeAssignees`",
    "- Add something to the canvas → call `propose_canvas_node`",
    "- Create an automation/rule → call `propose_create_automation`",
    "- Split a large task into parallel sub-tasks → call `propose_delegate`",
    "- Send an email to a workspace member → call `propose_send_email`",
    "",
    "Hard requirements:",
    "1. NEVER just describe an action in prose and ask 'shall I proceed?'. That is",
    "   forbidden. To act, CALL THE TOOL. The app renders an Approve/Decline card",
    "   from the tool call — that IS the confirmation step.",
    "2. You may write ONE short sentence of reasoning, then call the tool in the",
    "   same turn. Do not promise to do it later.",
    "3. Never say you already did something — the user must approve the card first.",
    "4. Use real names from the snapshot (exact task titles, project names).",
    "5. If the user is only asking a question (not requesting an action), just",
    "   answer — do not call a tool.",
    "",
    "## Multi-step requests — PLAN, then emit EVERY action (do not forget steps)",
    "- When the user asks for SEVERAL things in one message, first think through an",
    "  ordered plan of every required action, then in THIS SAME TURN call a tool",
    "  for EACH step. Never stop after the first action — finish the whole plan.",
    "- Example: 'move all in-progress tasks to review, then move all review tasks to",
    "  done' is TWO bulk steps: call `propose_bulk_update_tasks`",
    "  (filter.status=in-progress → changes.status=review) AND, in the same turn,",
    "  `propose_bulk_update_tasks` (filter.status=review → changes.status=done).",
    "  Emit BOTH cards. Missing the second step is a failure.",
    "- For groups of tasks ALWAYS prefer ONE `propose_bulk_update_tasks` per group",
    "  over many single-task cards.",
    "",
    "## Deadlines (dueDate) — REQUIRED when mentioned",
    "- If the user mentions ANY deadline (today/сегодня, tomorrow/завтра, 'до",
    "  пятницы', a date, 'через N дней'), you MUST set `dueDate` on the",
    "  create/update proposal — convert it to an ISO date (YYYY-MM-DD) using",
    "  TODAY'S DATE from the snapshot. Do not skip the deadline.",
    "",
    "## Assignees — assign EVERYONE the user names",
    "- When the user names performers (e.g. 'assign me and the analyst and Anna'),",
    "  you MUST include EVERY one of them in the proposal's `assignees` array —",
    "  people AND agents, one or many. Never drop or skip an assignee.",
    "- Identify each by their @handle from the snapshot (people and agents both",
    "  have handles). For the current user ('me'/'я') use their own @handle.",
    "- Resolve role-based references ('the one who does analysis/research') to the",
    "  matching agent from the team list, and include that agent's @handle.",
    "- Prefer setting `assignees` directly on `propose_create_task` /",
    "  `propose_update_task`; use `propose_assign_task` to add people to an",
    "  existing task without other changes.",
    "",
    "## Starting task work — use `propose_delegate_task`",
    "When the user wants real WORK done on a task, call `propose_delegate_task` ONCE",
    "with one `assignments` entry per piece of work. Each entry has: a precise",
    "`brief` (what to do on THIS task), the `tool` it needs (research /",
    "document / report / review / general).",
    "Reference the task by its exact `taskTitle`; if no suitable task exists yet,",
    "fill `createTask` instead. Write briefs in the user's language. Do NOT also",
    "call `propose_delegate`/`propose_assign_task` for the same work — one",
    "`propose_delegate_task` covers assigning, briefing and starting the work.",
    ...(opts.taskScoped
      ? [
          "",
          "## This is a TASK conversation",
          "- This chat is scoped to ONE specific task (shown in the snapshot). Stay",
          "  focused on that task. Treat the user's messages as answers/context for it.",
          "- If you have what you need, propose the concrete next action with a tool.",
          "- If something needed to finish the task is unclear or missing, ASK ONE",
          "  specific clarifying question (plain text, no tool) and wait for the answer.",
        ]
      : []),
    "",
    "## Live workspace snapshot",
    snapshot,
  ].join("\n");
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { organizationId, agentId, projectId, taskId, message } = body;
  const locale: "ru" | "en" = body.locale === "en" ? "en" : "ru";
  if (!organizationId || !agentId || !message?.trim()) {
    return Response.json(
      { error: "organizationId, agentId and message are required" },
      { status: 400 },
    );
  }

  const member = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.user.id } },
  });
  if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, organizationId },
  });
  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });

  try {
    assertAiGatewayConfigured();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "AI not configured" },
      { status: 503 },
    );
  }

  try {
    await assertWithinBudget(organizationId);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Budget exceeded" },
      { status: 402 },
    );
  }

  try {
  // Resolve (or create) the conversation thread for memory. Task-scoped chats
  // (taskId set) live in their own thread, separate from the general agent chat.
  let thread = body.threadId
    ? await prisma.chatThread.findFirst({
        where: {
          id: body.threadId,
          organizationId,
          userId: session.user.id,
          agentId: agent.id,
        },
      })
    : await prisma.chatThread.findFirst({
        where: {
          organizationId,
          userId: session.user.id,
          agentId: agent.id,
          taskId: taskId ?? null,
        },
        orderBy: { updatedAt: "desc" },
      });
  if (!thread) {
    thread = await prisma.chatThread.create({
      data: {
        organizationId,
        userId: session.user.id,
        agentId: agent.id,
        taskId: taskId ?? null,
        title: message.trim().slice(0, 60),
      },
    });
  }

  const history = await prisma.chatMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { role: true, content: true },
  });

  // Persist the incoming user message.
  await prisma.chatMessage.create({
    data: { threadId: thread.id, role: "user", content: message.trim() },
  });

  const snapshot = await buildWorkspaceSnapshot(organizationId, {
    projectId,
    taskId,
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
  });

  const modelMessages: ModelMessage[] = [
    ...history
      .filter((m) => m.content && m.content.trim())
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
    { role: "user", content: message.trim() },
  ];

  const run = await prisma.agentRun.create({
    data: {
      agentId: agent.id,
      taskId: taskId ?? null,
      triggeredById: session.user.id,
      status: "RUNNING",
      startedAt: new Date(),
      input: {
        message: message.trim(),
        projectId: projectId ?? null,
        taskId: taskId ?? null,
      },
    },
  });

  // Filter proposal tools + read tools to the agent's REAL configured tools.
  const toolKeys = normalizeAgentTools(agent.tools);
  const allowedProposals = proposalToolNames(toolKeys);
  const enabledProposals = Object.fromEntries(
    Object.entries(proposalTools).filter(([name]) =>
      allowedProposals.has(name),
    ),
  );
  const tools: ToolSet = {
    ...readTools(organizationId),
    ...enabledProposals,
  };
  if (toolKeys.includes("research")) {
    tools.research = tool({
      description:
        "Search the web for current information and return a concise sourced summary. Use when the user needs up-to-date external facts about this canvas/project.",
      inputSchema: z.object({
        query: z.string().min(1).max(300),
        maxResults: z.number().int().min(1).max(6).optional(),
      }),
      execute: async ({ query, maxResults }) => {
        const r = await executeResearch(
          {
            organizationId,
            agentId: agent.id,
            agentName: agent.name,
            projectId: projectId ?? undefined,
          },
          { query, maxResults, save: false },
        );
        return {
          summary: r.summary,
          sources: r.sources.map((s) => ({ title: s.title, url: s.url })),
        };
      },
    });
  }

  const result = streamText({
    model: chatModel(agent.model),
    system: systemPrompt(agent, snapshot, {
      userName: session.user.name,
      locale,
      capabilities: describeTools(toolKeys, locale),
      taskScoped: Boolean(taskId),
    }),
    messages: modelMessages,
    tools,
    // Allow several tool calls per turn so multi-step requests (e.g. a plan with
    // multiple bulk moves) complete without dropping steps. Configurable via env.
    stopWhen: stepCountIs(
      Math.min(Math.max(Number(process.env.AGENT_CHAT_MAX_STEPS) || 10, 4), 20),
    ),
  });

  let assistantText = "";
  const proposals: { id: string; kind: string; args: unknown }[] = [];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          switch (part.type) {
            case "text-delta":
              assistantText += part.text;
              controller.enqueue(enc({ t: "text", v: part.text }));
              break;
            case "reasoning-delta":
              controller.enqueue(enc({ t: "reasoning", v: part.text }));
              break;
            case "tool-call":
              if (PROPOSAL_NAMES.has(part.toolName)) {
                const proposal = {
                  id: part.toolCallId,
                  kind: part.toolName,
                  args: part.input,
                };
                proposals.push(proposal);
                controller.enqueue(enc({ t: "proposal", ...proposal }));
              }
              break;
            case "error":
              controller.enqueue(
                enc({
                  t: "error",
                  v:
                    part.error instanceof Error
                      ? part.error.message
                      : "Agent error",
                }),
              );
              break;
            default:
              break;
          }
        }

        const usage = await result.totalUsage;
        const costUsd = estimateCostUsd(
          agent.model,
          usage?.inputTokens ?? 0,
          usage?.outputTokens ?? 0,
        );

        const assistantMsg = await prisma.chatMessage.create({
          data: {
            threadId: thread.id,
            role: "assistant",
            content: assistantContent(assistantText, proposals),
            proposals: proposals.length
              ? JSON.parse(
                  JSON.stringify(
                    proposals.map((p) => ({ ...p, status: "pending" })),
                  ),
                )
              : undefined,
          },
        });
        await prisma.chatThread.update({
          where: { id: thread.id },
          data: { updatedAt: new Date() },
        });
        await prisma.agentRun.update({
          where: { id: run.id },
          data: {
            status: "DONE",
            result: assistantText.slice(0, 4000),
            tokensIn: usage?.inputTokens ?? 0,
            tokensOut: usage?.outputTokens ?? 0,
            costUsd,
            finishedAt: new Date(),
          },
        });

        controller.enqueue(
          enc({ t: "done", threadId: thread.id, messageId: assistantMsg.id }),
        );
        controller.close();
      } catch (err) {
        await prisma.agentRun
          .update({
            where: { id: run.id },
            data: {
              status: "FAILED",
              error: err instanceof Error ? err.message : "Stream error",
              finishedAt: new Date(),
            },
          })
          .catch(() => {});
        controller.enqueue(
          enc({
            t: "error",
            v: err instanceof Error ? err.message : "Stream error",
          }),
        );
        controller.enqueue(enc({ t: "done", threadId: thread.id }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-thread-id": thread.id,
    },
  });
  } catch (err) {
    console.error("[api/ai/chat] POST failed", err);
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Chat failed. Restart the dev server after schema changes.",
      },
      { status: 500 },
    );
  }
}
