import type {
  InboxTask,
  TaskAgentBrief,
  TaskAgentBriefTool,
  TaskPriority,
  TaskReview,
  TaskStatus,
} from "@/lib/workspace-data";

export type DbTaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type DbTaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export function statusFromDb(status: string): TaskStatus {
  switch (status) {
    case "IN_PROGRESS":
      return "in-progress";
    case "REVIEW":
      return "review";
    case "DONE":
      return "done";
    default:
      return "todo";
  }
}

export function statusToDb(status: TaskStatus): DbTaskStatus {
  switch (status) {
    case "in-progress":
      return "IN_PROGRESS";
    case "review":
      return "REVIEW";
    case "done":
      return "DONE";
    default:
      return "TODO";
  }
}

export function priorityFromDb(priority: string): TaskPriority {
  return priority.toLowerCase() as TaskPriority;
}

export function priorityToDb(priority: TaskPriority): DbTaskPriority {
  return priority.toUpperCase() as DbTaskPriority;
}

export type DateLocale = "ru" | "en";

/**
 * Absolute date in the user's locale format. RU → "DD.MM.YYYY" (day.month.year),
 * EN → "MM/DD/YYYY". The stored value stays ISO; this is display only.
 */
export function formatDate(
  due: Date | string | null | undefined,
  locale: DateLocale = "en",
): string {
  if (!due) return "";
  const date = typeof due === "string" ? new Date(due) : due;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Relative due label. EN output is unchanged (kept as the default so the
 * precomputed `dueLabel` and the "Due today" inbox filter keep matching
 * "Today"); pass a locale at display time for a localized label.
 */
export function formatDueLabel(
  due: Date | string | null | undefined,
  status?: TaskStatus,
  locale: DateLocale = "en",
): string {
  const ru = locale === "ru";
  if (status === "done") return ru ? "Готово" : "Completed";
  if (!due) return ru ? "Без срока" : "No due date";

  const date = typeof due === "string" ? new Date(due) : due;
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startOfDue = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (startOfDue.getTime() - startOfToday.getTime()) / 86_400_000,
  );

  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return ru ? `Просрочено на ${n} дн.` : `${n}d overdue`;
  }
  if (diffDays === 0) return ru ? "Сегодня" : "Today";
  if (diffDays === 1) return ru ? "Завтра" : "Tomorrow";
  if (diffDays < 14) return ru ? `Через ${diffDays} дн.` : `In ${diffDays} days`;
  if (ru) return formatDate(date, "ru");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type DbAssignee = {
  userId?: string | null;
  agentId?: string | null;
  user?: { id?: string; name: string | null } | null;
  agent?: { id?: string; name: string } | null;
};

export type DbTaskWithRelations = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | string | null;
  tags: string[];
  projectId?: string;
  project?: { name: string } | null;
  assignees: DbAssignee[];
  review?: unknown;
  agentBrief?: unknown;
  archivedAt?: Date | string | null;
};

const BRIEF_TOOLS: TaskAgentBriefTool[] = [
  "general",
  "research",
  "document",
  "report",
  "review",
];

function briefTool(value: unknown): TaskAgentBriefTool | undefined {
  return typeof value === "string" && BRIEF_TOOLS.includes(value as TaskAgentBriefTool)
    ? (value as TaskAgentBriefTool)
    : undefined;
}

function briefOptions(value: unknown): TaskAgentBrief["options"] {
  const opt =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    webSearch: typeof opt.webSearch === "boolean" ? opt.webSearch : undefined,
    researchQuery:
      typeof opt.researchQuery === "string" ? opt.researchQuery : undefined,
    format:
      opt.format === "word" || opt.format === "excel" || opt.format === "pdf"
        ? opt.format
        : undefined,
    documentSpec:
      typeof opt.documentSpec === "string" ? opt.documentSpec : undefined,
  };
}

export function parseAgentBrief(value: unknown): TaskAgentBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  const brief: TaskAgentBrief = {
    agentId: typeof r.agentId === "string" ? r.agentId : undefined,
    instructions: typeof r.instructions === "string" ? r.instructions : undefined,
    tool: briefTool(r.tool),
    options: briefOptions(r.options),
    knowledge: typeof r.knowledge === "string" ? r.knowledge : undefined,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : undefined,
  };
  return brief;
}

