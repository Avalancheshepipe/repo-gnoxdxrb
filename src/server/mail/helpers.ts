import { env } from "@/server/env";

const STATUS_LABEL: Record<string, string> = {
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Готово",
};

const STATUS_LABEL_EN: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  URGENT: "Срочный",
};

const PRIORITY_LABEL_EN: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export function taskUrl(taskId: string, projectId: string): string {
  const base = env.APP_URL.replace(/\/$/, "");
  return `${base}/app/inbox?task=${taskId}&project=${projectId}`;
}

export function inviteUrl(invitationId: string): string {
  const base = env.APP_URL.replace(/\/$/, "");
  return `${base}/invite/${invitationId}`;
}

export function formatStatus(status: string, locale: "ru" | "en" = "ru"): string {
  const map = locale === "ru" ? STATUS_LABEL : STATUS_LABEL_EN;
  return map[status] ?? status;
}

export function formatPriority(priority: string, locale: "ru" | "en" = "ru"): string {
  const map = locale === "ru" ? PRIORITY_LABEL : PRIORITY_LABEL_EN;
  return map[priority] ?? priority;
}

export function assigneeNames(
  assignees: {
    user: { name: string | null; email?: string } | null;
    agent: { name: string } | null;
  }[],
): string[] {
  return assignees
    .map((a) => a.user?.name ?? a.user?.email ?? a.agent?.name)
    .filter((x): x is string => Boolean(x));
}
