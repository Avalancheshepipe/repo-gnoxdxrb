"use client";

import {
  Activity01Icon,
  AiBrain01Icon,
  AiChat01Icon,
  Analytics01Icon,
  ArrowUp02Icon,
  CanvasIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  FileEditIcon,
  InformationCircleIcon,
  Loading03Icon,
  Mic01Icon,
  Mail01Icon,
  Queue01Icon,
  Settings02Icon,
  SparklesIcon,
  StopIcon,
  Task01Icon,
  Tick02Icon,
  WorkflowCircle01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { Button, Chip, Tabs } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown, type LinkSafetyModalProps } from "streamdown";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select-field";
import { AgentOrbAvatar } from "@/components/workspace/agent-avatar";
import { AgentSettingsDialog } from "@/components/workspace/agent-settings-dialog";
import { useAltDragScroll } from "@/components/workspace/use-alt-drag-scroll";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import { useVoiceInput } from "@/lib/use-voice-input";
import {
  assignProposalNames,
  PROPOSAL_ACTION_TYPE,
  proposalTitle,
  type AgentProposal,
  type ProposalArgsMap,
  type ProposalKind,
} from "@/lib/agent-proposals";
import { agentProfileText, dedupeAgentsByName } from "@/lib/agent-profiles";
import { findFreeSlot } from "@/lib/canvas-layout";
import { resolveAssigneeTokens } from "@/lib/assignees";
import { ProposalEditDialog } from "@/components/workspace/proposal-edit-dialog";
import { EmailProposalDialog } from "@/components/workspace/email-proposal-dialog";
import { formatRelativeTime } from "@/lib/format-time";
import { api } from "@/lib/trpc";
import { useAgentChat, type ChatTurn } from "@/lib/use-agent-chat";

const agentPanelTabs = [
  { id: "chat", labelKey: "agentPanel.tab.chat", icon: AiChat01Icon },
  { id: "queue", labelKey: "agentPanel.tab.queue", icon: Queue01Icon },
  { id: "activity", labelKey: "agentPanel.tab.activity", icon: Activity01Icon },
] as const;

const PROPOSAL_ICON: Record<ProposalKind, IconSvgElement> = {
  propose_create_task: Task01Icon,
  propose_update_task: Task01Icon,
  propose_assign_task: AiBrain01Icon,
  propose_bulk_update_tasks: Task01Icon,
  propose_archive_task: Task01Icon,
  propose_canvas_node: CanvasIcon,
  propose_create_automation: WorkflowCircle01Icon,
  propose_delegate: AiBrain01Icon,
  propose_delegate_task: WorkflowCircle01Icon,
  propose_create_document: FileEditIcon,
  propose_report: Analytics01Icon,
  propose_review: CheckmarkCircle02Icon,
  propose_test: CheckmarkCircle02Icon,
  propose_send_email: Mail01Icon,
};

function isInternalLink(url: string): boolean {
  if (url.startsWith("/") || url.startsWith("#") || url.startsWith("?")) return true;
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** Proposal kinds that map to a concrete task whose detail can be opened. */
const TASK_PROPOSAL_KINDS: ReadonlySet<ProposalKind> = new Set([
  "propose_create_task",
  "propose_update_task",
  "propose_assign_task",
  "propose_delegate_task",
]);

/**
 * Normalize an agent-provided date ("2026-06-24", an ISO datetime, …) into a
 * strict ISO 8601 datetime, which is what the task API validates/persists.
 * Returns undefined when there is nothing usable to set.
 */
function toIsoDateTime(input?: string): string | undefined {
  if (!input) return undefined;
  const raw = input.trim();
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const dt = new Date(raw);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }
  // Plain date → anchor at local noon so the calendar day can't slip by TZ.
  const dateOnly = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const day = new Date(`${dateOnly}T12:00:00`);
    if (!Number.isNaN(day.getTime())) return day.toISOString();
  }
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? undefined : fallback.toISOString();
}

/**
 * Intercepts clicks on in-app links (task links etc.) inside rendered agent
 * Markdown and navigates with the SPA router — same tab, no full reload, and
 * no external-link confirmation modal. External links fall through untouched.
 */
export function useInternalLinkClick() {
  const router = useRouter();
  return useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!isInternalLink(href)) return;
      e.preventDefault();
      e.stopPropagation();
      const url = new URL(href, window.location.origin);
      router.push(href.startsWith("/") ? href : url.pathname + url.search);
    },
    [router],
  );
}

