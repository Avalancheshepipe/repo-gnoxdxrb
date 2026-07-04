"use client";

import {
  AiBrain01Icon,
  Analytics01Icon,
  ArrowRight01Icon,
  CanvasIcon,
  FileEditIcon,
  GlobalSearchIcon,
  Loading03Icon,
  Message01Icon,
  SourceCodeIcon,
  Task01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { Button, Chip } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { ActivityStatusMarker } from "@/components/workspace/activity-status";
import {
  AgentOrbWithStatus,
  type AgentAvatarStatusTone,
} from "@/components/workspace/agent-avatar";
import { Modal } from "@/components/ui/modal";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import { api } from "@/lib/trpc";
import type { TeamAgent } from "@/lib/workspace-data";

export type AgentItem = {
  id: string;
  name: string;
  role: string;
  responsibility: string;
  status: "online" | "busy" | "idle" | "offline";
  model: string;
  tasksCompleted: number;
  avgResponse: string;
  capabilities: string[];
  currentTask?: string;
};

const statusColors: Record<
  TeamAgent["status"],
  "success" | "accent" | "default" | "warning"
> = {
  online: "success",
  busy: "accent",
  idle: "default",
  offline: "warning",
};

const statusLabelKeys: Record<TeamAgent["status"], string> = {
  online: "agents.status.online",
  busy: "agents.status.busy",
  idle: "agents.status.idle",
  offline: "agents.status.offline",
};

const capabilityIcons: Record<string, IconSvgElement> = {
  "Canvas context": CanvasIcon,
  "Web search": GlobalSearchIcon,
  Reports: Analytics01Icon,
  Markdown: FileEditIcon,
  "Release notes": FileEditIcon,
  "Tone matching": Message01Icon,
  "A/B variants": Analytics01Icon,
  Localization: Message01Icon,
  "Task routing": Task01Icon,
  "Deadline AI": Analytics01Icon,
  "Messenger relay": Message01Icon,
  TypeScript: SourceCodeIcon,
  "PR review": SourceCodeIcon,
};

function CapabilityChip({ label }: { label: string }) {
  const icon = capabilityIcons[label] ?? AiBrain01Icon;
  return (
    <span className="glass-panel-subtle inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-julow-fg">
      <Icon icon={icon} size={12} className="text-accent" />
      {label}
    </span>
  );
}

const statusDotTone: Record<TeamAgent["status"], AgentAvatarStatusTone> = {
  online: "online",
  busy: "busy",
  idle: "idle",
  offline: "offline",
};

function AgentRosterCard({
  agent,
  onView,
  viewLabel,
}: {
  agent: AgentItem;
  onView: (agent: AgentItem) => void;
  viewLabel: string;
}) {
  const { t } = useI18n();

  return (
    <article
      className="glass-panel group relative rounded-2xl p-4 transition-all hover:shadow-lg"
    >
      <button
        type="button"
        aria-label={viewLabel}
        title={viewLabel}
        onClick={() => onView(agent)}
        className="absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-lg text-julow-muted opacity-0 transition-all hover:bg-julow-glass-bg hover:text-julow-fg group-hover:opacity-100"
      >
        <Icon icon={ViewIcon} size={15} />
      </button>

      <div className="flex items-start gap-3">
        <AgentOrbWithStatus
          seed={agent.name}
          size="md"
          status={statusDotTone[agent.status]}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold">{agent.name}</h3>
          </div>
          <p className="mt-0.5 text-xs text-julow-muted">{agent.role}</p>
          <Chip
            size="sm"
            variant="soft"
            color={statusColors[agent.status]}
            className="mt-2"
          >
            {t(statusLabelKeys[agent.status])}
          </Chip>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-julow-glass-bg/60 px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-julow-muted">
          {t("agents.responsibleFor")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-julow-fg">
          {agent.responsibility}
        </p>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-julow-glass-border px-3 py-2.5">
        <Icon
          icon={agent.currentTask ? Task01Icon : AiBrain01Icon}
          size={14}
          className="mt-0.5 shrink-0 text-accent"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-julow-muted">
            {agent.currentTask ? t("agents.rightNow") : t("agents.currentState")}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-julow-fg">
            {agent.currentTask ?? t("agents.waitingForAssignment")}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-julow-muted">
          {t("agents.canDo")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {agent.capabilities.map((cap) => (
            <CapabilityChip key={cap} label={cap} />
          ))}
        </div>
      </div>
    </article>
  );
}

function ActivityFeedRow({
  item,
  compact = false,
}: {
  item: {
    id: string;
    actor: string;
    action: string;
    target: string;
    time: string;
    type: "agent" | "task" | "automation";
    status: "live" | "done";
  };
  compact?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-2.5 text-sm ${
        compact ? "" : "py-2.5 first:pt-0 last:pb-0"
      }`}
    >
      <ActivityStatusMarker status={item.status} type={item.type} />
      <span className="shrink-0 font-medium">{item.actor}</span>
      <span className="shrink-0 text-julow-muted">{item.action}</span>
      <span className="min-w-0 truncate font-medium">{item.target}</span>
      <span className="ml-auto shrink-0 text-[11px] text-julow-muted">
        {item.time}
      </span>
    </li>
  );
}

const PREVIEW_ACTIVITY_COUNT = 5;
const ACTIVITY_PAGE_SIZE = 20;

function ActivityHistoryLoader({
  label,
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 ${
        compact ? "py-4" : "py-10"
      }`}
      role="status"
      aria-live="polite"
    >
      <Icon
        icon={Loading03Icon}
        size={compact ? 18 : 24}
        className="animate-spin text-accent"
      />
      {label ? (
        <span className="text-xs text-julow-muted">{label}</span>
      ) : null}
    </div>
  );
}

function ActivityHistoryModal({
  open,
  onClose,
  organizationId,
  enabled,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  enabled: boolean;
}) {
  const { t } = useI18n();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const historyQuery = api.activity.listPage.useInfiniteQuery(
    {
      organizationId,
      limit: ACTIVITY_PAGE_SIZE,
      type: "agent",
    },
    {
      enabled: enabled && open,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    },
  );

  const items = useMemo(
    () => historyQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [historyQuery.data],
  );

  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          historyQuery.hasNextPage &&
          !historyQuery.isFetchingNextPage
        ) {
          void historyQuery.fetchNextPage();
        }
      },
      { root, rootMargin: "120px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    open,
    historyQuery.hasNextPage,
    historyQuery.isFetchingNextPage,
    historyQuery.fetchNextPage,
  ]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("agents.activityHistory")}
      description={t("agents.activityHistoryHint")}
      width="max-w-2xl"
      footer={
        <Button variant="primary" onPress={onClose}>
          {t("common.gotIt")}
        </Button>
      }
    >
      <div
        ref={scrollRef}
        className="workspace-scroll max-h-[min(28rem,60vh)] overflow-y-auto pr-1"
      >
        {historyQuery.isLoading ? (
          <ActivityHistoryLoader label={t("common.loading")} />
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-julow-muted">
            {t("agents.noActivity")}
          </p>
        ) : (
          <ul className="divide-y divide-julow-glass-border">
            {items.map((item) => (
              <ActivityFeedRow key={item.id} item={item} />
            ))}
          </ul>
        )}
        <div ref={sentinelRef} className="h-2" aria-hidden />
        {historyQuery.isFetchingNextPage && (
          <ActivityHistoryLoader
            compact
            label={t("agents.loadingMore")}
          />
        )}
      </div>
    </Modal>
  );
}

