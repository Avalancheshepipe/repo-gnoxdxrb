import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Only resolve optional connection URLs when they are actually set, because
// `env()` throws if the variable is missing/empty.
const datasource = {
  url: env("DATABASE_URL"),
  ...(process.env.DIRECT_DATABASE_URL
    ? { directUrl: env("DIRECT_DATABASE_URL") }
    : {}),
  ...(process.env.SHADOW_DATABASE_URL
    ? { shadowDatabaseUrl: env("SHADOW_DATABASE_URL") }
    : {}),
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource,
});
