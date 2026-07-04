import { generateText, stepCountIs } from "ai";
import { notifyAgentTaskResult } from "@/server/mail/notifications";
import { prisma } from "@/server/db";
import { presignDownload } from "@/server/s3";
import { env } from "@/server/env";
import {
  capabilityForBriefTool,
  describeTools,
  normalizeAgentTools,
  type ToolKey,
} from "@/server/ai/capabilities";
import { estimateCostUsd } from "@/server/ai/cost";
import { chatModel } from "@/server/ai/gateway";
import { createAgentTools } from "@/server/ai/tools";

export type UsageLike = {
  inputTokens?: number;
  outputTokens?: number;
} | null | undefined;

/** Sum of agent spend this calendar month for a workspace (USD). */
export async function monthlySpendUsd(organizationId: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const agg = await prisma.agentRun.aggregate({
    _sum: { costUsd: true },
    where: {
      agent: { organizationId },
      createdAt: { gte: start },
    },
  });
  return Number(agg._sum.costUsd ?? 0);
}

export async function assertWithinBudget(organizationId: string): Promise<void> {
  const spend = await monthlySpendUsd(organizationId);
  if (spend >= env.AGENT_MONTHLY_BUDGET_USD) {
    throw new Error(
      `Monthly agent budget reached ($${env.AGENT_MONTHLY_BUDGET_USD}). Increase AGENT_MONTHLY_BUDGET_USD to continue.`,
    );
  }
}

/**
 * Append an assistant message to the user's per-(task, agent) chat thread,
 * creating the thread if needed. Lets autonomous run results show up in the
 * in-panel task conversation alongside interactive messages.
 */
export async function postTaskThreadMessage(args: {
  organizationId: string;
  userId: string;
  agentId: string;
  taskId: string;
  content: string;
}): Promise<void> {
  let thread = await prisma.chatThread.findFirst({
    where: {
      organizationId: args.organizationId,
      userId: args.userId,
      agentId: args.agentId,
      taskId: args.taskId,
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!thread) {
    thread = await prisma.chatThread.create({
      data: {
        organizationId: args.organizationId,
        userId: args.userId,
        agentId: args.agentId,
        taskId: args.taskId,
        title: "Task work",
      },
      select: { id: true },
    });
  }
  await prisma.chatMessage.create({
    data: { threadId: thread.id, role: "assistant", content: args.content },
  });
  await prisma.chatThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });
}

export function buildSystemPrompt(
  agent: {
    name: string;
    role: string;
    systemPrompt: string;
    tools?: unknown;
  },
  opts: { locale?: "ru" | "en"; extraCapabilities?: ToolKey[] } = {},
): string {
  const locale = opts.locale === "en" ? "en" : "ru";
  const keys = [
    ...new Set([
      ...normalizeAgentTools(agent.tools),
      ...(opts.extraCapabilities ?? []),
    ]),
  ];
  const capabilities = describeTools(keys, locale);
  const todayIso = new Date().toISOString().slice(0, 10);
  const lang =
    locale === "en"
      ? "Always write your result and any task comments in English."
      : "Always write your result and any task comments in Russian (по-русски).";
  return [
    agent.systemPrompt,
    "",
    "You operate inside Julow, an AI-native team workspace.",
    `Today's date is ${todayIso}. Use it for anything time-sensitive (deadlines,`,
    "'current'/'latest' figures). When the user asks about up-to-date external",
    "facts, use your web research tool rather than guessing.",
    `Language: ${lang}`,
    "Use the provided tools to read and modify tasks and the canvas, do research,",
    "and create documents when helpful.",
    "Your enabled capabilities (only claim and use these):",
    ...capabilities,
    "Be concise. When you change something, briefly state what you did.",
  ].join("\n");
}

type StepLike = {
  text?: string;
  toolCalls?: unknown;
  toolResults?: unknown;
};

export async function persistRunResult(args: {
  runId: string;
  model: string;
  status: "DONE" | "FAILED";
  text?: string;
  error?: string;
  usage?: UsageLike;
  steps?: StepLike[];
}): Promise<void> {
  const inputTokens = args.usage?.inputTokens ?? 0;
  const outputTokens = args.usage?.outputTokens ?? 0;
  const costUsd = estimateCostUsd(args.model, inputTokens, outputTokens);

  await prisma.agentRun.update({
    where: { id: args.runId },
    data: {
      status: args.status,
      result: args.text ?? null,
      error: args.error ?? null,
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      costUsd,
      finishedAt: new Date(),
    },
  });

  if (args.steps?.length) {
    await prisma.agentStep.createMany({
      data: args.steps.map((step, index) => ({
        runId: args.runId,
        index,
        type: "step",
        content: JSON.parse(
          JSON.stringify({
            text: step.text ?? "",
            toolCalls: step.toolCalls ?? [],
            toolResults: step.toolResults ?? [],
          }),
        ),
      })),
    });
  }
}

