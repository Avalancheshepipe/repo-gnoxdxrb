"use client";

import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { AgentOrbAvatar } from "@/components/workspace/agent-avatar";
import {
  AgentMarkdown,
  ProposalCard,
  useInternalLinkClick,
  useProposalExecutor,
} from "@/components/workspace/agent-panel";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import {
  PROPOSAL_ACTION_TYPE,
  type AgentProposal,
  type ProposalArgsMap,
  type ProposalKind,
} from "@/lib/agent-proposals";
import { handleFromAgentName } from "@/lib/mentions";
import { api } from "@/lib/trpc";
import { useAgentChat } from "@/lib/use-agent-chat";
import type { InboxTask } from "@/lib/workspace-data";

type ThreadMessage = {
  key: string;
  role: "user" | "assistant";
  content: string;
  agentId: string | null;
  agentName: string | null;
  proposals: AgentProposal[];
  messageId?: string;
  streaming?: boolean;
  live?: boolean;
};

/**
 * The per-task conversation, shown at the bottom of the task detail panel.
 * Merges every assigned agent's messages into one timeline (filterable by
 * agent), lets the user @mention or click an agent to direct a message, and
 * persists through ChatThread/ChatMessage (scoped by taskId). Autonomous run
 * results posted back into these threads surface here too.
 */