export function AgentMarkdown({
  content,
  onContentClick,
}: {
  content: string;
  onContentClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const { t } = useI18n();

  const linkSafety = useMemo(
    () => ({
      enabled: true,
      onLinkCheck: (url: string) => !isInternalLink(url),
      renderModal: ({ isOpen, onClose, onConfirm, url }: LinkSafetyModalProps) => (
        <Modal
          open={isOpen}
          onClose={onClose}
          title={t("link.externalTitle")}
          description={t("link.externalWarning")}
          width="max-w-md"
          footer={
            <>
              <Button variant="ghost" onPress={onClose}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" onPress={onConfirm}>
                {t("link.externalConfirm")}
              </Button>
            </>
          }
        >
          <p className="break-all text-xs text-julow-muted">{url}</p>
        </Modal>
      ),
    }),
    [t],
  );

  return (
    <div className="julow-streamdown" onClick={onContentClick}>
      <Streamdown
        linkSafety={linkSafety}
        translations={{
          openExternalLink: t("link.externalTitle"),
          externalLinkWarning: t("link.externalWarning"),
          close: t("common.cancel"),
        }}
      >
        {content}
      </Streamdown>
    </div>
  );
}

function AgentProfileHint({
  role,
  description,
  ariaLabel,
}: {
  role: string;
  description: string;
  ariaLabel: string;
}) {
  if (!role && !description) return null;

  return (
    <button
      type="button"
      className="julow-tip flex size-6 shrink-0 items-center justify-center rounded-md text-julow-muted transition-colors hover:bg-julow-glass-bg hover:text-julow-fg"
      aria-label={ariaLabel}
    >
      <Icon icon={InformationCircleIcon} size={15} />
      <span className="julow-tip__bubble glass-panel">
        {role ? (
          <span className="block text-xs font-medium text-julow-fg">{role}</span>
        ) : null}
        {description ? (
          <span className="mt-1 block text-[11px] leading-snug text-julow-muted">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** Executes a confirmed proposal via the real APIs (scoped to the workspace). */
export function useProposalExecutor(agentId: string | null) {
  const { organizationId, activeProjectId, projects, tasks, user } =
    useTaskWorkspace();
  const { locale } = useI18n();
  const utils = api.useUtils();
  const agentsQuery = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: Boolean(organizationId), staleTime: 60_000 },
  );
  const membersQuery = api.workspace.members.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: Boolean(organizationId), staleTime: 60_000 },
  );
  const createTask = api.task.create.useMutation();
  const updateTask = api.task.update.useMutation();
  const setAssignees = api.task.setAssignees.useMutation();
  const bulkUpdate = api.task.bulkUpdate.useMutation();
  const setArchived = api.task.setArchived.useMutation();
  const addCanvasNode = api.canvas.addNode.useMutation();
  const createAutomation = api.automation.create.useMutation();
  const startRun = api.agentRun.start.useMutation();
  const delegateTask = api.task.delegate.useMutation();
  const createDocument = api.agentAction.createDocument.useMutation();
  const compileReport = api.agentAction.report.useMutation();
  const reviewTask = api.agentAction.review.useMutation();
  const validateTask = api.agentAction.validate.useMutation();
  const sendEmail = api.agentAction.sendEmail.useMutation();

  /** Resolve @handles / names (incl. "me"/"я") into real user + agent ids. */
  function resolveAssignees(tokens: string[] | undefined) {
    return resolveAssigneeTokens(tokens, {
      agents: agentsQuery.data ?? [],
      members: membersQuery.data ?? [],
      user,
    });
  }

  async function execute(
    p: AgentProposal,
  ): Promise<{ ok: boolean; note: string; taskId?: string; projectId?: string }> {
    const L = (en: string, ru: string) => (locale === "ru" ? ru : en);
    if (!organizationId)
      return { ok: false, note: L("No workspace", "Нет рабочего пространства") };
    try {
      switch (p.kind) {
        case "propose_create_task": {
          const projectId =
            projects.find(
              (pr) => pr.name.toLowerCase() === p.args.projectName?.toLowerCase(),
            )?.id ??
            activeProjectId ??
            projects[0]?.id;
          if (!projectId) return { ok: false, note: "No project available" };
          const who = resolveAssignees(p.args.assignees);
          const created = await createTask.mutateAsync({
            projectId,
            title: p.args.title,
            description: p.args.description,
            priority: p.args.priority ?? "medium",
            status: p.args.status ?? "todo",
            tags: p.args.tags ?? [],
            dueDate: toIsoDateTime(p.args.dueDate),
            assigneeUserIds: who.userIds,
            assigneeAgentIds: who.agentIds,
          });
          await utils.task.list.invalidate({ organizationId });
          const miss =
            who.unresolved.length > 0
              ? ` (${L("couldn't match", "не распознано")}: ${who.unresolved.join(", ")})`
              : "";
          return {
            ok: true,
            note: `${L("Task created", "Задача создана")}${miss}`,
            taskId: created.id,
            projectId: created.projectId,
          };
        }
        case "propose_update_task": {
          const task = tasks.find(
            (t) => t.title.toLowerCase() === p.args.taskTitle.toLowerCase(),
          );
          if (!task) return { ok: false, note: L("Task not found", "Задача не найдена") };
          await updateTask.mutateAsync({
            id: task.id,
            title: p.args.newTitle?.trim() || undefined,
            status: p.args.status,
            priority: p.args.priority,
            description: p.args.description,
            tags: p.args.tags,
            dueDate: toIsoDateTime(p.args.dueDate),
          });
          const add = resolveAssignees(p.args.assignees);
          const remove = resolveAssignees(p.args.removeAssignees);
          const notes: string[] = [];
          if (
            add.userIds.length ||
            add.agentIds.length ||
            remove.userIds.length ||
            remove.agentIds.length
          ) {
            const userIds = [
              ...new Set([...task.assigneeUserIds, ...add.userIds]),
            ].filter((id) => !remove.userIds.includes(id));
            const agentIds = [
              ...new Set([...task.assigneeAgentIds, ...add.agentIds]),
            ].filter((id) => !remove.agentIds.includes(id));
            await setAssignees.mutateAsync({ taskId: task.id, userIds, agentIds });
            if (add.userIds.length + add.agentIds.length)
              notes.push(`+${add.userIds.length + add.agentIds.length}`);
            if (remove.userIds.length + remove.agentIds.length)
              notes.push(`-${remove.userIds.length + remove.agentIds.length}`);
          }
          await utils.task.list.invalidate({ organizationId });
          return {
            ok: true,
            note: `${L("Task updated", "Задача обновлена")}${
              notes.length ? ` (${notes.join(" ")})` : ""
            }`,
            taskId: task.id,
            projectId: task.projectId,
          };
        }
        case "propose_assign_task": {
          const task = tasks.find(
            (t) => t.title.toLowerCase() === p.args.taskTitle.toLowerCase(),
          );
          if (!task) return { ok: false, note: L("Task not found", "Задача не найдена") };
          const add = resolveAssignees(assignProposalNames(p));
          const remove = resolveAssignees(p.args.removeAssignees);
          if (
            !add.userIds.length &&
            !add.agentIds.length &&
            !remove.userIds.length &&
            !remove.agentIds.length
          ) {
            return {
              ok: false,
              note: add.unresolved.length
                ? `Couldn't match: ${add.unresolved.join(", ")}`
                : "No assignees given",
            };
          }
          const userIds = [
            ...new Set([...task.assigneeUserIds, ...add.userIds]),
          ].filter((id) => !remove.userIds.includes(id));
          const agentIds = [
            ...new Set([...task.assigneeAgentIds, ...add.agentIds]),
          ].filter((id) => !remove.agentIds.includes(id));
          await setAssignees.mutateAsync({ taskId: task.id, userIds, agentIds });
          await utils.task.list.invalidate({ organizationId });
          const added = add.userIds.length + add.agentIds.length;
          const removed = remove.userIds.length + remove.agentIds.length;
          const parts = [
            added ? `+${added}` : "",
            removed ? `-${removed}` : "",
          ].filter(Boolean);
          return {
            ok: true,
            note: `${L("Assignees", "Исполнители")} ${parts.join(" ")}`.trim(),
            taskId: task.id,
            projectId: task.projectId,
          };
        }
        case "propose_bulk_update_tasks": {
          const res = await bulkUpdate.mutateAsync({
            organizationId,
            projectId: activeProjectId ?? undefined,
            filter: {
              status: p.args.filter.status,
              tags: p.args.filter.tags,
            },
            changes: {
              status: p.args.changes.status,
              priority: p.args.changes.priority,
              archive: p.args.changes.archive,
            },
          });
          await utils.task.list.invalidate();
          return {
            ok: res.count > 0,
            note:
              res.count > 0
                ? L(`${res.count} task(s) updated`, `Обновлено задач: ${res.count}`)
                : L("No matching tasks", "Нет подходящих задач"),
          };
        }
        case "propose_archive_task": {
          const task = tasks.find(
            (t) => t.title.toLowerCase() === p.args.taskTitle.toLowerCase(),
          );
          if (!task) return { ok: false, note: L("Task not found", "Задача не найдена") };
          const archived = p.args.archived !== false;
          await setArchived.mutateAsync({ id: task.id, archived });
          await utils.task.list.invalidate();
          return {
            ok: true,
            note: archived
              ? L("Task archived", "Задача в архиве")
              : L("Task restored", "Задача восстановлена"),
            taskId: task.id,
            projectId: task.projectId,
          };
        }
        case "propose_canvas_node": {
          const projectId = activeProjectId ?? projects[0]?.id;
          if (!projectId) return { ok: false, note: "No project available" };
          const existing = await utils.canvas.get.fetch({ projectId });
          const occupied = [
            ...(existing?.nodes ?? []).map((n) => ({ x: n.x, y: n.y })),
            ...Object.values(existing?.boardLayout ?? {}),
          ];
          const slot = findFreeSlot(occupied);
          await addCanvasNode.mutateAsync({
            projectId,
            type: p.args.nodeType ?? "note",
            title: p.args.title,
            subtitle: p.args.subtitle,
            x: slot.x,
            y: slot.y,
            width: 240,
          });
          await utils.canvas.get.invalidate({ projectId });
          return { ok: true, note: L("Added to canvas", "Добавлено на доску") };
        }
        case "propose_create_automation": {
          await createAutomation.mutateAsync({
            organizationId,
            name: p.args.name,
            description: p.args.description,
            trigger: { type: "custom", label: p.args.when },
            action: { type: "custom", label: p.args.then },
            aiManaged: p.args.aiManaged ?? false,
          });
          await utils.automation.list.invalidate({ organizationId });
          return { ok: true, note: L("Automation created", "Автоматизация создана") };
        }
        case "propose_delegate": {
          const target = (agentsQuery.data ?? [])[0];
          if (!target) return { ok: false, note: "No agent in workspace" };
          await startRun.mutateAsync({
            organizationId,
            agentId: target.id,
            prompt: p.args.objective,
            projectId: activeProjectId ?? undefined,
          });
          await utils.agentRun.invalidate();
          await utils.activity.invalidate();
          return { ok: true, note: `Delegated to ${target.name}` };
        }
        case "propose_delegate_task": {
          const existing = p.args.taskTitle
            ? tasks.find(
                (t) => t.title.toLowerCase() === p.args.taskTitle!.toLowerCase(),
              )
            : undefined;
          const res = await delegateTask.mutateAsync({
            organizationId,
            taskId: existing?.id,
            taskTitle: existing ? undefined : p.args.taskTitle,
            createTask:
              !existing && p.args.createTask
                ? {
                    title: p.args.createTask.title,
                    description: p.args.createTask.description,
                    projectName: p.args.createTask.projectName,
                    priority: p.args.createTask.priority,
                    dueDate: toIsoDateTime(p.args.createTask.dueDate),
                  }
                : undefined,
            assignments: p.args.assignments.map((a) => ({
              agentName: a.agentName?.trim() || undefined,
              tool: a.tool,
              brief: a.brief,
              format: a.format,
              documentSpec: a.documentSpec,
              researchQuery: a.researchQuery,
            })),
            locale,
          });
          await Promise.all([
            utils.task.list.invalidate(),
            utils.agentRun.invalidate(),
            utils.activity.invalidate(),
          ]);
          const ok = res.assigned.filter((x) => !x.error);
          const failed = res.assigned.filter((x) => x.error);
          const note = ok.length
            ? `Delegated to ${ok.map((x) => x.agent).join(", ")}${
                failed.length ? ` (skipped ${failed.length})` : ""
              }`
            : "No agents matched";
          return {
            ok: ok.length > 0,
            note,
            taskId: res.taskId,
            projectId: res.projectId,
          };
        }
        case "propose_create_document": {
          const projectId = activeProjectId ?? projects[0]?.id;
          const task = p.args.taskTitle
            ? tasks.find(
                (t) =>
                  t.title.toLowerCase() === p.args.taskTitle!.toLowerCase(),
              )
            : undefined;
          const res = await createDocument.mutateAsync({
            organizationId,
            agentId: agentId ?? undefined,
            projectId,
            format: p.args.format,
            title: p.args.title,
            sections: p.args.sections,
            sheet: p.args.sheet,
            taskId: task?.id,
          });
          await utils.canvas.get.invalidate();
          return {
            ok: true,
            note: res.filename ? `Created ${res.filename}` : "Document created",
          };
        }
        case "propose_report": {
          const projectId = activeProjectId ?? projects[0]?.id;
          await compileReport.mutateAsync({
            organizationId,
            agentId: agentId ?? undefined,
            projectId,
            title: p.args.title,
            format: p.args.format,
          });
          await utils.canvas.get.invalidate();
          return { ok: true, note: "Report compiled" };
        }
        case "propose_review": {
          const task = tasks.find(
            (t) => t.title.toLowerCase() === p.args.taskTitle.toLowerCase(),
          );
          if (!task) return { ok: false, note: "Task not found" };
          const res = await reviewTask.mutateAsync({
            organizationId,
            agentId: agentId ?? undefined,
            taskId: task.id,
            criteria: p.args.criteria,
          });
          await utils.task.list.invalidate({ organizationId });
          return {
            ok: res.ok,
            note: res.ok ? `Verdict: ${res.verdict}` : res.error ?? "Review failed",
          };
        }
        case "propose_test": {
          const task = tasks.find(
            (t) => t.title.toLowerCase() === p.args.taskTitle.toLowerCase(),
          );
          if (!task) return { ok: false, note: "Task not found" };
          const res = await validateTask.mutateAsync({
            organizationId,
            agentId: agentId ?? undefined,
            taskId: task.id,
            criteria: p.args.criteria,
          });
          await utils.task.list.invalidate({ organizationId });
          return {
            ok: res.ok,
            note: res.ok
              ? res.pass
                ? "Validation passed"
                : "Validation: changes needed"
              : res.error ?? "Validation failed",
          };
        }
        case "propose_send_email": {
          const res = await sendEmail.mutateAsync({
            organizationId,
            recipient: p.args.recipient,
            subject: p.args.subject,
            body: p.args.body,
            linkUrl: p.args.linkUrl,
            linkLabel: p.args.linkLabel,
          });
          if (!res.ok) return { ok: false, note: res.error ?? "Send failed" };
          await utils.activity.invalidate();
          return { ok: true, note: `Email queued to ${res.name}` };
        }
      }
    } catch (e) {
      return { ok: false, note: e instanceof Error ? e.message : "Action failed" };
    }
  }

  return { execute };
}

function ReasoningBlock({
  reasoning,
  streaming,
}: {
  reasoning: string;
  streaming?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-2 rounded-xl border border-julow-glass-border bg-julow-glass-bg/40 px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-[11px] font-medium text-julow-muted"
      >
        <Icon
          icon={SparklesIcon}
          size={12}
          className={streaming ? "animate-pulse text-accent" : "text-accent"}
        />
        {t("agentPanel.reasoning")}
        <span className="ml-auto">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-julow-muted">
          {reasoning}
        </p>
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="julow-thinking" aria-label="Thinking">
      <span />
      <span />
      <span />
    </span>
  );
}

export function ProposalCard({
  proposal,
  busy,
  onAccept,
  onDecline,
  onOpenTask,
  onApproveEdited,
  onApproveEmailEdited,
  workspaceName = "Julow",
}: {
  proposal: AgentProposal;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onOpenTask?: (taskId: string, projectId?: string) => void;
  onApproveEdited?: (args: ProposalArgsMap["propose_create_task"]) => void;
  onApproveEmailEdited?: (args: ProposalArgsMap["propose_send_email"]) => void;
  workspaceName?: string;
}) {
  const { t } = useI18n();
  const [editOpen, setEditOpen] = useState(false);
  const [emailEditOpen, setEmailEditOpen] = useState(false);
  const resolved = proposal.status !== "pending";
  const openableTaskId =
    proposal.status === "accepted" &&
    proposal.taskId &&
    TASK_PROPOSAL_KINDS.has(proposal.kind)
      ? proposal.taskId
      : null;
  // A still-pending task-creation proposal can be opened to edit before approve.
  const editable =
    proposal.status === "pending" &&
    proposal.kind === "propose_create_task" &&
    Boolean(onApproveEdited);
  const emailEditable =
    proposal.status === "pending" &&
    proposal.kind === "propose_send_email" &&
    Boolean(onApproveEmailEdited);
  const clickable = Boolean(openableTaskId) || editable || emailEditable;

  const handleOpen = () => {
    if (openableTaskId) onOpenTask?.(openableTaskId, proposal.projectId);
    else if (editable) setEditOpen(true);
    else if (emailEditable) setEmailEditOpen(true);
  };

  return (
    <div
      className={`julow-proposal-card glass-panel-subtle mt-2 rounded-xl border border-julow-glass-border p-2.5${
        clickable ? " julow-proposal-card--clickable" : ""
      }`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleOpen : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpen();
              }
            }
          : undefined
      }
      title={
        openableTaskId
          ? t("agentPanel.openTask")
          : editable
            ? t("agentPanel.clickToEdit")
            : emailEditable
              ? t("emailProposal.clickToEdit")
              : undefined
      }
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
          <Icon icon={PROPOSAL_ICON[proposal.kind]} size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-julow-muted">
            {t(`proposal.verb.${proposal.kind}`)}
          </p>
          <p className="truncate text-sm font-medium text-julow-fg">
            {proposalTitle(proposal)}
          </p>
        </div>
      </div>

      {resolved ? (
        <div className="mt-2 flex items-center gap-1.5">
          <Chip
            size="sm"
            variant="soft"
            color={
              proposal.status === "accepted"
                ? "success"
                : proposal.status === "failed"
                  ? "danger"
                  : "default"
            }
          >
            {proposal.status === "accepted"
              ? t("agentPanel.approved")
              : proposal.status === "failed"
                ? t("agentPanel.failed")
                : t("agentPanel.declined")}
          </Chip>
          {proposal.note && (
            <span className="text-[11px] text-julow-muted">{proposal.note}</span>
          )}
          {openableTaskId && (
            <span className="julow-proposal-card__open ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-accent">
              {t("agentPanel.openTask")}
              <Icon icon={ArrowUp02Icon} size={12} className="rotate-45" />
            </span>
          )}
        </div>
      ) : (
        <>
          {editable && (
            <button
              type="button"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent"
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(true);
              }}
            >
              <Icon icon={FileEditIcon} size={11} />
              {t("agentPanel.clickToEdit")}
            </button>
          )}
          {emailEditable && (
            <button
              type="button"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent"
              onClick={(e) => {
                e.stopPropagation();
                setEmailEditOpen(true);
              }}
            >
              <Icon icon={Mail01Icon} size={11} />
              {t("emailProposal.clickToEdit")}
            </button>
          )}
          <div
            className="mt-2 flex flex-wrap items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="primary"
              isDisabled={busy}
              onPress={() => {
                if (emailEditable) setEmailEditOpen(true);
                else onAccept();
              }}
              className="flex-1"
            >
              <Icon icon={Tick02Icon} size={14} />
              {busy ? t("agentPanel.working") : t("agentPanel.approve")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              isDisabled={busy}
              onPress={onDecline}
              className="flex-1"
            >
              <Icon icon={Cancel01Icon} size={14} />
              {t("agentPanel.decline")}
            </Button>
          </div>
        </>
      )}

      {editable && (
        <ProposalEditDialog
          open={editOpen}
          proposal={
            proposal as Extract<AgentProposal, { kind: "propose_create_task" }>
          }
          busy={busy}
          onClose={() => setEditOpen(false)}
          onApprove={(args) => {
            setEditOpen(false);
            onApproveEdited?.(args);
          }}
          onDecline={() => {
            setEditOpen(false);
            onDecline();
          }}
        />
      )}

      {emailEditable && (
        <EmailProposalDialog
          open={emailEditOpen}
          proposal={
            proposal as Extract<AgentProposal, { kind: "propose_send_email" }>
          }
          busy={busy}
          workspaceName={workspaceName}
          onClose={() => setEmailEditOpen(false)}
          onApprove={(args) => {
            setEmailEditOpen(false);
            onApproveEmailEdited?.(args);
          }}
          onDecline={() => {
            setEmailEditOpen(false);
            onDecline();
          }}
        />
      )}
    </div>
  );
}

