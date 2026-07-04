import { handleFromAgentName, handleFromEmail } from "@/lib/mentions";
import type { InboxTask } from "@/lib/workspace-data";

export type CommandPageResult = {
  kind: "page";
  id: string;
  href: string;
  label: string;
};

export type CommandTaskResult = {
  kind: "task";
  id: string;
  title: string;
  status: string;
  tags: string[];
};

export type CommandAgentResult = {
  kind: "agent";
  id: string;
  name: string;
  handle: string;
  role: string;
};

export type CommandPersonResult = {
  kind: "person";
  id: string;
  name: string;
  handle: string;
  email: string;
  role: string;
};

export type CommandResult =
  | CommandPageResult
  | CommandTaskResult
  | CommandAgentResult
  | CommandPersonResult;

export type CommandGroup = {
  id: "tasks" | "agents" | "people" | "pages";
  items: CommandResult[];
};

const PAGE_ROUTES: { id: string; href: string }[] = [
  { id: "canvas", href: "/app/board" },
  { id: "inbox", href: "/app/inbox" },
  { id: "automations", href: "/app/automations" },
];

const DEFAULT_MAX = 6;

function normalizeQuery(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

function isAgentQuery(raw: string, normalized: string): boolean {
  const trimmed = raw.trim().toLowerCase();
  return (
    trimmed.startsWith("@") ||
    normalized === "agent" ||
    normalized.startsWith("agent ") ||
    normalized.startsWith("агент")
  );
}

function matchesQuery(q: string, ...fields: (string | undefined | null)[]): boolean {
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export function buildCommandPaletteGroups(input: {
  query: string;
  tasks: InboxTask[];
  agents: { id: string; name: string; role: string }[];
  members: {
    user: { id: string; name: string | null; email: string };
    role: string;
  }[];
  pageLabel: (id: string) => string;
  maxPerGroup?: number;
}): CommandGroup[] {
  const max = input.maxPerGroup ?? DEFAULT_MAX;
  const raw = input.query;
  const q = normalizeQuery(raw);
  const agentFocus = isAgentQuery(raw, q);

  const pages: CommandPageResult[] = PAGE_ROUTES.map((p) => ({
    kind: "page" as const,
    id: p.id,
    href: p.href,
    label: input.pageLabel(p.id),
  }))
    .filter((p) => matchesQuery(q, p.label, p.id))
    .slice(0, max);

  const agentItems: CommandAgentResult[] = input.agents
    .map((a) => ({
      kind: "agent" as const,
      id: a.id,
      name: a.name,
      handle: handleFromAgentName(a.name),
      role: a.role,
    }))
    .filter((a) =>
      agentFocus
        ? matchesQuery(q, a.name, a.handle, a.role, "agent", "агент")
        : matchesQuery(q, a.name, a.handle, a.role),
    )
    .slice(0, max);

  const people: CommandPersonResult[] = input.members
    .map((m) => ({
      kind: "person" as const,
      id: m.user.id,
      name: m.user.name ?? m.user.email,
      handle: handleFromEmail(m.user.email),
      email: m.user.email,
      role: m.role,
    }))
    .filter((p) => !agentFocus && matchesQuery(q, p.name, p.handle, p.email, p.role))
    .slice(0, max);

  const taskItems: CommandTaskResult[] = input.tasks
    .filter(
      (t) =>
        !agentFocus &&
        matchesQuery(q, t.title, ...t.tags, t.status, t.priority),
    )
    .slice(0, max)
    .map((t) => ({
      kind: "task" as const,
      id: t.id,
      title: t.title,
      status: t.status,
      tags: t.tags,
    }));

  const groups: CommandGroup[] = [];

  if (taskItems.length > 0) groups.push({ id: "tasks", items: taskItems });
  if (agentItems.length > 0) groups.push({ id: "agents", items: agentItems });
  if (people.length > 0) groups.push({ id: "people", items: people });
  if (pages.length > 0) groups.push({ id: "pages", items: pages });

  return groups;
}

export function flattenCommandGroups(groups: CommandGroup[]): CommandResult[] {
  return groups.flatMap((g) => g.items);
}
