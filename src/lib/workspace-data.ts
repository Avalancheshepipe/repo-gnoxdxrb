export type WorkspaceView = "home" | "canvas" | "inbox";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in-progress" | "review" | "done";
export type AssigneeType = "human" | "agent";

export type TaskAssignee = { id?: string; name: string; type: AssigneeType };

export type TaskReview = {
  verdict: string;
  summary: string;
  checklist?: { item: string; pass: boolean }[];
  kind?: string;
  by?: string;
  at?: string;
};

/** What an assigned agent should do on a task (drives the real agent tools). */
export type TaskAgentBriefTool =
  | "general"
  | "research"
  | "document"
  | "report"
  | "review";

export type TaskAgentBrief = {
  /** The agent this brief is written for (id), if chosen. */
  agentId?: string;
  /** Plain-language instructions / context for the agent. */
  instructions?: string;
  /** Which real capability to lean on. */
  tool?: TaskAgentBriefTool;
  options?: {
    webSearch?: boolean;
    researchQuery?: string;
    format?: "word" | "excel" | "pdf";
    documentSpec?: string;
  };
  /** Extra knowledge the agent needs to finish the task. */
  knowledge?: string;
  updatedAt?: string;
};

export type InboxTask = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignees: TaskAssignee[];
  /** Assignee ids for editing (the human/agent display lives in `assignees`). */
  assigneeUserIds: string[];
  assigneeAgentIds: string[];
  dueDate: string;
  dueLabel: string;
  tags: string[];
  project: string;
  projectId: string;
  review?: TaskReview | null;
  agentBrief?: TaskAgentBrief | null;
  /** When true, the task is archived (hidden from inbox/canvas by default). */
  archived?: boolean;
};

export type TeamAgent = {
  id: string;
  name: string;
  role: string;
  /** Plain-language summary for organizers */
  responsibility: string;
  status: "online" | "busy" | "idle" | "offline";
  currentTask?: string;
  tasksCompleted: number;
  avgResponse: string;
  capabilities: string[];
};

export type MessengerChannel = {
  id: string;
  platform: "telegram" | "brf" | "slack" | "discord";
  name: string;
  handle: string;
  connected: boolean;
  lastMessage?: string;
};

export type AutomationRule = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  runsToday: number;
  aiManaged: boolean;
};

export type DeadlineRule = {
  id: string;
  taskPattern: string;
  behavior: string;
  nextRun: string;
  managedBy: string;
};

export const workspace = {
  name: "Q2 Product Launch",
  slug: "q2-launch",
};

export const sidebarViews: {
  id: Exclude<WorkspaceView, "home">;
  label: string;
  href: string;
}[] = [
  { id: "canvas", label: "Canvas", href: "/app/board" },
  { id: "inbox", label: "Inbox", href: "/app/inbox" },
];

export const viewLabels: Record<Exclude<WorkspaceView, "home">, string> = {
  canvas: "Canvas",
  inbox: "Inbox",
};

export function getViewFromPath(pathname: string): WorkspaceView {
  const normalized = pathname.replace(/\/$/, "") || "/app";
  if (normalized === "/app") return "home";
  if (pathname.startsWith("/app/board")) return "canvas";
  if (pathname.startsWith("/app/inbox")) return "inbox";
  return "home";
}

export const projects = [
  { id: "q2", name: "Q2 Product Launch", active: true },
  { id: "design", name: "Design System", active: false },
  { id: "infra", name: "Platform Infra", active: false },
];

// Seed-only shape (bootstrap.ts). Real Inbox tasks come from the DB via
// dbTaskToInbox and carry assignee ids, projectId, brief, etc.
export type SeedTask = Pick<
  InboxTask,
  | "id"
  | "title"
  | "description"
  | "status"
  | "priority"
  | "assignees"
  | "dueDate"
  | "dueLabel"
  | "tags"
  | "project"
>;

