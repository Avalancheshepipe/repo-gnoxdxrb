const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Fetch with an abort timeout so hung requests (e.g. blocked cleartext HTTP)
 * surface as errors instead of endless spinners.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { timeoutMs: _timeout, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (fetchInit.signal) {
    fetchInit.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    return await fetch(input, { ...fetchInit, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("NETWORK_TIMEOUT");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