/**
 * Execute a queued autonomous run to completion (used by the BullMQ worker).
 * Loads the agent, runs the tool loop, and persists the result + cost.
 */
export async function executeAgentRun(runId: string): Promise<void> {
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    include: { agent: true },
  });
  if (!run) throw new Error(`Run ${runId} not found`);

  const { agent } = run;

  await prisma.agentRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
  await prisma.agent.update({
    where: { id: agent.id },
    data: { status: "BUSY" },
  });

  const input = run.input as {
    prompt?: string;
    projectId?: string;
    taskId?: string;
    locale?: "ru" | "en";
    briefTool?: string;
  };
  const taskId = input.taskId ?? run.taskId ?? undefined;
  const briefCapability = capabilityForBriefTool(input.briefTool);
  const extraCapabilities: ToolKey[] = briefCapability ? [briefCapability] : [];
  const tools = createAgentTools({
    organizationId: agent.organizationId,
    agentId: agent.id,
    agentName: agent.name,
    projectId: input.projectId,
    taskId,
    runId,
    tools: agent.tools,
    extraCapabilities,
  });

  try {
    await assertWithinBudget(agent.organizationId);

    const result = await generateText({
      model: chatModel(agent.model),
      system: buildSystemPrompt(agent, {
        locale: input.locale,
        extraCapabilities,
      }),
      prompt: input.prompt ?? "Proceed with your assigned objective.",
      tools,
      stopWhen: stepCountIs(
        Math.min(Math.max(Number(process.env.AGENT_RUN_MAX_STEPS) || 10, 4), 20),
      ),
    });

    await persistRunResult({
      runId,
      model: agent.model,
      status: "DONE",
      text: result.text,
      usage: result.totalUsage ?? result.usage,
      steps: result.steps as StepLike[],
    });

    const resultText = result.text?.trim() ?? "";

    // Any file this run produced (document/report) — linked into the task
    // thread, the comment, and the completion email.
    let fileUrl: string | undefined;
    let fileName: string | undefined;
    if (taskId) {
      const attachment = await prisma.attachment.findFirst({
        where: { taskId, createdAt: { gte: run.createdAt } },
        orderBy: { createdAt: "desc" },
      });
      if (attachment) {
        fileName = attachment.name;
        try {
          fileUrl = await presignDownload(attachment.key);
        } catch {
          /* S3 optional in dev */
        }
      }
    }
    const fileLine = fileUrl ? `\n\n📎 [${fileName ?? "Download"}](${fileUrl})` : "";

    // Visibility: record the agent's outcome as a comment on its task.
    if (taskId && resultText) {
      await prisma.comment
        .create({
          data: {
            taskId,
            agentId: agent.id,
            body: resultText.slice(0, 4000),
          },
        })
        .catch(() => undefined);
    }

    // Surface the outcome inside the per-task agent chat thread so delegated
    // results land back in the task conversation (not only the global history).
    if (taskId && run.triggeredById && (resultText || fileUrl)) {
      await postTaskThreadMessage({
        organizationId: agent.organizationId,
        userId: run.triggeredById,
        agentId: agent.id,
        taskId,
        content: (resultText.slice(0, 6000) + fileLine).trim() || (fileName ?? "Done"),
      }).catch(() => undefined);
    }

    // Email human assignees when a task-scoped autonomous run completes.
    if (taskId && run.taskId) {
      void notifyAgentTaskResult({
        runId,
        taskId,
        agentId: agent.id,
        agentName: agent.name,
        resultText: result.text ?? "",
        fileUrl,
        fileName,
      }).catch((err) => console.error("[email] agent task result", err));
    }
  } catch (err) {
    await persistRunResult({
      runId,
      model: agent.model,
      status: "FAILED",
      error: err instanceof Error ? err.message : "Unknown error",
    });
    throw err;
  } finally {
    await prisma.agent.update({
      where: { id: agent.id },
      data: { status: "IDLE" },
    });
  }
}