export const inboxTasks: SeedTask[] = [
  {
    id: "t1",
    title: "Ship onboarding flow",
    description: "Finalize screens, hand off to engineering for implementation.",
    status: "in-progress",
    priority: "high",
    assignees: [
      { name: "Mira K.", type: "human" },
      { name: "Julow Agent", type: "agent" },
    ],
    dueDate: "2026-06-28",
    dueLabel: "In 4 days",
    tags: ["design", "launch"],
    project: "Q2 Product Launch",
  },
  {
    id: "t2",
    title: "Research competitor UX patterns",
    description: "Agent-led analysis of Linear, Notion, and FigJam canvas flows.",
    status: "in-progress",
    priority: "medium",
    assignees: [
      { name: "Julow Agent", type: "agent" },
    ],
    dueDate: "2026-06-25",
    dueLabel: "Tomorrow",
    tags: ["research", "agent"],
    project: "Q2 Product Launch",
  },
  {
    id: "t3",
    title: "API rate limiting spec",
    description: "Define limits, error responses, and migration plan.",
    status: "todo",
    priority: "urgent",
    assignees: [
      { name: "Alex P.", type: "human" },
      { name: "Julow Agent", type: "agent" },
    ],
    dueDate: "2026-06-24",
    dueLabel: "Today",
    tags: ["backend", "infra"],
    project: "Platform Infra",
  },
  {
    id: "t4",
    title: "Draft launch blog post",
    description: "Outline → draft → review. Julow Agent can assist with changelog sync.",
    status: "todo",
    priority: "medium",
    assignees: [
      { name: "Julow Agent", type: "agent" },
    ],
    dueDate: "2026-07-02",
    dueLabel: "In 8 days",
    tags: ["marketing", "content"],
    project: "Q2 Product Launch",
  },
  {
    id: "t5",
    title: "Review agent orchestration PR",
    description: "Code review for remote task queue and webhook handlers.",
    status: "review",
    priority: "high",
    assignees: [
      { name: "You", type: "human" },
      { name: "Julow Agent", type: "agent" },
    ],
    dueDate: "2026-06-26",
    dueLabel: "In 2 days",
    tags: ["engineering"],
    project: "Q2 Product Launch",
  },
  {
    id: "t6",
    title: "Deploy staging environment",
    description: "Ship latest build to staging and verify agent webhook endpoints.",
    status: "done",
    priority: "medium",
    assignees: [
      { name: "You", type: "human" },
      { name: "Julow Agent", type: "agent" },
    ],
    dueDate: "2026-06-20",
    dueLabel: "Completed",
    tags: ["infra", "devops"],
    project: "Platform Infra",
  },
];

export const teamAgents: TeamAgent[] = [
  {
    id: "a1",
    name: "Julow Agent",
    role: "Universal workspace assistant",
    responsibility:
      "Manages tasks, creates documents (Word/Excel/PDF), does web research, reviews work, compiles reports, and splits large objectives into parallel sub-tasks.",
    status: "online",
    tasksCompleted: 0,
    avgResponse: "Instant",
    capabilities: [
      "create_task",
      "update_task",
      "research",
      "create_document",
      "review",
      "test",
      "report",
      "canvas",
      "delegate",
    ],
  },
];

export const messengerChannels: MessengerChannel[] = [
  {
    id: "m1",
    platform: "telegram",
    name: "Team Launch Channel",
    handle: "@julow_launch",
    connected: true,
    lastMessage: "Research Agent: 3 UX gaps found · 2m ago",
  },
  {
    id: "m2",
    platform: "brf",
    name: "Dev Standup Bot",
    handle: "brf://julow-dev",
    connected: true,
    lastMessage: "Daily digest sent · 1h ago",
  },
  {
    id: "m3",
    platform: "telegram",
    name: "Agent Alerts",
    handle: "@julow_agents",
    connected: true,
    lastMessage: "Julow Agent queued changelog task",
  },
  {
    id: "m4",
    platform: "slack",
    name: "Product Team",
    handle: "#product",
    connected: false,
  },
];

export const automationRules: AutomationRule[] = [
  {
    id: "r1",
    name: "Deadline escalation",
    description: "When a task is 24h from due, notify assignee via Telegram.",
    trigger: "Due date −24h",
    action: "Send messenger alert + re-prioritize inbox",
    enabled: true,
    runsToday: 3,
    aiManaged: true,
  },
  {
    id: "r2",
    name: "Agent handoff on @mention",
    description: "Tag an agent in BRF or Telegram — task auto-created and assigned.",
    trigger: "@agent mention in messenger",
    action: "Create inbox task · assign agent",
    enabled: true,
    runsToday: 7,
    aiManaged: true,
  },
  {
    id: "r3",
    name: "Weekly team digest",
    description: "Julow Agent summarizes canvas, inbox, and activity every Monday.",
    trigger: "Cron · Mon 09:00",
    action: "Post to BRF + email team",
    enabled: true,
    runsToday: 0,
    aiManaged: false,
  },
  {
    id: "r4",
    name: "Overdue → agent takeover",
    description: "If human task overdue 48h, offer agent delegation with approval gate.",
    trigger: "Overdue 48h",
    action: "Suggest agent · notify in Inbox",
    enabled: true,
    runsToday: 1,
    aiManaged: true,
  },
];