export function TaskAgentChat({ task }: { task: InboxTask }) {
  const { t, locale } = useI18n();
  const { organizationId, activeProjectId, isLive, openTask } = useTaskWorkspace();
  const handleContentClick = useInternalLinkClick();
  const utils = api.useUtils();

  const agentsQuery = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: isLive, staleTime: 60_000 },
  );
  const allAgents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);

  const threadQuery = api.chat.taskThread.useQuery(
    { organizationId: organizationId ?? "", taskId: task.id },
    {
      enabled: isLive,
      refetchInterval: 5000,
      refetchOnWindowFocus: true,
    },
  );

  // Poll for autonomous runs working on this task, to show a live indicator.
  const runningQuery = api.agentRun.runningForTask.useQuery(
    { organizationId: organizationId ?? "", taskId: task.id },
    { enabled: isLive, refetchInterval: 4000 },
  );
  const runningAgents = runningQuery.data?.agents ?? [];
  const runningActive = (runningQuery.data?.active ?? 0) > 0;

  // The agents that can be talked to: the task's assigned agents, falling back
  // to the whole roster so a conversation can always be started.
  const taskAgents = useMemo(() => {
    const assigned = task.assigneeAgentIds
      .map((id) => allAgents.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
    if (assigned.length) return assigned;
    return allAgents;
  }, [task.assigneeAgentIds, allAgents]);

  const [filterAgentId, setFilterAgentId] = useState<string | null>(null);
  const [targetAgentId, setTargetAgentId] = useState<string | null>(null);
  useEffect(() => {
    setTargetAgentId(
      task.assigneeAgentIds[0] ??
        allAgents.find((a) => a.name.toLowerCase().includes("orchestrator"))?.id ??
        allAgents[0]?.id ??
        null,
    );
    setFilterAgentId(null);
  }, [task.id, task.assigneeAgentIds, allAgents]);
  const targetAgent = allAgents.find((a) => a.id === targetAgentId) ?? null;

  const chat = useAgentChat({
    organizationId,
    agentId: targetAgentId,
    projectId: activeProjectId,
    taskId: task.id,
    locale,
  });
  const executor = useProposalExecutor(targetAgentId);
  const resolveProposal = api.chat.resolveProposal.useMutation();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState("");
  const [mention, setMention] = useState<{ query: string; start: number } | null>(
    null,
  );
  const [mentionIndex, setMentionIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasStreamingRef = useRef(false);

  // A fresh streaming session belongs to one agent; reset it when the target
  // agent changes so its in-flight overlay doesn't bleed across agents.
  useEffect(() => {
    chat.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetAgentId, task.id]);

  // When a stream finishes, refetch the persisted thread, then clear the live
  // overlay (the dedupe below hides it as soon as the persisted copy lands).
  useEffect(() => {
    if (wasStreamingRef.current && !chat.isStreaming) {
      void utils.chat.taskThread
        .invalidate({ organizationId: organizationId ?? "", taskId: task.id })
        .then(() => chat.reset());
    }
    wasStreamingRef.current = chat.isStreaming;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.isStreaming]);

  const persisted = useMemo<ThreadMessage[]>(
    () =>
      (threadQuery.data?.messages ?? []).map((m) => ({
        key: m.id,
        messageId: m.id,
        role: m.role,
        content: m.content,
        agentId: m.agentId,
        agentName: m.agentName,
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
    [threadQuery.data],
  );

  // Live overlay: the in-flight turn(s) for the target agent. Hidden as soon as
  // the assistant's persisted copy (matched by messageId) shows up in the query.
  const persistedIds = useMemo(
    () => new Set(persisted.map((m) => m.messageId)),
    [persisted],
  );
  const liveAssistantId = chat.messages.find(
    (m) => m.role === "assistant",
  )?.messageId;
  const showOverlay =
    chat.messages.length > 0 &&
    !(liveAssistantId && persistedIds.has(liveAssistantId));
  const overlay: ThreadMessage[] = showOverlay
    ? chat.messages.map((m) => ({
        key: `live-${m.id}`,
        role: m.role,
        content: m.content,
        agentId: targetAgentId,
        agentName: targetAgent?.name ?? null,
        proposals: [],
        streaming: m.streaming,
        live: true,
      }))
    : [];

  const messages = useMemo(() => {
    const all = [...persisted, ...overlay];
    return filterAgentId
      ? all.filter((m) => m.agentId === filterAgentId)
      : all;
  }, [persisted, overlay, filterAgentId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, runningActive]);

  // When background runs finish, pull in their posted results right away.
  const wasRunningRef = useRef(false);
  useEffect(() => {
    if (wasRunningRef.current && !runningActive) {
      void utils.chat.taskThread.invalidate({
        organizationId: organizationId ?? "",
        taskId: task.id,
      });
    }
    wasRunningRef.current = runningActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningActive]);

  // Auto-approval: proposals whose action type is AUTO in the workspace
  // rules are executed without waiting for the user's click.
  const rulesQuery = api.approval.rules.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: isLive, staleTime: 30_000 },
  );
  const autoTypes = useMemo(
    () =>
      new Set(
        (rulesQuery.data ?? [])
          .filter((r) => r.level === "AUTO")
          .map((r) => r.actionType),
      ),
    [rulesQuery.data],
  );
  const autoHandledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (chat.isStreaming || autoTypes.size === 0) return;
    for (const msg of persisted) {
      for (const p of msg.proposals) {
        if (p.status !== "pending" || autoHandledRef.current.has(p.id)) continue;
        const actionType = PROPOSAL_ACTION_TYPE[p.kind];
        if (!actionType || !autoTypes.has(actionType)) continue;
        autoHandledRef.current.add(p.id);
        void accept(msg, p);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted, chat.isStreaming, autoTypes]);

  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return taskAgents
      .filter(
        (a) =>
          handleFromAgentName(a.name).toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [mention, taskAgents]);

  const live = isLive && Boolean(targetAgent);

  const submit = () => {
    const text = draft.trim();
    if (!text || !live || chat.isStreaming) return;
    chat.send(text);
    setDraft("");
    setMention(null);
  };

  const onDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDraft(value);
    const caret = e.target.selectionStart ?? value.length;
    const m = value.slice(0, caret).match(/(?:^|\s)@(\w*)$/);
    if (m) {
      setMention({ query: m[1] ?? "", start: caret - (m[1]?.length ?? 0) - 1 });
      setMentionIndex(0);
    } else {
      setMention(null);
    }
  };

  const selectMention = (agent: { id: string; name: string }) => {
    setTargetAgentId(agent.id);
    setFilterAgentId(null);
    const ta = textareaRef.current;
    const handle = handleFromAgentName(agent.name);
    if (!mention) {
      setMention(null);
      requestAnimationFrame(() => ta?.focus());
      return;
    }
    const caret = ta?.selectionStart ?? draft.length;
    const before = draft.slice(0, mention.start);
    const after = draft.slice(caret);
    const insert = `@${handle} `;
    setDraft(before + insert + after);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = (before + insert).length;
      ta?.focus();
      ta?.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + mentionMatches.length) % mentionMatches.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(mentionMatches[mentionIndex]!);
        return;
      }
      if (e.key === "Escape") {
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  async function accept(msg: ThreadMessage, p: AgentProposal) {
    setBusy((b) => ({ ...b, [p.id]: true }));
    const res = await executor.execute(p);
    const status = res.ok ? "accepted" : "failed";
    if (msg.messageId) {
      await resolveProposal
        .mutateAsync({
          messageId: msg.messageId,
          proposalId: p.id,
          status,
          note: res.note,
          taskId: res.taskId,
          projectId: res.projectId,
          args: p.args,
        })
        .catch(() => undefined);
    }
    await Promise.all([
      utils.chat.taskThread.invalidate({
        organizationId: organizationId ?? "",
        taskId: task.id,
      }),
      utils.task.list.invalidate(),
    ]);
    setBusy((b) => ({ ...b, [p.id]: false }));
  }

  async function acceptEdited(
    msg: ThreadMessage,
    p: AgentProposal,
    args: ProposalArgsMap["propose_create_task"],
  ) {
    await accept(msg, { ...p, args } as AgentProposal);
  }

  async function decline(msg: ThreadMessage, p: AgentProposal) {
    if (msg.messageId) {
      await resolveProposal
        .mutateAsync({
          messageId: msg.messageId,
          proposalId: p.id,
          status: "declined",
        })
        .catch(() => undefined);
    }
    await utils.chat.taskThread.invalidate({
      organizationId: organizationId ?? "",
      taskId: task.id,
    });
  }

  return (
    <div className="julow-task-chat">
      <div className="julow-task-chat__filters">
        <span className="julow-task-chat__filters-label">{t("taskChat.with")}</span>
        <div className="julow-task-chat__chips workspace-scroll">
          <button
            type="button"
            className={`julow-task-chat__chip ${filterAgentId === null ? "is-active" : ""}`}
            onClick={() => setFilterAgentId(null)}
          >
            {t("taskChat.all")}
          </button>
          {taskAgents.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`julow-task-chat__chip ${filterAgentId === a.id ? "is-active" : ""}`}
              onClick={() => {
                setFilterAgentId(a.id);
                setTargetAgentId(a.id);
              }}
            >
              <AgentOrbAvatar seed={a.name} size="sm" />
              <span className="truncate">{a.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="julow-task-chat__scroll workspace-scroll">
        {messages.length === 0 && (
          <p className="julow-task-chat__empty">{t("taskChat.intro")}</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.key}
            className={`julow-task-chat__msg ${
              msg.role === "user" ? "julow-task-chat__msg--user" : ""
            }`}
          >
            {msg.role === "assistant" ? (
              <div className="julow-task-chat__row">
                {msg.agentName && (
                  <AgentOrbAvatar seed={msg.agentName} size="sm" />
                )}
                <div className="min-w-0 flex-1">
                  {msg.agentName && (
                    <p className="julow-task-chat__author">{msg.agentName}</p>
                  )}
                  <div className="julow-task-chat__bubble">
                    {msg.content ? (
                      <AgentMarkdown
                        content={msg.content}
                        onContentClick={handleContentClick}
                      />
                    ) : msg.streaming ? (
                      <span className="julow-thinking" aria-label="Thinking">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : null}
                    {msg.proposals.map((p) => (
                      <ProposalCard
                        key={p.id}
                        proposal={p}
                        busy={Boolean(busy[p.id])}
                        onAccept={() => accept(msg, p)}
                        onDecline={() => decline(msg, p)}
                        onOpenTask={openTask}
                        onApproveEdited={(args) => acceptEdited(msg, p, args)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="julow-task-chat__bubble julow-task-chat__bubble--user">
                {msg.content}
              </div>
            )}
          </div>
        ))}
        {runningActive && (
          <div className="julow-task-chat__working" aria-live="polite">
            <span className="julow-thinking" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            <span>
              {runningAgents.length === 1
                ? t("taskChat.working").replace("{agent}", runningAgents[0]!)
                : t("taskChat.workingMany")}
            </span>
          </div>
        )}
      </div>

      <div className="julow-task-chat__composer-wrap">
        {mention && mentionMatches.length > 0 && (
          <div className="julow-mention-pop julow-mention-pop--task">
            {mentionMatches.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectMention(a);
                }}
                className={`julow-mention-item ${i === mentionIndex ? "is-active" : ""}`}
              >
                <span className="julow-mention-item__handle">
                  @{handleFromAgentName(a.name)}
                </span>
                <span className="julow-mention-item__name">{a.name}</span>
                <span className="julow-mention-item__sub">
                  {t("agentPanel.mentionAgent")}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="julow-task-chat__composer">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={onDraftChange}
            onKeyDown={onKeyDown}
            placeholder={
              live
                ? t("taskChat.placeholderTo").replace(
                    "{agent}",
                    targetAgent?.name ?? "",
                  )
                : t("chat.connecting")
            }
            rows={1}
            className="julow-task-chat__input resize-none"
          />
          <Button
            isIconOnly
            size="sm"
            variant="primary"
            aria-label={t("agentPanel.send")}
            isDisabled={!draft.trim() || chat.isStreaming || !live}
            onPress={submit}
          >
            <Icon icon={ArrowUp02Icon} size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}
