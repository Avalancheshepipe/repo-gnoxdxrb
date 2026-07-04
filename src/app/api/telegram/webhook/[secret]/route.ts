import { webhookCallback } from "grammy";
import { env } from "@/server/env";
import { getBot } from "@/server/telegram/bot";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/telegram/webhook/[secret]">,
) {
  const { secret } = await ctx.params;
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const handle = webhookCallback(getBot(), "std/http");
    return await handle(req);
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return new Response("error", { status: 500 });
  }
}