/** A per-(task, agent) brief row, flattened with the agent's display name. */
export type TaskAgentBriefRecord = TaskAgentBrief & {
  agentId: string;
  agentName: string;
};

/**
 * Flatten a `TaskAgentBrief` DB row (instructions/tool/config columns) into the
 * client-facing brief content shape. `config` holds { options, knowledge }.
 */
export function dbBriefToContent(row: {
  agentId: string;
  agent?: { name: string } | null;
  instructions: string | null;
  tool: string | null;
  config: unknown;
  updatedAt?: Date | string | null;
}): TaskAgentBriefRecord {
  const cfg =
    row.config && typeof row.config === "object" && !Array.isArray(row.config)
      ? (row.config as Record<string, unknown>)
      : {};
  return {
    agentId: row.agentId,
    agentName: row.agent?.name ?? "",
    instructions: row.instructions ?? undefined,
    tool: briefTool(row.tool),
    options: briefOptions(cfg.options),
    knowledge: typeof cfg.knowledge === "string" ? cfg.knowledge : undefined,
    updatedAt: row.updatedAt
      ? typeof row.updatedAt === "string"
        ? row.updatedAt
        : row.updatedAt.toISOString()
      : undefined,
  };
}

/** Build the `TaskAgentBrief` DB columns (instructions/tool/config) from content. */
export function briefContentToDb(brief: {
  instructions?: string;
  tool?: TaskAgentBriefTool;
  options?: TaskAgentBrief["options"];
  knowledge?: string;
}): {
  instructions: string | null;
  tool: string | null;
  config: { options: NonNullable<TaskAgentBrief["options"]>; knowledge?: string };
} {
  const options = brief.options ?? {};
  const knowledge = brief.knowledge?.trim();
  return {
    instructions: brief.instructions?.trim() || null,
    tool: brief.tool ?? null,
    config: { options, ...(knowledge ? { knowledge } : {}) },
  };
}

function parseReview(value: unknown): TaskReview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  if (typeof r.verdict !== "string" || typeof r.summary !== "string") return null;
  const checklist = Array.isArray(r.checklist)
    ? r.checklist
        .filter(
          (c): c is { item: string; pass: boolean } =>
            !!c &&
            typeof c === "object" &&
            typeof (c as { item?: unknown }).item === "string" &&
            typeof (c as { pass?: unknown }).pass === "boolean",
        )
        .map((c) => ({ item: c.item, pass: c.pass }))
    : undefined;
  return {
    verdict: r.verdict,
    summary: r.summary,
    checklist,
    kind: typeof r.kind === "string" ? r.kind : undefined,
    by: typeof r.by === "string" ? r.by : undefined,
    at: typeof r.at === "string" ? r.at : undefined,
  };
}

export function dbTaskToInbox(task: DbTaskWithRelations): InboxTask {
  const status = statusFromDb(task.status);
  const assigneeUserIds: string[] = [];
  const assigneeAgentIds: string[] = [];
  for (const a of task.assignees) {
    const agentId = a.agent?.id ?? a.agentId ?? null;
    const userId = a.user?.id ?? a.userId ?? null;
    if (agentId) assigneeAgentIds.push(agentId);
    else if (userId) assigneeUserIds.push(userId);
  }
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    status,
    priority: priorityFromDb(task.priority),
    assignees: task.assignees.map((a) =>
      a.agent
        ? { id: a.agent.id ?? a.agentId ?? undefined, name: a.agent.name, type: "agent" as const }
        : {
            id: a.user?.id ?? a.userId ?? undefined,
            name: a.user?.name ?? "Unknown",
            type: "human" as const,
          },
    ),
    assigneeUserIds,
    assigneeAgentIds,
    dueDate:
      task.dueDate == null
        ? ""
        : typeof task.dueDate === "string"
          ? task.dueDate
          : task.dueDate.toISOString(),
    dueLabel: formatDueLabel(task.dueDate, status),
    tags: task.tags,
    project: task.project?.name ?? "",
    projectId: task.projectId ?? "",
    review: parseReview(task.review),
    agentBrief: parseAgentBrief(task.agentBrief),
    archived: task.archivedAt != null,
  };
}
