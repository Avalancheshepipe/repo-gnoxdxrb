import { Queue, type ConnectionOptions } from "bullmq";
import { redis } from "@/server/redis";

export const QUEUE_NAMES = {
  agentRun: "julow-agent-run",
  automation: "julow-automation",
  email: "julow-email",
} as const;

// BullMQ accepts an existing ioredis instance at runtime, but its bundled types
// expect its own Redis identity, so we cast.
const connection = redis as unknown as ConnectionOptions;

// Lazy singletons so simply importing this module (e.g. from a tRPC router)
// does not open a Redis connection until a job is actually enqueued.
let agentRunQueueRef: Queue | undefined;
let automationQueueRef: Queue | undefined;
let emailQueueRef: Queue | undefined;

export function agentRunQueue(): Queue {
  agentRunQueueRef ??= new Queue(QUEUE_NAMES.agentRun, { connection });
  return agentRunQueueRef;
}

export function automationQueue(): Queue {
  automationQueueRef ??= new Queue(QUEUE_NAMES.automation, { connection });
  return automationQueueRef;
}

export function emailQueue(): Queue {
  emailQueueRef ??= new Queue(QUEUE_NAMES.email, { connection });
  return emailQueueRef;
}
