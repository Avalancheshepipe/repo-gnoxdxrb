import { parseTrigger } from "@/server/automations/spec";
import type { EmailJobPayload } from "@/server/mail/types";
import { agentRunQueue, automationQueue, emailQueue } from "@/server/queue/queue";

export type AgentRunJob = { runId: string };

export type EmailJob = EmailJobPayload & { logId: string };

export async function enqueueEmail(payload: EmailJob): Promise<void> {
  await emailQueue().add(
    "send",
    payload,
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: 500,
      removeOnFail: 500,
    },
  );
}

export async function enqueueAgentRun(runId: string): Promise<void> {
  await agentRunQueue().add(
    "run",
    { runId } satisfies AgentRunJob,
    {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  );
}

export async function enqueueAutomation(automationId: string): Promise<void> {
  await automationQueue().add(
    "run-automation",
    { type: "run-automation", automationId },
    { removeOnComplete: 100, removeOnFail: 200 },
  );
}

const schedKey = (id: string) => `auto:${id}`;
const onceKey = (id: string) => `auto-once:${id}`;

/**
 * (Re)schedule an automation's BullMQ job from its trigger. Recurring triggers
 * become repeatable job schedulers; one-time date/time triggers become delayed
 * jobs. Disabled automations (or event/custom triggers) are unscheduled.
 * Idempotent — safe to call on every create/update/toggle.
 */
export async function scheduleAutomation(automation: {
  id: string;
  trigger: unknown;
  enabled: boolean;
}): Promise<void> {
  const q = automationQueue();
  await unscheduleAutomation(automation.id);
  if (!automation.enabled) return;

  const trigger = parseTrigger(automation.trigger);
  if (trigger.type === "recurring") {
    const every = Math.max(1, trigger.everyMinutes) * 60_000;
    await q.upsertJobScheduler(
      schedKey(automation.id),
      { every },
      {
        name: "run-automation",
        data: { type: "run-automation", automationId: automation.id },
      },
    );
  } else if (trigger.type === "schedule") {
    const delay = new Date(trigger.runAt).getTime() - Date.now();
    if (Number.isFinite(delay) && delay > 0) {
      await q.add(
        "run-automation",
        { type: "run-automation", automationId: automation.id },
        { jobId: onceKey(automation.id), delay, removeOnComplete: true, removeOnFail: 50 },
      );
    }
  }
}

export async function unscheduleAutomation(automationId: string): Promise<void> {
  const q = automationQueue();
  await q.removeJobScheduler(schedKey(automationId)).catch(() => {});
  await q.remove(onceKey(automationId)).catch(() => {});
}

export type TaskEvent = {
  event: "created" | "status";
  organizationId: string;
  taskId: string;
  status?: string;
};

/** Emit a task lifecycle event so matching event-triggered automations run. */
export async function emitTaskEvent(evt: TaskEvent): Promise<void> {
  try {
    await automationQueue().add(
      "task-event",
      { type: "task-event", ...evt },
      { removeOnComplete: 200, removeOnFail: 200 },
    );
  } catch (err) {
    // A queue hiccup must never fail the originating task mutation.
    console.error("[emitTaskEvent] failed", err);
  }
}