/** Read-only agent details. In this MVP the roster is fixed and not editable. */
function AgentDetailsDialog({
  open,
  onClose,
  agent,
}: {
  open: boolean;
  onClose: () => void;
  agent: AgentItem | null;
}) {
  const { t } = useI18n();
  if (!agent) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={agent.name}
      description={agent.role}
      width="max-w-lg"
      footer={
        <Button variant="primary" onPress={onClose}>
          {t("common.gotIt")}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="glass-panel-subtle rounded-xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-julow-muted">
              {t("agent.model")}
            </p>
            <p className="mt-0.5 truncate text-sm font-medium">{agent.model}</p>
          </div>
          <div className="glass-panel-subtle rounded-xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-julow-muted">
              {t("agent.status")}
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {t(statusLabelKeys[agent.status])}
            </p>
          </div>
        </div>

        {agent.responsibility && (
          <div>
            <p className="julow-field-label">{t("agent.responsibility")}</p>
            <p className="mt-1 text-sm leading-relaxed text-julow-muted">
              {agent.responsibility}
            </p>
          </div>
        )}

        <div>
          <p className="julow-field-label">{t("agents.canDo")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {agent.capabilities.length > 0 ? (
              agent.capabilities.map((cap) => (
                <CapabilityChip key={cap} label={cap} />
              ))
            ) : (
              <span className="text-xs text-julow-muted">—</span>
            )}
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-julow-muted">
          {t("agent.viewOnlyNote")}
        </p>
      </div>
    </Modal>
  );
}

export function AgentsView() {
  const { t } = useI18n();
  const { organizationId, isLive } = useTaskWorkspace();
  const [viewing, setViewing] = useState<AgentItem | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const agentsQuery = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: isLive, staleTime: 30_000 },
  );
  const activitiesQuery = api.activity.list.useQuery(
    {
      organizationId: organizationId ?? "",
      limit: PREVIEW_ACTIVITY_COUNT + 1,
      type: "agent",
    },
    { enabled: isLive, staleTime: 30_000 },
  );

  const agents = useMemo(
    () => (agentsQuery.data ?? []) as AgentItem[],
    [agentsQuery.data],
  );
  const previewActivities = (activitiesQuery.data ?? []).slice(
    0,
    PREVIEW_ACTIVITY_COUNT,
  );
  const hasMoreActivity =
    (activitiesQuery.data?.length ?? 0) > PREVIEW_ACTIVITY_COUNT;

  const activeCount = agents.filter(
    (a) => a.status === "online" || a.status === "busy",
  ).length;
  const totalRuns = agents.reduce((sum, a) => sum + (a.tasksCompleted ?? 0), 0);

  const stats = [
    {
      label: t("agents.activeNow"),
      value: String(activeCount),
      sub: t("agents.ofAgents").replace("{count}", String(agents.length)),
    },
    {
      label: t("agents.totalRuns"),
      value: String(totalRuns),
      sub: t("agents.acrossAll"),
    },
    {
      label: t("agents.onGateway"),
      value: String(agents.length),
      sub: t("agents.modelsConfigured"),
    },
  ];

  return (
    <WorkspacePage title={t("agents.title")} description={t("agents.description")}>
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">{t("agents.teamActivity")}</h2>
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="glass-panel rounded-2xl p-4">
              <p className="text-xs text-julow-muted">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {stat.value}
              </p>
              <p className="mt-0.5 text-[11px] text-julow-muted">{stat.sub}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          disabled={previewActivities.length === 0}
          className="julow-activity-preview glass-panel-subtle group w-full rounded-xl px-4 py-3 text-left transition-all hover:border-julow-glass-border disabled:cursor-default disabled:opacity-80"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-julow-muted">
              {t("agents.live")}
            </p>
            {hasMoreActivity && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-accent opacity-80 transition-opacity group-hover:opacity-100">
                {t("agents.viewAllActivity")}
                <Icon icon={ArrowRight01Icon} size={14} />
              </span>
            )}
          </div>
          {previewActivities.length === 0 ? (
            <p className="text-sm text-julow-muted">{t("agents.noActivity")}</p>
          ) : (
            <ul className="space-y-2">
              {previewActivities.map((item) => (
                <ActivityFeedRow key={item.id} item={item} compact />
              ))}
            </ul>
          )}
        </button>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-medium">{t("agents.roster")}</h2>
          <p className="mt-0.5 text-xs text-julow-muted">
            {t("agents.rosterDescription")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentRosterCard
              key={agent.id}
              agent={agent}
              onView={setViewing}
              viewLabel={t("agent.viewTooltip")}
            />
          ))}
        </div>
      </section>

      <AgentDetailsDialog
        open={Boolean(viewing)}
        agent={viewing}
        onClose={() => setViewing(null)}
      />

      {organizationId && (
        <ActivityHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          organizationId={organizationId}
          enabled={isLive}
        />
      )}
    </WorkspacePage>
  );
}