function AgentChat() {
  const [draft, setDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busyProposals, setBusyProposals] = useState<Record<string, boolean>>({});
  const { ref: suggestionsRef, scrollProps } = useAltDragScroll<HTMLDivElement>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(
    null,
  );
  const [mentionIndex, setMentionIndex] = useState(0);
  const { locale, t } = useI18n();
  const { organizationId, isLive, activeProjectId, openTask, workspaceName } =
    useTaskWorkspace();

  const mentionablesQuery = api.workspace.mentionables.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: isLive, staleTime: 60_000 },
  );
  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return (mentionablesQuery.data ?? [])
      .filter(
        (m) =>
          m.handle.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [mention, mentionablesQuery.data]);

  const voice = useVoiceInput(
    (text) => setDraft((d) => (d ? `${d} ${text}` : text)),
    locale,
  );

  const agentsQuery = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: isLive, staleTime: 60_000 },
  );
  const agents = useMemo(
    () => dedupeAgentsByName(agentsQuery.data ?? []),
    [agentsQuery.data],
  );

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      const lead =
        agents.find((a) => a.name.toLowerCase().includes("orchestrator")) ??
        agents[0]!;
      setSelectedAgentId(lead.id);
    }
  }, [agents, selectedAgentId]);
  const activeAgent =
    agents.find((a) => a.id === selectedAgentId) ?? agents[0] ?? null;

  const activeProfile = activeAgent
    ? agentProfileText(activeAgent.name, locale, {
        role: activeAgent.role,
        responsibility: activeAgent.responsibility,
      })
    : null;

  const agentSelectOptions = useMemo(
    () => agents.map((a) => ({ value: a.id, label: a.name })),
    [agents],
  );

  const chat = useAgentChat({
    organizationId,
    agentId: activeAgent?.id ?? null,
    projectId: activeProjectId,
    locale,
  });
  const executor = useProposalExecutor(activeAgent?.id ?? null);
  const resolveProposal = api.chat.resolveProposal.useMutation();

  const historyQuery = api.chat.history.useQuery(
    {
      organizationId: organizationId ?? "",
      agentId: activeAgent?.id ?? "",
    },
    {
      enabled: isLive && Boolean(activeAgent?.id),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    chat.reset();
  }, [activeAgent?.id, chat.reset]);

  useEffect(() => {
    if (!activeAgent?.id || !historyQuery.data) return;
    chat.hydrate(historyQuery.data);
  }, [activeAgent?.id, historyQuery.data, chat.hydrate]);

  // Auto-scroll to the newest content while streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  // Let other surfaces (e.g. the task panel) prefill the composer.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string }>).detail;
      if (detail?.text) setDraft(detail.text);
    };
    window.addEventListener("julow:agent-prompt", onPrompt);
    return () => window.removeEventListener("julow:agent-prompt", onPrompt);
  }, []);

  // Command palette / other surfaces can switch the active agent.
  useEffect(() => {
    const onSelect = (e: Event) => {
      const agentId = (e as CustomEvent<{ agentId?: string }>).detail?.agentId;
      if (agentId) setSelectedAgentId(agentId);
    };
    window.addEventListener("julow:select-agent", onSelect);
    return () => window.removeEventListener("julow:select-agent", onSelect);
  }, []);

  useEffect(() => {
    const onFocusComposer = () => {
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    window.addEventListener("julow:focus-agent-composer", onFocusComposer);
    return () =>
      window.removeEventListener("julow:focus-agent-composer", onFocusComposer);
  }, []);

  // Intercept in-app links inside agent answers (e.g. task links) for SPA nav.
  const handleContentClick = useInternalLinkClick();

  const live = isLive && Boolean(activeAgent);

  // Auto-approval: proposals whose action type is set to AUTO in the
  // workspace rules are executed immediately, without waiting for a click.
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
    for (const turn of chat.messages) {
      for (const p of turn.proposals ?? []) {
        if (p.status !== "pending" || autoHandledRef.current.has(p.id)) continue;
        const actionType = PROPOSAL_ACTION_TYPE[p.kind];
        if (!actionType || !autoTypes.has(actionType)) continue;
        autoHandledRef.current.add(p.id);
        void handleAccept(turn, p);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.messages, chat.isStreaming, autoTypes]);

  const suggestions = useMemo(
    () => [t("suggestion.1"), t("suggestion.2"), t("suggestion.3")],
    [t],
  );

  const submit = () => {
    const text = draft.trim();
    if (!text || !live) return;
    chat.send(text);
    setDraft("");
    setMention(null);
  };

  const sendSuggestion = (text: string) => {
    if (!live || chat.isStreaming) return;
    chat.send(text);
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

  const selectMention = (handle: string) => {
    const ta = textareaRef.current;
    if (!mention) return;
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

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        selectMention(mentionMatches[mentionIndex]!.handle);
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

  async function handleAccept(turn: ChatTurn, proposal: AgentProposal) {
    setBusyProposals((b) => ({ ...b, [proposal.id]: true }));
    const res = await executor.execute(proposal);
    const status = res.ok ? "accepted" : "failed";
    chat.setProposalStatus(
      turn.id,
      proposal.id,
      status,
      res.note,
      res.taskId,
      res.projectId,
    );
    if (turn.messageId) {
      resolveProposal.mutate({
        messageId: turn.messageId,
        proposalId: proposal.id,
        status,
        note: res.note,
        taskId: res.taskId,
        projectId: res.projectId,
        args: proposal.args,
      });
    }
    setBusyProposals((b) => ({ ...b, [proposal.id]: false }));
  }

  // Approve a task-creation proposal that was edited in the modal: persist the
  // edited args first, then run the SAME execution path with those values.
  async function handleAcceptEdited(
    turn: ChatTurn,
    proposal: AgentProposal,
    args: ProposalArgsMap["propose_create_task"],
  ) {
    chat.updateProposalArgs(turn.id, proposal.id, args);
    await handleAccept(turn, { ...proposal, args } as AgentProposal);
  }

  async function handleAcceptEmailEdited(
    turn: ChatTurn,
    proposal: AgentProposal,
    args: ProposalArgsMap["propose_send_email"],
  ) {
    chat.updateProposalArgs(turn.id, proposal.id, args);
    await handleAccept(turn, { ...proposal, args } as AgentProposal);
  }

  function handleDecline(turn: ChatTurn, proposal: AgentProposal) {
    chat.setProposalStatus(turn.id, proposal.id, "declined");
    if (turn.messageId) {
      resolveProposal.mutate({
        messageId: turn.messageId,
        proposalId: proposal.id,
        status: "declined",
      });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Active agent picker */}
      <div className="flex items-center gap-2 border-b border-julow-glass-border px-3 py-2">
        {activeAgent && <AgentOrbAvatar seed={activeAgent.name} size="sm" />}
        <SelectField
          value={selectedAgentId ?? ""}
          onChange={setSelectedAgentId}
          ariaLabel={t("agentPanel.selectAgent")}
          className="min-w-0 flex-1"
          options={agentSelectOptions}
          selectedDescription={
            activeProfile
              ? [activeProfile.role, activeProfile.description]
                  .filter(Boolean)
                  .join(" — ")
              : undefined
          }
        />
        {activeProfile ? (
          <AgentProfileHint
            role={activeProfile.role}
            description={activeProfile.description}
            ariaLabel={t("agentPanel.agentInfo")}
          />
        ) : null}
        <button
          type="button"
          aria-label={t("agentSettings.open")}
          title={t("agentSettings.open")}
          onClick={() => setSettingsOpen(true)}
          className="shrink-0 rounded-lg p-1.5 text-julow-muted transition-colors hover:bg-julow-glass-bg hover:text-julow-fg"
        >
          <Icon icon={Settings02Icon} size={16} />
        </button>
      </div>

      <AgentSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        organizationId={organizationId}
      />

      <div
        ref={scrollRef}
        className="workspace-scroll flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {chat.messages.length === 0 && (
          <div className="glass-panel-subtle rounded-2xl px-3 py-2 text-sm text-julow-muted">
            {activeAgent?.name ?? "Agent"} {t("chat.intro")}
          </div>
        )}
        {chat.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${
              msg.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            {msg.role === "assistant" && activeAgent && (
              <div className="shrink-0 self-start">
                <AgentOrbAvatar seed={activeAgent.name} size="sm" />
              </div>
            )}
            <div
              className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent text-accent-foreground"
                  : "glass-panel-subtle w-full"
              }`}
            >
              {msg.role === "assistant" ? (
                <>
                  {msg.reasoning && (
                    <ReasoningBlock
                      reasoning={msg.reasoning}
                      streaming={msg.streaming}
                    />
                  )}
                  {msg.content ? (
                    <AgentMarkdown
                      content={msg.content}
                      onContentClick={handleContentClick}
                    />
                  ) : msg.streaming ? (
                    <ThinkingDots />
                  ) : null}
                  {msg.proposals.map((p) => (
                    <ProposalCard
                      key={p.id}
                      proposal={p}
                      busy={Boolean(busyProposals[p.id])}
                      onAccept={() => handleAccept(msg, p)}
                      onDecline={() => handleDecline(msg, p)}
                      onOpenTask={openTask}
                      onApproveEdited={(args) => handleAcceptEdited(msg, p, args)}
                      onApproveEmailEdited={(args) =>
                        handleAcceptEmailEdited(msg, p, args)
                      }
                      workspaceName={workspaceName}
                    />
                  ))}
                </>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-julow-glass-border px-3 py-3">
        <div
          ref={suggestionsRef}
          {...scrollProps}
          tabIndex={0}
          role="list"
          aria-label="Suggested prompts"
          className="julow-suggestion-strip mb-3 flex gap-1.5 overflow-x-auto pb-1 outline-none scrollbar-none"
        >
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              role="listitem"
              onClick={() => sendSuggestion(s)}
              className="julow-suggestion-chip"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative">
          {mention && mentionMatches.length > 0 && (
            <div className="julow-mention-pop">
              {mentionMatches.map((m, i) => (
                <button
                  key={`${m.kind}-${m.handle}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectMention(m.handle);
                  }}
                  className={`julow-mention-item ${i === mentionIndex ? "is-active" : ""}`}
                >
                  <span className="julow-mention-item__handle">@{m.handle}</span>
                  <span className="julow-mention-item__name">{m.name}</span>
                  <span className="julow-mention-item__sub">
                    {m.kind === "agent" ? t("agentPanel.mentionAgent") : m.sub}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="julow-chat-composer">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={onDraftChange}
              onKeyDown={onComposerKeyDown}
              placeholder={live ? t("chat.placeholder") : t("chat.connecting")}
              rows={1}
              className="julow-chat-composer__input resize-none"
            />
            <Button
              isIconOnly
              size="sm"
              variant={voice.recording ? "danger" : "ghost"}
              aria-label={t("chat.voiceInput")}
              isDisabled={voice.busy || !live}
              onPress={voice.toggle}
              className="julow-chat-composer__mic"
            >
              <Icon
                icon={
                  voice.busy
                    ? Loading03Icon
                    : voice.recording
                      ? StopIcon
                      : Mic01Icon
                }
                size={15}
                className={
                  voice.busy
                    ? "animate-spin"
                    : voice.recording
                      ? "julow-mic-live"
                      : undefined
                }
              />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="primary"
              aria-label={t("agentPanel.send")}
              isDisabled={!draft.trim() || chat.isStreaming || !live}
              onPress={submit}
              className="julow-chat-composer__send"
            >
              <Icon icon={ArrowUp02Icon} size={15} />
            </Button>
          </div>
          {voice.error && (
            <p className="mt-1.5 px-1 text-[11px] text-danger">{voice.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

const RUN_STATUS_COLOR: Record<string, "accent" | "warning" | "success" | "danger" | "default"> =
  {
    RUNNING: "accent",
    QUEUED: "warning",
    WAITING_APPROVAL: "warning",
    DONE: "success",
    FAILED: "danger",
    CANCELLED: "default",
  };

function AutomationQueue() {
  const { organizationId, isLive } = useTaskWorkspace();
  const { t } = useI18n();
  const runsQuery = api.agentRun.list.useQuery(
    { organizationId: organizationId ?? "", limit: 20 },
    { enabled: isLive, refetchInterval: 5000 },
  );
  const runs = runsQuery.data ?? [];

  return (
    <div className="workspace-scroll flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {runs.length === 0 ? (
        <div className="glass-panel-subtle rounded-xl px-3 py-2 text-sm text-julow-muted">
          {t("agentPanel.queueEmpty")}
        </div>
      ) : (
        runs.map((run) => (
          <div key={run.id} className="glass-panel-subtle rounded-xl p-3">
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium">{run.agent}</p>
              <Chip
                size="sm"
                variant="soft"
                color={RUN_STATUS_COLOR[run.status] ?? "default"}
              >
                {run.status.toLowerCase().replace("_", " ")}
              </Chip>
            </div>
            {run.result && (
              <p className="line-clamp-2 text-xs text-julow-muted">{run.result}</p>
            )}
            <p className="mt-1 text-[11px] text-julow-muted">
              {formatRelativeTime(run.createdAt)}
              {run.costUsd > 0 && ` · $${run.costUsd.toFixed(4)}`}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

function ActivityFeed() {
  const { organizationId, isLive } = useTaskWorkspace();
  const { t } = useI18n();
  const activityQuery = api.activity.list.useQuery(
    { organizationId: organizationId ?? "", limit: 40 },
    { enabled: isLive, refetchInterval: 10000 },
  );
  const items = activityQuery.data ?? [];

  return (
    <div className="workspace-scroll flex-1 space-y-2 overflow-y-auto px-4 py-3">
      {items.length === 0 ? (
        <div className="glass-panel-subtle rounded-xl px-3 py-2 text-sm text-julow-muted">
          {t("agentPanel.activityEmpty")}
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="flex gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-julow-glass-bg"
          >
            <span
              className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                item.type === "agent"
                  ? "bg-accent"
                  : item.type === "automation"
                    ? "bg-warning"
                    : "bg-success"
              }`}
            />
            <div className="min-w-0 text-sm">
              <p className="leading-snug">
                <span className="font-medium">{item.actor}</span>{" "}
                <span className="text-julow-muted">{item.action}</span>{" "}
                <span className="font-medium">{item.target}</span>
              </p>
              <p className="text-[11px] text-julow-muted">{item.time}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

type AgentStripProps = {
  variant: "expand" | "focus-agent";
  onPress: () => void;
};

export function AgentStrip({ variant, onPress }: AgentStripProps) {
  const isFocus = variant === "focus-agent";

  return (
    <aside
      className={`glass-panel julow-agent-strip flex h-full w-[var(--rail-collapsed-width)] shrink-0 flex-col items-center overflow-hidden border-l-0 py-3 ${
        isFocus ? "julow-agent-strip--during-task" : ""
      }`}
    >
      <Button
        isIconOnly
        size="sm"
        variant={isFocus ? "secondary" : "ghost"}
        aria-label={isFocus ? "Open agent panel" : "Expand agent panel"}
        onPress={onPress}
        className={isFocus ? "julow-agent-strip__launcher" : undefined}
      >
        <Icon icon={AiChat01Icon} size={18} />
      </Button>
    </aside>
  );
}

type AgentPanelFullProps = {
  onCollapse: () => void;
  embedded?: boolean;
  className?: string;
};

export function AgentPanelFull({
  onCollapse,
  embedded = false,
  className = "",
}: AgentPanelFullProps) {
  const { t } = useI18n();
  return (
    <aside
      className={`julow-agent-panel-full flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l-0 ${
        embedded
          ? "julow-agent-panel-full--embedded w-full max-w-full min-w-0 bg-transparent shadow-none"
          : "glass-panel w-[var(--panel-width)]"
      } ${className}`.trim()}
    >
      <div className="julow-agent-panel-full__header flex items-center justify-between border-b border-julow-glass-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon icon={AiChat01Icon} size={18} className="text-accent" />
          <span className="text-sm font-medium">{t("nav.agents")}</span>
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={t("agentPanel.collapse")}
          onPress={onCollapse}
        >
          ×
        </Button>
      </div>

      <Tabs
        defaultSelectedKey="chat"
        className="julow-agent-tabs flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <Tabs.ListContainer className="border-b border-julow-glass-border px-3 py-2.5">
          <Tabs.List aria-label={t("agentPanel.tabsLabel")} className="w-full">
            {agentPanelTabs.map((tab) => (
              <Tabs.Tab key={tab.id} id={tab.id} className="julow-agent-tab">
                <Icon
                  icon={tab.icon}
                  size={14}
                  className="julow-agent-tab-icon shrink-0"
                />
                <span className="truncate">{t(tab.labelKey)}</span>
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="chat" className="flex min-h-0 flex-1 flex-col">
          <AgentChat />
        </Tabs.Panel>
        <Tabs.Panel id="queue" className="flex min-h-0 flex-1 flex-col">
          <AutomationQueue />
        </Tabs.Panel>
        <Tabs.Panel id="activity" className="flex min-h-0 flex-1 flex-col">
          <ActivityFeed />
        </Tabs.Panel>
      </Tabs>
    </aside>
  );
}

/** @deprecated Use AgentPanelFull + AgentStrip via WorkspaceRightRail */
type AgentPanelProps = {
  collapsed: boolean;
  onToggle: () => void;
  embedded?: boolean;
  stripMode?: boolean;
  className?: string;
};

export function AgentPanel({
  collapsed,
  onToggle,
  embedded = false,
  stripMode = false,
  className = "",
}: AgentPanelProps) {
  if (collapsed || stripMode) {
    return (
      <AgentStrip
        variant={stripMode ? "focus-agent" : "expand"}
        onPress={onToggle}
      />
    );
  }

  return (
    <AgentPanelFull
      onCollapse={onToggle}
      embedded={embedded}
      className={className}
    />
  );
}
