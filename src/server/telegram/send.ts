import { env } from "@/server/env";

/** Send a message via the Telegram Bot API. No-op when no token is configured. */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );
    const data = (await res.json()) as { ok: boolean; description?: string };
    return { ok: data.ok, error: data.description };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "failed" };
  }
}

/** Notify all connected Telegram channels of a workspace. */
export async function notifyOrganizationTelegram(
  integrations: { config: unknown }[],
  text: string,
): Promise<void> {
  for (const integ of integrations) {
    const chatId = (integ.config as { chatId?: string } | null)?.chatId;
    if (chatId) await sendTelegramMessage(String(chatId), text);
  }
}