export const deadlineRules: DeadlineRule[] = [
  {
    id: "d1",
    taskPattern: "Launch milestone tasks",
    behavior: "Auto-adjust subtask due dates when parent shifts",
    nextRun: "On milestone edit",
    managedBy: "Julow Agent",
  },
  {
    id: "d2",
    taskPattern: "Agent-assigned tasks",
    behavior: "Set ETA from agent capacity model; sync to canvas node",
    nextRun: "Continuous",
    managedBy: "Julow Agent",
  },
  {
    id: "d3",
    taskPattern: "Urgent priority",
    behavior: "Immediate Telegram + BRF ping to assignee",
    nextRun: "On priority change",
    managedBy: "Julow Agent",
  },
];

// Re-export canvas-related data from workspace-data legacy - keep canvas nodes here
export type NodeStatus = "todo" | "in-progress" | "done" | "agent";
export type AgentStatus = "idle" | "running" | "waiting";

export type CanvasNode = {
  id: string;
  type: "task" | "note" | "agent" | "milestone";
  title: string;
  subtitle?: string;
  status?: NodeStatus;
  x: number;
  y: number;
  width: number;
  connections?: string[];
};

export type AgentJob = {
  id: string;
  title: string;
  agent: string;
  status: AgentStatus;
  progress: number;
  eta?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  time: string;
  /** Agent display name for agent/system rows in chat */
  agentName?: string;
};

export type ActivityItem = {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  type: "agent" | "task" | "automation";
  status: "live" | "done";
};

export const canvasNodes: CanvasNode[] = [
  {
    id: "n1",
    type: "milestone",
    title: "Launch milestone",
    subtitle: "Apr 30 · 12 days left",
    status: "in-progress",
    x: 0,
    y: 0,
    width: 220,
    connections: ["n2", "n3"],
  },
  {
    id: "n2",
    type: "task",
    title: "Ship onboarding flow",
    subtitle: "Design · Engineering",
    status: "in-progress",
    x: 300,
    y: -30,
    width: 200,
    connections: ["n4"],
  },
  {
    id: "n3",
    type: "agent",
    title: "Research competitor UX",
    subtitle: "Agent · Cursor",
    status: "agent",
    x: 300,
    y: 150,
    width: 200,
    connections: ["n5"],
  },
  {
    id: "n4",
    type: "task",
    title: "API rate limiting",
    subtitle: "Backend",
    status: "todo",
    x: 580,
    y: -50,
    width: 190,
  },
  {
    id: "n5",
    type: "note",
    title: "Key insight",
    subtitle: "Agents found 3 gaps in Linear's canvas UX",
    status: "done",
    x: 580,
    y: 130,
    width: 210,
  },
  {
    id: "n6",
    type: "task",
    title: "Write launch blog post",
    subtitle: "Marketing",
    status: "todo",
    x: 0,
    y: 170,
    width: 200,
    connections: ["n3"],
  },
];

export const agentJobs: AgentJob[] = [
  {
    id: "j1",
    title: "Summarize competitor research",
    agent: "Julow Agent",
    status: "running",
    progress: 68,
    eta: "~2 min",
  },
  {
    id: "j2",
    title: "Draft API changelog",
    agent: "Julow Agent",
    status: "waiting",
    progress: 0,
  },
  {
    id: "j3",
    title: "Review onboarding copy",
    agent: "Julow Agent",
    status: "idle",
    progress: 100,
  },
];

export const chatMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "system",
    agentName: "Julow Agent",
    content: "Julow Agent connected to canvas context.",
    time: "10:02",
  },
  {
    id: "m2",
    role: "user",
    content:
      "Analyze how Linear handles canvas views and suggest improvements for Julow.",
    time: "10:03",
  },
  {
    id: "m3",
    role: "agent",
    agentName: "Julow Agent",
    content:
      "I found 3 gaps: no spatial linking between issues, limited agent hooks, and no remote automation queue. I added a note node to your canvas with details.",
    time: "10:04",
  },
];

export const activities: ActivityItem[] = [
  {
    id: "a1",
    actor: "Julow Agent",
    action: "creating note on",
    target: "Key insight",
    time: "now",
    type: "agent",
    status: "live",
  },
  {
    id: "a2",
    actor: "You",
    action: "moved task to",
    target: "In progress",
    time: "8m ago",
    type: "task",
    status: "done",
  },
  {
    id: "a3",
    actor: "Julow Agent",
    action: "queued automation",
    target: "API changelog",
    time: "14m ago",
    type: "automation",
    status: "done",
  },
];

export const agentSuggestions = [
  "Break down launch milestone into subtasks",
  "Run UX audit on onboarding flow",
  "Schedule weekly agent sync",
];
