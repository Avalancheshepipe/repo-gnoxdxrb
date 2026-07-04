// Shared (client-safe) types for agent write-actions that require user
// confirmation. The server declares matching AI tools in
// `src/server/ai/proposal-tools.ts`; the client renders + executes them.

export type TaskStatusArg = "todo" | "in-progress" | "review" | "done";
export type TaskPriorityArg = "low" | "medium" | "high" | "urgent";
export type CanvasNodeKind = "task" | "note" | "agent" | "milestone";

export type ProposalArgsMap = {
  propose_create_task: {
    title: string;
    description?: string;
    projectName?: string;
    priority?: TaskPriorityArg;
    status?: TaskStatusArg;
    tags?: string[];
    dueDate?: string;
    assignees?: string[];
  };
  propose_update_task: {
    taskTitle: string;
    newTitle?: string;
    status?: TaskStatusArg;
    priority?: TaskPriorityArg;
    description?: string;
    tags?: string[];
    dueDate?: string;
    assignees?: string[];
    removeAssignees?: string[];
  };
  propose_assign_task: {
    taskTitle: string;
    assignees?: string[];
    removeAssignees?: string[];
    /** @deprecated single-agent form, kept for older persisted proposals. */
    agentName?: string;
  };
  propose_bulk_update_tasks: {
    filter: { status?: TaskStatusArg; tags?: string[] };
    changes: {
      status?: TaskStatusArg;
      priority?: TaskPriorityArg;
      archive?: boolean;
    };
  };
  propose_archive_task: {
    taskTitle: string;
    archived?: boolean;
  };
  propose_canvas_node: {
    title: string;
    subtitle?: string;
    nodeType?: CanvasNodeKind;
    linkToTitle?: string;
  };
  propose_create_automation: {
    name: string;
    description?: string;
    when: string;
    then: string;
    aiManaged?: boolean;
  };
  propose_delegate: {
    objective: string;
  };
  propose_delegate_task: {
    taskTitle?: string;
    createTask?: {
      title: string;
      description?: string;
      projectName?: string;
      priority?: TaskPriorityArg;
      dueDate?: string;
    };
    assignments: {
      agentName?: string;
      tool?: "general" | "research" | "document" | "report" | "review";
      brief: string;
      format?: "word" | "excel" | "pdf";
      documentSpec?: string;
      researchQuery?: string;
    }[];
  };
  propose_create_document: {
    format: "word" | "excel" | "pdf";
    title: string;
    sections?: {
      heading?: string;
      paragraphs?: string[];
      bullets?: string[];
    }[];
    sheet?: { columns: string[]; rows: (string | number)[][] };
    taskTitle?: string;
  };
  propose_report: {
    title?: string;
    format?: "markdown" | "excel";
  };
  propose_review: {
    taskTitle: string;
    criteria?: string;
  };
  propose_test: {
    taskTitle: string;
    criteria?: string;
  };
  propose_send_email: {
    recipient: string;
    subject: string;
    body: string;
    linkUrl?: string;
    linkLabel?: string;
  };
};

export type ProposalKind = keyof ProposalArgsMap;

export type AgentProposal = {
  [K in ProposalKind]: {
    id: string;
    kind: K;
    args: ProposalArgsMap[K];
    status: "pending" | "accepted" | "declined" | "failed";
    note?: string;
    /** Task this proposal created/affected — lets the card open its detail. */
    taskId?: string;
    /** Project the task lives in — so opening can switch the active project. */
    projectId?: string;
  };
}[ProposalKind];

/** Assignees for an assign proposal, tolerating the older single-agent form. */
export function assignProposalNames(p: {
  args: ProposalArgsMap["propose_assign_task"];
}): string[] {
  if (p.args.assignees?.length) return p.args.assignees;
  return p.args.agentName ? [p.args.agentName] : [];
}

/** Approval-gate action type each proposal kind maps to (for auto-approve). */
export const PROPOSAL_ACTION_TYPE: Record<
  ProposalKind,
  | "CREATE_TASK"
  | "UPDATE_TASK"
  | "DELETE_TASK"
  | "CREATE_DOCUMENT"
  | "SEND_EMAIL"
  | "SPLIT_TASK"
  | "CANVAS_NOTE"
  | null
> = {
  propose_create_task: "CREATE_TASK",
  propose_update_task: "UPDATE_TASK",
  propose_assign_task: "UPDATE_TASK",
  propose_bulk_update_tasks: "UPDATE_TASK",
  propose_archive_task: "DELETE_TASK",
  propose_canvas_node: "CANVAS_NOTE",
  propose_create_automation: null,
  propose_delegate: "SPLIT_TASK",
  propose_delegate_task: "SPLIT_TASK",
  propose_create_document: "CREATE_DOCUMENT",
  propose_report: "CREATE_DOCUMENT",
  propose_review: null,
  propose_test: null,
  propose_send_email: "SEND_EMAIL",
};

export function proposalTitle(p: AgentProposal): string {
  switch (p.kind) {
    case "propose_create_task":
      return p.args.title;
    case "propose_update_task":
      return p.args.taskTitle;
    case "propose_assign_task":
      return p.args.taskTitle;
    case "propose_bulk_update_tasks": {
      const f = p.args.filter;
      return f.status ? f.status : f.tags?.length ? `#${f.tags.join(" #")}` : "tasks";
    }
    case "propose_archive_task":
      return p.args.taskTitle;
    case "propose_canvas_node":
      return p.args.title;
    case "propose_create_automation":
      return p.args.name;
    case "propose_delegate":
      return "Delegate";
    case "propose_delegate_task":
      return p.args.taskTitle ?? p.args.createTask?.title ?? "Task";
    case "propose_create_document":
      return p.args.title;
    case "propose_report":
      return p.args.title ?? "Workspace report";
    case "propose_review":
      return p.args.taskTitle;
    case "propose_test":
      return p.args.taskTitle;
    case "propose_send_email":
      return p.args.subject;
  }
}
