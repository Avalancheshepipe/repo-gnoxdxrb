// Executable "real work" actions shared by autonomous worker tools AND
// approval-gated chat proposals (via the agentAction tRPC router), so both
// paths run the SAME code. Budget discipline: documents + reports use no LLM
// (agent-provided / real DB data); only review/validate make one cheap call.

import { generateObject } from "ai";
import { z } from "zod";
import { findFreeSlot } from "@/lib/canvas-layout";
import { statusFromDb } from "@/lib/task-mappers";
import {
  buildExcelWorkbook,
  buildPdfDocument,
  buildWordDocument,
  type DocSection,
  type GeneratedFile,
} from "@/server/ai/documents";
import { chatModel } from "@/server/ai/gateway";
import { runWebResearch, type ResearchSource } from "@/server/ai/research";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { buildDocumentKey, presignDownload, uploadObject } from "@/server/s3";

export type ActionContext = {
  organizationId: string;
  agentId: string | null;
  agentName: string;
  projectId?: string;
};

async function firstProjectId(
  organizationId: string,
  projectId?: string,
): Promise<string | null> {
  if (projectId) {
    const p = await prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (p) return p.id;
  }
  const first = await prisma.project.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

async function logActivity(ctx: ActionContext, action: string, target: string) {
  await prisma.activityLog
    .create({
      data: {
        organizationId: ctx.organizationId,
        type: "AGENT",
        actor: ctx.agentName,
        action,
        target,
      },
    })
    .catch(() => undefined);
}

/** Add a NOTE node to a project canvas, placed in a free slot (no overlap). */
async function addNote(
  projectId: string,
  title: string,
  body: string,
): Promise<string | undefined> {
  const [existing, doc] = await Promise.all([
    prisma.canvasNode.findMany({
      where: { projectId },
      select: { x: true, y: true },
    }),
    prisma.canvasDoc
      .findUnique({ where: { projectId }, select: { boardLayout: true } })
      .catch(() => null),
  ]);
  const layoutPts =
    doc?.boardLayout && typeof doc.boardLayout === "object" && !Array.isArray(doc.boardLayout)
      ? Object.values(doc.boardLayout as Record<string, { x: number; y: number }>)
      : [];
  const slot = findFreeSlot([
    ...existing.map((n) => ({ x: n.x, y: n.y })),
    ...layoutPts,
  ]);
  const note = await prisma.canvasNode.create({
    data: {
      projectId,
      type: "NOTE",
      title: title.slice(0, 200),
      subtitle: body.slice(0, 2000),
      x: slot.x,
      y: slot.y,
      width: 240,
    },
  });
  return note.id;
}

// ── Web research ─────────────────────────────────────────────────────────────

export async function executeResearch(
  ctx: ActionContext,
  input: { query: string; maxResults?: number; save?: boolean },
): Promise<{ summary: string; sources: ResearchSource[]; noteId?: string }> {
  const result = await runWebResearch({
    query: input.query,
    maxResults: input.maxResults,
  });
  let noteId: string | undefined;
  if (input.save) {
    const projectId = await firstProjectId(ctx.organizationId, ctx.projectId);
    if (projectId) {
      const sources = result.sources
        .map((s, i) => `${i + 1}. [${s.title}](${s.url})`)
        .join("\n");
      noteId = await addNote(
        projectId,
        `Research: ${input.query}`.slice(0, 120),
        `${result.summary}\n\n${sources}`,
      );
    }
    await logActivity(ctx, "researched", input.query.slice(0, 80));
  }
  return { summary: result.summary, sources: result.sources, noteId };
}

// ── Document generation ──────────────────────────────────────────────────────

export type DocContent = {
  sections?: DocSection[];
  sheet?: { columns: string[]; rows: (string | number)[][] };
};

async function generateFile(
  format: "word" | "excel" | "pdf",
  title: string,
  content: DocContent,
): Promise<GeneratedFile> {
  if (format === "excel") {
    const headers = content.sheet?.columns?.length
      ? content.sheet.columns
      : ["Item"];
    const columns = headers.map((h, i) => ({ header: h, key: `c${i}` }));
    const rows = (content.sheet?.rows ?? []).map((r) => {
      const obj: Record<string, string | number | null> = {};
      r.forEach((v, i) => {
        obj[`c${i}`] = v ?? "";
      });
      return obj;
    });
    return buildExcelWorkbook({ title, sheets: [{ name: title, columns, rows }] });
  }
  if (format === "pdf") {
    return buildPdfDocument({
      title,
      sections: content.sections?.length
        ? content.sections
        : [{ paragraphs: ["(empty document)"] }],
    });
  }
  return buildWordDocument({
    title,
    sections: content.sections?.length
      ? content.sections
      : [{ paragraphs: ["(empty document)"] }],
  });
}

export async function executeCreateDocument(
  ctx: ActionContext,
  input: {
    format: "word" | "excel" | "pdf";
    title: string;
    content: DocContent;
    projectId?: string;
    taskId?: string;
  },
): Promise<{ url: string; filename: string; nodeId?: string }> {
  const file = await generateFile(input.format, input.title, input.content);
  const key = buildDocumentKey(ctx.organizationId, file.filename);
  await uploadObject(key, file.buffer, file.mime);
  const url = await presignDownload(key);

  let nodeId: string | undefined;
  const projectId = await firstProjectId(
    ctx.organizationId,
    input.projectId ?? ctx.projectId,
  );
  if (projectId) {
    nodeId = await addNote(
      projectId,
      input.title,
      `📄 [${file.filename}](${url})`,
    );
  }
  if (input.taskId) {
    await prisma.attachment
      .create({
        data: {
          taskId: input.taskId,
          key,
          name: file.filename,
          mime: file.mime,
          size: file.buffer.length,
        },
      })
      .catch(() => undefined);
  }
  await logActivity(ctx, "created document", input.title.slice(0, 80));
  return { url, filename: file.filename, nodeId };
}

// ── Reports (real workspace data, no LLM) ────────────────────────────────────

async function gatherReportData(organizationId: string, projectId?: string) {
  const taskWhere = {
    project: { organizationId, ...(projectId ? { id: projectId } : {}) },
  };
  const [tasks, agents, automations, activity, project] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      select: { title: true, status: true, priority: true, dueDate: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.agent.findMany({
      where: { organizationId },
      select: { name: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.automation.findMany({
      where: { organizationId },
      select: { name: true, enabled: true },
    }),
    prisma.activityLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { actor: true, action: true, target: true },
    }),
    projectId
      ? prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  const byStatus = { todo: 0, "in-progress": 0, review: 0, done: 0 } as Record<
    string,
    number
  >;
  for (const t of tasks) byStatus[statusFromDb(t.status)] += 1;

  return { tasks, agents, automations, activity, project, byStatus };
}

type ReportData = Awaited<ReturnType<typeof gatherReportData>>;

function renderReportMarkdown(data: ReportData, title: string): string {
  const lines: string[] = [`# ${title}`, ""];
  lines.push(
    `_Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")}_`,
    "",
    "## Tasks",
    `- Total: ${data.tasks.length}`,
    `- To do: ${data.byStatus.todo} · In progress: ${data.byStatus["in-progress"]} · Review: ${data.byStatus.review} · Done: ${data.byStatus.done}`,
    "",
    "## Agents",
    ...data.agents.map((a) => `- ${a.name} — ${a.role}`),
    "",
    "## Automations",
    `- ${data.automations.filter((a) => a.enabled).length}/${data.automations.length} enabled`,
    "",
    "## Recent activity",
    ...data.activity.map((a) => `- ${a.actor} ${a.action} ${a.target ?? ""}`.trim()),
  );
  return lines.join("\n");
}

export async function executeReport(
  ctx: ActionContext,
  input: { title?: string; projectId?: string; format?: "markdown" | "excel" },
): Promise<{ markdown: string; url?: string; filename?: string; nodeId?: string }> {
  const projectId = await firstProjectId(
    ctx.organizationId,
    input.projectId ?? ctx.projectId,
  );
  const data = await gatherReportData(
    ctx.organizationId,
    projectId ?? undefined,
  );
  const title =
    input.title?.trim() ||
    `${data.project?.name ?? "Workspace"} report`;
  const markdown = renderReportMarkdown(data, title);

  let url: string | undefined;
  let filename: string | undefined;
  if (input.format === "excel") {
    const file = await buildExcelWorkbook({
      title,
      sheets: [
        {
          name: "Tasks",
          columns: [
            { header: "Title", key: "title", width: 48 },
            { header: "Status", key: "status" },
            { header: "Priority", key: "priority" },
          ],
          rows: data.tasks.map((t) => ({
            title: t.title,
            status: statusFromDb(t.status),
            priority: t.priority.toLowerCase(),
          })),
        },
      ],
    });
    const key = buildDocumentKey(ctx.organizationId, file.filename);
    await uploadObject(key, file.buffer, file.mime);
    url = await presignDownload(key);
    filename = file.filename;
  }

  let nodeId: string | undefined;
  if (projectId) {
    const body = url
      ? `${markdown}\n\n📊 [${filename}](${url})`
      : markdown;
    nodeId = await addNote(projectId, title, body);
  }
  await logActivity(ctx, "compiled report", title.slice(0, 80));
  return { markdown, url, filename, nodeId };
}

// ── Review verdicts + spec validation (one cheap LLM call) ───────────────────

const VERDICTS = ["approved", "changes_requested", "needs_info"] as const;

const reviewSchema = z.object({
  verdict: z.enum(VERDICTS),
  summary: z.string(),
  checklist: z
    .array(z.object({ item: z.string(), pass: z.boolean() }))
    .optional(),
});

async function loadTask(organizationId: string, taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, project: { organizationId } },
    select: { id: true, title: true, description: true, status: true },
  });
}

