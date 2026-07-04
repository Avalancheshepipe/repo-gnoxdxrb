import "dotenv/config";
import {
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { createRedisConnection } from "@/server/redis";
import { s3 } from "@/server/s3";

type Check = { name: string; run: () => Promise<string> };

const checks: Check[] = [
  {
    name: "PostgreSQL",
    run: async () => {
      await prisma.$queryRaw`SELECT 1`;
      const tasks = await prisma.task.count();
      return `connected · ${tasks} tasks`;
    },
  },
  {
    name: "Redis",
    run: async () => {
      const redis = createRedisConnection();
      const pong = await redis.ping();
      await redis.quit();
      return pong;
    },
  },
  {
    name: "Vercel AI Gateway",
    run: async () => {
      if (!env.AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY not set");
      const { AI_GATEWAY_CHAT_URL } = await import("@/server/ai/gateway");
      const res = await fetch(AI_GATEWAY_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.AI_GATEWAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.AI_GATEWAY_DEFAULT_MODEL,
          messages: [{ role: "user", content: "Reply with the word ok." }],
          max_tokens: 16,
        }),
      });
      const data = (await res.json()) as {
        error?: { message?: string };
        choices?: { message?: { content?: string } }[];
      };
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      const reply = data.choices?.[0]?.message?.content?.trim() ?? "(empty)";
      return `${env.AI_GATEWAY_DEFAULT_MODEL} → "${reply}"`;
    },
  },
  {
    name: "S3 (Beget)",
    run: async () => {
      if (!env.S3_ACCESS_KEY_ID) throw new Error("S3 credentials not set");
      const key = `health/${Date.now()}.txt`;
      await s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: "ok",
          ContentType: "text/plain",
        }),
      );
      await s3.send(
        new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
      );
      return `read/write ok · bucket ${env.S3_BUCKET}`;
    },
  },
  {
    name: "Telegram",
    run: async () => {
      if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not set");
      const res = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`,
      );
      const data = (await res.json()) as {
        ok: boolean;
        description?: string;
        result?: { username?: string };
      };
      if (!data.ok) throw new Error(data.description ?? "getMe failed");
      return `@${data.result?.username ?? "unknown"}`;
    },
  },
];

async function main() {
  console.log("Checking Julow services...\n");
  let failures = 0;
  for (const check of checks) {
    try {
      const info = await check.run();
      console.log(`  OK   ${check.name.padEnd(14)} ${info}`);
    } catch (err) {
      failures++;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  FAIL ${check.name.padEnd(14)} ${message}`);
    }
  }
  await prisma.$disconnect();
  console.log(
    failures === 0
      ? "\nAll services healthy."
      : `\n${failures} check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

void main();
