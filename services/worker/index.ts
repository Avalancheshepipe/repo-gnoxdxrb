import "dotenv/config";
import { Worker, type ConnectionOptions } from "bullmq";
import {
  processAutomationJob,
  type AutomationJob,
} from "@/server/automations/process";
import { executeAgentRun } from "@/server/ai/run";
import { processEmailJob } from "@/server/mail/send";
import { prisma } from "@/server/db";
import { scheduleAutomation } from "@/server/queue/enqueue";
import { automationQueue, QUEUE_NAMES } from "@/server/queue/queue";
import { createRedisConnection } from "@/server/redis";
import type { AgentRunJob, EmailJob } from "@/server/queue/enqueue";

const redisConn = createRedisConnection();
const connection = redisConn as unknown as ConnectionOptions;

const agentWorker = new Worker<AgentRunJob>(
  QUEUE_NAMES.agentRun,
  async (job) => {
    if (job.name === "run") {
      console.log(`[worker] executing agent run ${job.data.runId}`);
      await executeAgentRun(job.data.runId);
    }
  },
  { connection, concurrency: 2 },
);

const automationWorker = new Worker<AutomationJob>(
  QUEUE_NAMES.automation,
  async (job) => {
    console.log(`[worker] automation job: ${job.data.type}`);
    await processAutomationJob(job.data);
  },
  { connection, concurrency: 1 },
);

const emailWorker = new Worker<EmailJob>(
  QUEUE_NAMES.email,
  async (job) => {
    console.log(`[worker] email → ${job.data.to} (${job.data.template})`);
    await processEmailJob(job.data);
  },
  { connection, concurrency: 3 },
);

agentWorker.on("failed", (job, err) =>
  console.error(`[worker] run ${job?.id} failed:`, err?.message),
);
automationWorker.on("failed", (job, err) =>
  console.error(`[worker] automation ${job?.id} failed:`, err?.message),
);
emailWorker.on("failed", (job, err) =>
  console.error(`[worker] email ${job?.id} failed:`, err?.message),
);

async function scheduleRepeatableJobs() {
  // Deadline scan every 30 minutes. jobId keeps a single repeatable instance.
  await automationQueue().add(
    "deadline-scan",
    { type: "deadline-scan" },
    {
      repeat: { every: 30 * 60 * 1000 },
      jobId: "deadline-scan",
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );
  // Reset per-automation runsToday counters daily.
  await automationQueue().add(
    "reset-daily-counters",
    { type: "reset-daily-counters" },
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      jobId: "reset-daily-counters",
      removeOnComplete: true,
      removeOnFail: 10,
    },
  );
}

/** Re-create BullMQ schedules for every enabled scheduled automation. */
async function rescheduleAllAutomations() {
  const automations = await prisma.automation.findMany({
    select: { id: true, trigger: true, enabled: true },
  });
  for (const automation of automations) {
    await scheduleAutomation(automation).catch((err) =>
      console.error(`[worker] failed to schedule automation ${automation.id}`, err),
    );
  }
}

async function main() {
  await scheduleRepeatableJobs();
  await rescheduleAllAutomations();
  console.log("Julow worker started: agent runs + automations + email + deadlines.");
}

void main();

async function shutdown() {
  console.log("[worker] shutting down...");
  await Promise.all([agentWorker.close(), automationWorker.close(), emailWorker.close()]);
  await redisConn.quit();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
