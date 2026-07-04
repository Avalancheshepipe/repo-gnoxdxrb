"use client";

import {
  Add01Icon,
  AiBrain01Icon,
  Cancel01Icon,
  Download04Icon,
  File01Icon,
  FileEditIcon,
  Folder01Icon,
  TickDouble01Icon,
} from "@hugeicons/core-free-icons";
import { Button, Chip } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { ColorSelectField } from "@/components/ui/color-select-field";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Icon } from "@/components/ui/icon";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { AgentOrbAvatar } from "@/components/workspace/agent-avatar";
import { AgentBriefDialog } from "@/components/workspace/agent-brief-dialog";
import { AssigneePicker } from "@/components/workspace/assignee-picker";
import {
  priorityColors,
  statusColors,
} from "@/components/workspace/inbox-shared";
import {
  priorityOptions,
  statusOptions,
} from "@/components/workspace/task-field-options";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import { api } from "@/lib/trpc";
import type {
  InboxTask,
  TaskPriority,
  TaskStatus,
} from "@/lib/workspace-data";

/**
 * Documents generated for a task (agent reports, analyses, uploads) with the
 * full history — newest first — and one-click download links.
 */
function TaskDocuments({ taskId }: { taskId: string }) {
  const { t, locale } = useI18n();
  const { isLive } = useTaskWorkspace();
  const attachmentsQuery = api.attachment.list.useQuery(
    { taskId },
    { enabled: isLive, refetchInterval: 10_000 },
  );
  const getDownloadUrl = api.attachment.getDownloadUrl.useMutation();

  const download = async (id: string) => {
    const { url } = await getDownloadUrl.mutateAsync({ id });
    window.open(url, "_blank", "noopener");
  };

  const attachments = attachmentsQuery.data ?? [];

  return (
    <section className="julow-task-detail__section">
      <p className="julow-task-detail__label">
        {t("task.documents")}
        {attachments.length > 0 ? ` (${attachments.length})` : ""}
      </p>
      {attachments.length === 0 ? (
        <p className="julow-task-detail__agents-empty">{t("task.noDocuments")}</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => void download(a.id)}
              disabled={getDownloadUrl.isPending}
              className="flex w-full items-center gap-2.5 rounded-xl border border-julow-glass-border px-3 py-2 text-left transition-colors hover:bg-julow-glass-bg"
            >
              <Icon
                icon={File01Icon}
                size={16}
                className="shrink-0 text-accent"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {a.name}
                </span>
                <span className="block truncate text-[11px] text-julow-muted">
                  {new Date(a.createdAt).toLocaleString(
                    locale === "ru" ? "ru-RU" : "en-US",
                    { dateStyle: "medium", timeStyle: "short" },
                  )}
                  {" · "}
                  {a.size >= 1024 * 1024
                    ? `${(a.size / (1024 * 1024)).toFixed(1)} MB`
                    : `${Math.max(1, Math.round(a.size / 1024))} KB`}
                </span>
              </span>
              <span
                className="shrink-0 text-julow-muted"
                title={t("task.download")}
              >
                <Icon icon={Download04Icon} size={15} />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

type TaskDetailPanelProps = {
  task: InboxTask | null;
  onClose: () => void;
  onUpdate: (taskId: string, patch: Partial<InboxTask>) => void;
  embedded?: boolean;
  className?: string;
};

export function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  embedded = false,
  className = "",
}: TaskDetailPanelProps) {
  const { t } = useI18n();
  const { organizationId, isLive } = useTaskWorkspace();
  const utils = api.useUtils();
  const setAssignees = api.task.setAssignees.useMutation({
    onSettled: () => void utils.task.list.invalidate(),
  });

  const [title, setTitle] = useState(task?.title ?? "");
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [assignees, setAssigneesState] = useState<{
    userIds: string[];
    agentIds: string[];
  }>({
    userIds: task?.assigneeUserIds ?? [],
    agentIds: task?.assigneeAgentIds ?? [],
  });
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefAgentId, setBriefAgentId] = useState<string | null>(null);

  // Reset local edit state when the task changes.
  useEffect(() => {
    setTitle(task?.title ?? "");
    setTags(task?.tags ?? []);
    setTagDraft("");
    setAssigneesState({
      userIds: task?.assigneeUserIds ?? [],
      agentIds: task?.assigneeAgentIds ?? [],
    });
  }, [task?.id, task?.title, task?.tags, task?.assigneeUserIds, task?.assigneeAgentIds]);

  useEffect(() => {
    if (!task) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [task, onClose]);

  const briefsQuery = api.task.briefs.useQuery(
    { taskId: task?.id ?? "" },
    { enabled: isLive && Boolean(task?.id), staleTime: 10_000 },
  );
  const briefMap = useMemo(() => {
    const briefs = briefsQuery.data ?? [];
    const map = new Map<string, (typeof briefs)[number]>();
    for (const b of briefs) map.set(b.agentId, b);
    return map;
  }, [briefsQuery.data]);

  if (!task) return null;

  const agents = task.assignees.filter(
    (a): a is { id: string; name: string; type: "agent" } =>
      a.type === "agent" && Boolean(a.id),
  );
  const statusLabel =
    statusOptions(t).find((o) => o.value === task.status)?.label ?? task.status;
  const priorityLabel =
    priorityOptions(t).find((o) => o.value === task.priority)?.label ?? task.priority;

  const saveTitle = () => {
    const next = title.trim();
    if (next && next !== task.title) onUpdate(task.id, { title: next });
  };

  const saveTags = (next: string[]) => {
    setTags(next);
    onUpdate(task.id, { tags: next });
  };

  const addTag = () => {
    const v = tagDraft.trim().toLowerCase();
    if (!v || tags.includes(v)) {
      setTagDraft("");
      return;
    }
    saveTags([...tags, v]);
    setTagDraft("");
  };

  const changeAssignees = (next: { userIds: string[]; agentIds: string[] }) => {
    setAssigneesState(next);
    setAssignees.mutate({
      taskId: task.id,
      userIds: next.userIds,
      agentIds: next.agentIds,
    });
  };

  const openBrief = (agentId: string | null) => {
    setBriefAgentId(agentId);
    setBriefOpen(true);
  };

  const briefSummary = (agentId: string): string => {
    const b = briefMap.get(agentId);
    if (!b) return t("taskAgents.noBrief");
    if (b.instructions?.trim()) return b.instructions.trim();
    if (b.tool) return t(`brief.tool.${b.tool}`);
    return t("taskAgents.briefSet");
  };

  return (
    <aside
      className={`julow-task-detail-panel glass-panel ${embedded ? "julow-task-detail-panel--embedded" : ""} ${className}`.trim()}
      role="dialog"
      aria-labelledby="task-detail-title"
    >
      <header className="julow-task-detail-panel__header">
        <div className="julow-task-detail-panel__header-top">
          <div className="flex flex-wrap items-center gap-2">
            <Chip size="sm" variant="soft" color={statusColors[task.status]}>
              {statusLabel}
            </Chip>
            <Chip size="sm" variant="soft" color={priorityColors[task.priority]}>
              {priorityLabel}
            </Chip>
            {agents.length > 0 && (
              <Chip size="sm" variant="soft" color="accent">
                <Icon icon={AiBrain01Icon} size={12} />
                {t("common.agent")}
              </Chip>
            )}
          </div>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="Close"
            onPress={onClose}
          >
            <Icon icon={Cancel01Icon} size={16} />
          </Button>
        </div>
        <Button
          size="sm"
          variant="primary"
          fullWidth
          onPress={() => onUpdate(task.id, { status: "done" })}
          isDisabled={task.status === "done"}
        >
          <Icon icon={TickDouble01Icon} size={14} />
          {t("task.markComplete")}
        </Button>
      </header>

      <div className="julow-task-detail-panel__scroll workspace-scroll">
        <input
          id="task-detail-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="julow-task-detail__title-input"
          aria-label="Task title"
        />

        <section className="julow-task-detail__section">
          <p className="julow-task-detail__label">{t("task.description")}</p>
          <div className="julow-task-detail__editor">
            <MarkdownEditor
              value={task.description}
              onBlur={(md) => onUpdate(task.id, { description: md })}
            />
          </div>
        </section>

        {task.review && (
          <section className="julow-task-detail__section">
            <p className="julow-task-detail__label">{t("task.verdict")}</p>
            <div className="glass-panel-subtle rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Chip
                  size="sm"
                  variant="soft"
                  color={
                    task.review.verdict === "approved"
                      ? "success"
                      : task.review.verdict === "changes_requested"
                        ? "warning"
                        : "default"
                  }
                >
                  {task.review.verdict.replace(/_/g, " ")}
                </Chip>
                {task.review.by && (
                  <span className="text-[11px] text-julow-muted">
                    {task.review.by}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-julow-fg">
                {task.review.summary}
              </p>
              {task.review.checklist && task.review.checklist.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {task.review.checklist.map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px]">
                      <span className={c.pass ? "text-success" : "text-danger"}>
                        {c.pass ? "✓" : "✗"}
                      </span>
                      <span className="text-julow-muted">{c.item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="julow-task-detail__section">
            <p className="julow-task-detail__label">{t("task.status")}</p>
            <ColorSelectField
              value={task.status}
              onChange={(v) => onUpdate(task.id, { status: v as TaskStatus })}
              ariaLabel={t("task.status")}
              options={statusOptions(t)}
            />
          </section>
          <section className="julow-task-detail__section">
            <p className="julow-task-detail__label">{t("task.priority")}</p>
            <ColorSelectField
              value={task.priority}
              onChange={(v) => onUpdate(task.id, { priority: v as TaskPriority })}
              ariaLabel={t("task.priority")}
              options={priorityOptions(t)}
            />
          </section>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="julow-task-detail__section">
            <p className="julow-task-detail__label">{t("task.due")}</p>
            <DatePickerField
              value={task.dueDate || null}
              onChange={(iso) => onUpdate(task.id, { dueDate: iso ?? "" })}
              ariaLabel={t("task.due")}
              clearLabel={t("common.delete")}
            />
          </section>
          <section className="julow-task-detail__section">
            <p className="julow-task-detail__label">{t("task.project")}</p>
            <div className="julow-task-detail__meta-item">
              <Icon icon={Folder01Icon} size={15} className="text-julow-muted" />
              <p className="truncate text-sm font-medium">{task.project}</p>
            </div>
          </section>
        </div>

        <section className="julow-task-detail__section">
          <p className="julow-task-detail__label">{t("task.tags")}</p>
          <div className="julow-tag-field">
            {tags.map((tag) => (
              <span key={tag} className="julow-tag-chip">
                {tag}
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  onClick={() => saveTags(tags.filter((x) => x !== tag))}
                  className="julow-tag-chip__remove"
                >
                  <Icon icon={Cancel01Icon} size={10} />
                </button>
              </span>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder={t("task.addTag")}
              className="julow-tag-input"
            />
          </div>
        </section>

        <section className="julow-task-detail__section">
          <p className="julow-task-detail__label">{t("task.assignees")}</p>
          <AssigneePicker
            organizationId={organizationId}
            value={assignees}
            onChange={changeAssignees}
          />
        </section>

        <section className="julow-task-detail__section">
          <div className="julow-task-detail__agents-head">
            <p className="julow-task-detail__label">{t("taskAgents.title")}</p>
            <button
              type="button"
              className="julow-task-detail__brief-add"
              onClick={() => openBrief(null)}
            >
              <Icon icon={Add01Icon} size={13} />
              {t("taskAgents.brief")}
            </button>
          </div>
          {agents.length === 0 ? (
            <p className="julow-task-detail__agents-empty">
              {t("taskAgents.empty")}
            </p>
          ) : (
            <div className="julow-task-detail__agents">
              {agents.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="julow-task-agent-row"
                  onClick={() => openBrief(a.id)}
                >
                  <AgentOrbAvatar seed={a.name} size="sm" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="truncate text-[11px] text-julow-muted">
                      {briefSummary(a.id)}
                    </p>
                  </div>
                  <span className="julow-task-agent-row__edit">
                    <Icon icon={FileEditIcon} size={14} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <TaskDocuments taskId={task.id} />
      </div>

      <AgentBriefDialog
        open={briefOpen}
        onClose={() => setBriefOpen(false)}
        task={task}
        organizationId={organizationId}
        agentId={briefAgentId}
      />
    </aside>
  );
}
