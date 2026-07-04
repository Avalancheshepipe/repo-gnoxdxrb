import { createGateway } from "@ai-sdk/gateway";
import { env } from "@/server/env";

/** OpenAI-compatible chat completions endpoint (voice transcribe, health checks). */
export const AI_GATEWAY_CHAT_URL =
  "https://ai-gateway.vercel.sh/v1/chat/completions";

/** Throws with a user-facing message when Vercel AI Gateway is not configured. */
export function assertAiGatewayConfigured(): void {
  if (!env.AI_GATEWAY_API_KEY.trim()) {
    throw new Error(
      "AI_GATEWAY_API_KEY is not configured. Add it to .env to enable AI chat and flow generation.",
    );
  }
}

const gatewayProvider = createGateway({
  apiKey: env.AI_GATEWAY_API_KEY,
});

/** Resolve a chat model via Vercel AI Gateway. Falls back to the budget default. */
export function chatModel(modelId?: string) {
  return gatewayProvider(modelId || env.AI_GATEWAY_DEFAULT_MODEL);
}
