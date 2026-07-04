// Rough USD cost estimation for budget tracking. Prices are per 1M tokens and
// can drift; treat as an estimate for in-app spend caps, not billing truth.
const PRICES_PER_MILLION: Record<string, { input: number; output: number }> = {
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "openai/gpt-4o": { input: 2.5, output: 10 },
  "openai/gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "anthropic/claude-3.5-sonnet": { input: 3, output: 15 },
  "anthropic/claude-3.5-haiku": { input: 0.8, output: 4 },
  "google/gemini-2.0-flash-001": { input: 0.1, output: 0.4 },
  "meta-llama/llama-3.3-70b-instruct": { input: 0.12, output: 0.3 },
};

const DEFAULT_PRICE = { input: 0.5, output: 1.5 };

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = PRICES_PER_MILLION[model] ?? DEFAULT_PRICE;
  const cost =
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output;
  // round to 6 decimals to match the Decimal(12,6) column
  return Math.round(cost * 1_000_000) / 1_000_000;
}
