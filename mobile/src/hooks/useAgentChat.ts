import { useCallback, useRef, useState } from "react";
import { apiFetch } from "../apiFetch";
import { API_URL, getSessionCookie } from "../auth";
import type { Locale } from "../strings";

export type ChatRole = "user" | "assistant";

export type ChatTurn = {
  id: string;
  messageId?: string;
  role: ChatRole;
  content: string;
  streaming?: boolean;
};

type Options = {
  organizationId: string | null;
  agentId: string | null;
  locale?: Locale;
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Mobile agent chat — streams NDJSON from `/api/ai/chat` with session cookies. */
export function useAgentChat({ organizationId, agentId, locale }: Options) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  const hydrate = useCallback(
    (data: {
      threadId: string | null;
      messages: { id: string; role: ChatRole; content: string }[];
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

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || !organizationId || !agentId || isStreaming) return;
      hydratedRef.current = true;

      const userTurn: ChatTurn = {
        id: uid(),
        role: "user",
        content,
      };
      const assistantId = uid();
      setMessages((prev) => [
        ...prev,
        userTurn,
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ]);
      setIsStreaming(true);
      setError(null);

      const patchAssistant = (fn: (t: ChatTurn) => ChatTurn) =>
        setMessages((prev) => prev.map((t) => (t.id === assistantId ? fn(t) : t)));

      try {
        const cookie = getSessionCookie();
        const res = await apiFetch(`${API_URL}/api/ai/chat`, {
          timeoutMs: 120_000,
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body: JSON.stringify({
            organizationId,
            agentId,
            threadId: threadIdRef.current ?? undefined,
            message: content,
            locale: locale ?? undefined,
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }

        const body = res.body;
        if (!body?.getReader) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
            content?: string;
          } | null;
          if (data?.error) throw new Error(data.error);
          patchAssistant((t) => ({
            ...t,
            streaming: false,
            content: data?.content ?? (t.content || "(no response)"),
          }));
          return;
        }

        const reader = body.getReader();
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
                patchAssistant((t) => ({
                  ...t,
                  content: t.content + (evt.v as string),
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
                if (typeof evt.threadId === "string") {
                  threadIdRef.current = evt.threadId;
                }
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
    [organizationId, agentId, locale, isStreaming],
  );

  return { messages, send, isStreaming, error, hydrate, reset };
}
