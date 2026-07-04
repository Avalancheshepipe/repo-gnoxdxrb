/**
 * Budget-friendly web research tool.
 *
 * Runs a single free DuckDuckGo HTML search (no API key, no extra deps),
 * regex-extracts the top results, then produces ONE cheap LLM summary with a
 * capped token budget. It is deliberately frugal: results are capped, there is
 * exactly one search and at most one LLM call, no loops and no retries. It
 * never throws — on any failure it degrades to returning the raw sources (or
 * an empty set with a short note).
 */
import { generateText } from "ai";
import { chatModel } from "@/server/ai/gateway";
import { env } from "@/server/env";

export type ResearchSource = { title: string; url: string; snippet: string };
export type ResearchResult = {
  query: string;
  summary: string;
  sources: ResearchSource[];
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function fromCodePointSafe(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function decodeEntities(input: string): string {
  // Decode &amp; LAST so sequences like "&amp;lt;" are not double-decoded.
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) =>
      fromCodePointSafe(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m, dec: string) =>
      fromCodePointSafe(parseInt(dec, 10)),
    )
    .replace(/&amp;/g, "&");
}

function cleanText(input: string, maxLen = Infinity): string {
  const text = decodeEntities(input.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen).trim() : text;
}

function resolveHref(href: string): string {
  // DDG wraps the real target URL in a redirect carrying it in `uddg`.
  const uddg = href.match(/[?&]uddg=([^&]+)/);
  if (uddg) {
    try {
      return decodeURIComponent(uddg[1]);
    } catch {
      // fall through and use the raw href
    }
  }
  return href.startsWith("//") ? `https:${href}` : href;
}

export async function runWebResearch(input: {
  query: string;
  maxResults?: number;
  model?: string;
}): Promise<ResearchResult> {
  const query = input.query.trim();
  const maxResults = clamp(input.maxResults ?? env.RESEARCH_MAX_RESULTS ?? 5, 1, 8);

  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: controller.signal,
        },
      );
      html = await res.text();
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return {
      query,
      summary: `Web search was temporarily unavailable for: ${query}`,
      sources: [],
    };
  }

  const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets: string[] = [];
  for (let m = snippetRe.exec(html); m !== null; m = snippetRe.exec(html)) {
    snippets.push(cleanText(m[1], 300));
  }

  const anchorRe =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const sources: ResearchSource[] = [];
  let i = 0;
  for (
    let m = anchorRe.exec(html);
    m !== null && sources.length < maxResults;
    m = anchorRe.exec(html)
  ) {
    const url = resolveHref(m[1]);
    const title = cleanText(m[2]);
    const snippet = snippets[i] ?? "";
    i += 1;
    if (title && url) sources.push({ title, url, snippet });
  }

  if (sources.length === 0) {
    return { query, summary: `No web results found for: ${query}`, sources: [] };
  }

  const numbered = sources
    .map(
      (s, idx) =>
        `[${idx + 1}] ${s.title} — ${s.url}${s.snippet ? ` — ${s.snippet}` : ""}`,
    )
    .join("\n");

  try {
    const result = await generateText({
      model: chatModel(input.model ?? env.AI_GATEWAY_RESEARCH_MODEL),
      system:
        "You are a concise research assistant. Using ONLY the provided sources, " +
        "write a tight, factual summary in the SAME language as the user's query. " +
        "Cite sources inline as [n] matching the numbered list. Do not invent " +
        "facts or sources, and keep it brief.",
      prompt: `Query: ${query}\n\nSources:\n${numbered}\n\nWrite the summary now.`,
      maxOutputTokens: 600,
    });
    return { query, summary: result.text.trim(), sources };
  } catch {
    // Still return real value: a plain list of the sources we found.
    const listed = sources
      .map((s, idx) => `[${idx + 1}] ${s.title} — ${s.url}`)
      .join("\n");
    return {
      query,
      summary: `Summary unavailable; found ${sources.length} source(s):\n${listed}`,
      sources,
    };
  }
}
