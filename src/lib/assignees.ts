// Shared (client-safe) helpers to map between assignee TOKENS (the @handles /
// names the agent emits, or that a human types) and real user/agent ids. Used
// by the chat proposal executor and the proposal edit dialog so both resolve
// assignees identically.

import { handleFromAgentName, handleFromEmail } from "@/lib/mentions";

export type AssigneeAgent = { id: string; name: string };
export type AssigneeMember = {
  user: { id: string; name: string | null; email: string };
};
export type AssigneeUser = { id: string; name?: string | null; email: string };

export type AssigneeResolveCtx = {
  agents: AssigneeAgent[];
  members: AssigneeMember[];
  user: AssigneeUser | null;
};

export type ResolvedAssignees = {
  userIds: string[];
  agentIds: string[];
  unresolved: string[];
};

/**
 * Resolve assignee tokens (e.g. "@anna", "Docs", "me"/"я") into real user +
 * agent ids. The current user's handle, name, and the literal "me"/"я" all map
 * to the current user.
 */
export function resolveAssigneeTokens(
  tokens: string[] | undefined,
  ctx: AssigneeResolveCtx,
): ResolvedAssignees {
  const userIds = new Set<string>();
  const agentIds = new Set<string>();
  const unresolved: string[] = [];
  const { agents, members, user } = ctx;

  for (const rawToken of tokens ?? []) {
    const token = rawToken.trim().replace(/^@+/, "").toLowerCase();
    if (!token) continue;

    if (
      user &&
      (token === "me" ||
        token === "я" ||
        token === "мне" ||
        token === "self" ||
        token === handleFromEmail(user.email).toLowerCase() ||
        token === (user.name ?? "").toLowerCase())
    ) {
      userIds.add(user.id);
      continue;
    }

    const agent = agents.find(
      (a) =>
        handleFromAgentName(a.name).toLowerCase() === token ||
        a.name.toLowerCase() === token,
    );
    if (agent) {
      agentIds.add(agent.id);
      continue;
    }

    const member = members.find(
      (m) =>
        handleFromEmail(m.user.email).toLowerCase() === token ||
        (m.user.name ?? "").toLowerCase() === token ||
        (m.user.email.split("@")[0] ?? "").toLowerCase() === token,
    );
    if (member) {
      userIds.add(member.user.id);
      continue;
    }

    unresolved.push(rawToken);
  }

  return {
    userIds: [...userIds],
    agentIds: [...agentIds],
    unresolved,
  };
}

/**
 * Inverse of resolveAssigneeTokens: turn selected user/agent ids back into
 * @handle tokens, so an edited assignee set round-trips through the same
 * proposal `assignees` field the executor understands.
 */
export function assigneeIdsToTokens(
  ids: { userIds: string[]; agentIds: string[] },
  ctx: { agents: AssigneeAgent[]; members: AssigneeMember[] },
): string[] {
  const tokens: string[] = [];
  for (const userId of ids.userIds) {
    const m = ctx.members.find((mm) => mm.user.id === userId);
    if (m) tokens.push(`@${handleFromEmail(m.user.email)}`);
  }
  for (const agentId of ids.agentIds) {
    const a = ctx.agents.find((aa) => aa.id === agentId);
    if (a) tokens.push(`@${handleFromAgentName(a.name)}`);
  }
  return tokens;
}
