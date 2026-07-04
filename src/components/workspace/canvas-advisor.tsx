"use client";

import {
  ArrowUp02Icon,
  Cancel01Icon,
  Loading03Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/trpc";
import { useAgentChat } from "@/lib/use-agent-chat";

/**
 * Canvas-scoped AI advisor. Reuses the agent chat infra (Orchestrator) but
 * scopes context to THIS project/canvas via projectId, plus a one-tap
 * "suggestions" call. RU/EN follows the active locale.
 */
export function CanvasAdvisor({
  organizationId,
  projectId,
  onClose,
}: {
  organizationId: string | null;
  projectId: string;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);

  const agentsQuery = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: Boolean(organizationId), staleTime: 60_000 },
  );
  const orchestrator = useMemo(() => {
    const list = agentsQuery.data ?? [];
    return (
      list.find((a) => a.name.toLowerCase().includes("orchestr")) ??
      list[0] ??
      null
    );
  }, [agentsQuery.data]);

  const chat = useAgentChat({
    organizationId,
    agentId: orchestrator?.id ?? null,
    projectId,
    locale,
  });

  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const suggest = api.canvas.suggest.useMutation({
    onSuccess: (r) => setSuggestions(r.suggestions ?? []),
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages, suggestions]);

  const ask = () => {
    const text = draft.trim();
    if (!text || !orchestrator || chat.isStreaming) return;
    chat.send(text);
    setDraft("");
  };

  const sendSuggestion = (text: string) => {
    if (!orchestrator || chat.isStreaming) return;
    chat.send(text);
    setSuggestions([]);
  };

  return (
    <aside className="julow-canvas-advisor glass-panel flex h-full w-[320px] shrink-0 flex-col overflow-hidden border-l border-julow-glass-border">
      <header className="flex items-center justify-between gap-2 border-b border-julow-glass-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Icon icon={SparklesIcon} size={16} className="text-accent" />
          <span className="text-sm font-medium">{t("canvas.advisor.title")}</span>
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={t("common.cancel")}
          onPress={onClose}
        >
          <Icon icon={Cancel01Icon} size={15} />
        </Button>
      </header>

      <div
        ref={scrollRef}
        className="workspace-scroll flex-1 space-y-3 overflow-y-auto px-3 py-3"
      >
        <div className="glass-panel-subtle rounded-xl px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-julow-muted">
              {t("canvas.advisor.suggestions")}
            </p>
            <div className="flex items-center gap-0.5">
              {suggestions.length > 0 && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={t("common.cancel")}
                  onPress={() => setSuggestions([])}
                >
                  <Icon icon={Cancel01Icon} size={13} />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                isDisabled={suggest.isPending}
                onPress={() => suggest.mutate({ projectId, locale })}
              >
                <Icon
                  icon={suggest.isPending ? Loading03Icon : SparklesIcon}
                  size={13}
                  className={suggest.isPending ? "animate-spin" : undefined}
                />
                {t("canvas.advisor.suggest")}
              </Button>
            </div>
          </div>
          {suggestions.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => sendSuggestion(s)}
                    disabled={!orchestrator || chat.isStreaming}
                    className="flex w-full gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-xs leading-relaxed transition-colors hover:bg-julow-glass-border/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="shrink-0 text-accent">•</span>
                    <span>{s}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[11px] leading-relaxed text-julow-muted">
              {t("canvas.advisor.suggestHint")}
            </p>
          )}
        </div>

        {chat.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent text-accent-foreground"
                  : "glass-panel-subtle w-full"
              }`}
            >
              {msg.role === "assistant" ? (
                msg.content ? (
                  <div className="julow-streamdown">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                ) : (
                  <span className="text-julow-muted">…</span>
                )
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-julow-glass-border p-2.5">
        <div className="julow-chat-composer">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            rows={1}
            placeholder={
              orchestrator ? t("canvas.advisor.ask") : t("chat.connecting")
            }
            className="julow-chat-composer__input resize-none"
          />
          <Button
            isIconOnly
            size="sm"
            variant="primary"
            aria-label={t("canvas.advisor.ask")}
            isDisabled={!draft.trim() || chat.isStreaming || !orchestrator}
            onPress={ask}
            className="julow-chat-composer__send"
          >
            <Icon icon={ArrowUp02Icon} size={15} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
