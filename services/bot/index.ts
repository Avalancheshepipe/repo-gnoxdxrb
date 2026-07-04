import "dotenv/config";
import { getBot } from "@/server/telegram/bot";

// Dev / self-hosted long-polling mode. In production behind Caddy, prefer the
// webhook route at /api/telegram/webhook/<secret> instead of polling.
const bot = getBot();

void bot.start({
  onStart: (info) => console.log(`Julow Telegram bot @${info.username} started (long polling).`),
});

async function shutdown() {
  await bot.stop();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
