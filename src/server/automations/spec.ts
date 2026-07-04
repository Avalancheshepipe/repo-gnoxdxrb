// Structured trigger/action specs for automations + tolerant parsers.
//
// Automations are stored with `trigger` and `action` Json columns shaped as
// { type, label?, config? }. The UI and agent proposals may also pass a bare
// { type: "custom", label } — in that case we best-effort INFER a structured
// trigger/action from the label so the rule still schedules and runs for real
// (budget: pure heuristics, no LLM).

export type TaskStatusKey = "todo" | "in-progress" | "review" | "done";

export type AutomationTrigger =
  | { type: "recurring"; everyMinutes: number; label?: string }
  | { type: "schedule"; runAt: string; label?: string }
  | { type: "task_created"; projectId?: string; label?: string }
  | { type: "task_status"; status: TaskStatusKey; label?: string }
  | { type: "task_due_soon"; withinHours: number; label?: string }
  | { type: "custom"; label?: string };

export type AutomationActionSpec =
  | { type: "telegram_message"; text: string; label?: string }
  | {
      type: "create_task";
      title: string;
      projectId?: string;
      description?: string;
      priority?: string;
      status?: TaskStatusKey;
      label?: string;
    }
  | { type: "set_task_status"; status: TaskStatusKey; taskTitle?: string; label?: string }
  | { type: "assign_agent"; agentName: string; taskTitle?: string; label?: string }
  | { type: "run_agent"; agentName: string; prompt: string; projectId?: string; label?: string }
  | { type: "post_activity"; text: string; label?: string }
  | { type: "custom"; label?: string };

type RawSpec = { type?: string; label?: string; config?: Record<string, unknown> };

function asRaw(value: unknown): RawSpec {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as RawSpec;
  }
  return {};
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const STATUSES: TaskStatusKey[] = ["todo", "in-progress", "review", "done"];
function asStatus(v: unknown, fallback: TaskStatusKey = "done"): TaskStatusKey {
  const s = String(v ?? "").toLowerCase().replace(/[_\s]+/g, "-");
  return (STATUSES as string[]).includes(s) ? (s as TaskStatusKey) : fallback;
}

// ── Label inference (used when type is "custom" / freeform) ──────────────────

function inferTriggerFromLabel(label: string): AutomationTrigger {
  const l = label.toLowerCase();
  const everyMatch = l.match(/every\s+(\d+)\s*(minute|min|hour|hr|day|week)/);
  if (everyMatch) {
    const n = Number(everyMatch[1]);
    const unit = everyMatch[2]!;
    const mult = unit.startsWith("min") ? 1 : unit.startsWith("h") ? 60 : unit.startsWith("day") ? 1440 : 10080;
    return { type: "recurring", everyMinutes: clampInt(n * mult, 60, 1, 60 * 24 * 30), label };
  }
  if (/(hourly|every hour|каждый час)/.test(l)) return { type: "recurring", everyMinutes: 60, label };
  if (/(daily|every day|each day|каждый день|ежедневн)/.test(l)) return { type: "recurring", everyMinutes: 1440, label };
  if (/(weekly|every week|раз в неделю|еженедельн)/.test(l)) return { type: "recurring", everyMinutes: 10080, label };
  if (/(due|deadline|overdue|−24h|-24h|дедлайн|срок|просроч)/.test(l)) return { type: "task_due_soon", withinHours: 24, label };
  if (/(task created|new task|created|новая задача|создан|создании)/.test(l)) return { type: "task_created", label };
  if (/(mention|@|handoff|hand off|передач|упомина)/.test(l)) return { type: "task_created", label }; // best-effort
  if (/(done|completed|complete|выполнен|готов|заверш)/.test(l)) return { type: "task_status", status: "done", label };
  if (/(in review|on review|на проверк|ревью)/.test(l)) return { type: "task_status", status: "review", label };
  if (/(in progress|в работе|в процессе)/.test(l)) return { type: "task_status", status: "in-progress", label };
  return { type: "custom", label };
}

function inferActionFromLabel(label: string): AutomationActionSpec {
  const l = label.toLowerCase();
  if (/(telegram|телеграм|message|сообщени|notify|alert|оповест|уведом|ping|digest|дайджест)/.test(l)) {
    return { type: "telegram_message", text: label, label };
  }
  if (/(create task|new task|создать задачу|добавить задачу|создай задачу)/.test(l)) {
    return { type: "create_task", title: label, label };
  }
  return { type: "post_activity", text: label, label };
}

// ── Parsers ──────────────────────────────────────────────────────────────────

export function parseTrigger(value: unknown): AutomationTrigger {
  const raw = asRaw(value);
  const cfg = raw.config ?? {};
  const label = str(raw.label);
  switch (raw.type) {
    case "recurring":
      return { type: "recurring", everyMinutes: clampInt(cfg.everyMinutes, 1440, 1, 60 * 24 * 30), label };
    case "schedule":
      return { type: "schedule", runAt: str(cfg.runAt) ?? "", label };
    case "task_created":
      return { type: "task_created", projectId: str(cfg.projectId), label };
    case "task_status":
      return { type: "task_status", status: asStatus(cfg.status), label };
    case "task_due_soon":
      return { type: "task_due_soon", withinHours: clampInt(cfg.withinHours, 24, 1, 24 * 14), label };
    case "custom":
    case undefined:
      return label ? inferTriggerFromLabel(label) : { type: "custom", label };
    default:
      return { type: "custom", label };
  }
}

export function parseAction(value: unknown): AutomationActionSpec {
  const raw = asRaw(value);
  const cfg = raw.config ?? {};
  const label = str(raw.label);
  switch (raw.type) {
    case "telegram_message":
      return { type: "telegram_message", text: str(cfg.text) ?? label ?? "", label };
    case "create_task":
      return {
        type: "create_task",
        title: str(cfg.title) ?? label ?? "New task",
        projectId: str(cfg.projectId),
        description: str(cfg.description),
        priority: str(cfg.priority),
        status: cfg.status ? asStatus(cfg.status, "todo") : undefined,
        label,
      };
    case "set_task_status":
      return { type: "set_task_status", status: asStatus(cfg.status), taskTitle: str(cfg.taskTitle), label };
    case "assign_agent":
      return { type: "assign_agent", agentName: str(cfg.agentName) ?? "", taskTitle: str(cfg.taskTitle), label };
    case "run_agent":
      return {
        type: "run_agent",
        agentName: str(cfg.agentName) ?? "",
        prompt: str(cfg.prompt) ?? label ?? "Proceed with your objective.",
        projectId: str(cfg.projectId),
        label,
      };
    case "post_activity":
      return { type: "post_activity", text: str(cfg.text) ?? label ?? "ran", label };
    case "custom":
    case undefined:
      return label ? inferActionFromLabel(label) : { type: "custom", label };
    default:
      return { type: "custom", label };
  }
}

/** True when a trigger should be (re)scheduled as a BullMQ job. */
export function isScheduledTrigger(t: AutomationTrigger): t is
  | { type: "recurring"; everyMinutes: number; label?: string }
  | { type: "schedule"; runAt: string; label?: string } {
  return t.type === "recurring" || t.type === "schedule";
}
