import { Redis } from "ioredis";
import { env } from "@/server/env";

// Shared Redis connections. BullMQ requires `maxRetriesPerRequest: null` on the
// connection it uses for blocking commands, so we expose a dedicated factory.
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/** Create a fresh connection (BullMQ workers need their own). */
export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export const REDIS_CHANNELS = {
  agentRun: (runId: string) => `julow:run:${runId}`,
  activity: (orgId: string) => `julow:activity:${orgId}`,
} as const;