type Review = {
  verdict: string;
  summary: string;
  checklist: { item: string; pass: boolean }[];
  kind: "review" | "test";
  by: string;
  at: string;
};

async function persistReview(taskId: string, ctx: ActionContext, review: Review) {
  await prisma.task.update({ where: { id: taskId }, data: { review } });
  if (ctx.agentId) {
    await prisma.comment
      .create({
        data: {
          taskId,
          agentId: ctx.agentId,
          body: `**${review.verdict.replace(/_/g, " ")}** — ${review.summary}`,
        },
      })
      .catch(() => undefined);
  }
}

export async function executeReviewTask(
  ctx: ActionContext,
  input: { taskId: string; criteria?: string },
): Promise<{ ok: boolean; verdict?: string; summary?: string; error?: string }> {
  const task = await loadTask(ctx.organizationId, input.taskId);
  if (!task) return { ok: false, error: "Task not found" };

  const { object } = await generateObject({
    model: chatModel(env.AI_GATEWAY_DOC_MODEL),
    schema: reviewSchema,
    system:
      "You are a meticulous reviewer. Judge whether the task meets its goal " +
      "and acceptance criteria. Return a verdict (approved / changes_requested " +
      "/ needs_info), a short summary, and an optional checklist. Be fair and concise.",
    prompt: [
      `Task: ${task.title}`,
      `Description: ${task.description ?? "(none)"}`,
      input.criteria ? `Acceptance criteria: ${input.criteria}` : "",
      "Review it now.",
    ]
      .filter(Boolean)
      .join("\n"),
    maxOutputTokens: 500,
  });

  const review: Review = {
    verdict: object.verdict,
    summary: object.summary,
    checklist: object.checklist ?? [],
    kind: "review",
    by: ctx.agentName,
    at: new Date().toISOString(),
  };
  await persistReview(task.id, ctx, review);
  await logActivity(ctx, `review verdict: ${object.verdict.replace(/_/g, " ")}`, task.title);
  return { ok: true, verdict: object.verdict, summary: object.summary };
}

