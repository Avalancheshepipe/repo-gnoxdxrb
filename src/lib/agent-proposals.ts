// Shared (client-safe) types for agent write-actions that require user
// confirmation. The server declares matching AI tools in
// `src/server/ai/proposal-tools.ts`; the client renders + executes them.

import { formatDate, type DateLocale } from "@/lib/task-mappers";

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

export const PROPOSAL_VERB: Record<ProposalKind, string> = {
  propose_create_task: "Create task",
  propose_update_task: "Update task",
  propose_assign_task: "Assign agent",
  propose_bulk_update_tasks: "Update tasks",
  propose_archive_task: "Archive task",
  propose_canvas_node: "Add canvas node",
  propose_create_automation: "Create automation",
  propose_delegate: "Delegate to agent",
  propose_delegate_task: "Delegate task to team",
  propose_create_document: "Create document",
  propose_report: "Compile report",
  propose_review: "Review task",
  propose_test: "Validate task",
  propose_send_email: "Send email",
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

export function proposalDetail(p: AgentProposal, locale: DateLocale = "en"): string {
  switch (p.kind) {
    case "propose_create_task": {
      const bits = [
        p.args.projectName && `in ${p.args.projectName}`,
        p.args.priority && `${p.args.priority} priority`,
        p.args.status && p.args.status,
        p.args.dueDate && `${locale === "ru" ? "срок" : "due"} ${formatDate(p.args.dueDate, locale)}`,
        p.args.assignees?.length && `→ ${p.args.assignees.join(", ")}`,
        p.args.tags?.length && `#${p.args.tags.join(" #")}`,
      ].filter(Boolean);
      return [p.args.description, bits.join(" · ")].filter(Boolean).join("\n");
    }
    case "propose_update_task": {
      const ru = locale === "ru";
      const bits = [
        p.args.newTitle && `${ru ? "переименовать в" : "rename to"} "${p.args.newTitle}"`,
        p.args.status && `→ ${p.args.status}`,
        p.args.priority && `priority ${p.args.priority}`,
        p.args.dueDate && `${ru ? "срок" : "due"} ${formatDate(p.args.dueDate, locale)}`,
        p.args.assignees?.length && `+ ${p.args.assignees.join(", ")}`,
        p.args.removeAssignees?.length &&
          `${ru ? "убрать" : "remove"} ${p.args.removeAssignees.join(", ")}`,
        p.args.tags?.length && `#${p.args.tags.join(" #")}`,
      ].filter(Boolean);
      return [p.args.description, bits.join(" · ")].filter(Boolean).join("\n");
    }
    case "propose_assign_task": {
      const ru = locale === "ru";
      const add = p.args.assignees?.length ? assignProposalNames(p) : [];
      const bits = [
        add.length && `+ ${add.join(", ")}`,
        p.args.removeAssignees?.length &&
          `${ru ? "убрать" : "remove"} ${p.args.removeAssignees.join(", ")}`,
      ].filter(Boolean);
      return bits.join(" · ");
    }
    case "propose_bulk_update_tasks": {
      const ru = locale === "ru";
      const f = p.args.filter;
      const c = p.args.changes;
      const from = f.status
        ? f.status
        : f.tags?.length
          ? `#${f.tags.join(" #")}`
          : ru
            ? "все задачи"
            : "all tasks";
      const to = [
        c.status && `→ ${c.status}`,
        c.priority && `priority ${c.priority}`,
        c.archive === true && (ru ? "в архив" : "archive"),
        c.archive === false && (ru ? "из архива" : "restore"),
      ].filter(Boolean);
      return `${from} ${to.join(" · ")}`;
    }
    case "propose_archive_task":
      return p.args.archived === false
        ? locale === "ru"
          ? "восстановить из архива"
          : "restore from archive"
        : locale === "ru"
          ? "в архив"
          : "archive";
    case "propose_canvas_node": {
      const bits = [
        p.args.nodeType && `${p.args.nodeType} node`,
        p.args.linkToTitle && `linked to "${p.args.linkToTitle}"`,
      ].filter(Boolean);
      return [p.args.subtitle, bits.join(" · ")].filter(Boolean).join("\n");
    }
    case "propose_create_automation":
      return [p.args.description, `When ${p.args.when} → ${p.args.then}`]
        .filter(Boolean)
        .join("\n");
    case "propose_delegate":
      return p.args.objective;
    case "propose_delegate_task": {
      const lines = p.args.assignments.map((a) => {
        const who = a.agentName?.trim() || (a.tool ? `(${a.tool})` : "auto");
        const fmt = a.format ? ` [${a.format === "excel" ? "Excel" : a.format === "pdf" ? "PDF" : "Word"}]` : "";
        return `→ ${who}${fmt}: ${a.brief}`;
      });
      const head = p.args.createTask
        ? `${locale === "ru" ? "новая задача" : "new task"}: ${p.args.createTask.title}`
        : "";
      return [head, ...lines].filter(Boolean).join("\n");
    }
    case "propose_create_document": {
      const bits = [
        p.args.format === "excel" ? "Excel .xlsx" : p.args.format === "pdf" ? "PDF .pdf" : "Word .docx",
        p.args.taskTitle && `attach to "${p.args.taskTitle}"`,
      ].filter(Boolean);
      return bits.join(" · ");
    }
    case "propose_report":
      return p.args.format === "excel" ? "Markdown + Excel export" : "Markdown";
    case "propose_review":
    case "propose_test":
      return p.args.criteria ?? "";
    case "propose_send_email": {
      const bits = [
        `→ ${p.args.recipient}`,
        p.args.linkUrl && p.args.linkLabel
          ? `+ ${p.args.linkLabel}`
          : p.args.linkUrl,
      ].filter(Boolean);
      return [p.args.body, bits.join(" · ")].filter(Boolean).join("\n\n");
    }
  }
}
