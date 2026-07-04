import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/server/db";

const status = z.enum(["todo", "in-progress", "review", "done"]);
const priority = z.enum(["low", "medium", "high", "urgent"]);
const canvasKind = z.enum(["task", "note", "agent", "milestone"]);

const dueDate = z
  .string()
  .optional()
  .describe(
    "Deadline / due date as an ISO date 'YYYY-MM-DD' (or full ISO datetime). " +
      "ALWAYS set this when the user mentions any deadline. Resolve relative " +
      "dates (today/сегодня, tomorrow/завтра, 'до пятницы', 'через 2 дня') into " +
      "a concrete date using TODAY'S DATE from the snapshot.",
  );

const assignees = z
  .array(z.string())
  .optional()
  .describe(
    "Performers to assign — people AND/OR agents. Use their @handle from the " +
      "snapshot (e.g. '@anna', '@docs'); exact names also work. For the current " +
      "user ('me'/'я') use the user's own @handle from the snapshot. Include " +
      "EVERY performer the user names (one or many, humans and/or agents).",
  );

/**
 * Write-action tools. They intentionally have NO `execute` — when the model
 * calls one, the AI SDK emits a tool-call with no result, which we surface to
 * the user as a proposal card. The action only runs after the user confirms.
 */
export const proposalTools = {
  propose_create_task: tool({
    description:
      "Propose creating a new task. Use when the user wants new work tracked. You may include a Markdown description, tags, a deadline (dueDate) and performers (assignees). Does NOT run until the user confirms.",
    inputSchema: z.object({
      title: z.string().min(1).max(200),
      description: z
        .string()
        .max(4000)
        .optional()
        .describe("Markdown description for the task"),
      projectName: z
        .string()
        .optional()
        .describe("Existing project name from the workspace snapshot"),
      priority: priority.optional(),
      status: status.optional(),
      tags: z.array(z.string()).max(8).optional(),
      dueDate,
      assignees,
    }),
  }),

  propose_update_task: tool({
    description:
      "Propose updating an existing task — RENAME it (newTitle), change status, priority, Markdown description, tags, deadline (dueDate), add performers (assignees) and/or REMOVE performers (removeAssignees). Reference the task by its exact CURRENT title. Confirmation required.",
    inputSchema: z.object({
      taskTitle: z
        .string()
        .min(1)
        .describe("Exact CURRENT title of an existing task"),
      newTitle: z
        .string()
        .max(200)
        .optional()
        .describe("New title to RENAME the task to (use when the user asks to rename)"),
      status: status.optional(),
      priority: priority.optional(),
      description: z
        .string()
        .max(4000)
        .optional()
        .describe("New Markdown description"),
      tags: z.array(z.string()).max(8).optional(),
      dueDate,
      assignees,
      removeAssignees: z
        .array(z.string())
        .optional()
        .describe(
          "@handles or names of performers to REMOVE from the task (people " +
            "and/or agents). Use when the user asks to unassign/remove someone.",
        ),
    }),
  }),

  propose_assign_task: tool({
    description:
      "Propose changing the performers (people AND/OR agents) on an existing task, by exact task title. Add performers with `assignees` and/or REMOVE performers with `removeAssignees`. Confirmation required.",
    inputSchema: z.object({
      taskTitle: z.string().min(1).describe("Exact title of an existing task"),
      assignees: z
        .array(z.string())
        .optional()
        .describe(
          "@handles or exact names of the people and/or agents to ADD. " +
            "Use the user's own @handle for 'me'/'я'. Include all of them.",
        ),
      removeAssignees: z
        .array(z.string())
        .optional()
        .describe(
          "@handles or names of the people and/or agents to REMOVE/unassign.",
        ),
    }),
  }),

  propose_bulk_update_tasks: tool({
    description:
      "Propose updating MANY tasks at once (bulk move/priority/archive). Use this whenever the user asks to change a GROUP of tasks — e.g. 'move all in-progress to review', 'mark every review task done', 'archive all done tasks'. Select the group with `filter` (by current status and/or tags), then set the change(s) in `changes`. For a multi-step request like 'move in-progress→review, then review→done', emit ONE `propose_bulk_update_tasks` per step IN THE SAME TURN (do not skip the second step). Confirmation required.",
    inputSchema: z.object({
      filter: z
        .object({
          status: status.optional().describe("Only tasks currently in this status"),
          tags: z
            .array(z.string())
            .optional()
            .describe("Only tasks that have any of these tags"),
        })
        .describe("Which tasks to affect (at least one of status/tags)"),
      changes: z
        .object({
          status: status.optional().describe("Move all matched tasks to this status"),
          priority: priority.optional().describe("Set priority on all matched tasks"),
          archive: z
            .boolean()
            .optional()
            .describe("true = archive matched tasks, false = restore"),
        })
        .describe("What to change on every matched task"),
    }),
  }),

  propose_archive_task: tool({
    description:
      "Propose archiving (or restoring) ONE task by exact title. Archived tasks are hidden from the inbox and canvas but kept in the workspace. Confirmation required.",
    inputSchema: z.object({
      taskTitle: z.string().min(1).describe("Exact title of an existing task"),
      archived: z
        .boolean()
        .default(true)
        .describe("true = archive, false = restore"),
    }),
  }),

  propose_canvas_node: tool({
    description:
      "Propose adding a node to the active project's canvas to visualize a concept, note, milestone, or task. Confirmation required.",
    inputSchema: z.object({
      title: z.string().min(1).max(200),
      subtitle: z.string().max(500).optional(),
      nodeType: canvasKind.optional(),
      linkToTitle: z
        .string()
        .optional()
        .describe("Title of an existing canvas node to connect this one to"),
    }),
  }),

  propose_create_automation: tool({
    description:
      "Propose a new automation (when X happens, do Y). Confirmation required.",
    inputSchema: z.object({
      name: z.string().min(1).max(120),
      description: z.string().max(1000).optional(),
      when: z.string().min(1).describe("Trigger in plain language"),
      then: z.string().min(1).describe("Action in plain language"),
      aiManaged: z.boolean().optional(),
    }),
  }),

  propose_delegate: tool({
    description:
      "Propose delegating an objective to the workspace agent. The agent will run autonomously once confirmed.",
    inputSchema: z.object({
      objective: z.string().min(1).max(2000),
    }),
  }),

  propose_delegate_task: tool({
    description:
      "Propose decomposing work on ONE task across several agents and delegating it. Use this for orchestration: when the user wants multiple agents to work on a task, OR when they describe WORK (make a document, do an analysis, research X, compute totals) without naming agents — in that case auto-select the right agents from the team by their capabilities. Reference an existing task by `taskTitle`, or set `createTask` to make a new one. For each piece of work add an `assignments` entry with a clear per-agent `brief` (what THAT agent must do on this task), the `tool` it should use, and `agentName` if a specific agent was named (leave `agentName` empty to auto-select by capability). On confirmation each agent is assigned to the task, given its brief, and started. Confirmation required.",
    inputSchema: z.object({
      taskTitle: z
        .string()
        .optional()
        .describe("Exact title of an existing task to delegate work on"),
      createTask: z
        .object({
          title: z.string().min(1).max(200),
          description: z.string().max(2000).optional(),
          projectName: z.string().optional(),
          priority: priority.optional(),
          dueDate,
        })
        .optional()
        .describe("Create a new task to hold the work (when none exists yet)"),
      assignments: z
        .array(
          z.object({
            agentName: z
              .string()
              .optional()
              .describe(
                "Agent to do this piece (exact name). Leave empty to auto-select by capability.",
              ),
            tool: z
              .enum(["general", "research", "document", "report", "review"])
              .optional()
              .describe("Which real capability this piece needs"),
            brief: z
              .string()
              .min(1)
              .max(2000)
              .describe("Specific instructions for THIS agent on THIS task"),
            format: z
              .enum(["word", "excel", "pdf"])
              .optional()
              .describe(
                "For tool 'document': which file to produce. Use 'excel' for a " +
                  "table/spreadsheet, 'word' or 'pdf' for a text document. REQUIRED when the " +
                  "user asks for an Excel/table/spreadsheet.",
              ),
            documentSpec: z
              .string()
              .max(2000)
              .optional()
              .describe("For tool 'document': exactly what the document must contain"),
            researchQuery: z
              .string()
              .max(500)
              .optional()
              .describe("For tool 'research': what to search the web for"),
          }),
        )
        .min(1)
        .max(6),
    }),
  }),

  propose_create_document: tool({
    description:
      "Propose creating a REAL Word, Excel, or PDF document (uploaded to storage with a download link). Provide the content directly: `sections` for Word/PDF, `sheet` for Excel. Confirmation required.",
    inputSchema: z.object({
      format: z.enum(["word", "excel", "pdf"]),
      title: z.string().min(1).max(160),
      sections: z
        .array(
          z.object({
            heading: z.string().optional(),
            paragraphs: z.array(z.string()).optional(),
            bullets: z.array(z.string()).optional(),
          }),
        )
        .optional(),
      sheet: z
        .object({
          columns: z.array(z.string()),
          rows: z.array(z.array(z.union([z.string(), z.number()]))),
        })
        .optional(),
      taskTitle: z
        .string()
        .optional()
        .describe("Attach to this existing task, if any"),
    }),
  }),

  propose_report: tool({
    description:
      "Propose compiling a report from real workspace data. Optionally export Excel. Confirmation required.",
    inputSchema: z.object({
      title: z.string().max(160).optional(),
      format: z.enum(["markdown", "excel"]).optional(),
    }),
  }),

  propose_review: tool({
    description:
      "Propose reviewing an existing task and recording an approve / changes-requested verdict on it. Confirmation required.",
    inputSchema: z.object({
      taskTitle: z.string().min(1).describe("Exact title of an existing task"),
      criteria: z.string().max(2000).optional(),
    }),
  }),

  propose_test: tool({
    description:
      "Propose validating an existing task/spec against acceptance criteria (a checklist) and recording the outcome. Confirmation required.",
    inputSchema: z.object({
      taskTitle: z.string().min(1).describe("Exact title of an existing task"),
      criteria: z.string().max(2000).optional(),
    }),
  }),

  propose_send_email: tool({
    description:
      "Propose sending an email to a workspace member (human only — NOT to agents). " +
      "Resolve the recipient by @handle, name, or email from the snapshot. " +
      "The user must approve before anything is sent.",
    inputSchema: z.object({
      recipient: z
        .string()
        .min(1)
        .describe("@handle, name, or email of a workspace member"),
      subject: z.string().min(1).max(200),
      body: z
        .string()
        .min(1)
        .max(8000)
        .describe("Email body in Markdown or plain text"),
      linkUrl: z
        .string()
        .url()
        .optional()
        .describe("Optional link to append at the end of the email"),
      linkLabel: z.string().max(120).optional(),
    }),
  }),
};

/** A single read tool for looking up tasks not present in the snapshot. */
export function readTools(organizationId: string) {
  return {
    search_tasks: tool({
      description:
        "Search tasks in the workspace by a keyword in the title. Use only if the task you need isn't already in the snapshot.",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ query, limit }) => {
        const tasks = await prisma.task.findMany({
          where: {
            project: { organizationId },
            title: { contains: query, mode: "insensitive" },
          },
          select: {
            title: true,
            status: true,
            priority: true,
            project: { select: { name: true } },
          },
          take: limit,
        });
        return tasks.map((t) => ({
          title: t.title,
          status: t.status,
          priority: t.priority,
          project: t.project.name,
        }));
      },
    }),
  };
}