const validateSchema = z.object({
  pass: z.boolean(),
  summary: z.string(),
  items: z.array(z.object({ criterion: z.string(), pass: z.boolean() })),
});

export async function executeValidateTask(
  ctx: ActionContext,
  input: { taskId: string; criteria?: string },
): Promise<{ ok: boolean; pass?: boolean; summary?: string; error?: string }> {
  const task = await loadTask(ctx.organizationId, input.taskId);
  if (!task) return { ok: false, error: "Task not found" };

  const { object } = await generateObject({
    model: chatModel(env.AI_GATEWAY_DOC_MODEL),
    schema: validateSchema,
    system:
      "You validate a task/spec against acceptance criteria as a checklist. " +
      "If no criteria are given, derive 3–5 reasonable ones from the task. " +
      "Return pass (overall), a short summary, and per-criterion pass/fail.",
    prompt: [
      `Task: ${task.title}`,
      `Description: ${task.description ?? "(none)"}`,
      input.criteria ? `Criteria: ${input.criteria}` : "",
      "Validate it now.",
    ]
      .filter(Boolean)
      .join("\n"),
    maxOutputTokens: 500,
  });

  const review: Review = {
    verdict: object.pass ? "approved" : "changes_requested",
    summary: object.summary,
    checklist: object.items.map((i) => ({ item: i.criterion, pass: i.pass })),
    kind: "test",
    by: ctx.agentName,
    at: new Date().toISOString(),
  };
  await persistReview(task.id, ctx, review);
  await logActivity(
    ctx,
    `validation: ${object.pass ? "passed" : "failed"}`,
    task.title,
  );
  return { ok: true, pass: object.pass, summary: object.summary };
}
