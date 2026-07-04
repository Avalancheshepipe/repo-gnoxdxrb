import type { Locale } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

export type AgentProfileKey =
  | "orchestrator"
  | "research"
  | "docs"
  | "copy"
  | "code";

const NAME_TO_KEY: Record<string, AgentProfileKey> = {
  orchestrator: "orchestrator",
  "research agent": "research",
  "docs agent": "docs",
  "copy agent": "copy",
  "code agent": "code",
};

export function agentProfileKey(name: string): AgentProfileKey | null {
  return NAME_TO_KEY[name.trim().toLowerCase()] ?? null;
}

export function agentProfileText(
  name: string,
  locale: Locale,
  fallback?: { role?: string; responsibility?: string },
): { role: string; description: string } {
  const key = agentProfileKey(name);
  if (key) {
    return {
      role: translate(locale, `agents.profile.${key}.role`),
      description: translate(locale, `agents.profile.${key}.description`),
    };
  }
  return {
    role: fallback?.role ?? "",
    description: fallback?.responsibility ?? "",
  };
}

/** Keep one agent per name (first created wins). */
export function dedupeAgentsByName<T extends { id: string; name: string }>(
  agents: T[],
): T[] {
  const byName = new Map<string, T>();
  for (const agent of agents) {
    const key = agent.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, agent);
  }
  return Array.from(byName.values());
}
