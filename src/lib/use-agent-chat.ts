"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentProposal, ProposalKind } from "@/lib/agent-proposals";

export type ChatRole = "user" | "assistant";

export type ChatTurn = {
  id: string;
  /** Server message id (assistant turns, once persisted). */
  messageId?: string;
  role: ChatRole;
  content: string;
  reasoning?: string;
  proposals: AgentProposal[];
  streaming?: boolean;
};

type Options = {
  organizationId: string | null;
  agentId: string | null;
  projectId?: string | null;
  /** When set, the conversation is scoped to a single task. */
  taskId?: string | null;
  locale?: "ru" | "en";
};

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function useAgentChat({
  organizationId,
  agentId,
  projectId,
  taskId,
  locale,
}: Options) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  /** Seed from persisted history (call reset() before switching agents). */
  const hydrate = useCallback(
    (data: {
      threadId: string | null;
      messages: {
        id: string;
        role: ChatRole;
        content: string;
        proposals: {
          id: string;
          kind: string;
          args: unknown;
          status?: string;
          note?: string;
          taskId?: string;
          projectId?: string;
        }[];
      }[];
    }) => {
      if (hydratedRef.current) return;
      hydratedRef.current = true;
      threadIdRef.current = data.threadId;
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          messageId: m.id,
          role: m.role,
          content: m.content,
          proposals: m.proposals.map((p) => ({
            id: p.id,
            kind: p.kind as ProposalKind,
            args: p.args,
            status: (p.status as AgentProposal["status"]) ?? "pending",
            note: p.note,
            taskId: p.taskId,
            projectId: p.projectId,
          })) as AgentProposal[],
        })),
      );
    },
    [],
  );

  const reset = useCallback(() => {
    hydratedRef.current = false;
    threadIdRef.current = null;
    setMessages([]);
    setIsStreaming(false);
    setError(null);
  }, []);

  const setProposalStatus = useCallback(
    (
      turnId: string,
      proposalId: string,
      status: AgentProposal["status"],
      note?: string,
      taskId?: string,
      projectId?: string,
    ) => {
      setMessages((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                proposals: t.proposals.map((p) =>
                  p.id === proposalId
                    ? ({
                        ...p,
                        status,
                        note,
                        taskId: taskId ?? p.taskId,
                        projectId: projectId ?? p.projectId,
                      } as AgentProposal)
                    : p,
                ),
              }
            : t,
        ),
      );
    },
    [],
  );

  /** Replace a pending proposal's args (used by the edit-before-approve modal). */
  const updateProposalArgs = useCallback(
    (turnId: string, proposalId: string, args: AgentProposal["args"]) => {
      setMessages((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                proposals: t.proposals.map((p) =>
                  p.id === proposalId ? ({ ...p, args } as AgentProposal) : p,
                ),
              }
            : t,
        ),
      );
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || !organizationId || !agentId || isStreaming) return;
      // Don't let a late history load clobber an active conversation.
      hydratedRef.current = true;

      const userTurn: ChatTurn = {
        id: uid(),
        role: "user",
        content,
        proposals: [],
      };
      const assistantId = uid();
      setMessages((prev) => [
        ...prev,
        userTurn,
        { id: assistantId, role: "assistant", content: "", proposals: [], streaming: true },
      ]);
      setIsStreaming(true);
      setError(null);

      const patchAssistant = (fn: (t: ChatTurn) => ChatTurn) =>
        setMessages((prev) => prev.map((t) => (t.id === assistantId ? fn(t) : t)));

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId,
            agentId,
            projectId: projectId ?? undefined,
            taskId: taskId ?? undefined,
            threadId: threadIdRef.current ?? undefined,
            message: content,
            locale: locale ?? undefined,
          }),
        });

        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let evt: Record<string, unknown>;
            try {
              evt = JSON.parse(line);
            } catch {
              continue;
            }
            switch (evt.t) {
              case "text":
                patchAssistant((t) => ({ ...t, content: t.content + (evt.v as string) }));
                break;
              case "reasoning":
                patchAssistant((t) => ({
                  ...t,
                  reasoning: (t.reasoning ?? "") + (evt.v as string),
                }));
                break;
              case "proposal":
                patchAssistant((t) => ({
                  ...t,
                  proposals: [
                    ...t.proposals,
                    {
                      id: evt.id as string,
                      kind: evt.kind as ProposalKind,
                      args: evt.args,
                      status: "pending",
                    } as AgentProposal,
                  ],
                }));
                break;
              case "error":
                setError(evt.v as string);
                patchAssistant((t) => ({
                  ...t,
                  content: t.content || `_${evt.v as string}_`,
                }));
                break;
              case "done":
                if (typeof evt.threadId === "string") threadIdRef.current = evt.threadId;
                patchAssistant((t) => ({
                  ...t,
                  streaming: false,
                  messageId: (evt.messageId as string) ?? t.messageId,
                }));
                break;
              default:
                break;
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to reach agent";
        setError(msg);
        patchAssistant((t) => ({
          ...t,
          streaming: false,
          content: t.content || `_${msg}_`,
        }));
      } finally {
        setIsStreaming(false);
        patchAssistant((t) => ({ ...t, streaming: false }));
      }
    },
    [organizationId, agentId, projectId, taskId, locale, isStreaming],
  );

  return {
    messages,
    send,
    isStreaming,
    error,
    hydrate,
    reset,
    setProposalStatus,
    updateProposalArgs,
    threadId: threadIdRef,
  };
}
