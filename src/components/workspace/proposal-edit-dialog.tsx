"use client";

import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { ColorSelectField } from "@/components/ui/color-select-field";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Icon } from "@/components/ui/icon";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Modal } from "@/components/ui/modal";
import { AssigneePicker } from "@/components/workspace/assignee-picker";
import {
  priorityOptions,
  statusOptions,
} from "@/components/workspace/task-field-options";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import { assigneeIdsToTokens, resolveAssigneeTokens } from "@/lib/assignees";
import type {
  AgentProposal,
  ProposalArgsMap,
  TaskPriorityArg,
  TaskStatusArg,
} from "@/lib/agent-proposals";
import { api } from "@/lib/trpc";

type CreateProposal = Extract<AgentProposal, { kind: "propose_create_task" }>;
type AssigneeValue = { userIds: string[]; agentIds: string[] };

type ProposalEditDialogProps = {
  open: boolean;
  proposal: CreateProposal;
  busy: boolean;
  onClose: () => void;
  onApprove: (args: ProposalArgsMap["propose_create_task"]) => void;
  onDecline: () => void;
};

/**
 * Edit a still-pending "create task" proposal before approving it. The form
 * mirrors the inbox task detail (title, Markdown description, status, priority,
 * RU/EN due date, tags, assignees). Approving runs the SAME human-in-the-loop
 * execution path with the edited values — nothing is written until approve.
 */
export function ProposalEditDialog({
  open,
  proposal,
  busy,
  onClose,
  onApprove,
  onDecline,
}: ProposalEditDialogProps) {
  const { t } = useI18n();
  const { organizationId, user } = useTaskWorkspace();
  const args = proposal.args;

  const membersQuery = api.workspace.members.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: open && Boolean(organizationId), staleTime: 60_000 },
  );
  const agentsQuery = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: open && Boolean(organizationId), staleTime: 60_000 },
  );
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);

  const [title, setTitle] = useState(args.title ?? "");
  const [description, setDescription] = useState(args.description ?? "");
  const [tags, setTags] = useState<string[]>(args.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [status, setStatus] = useState<TaskStatusArg>(args.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriorityArg>(
    args.priority ?? "medium",
  );
  const [dueDate, setDueDate] = useState<string | null>(args.dueDate ?? null);
  // Null until the user edits assignees — then it overrides the resolved set.
  const [assigneeOverride, setAssigneeOverride] = useState<AssigneeValue | null>(
    null,
  );

  // (Re)initialize the form each time the dialog opens for this proposal.
  useEffect(() => {
    if (!open) return;
    setTitle(args.title ?? "");
    setDescription(args.description ?? "");
    setTags(args.tags ?? []);
    setTagDraft("");
    setStatus(args.status ?? "todo");
    setPriority(args.priority ?? "medium");
    setDueDate(args.dueDate ?? null);
    setAssigneeOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proposal.id]);

  // Assignees resolved from the proposal's handles, until the user edits them.
  const resolved = useMemo(
    () => resolveAssigneeTokens(args.assignees, { agents, members, user }),
    [args.assignees, agents, members, user],
  );
  const assignees: AssigneeValue =
    assigneeOverride ?? { userIds: resolved.userIds, agentIds: resolved.agentIds };

  const addTag = () => {
    const v = tagDraft.trim().toLowerCase();
    if (!v || tags.includes(v)) {
      setTagDraft("");
      return;
    }
    setTags((prev) => [...prev, v]);
    setTagDraft("");
  };

  const approve = () => {
    // Untouched → keep the original tokens (avoids a load race dropping people).
    // Edited → convert the chosen ids back into @handle tokens.
    const finalAssignees =
      assigneeOverride === null
        ? args.assignees
        : assigneeIdsToTokens(assigneeOverride, { agents, members });
    onApprove({
      ...args,
      title: title.trim() || args.title,
      description: description.trim() ? description : undefined,
      tags,
      status,
      priority,
      dueDate: dueDate ?? undefined,
      assignees:
        finalAssignees && finalAssignees.length ? finalAssignees : undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("proposal.editTitle")}
      description={t("proposal.editDescription")}
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" isDisabled={busy} onPress={onDecline}>
            <Icon icon={Cancel01Icon} size={14} />
            {t("agentPanel.decline")}
          </Button>
          <Button
            variant="primary"
            isDisabled={busy || !title.trim()}
            onPress={approve}
          >
            <Icon icon={Tick02Icon} size={14} />
            {busy ? t("agentPanel.working") : t("agentPanel.approve")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="julow-task-detail__section">
          <p className="julow-task-detail__label">{t("newTask.titleField")}</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("newTask.titlePlaceholder")}
            className="julow-task-detail__title-input"
            aria-label={t("newTask.titleField")}
          />
        </div>

        <div className="julow-task-detail__section">
          <p className="julow-task-detail__label">{t("task.description")}</p>
          <div className="julow-task-detail__editor">
            <MarkdownEditor value={description} onChange={setDescription} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="julow-task-detail__section">
            <p className="julow-task-detail__label">{t("task.status")}</p>
            <ColorSelectField
              value={status}
              onChange={(v) => setStatus(v as TaskStatusArg)}
              ariaLabel={t("task.status")}
              options={statusOptions(t)}
            />
          </div>
          <div className="julow-task-detail__section">
            <p className="julow-task-detail__label">{t("task.priority")}</p>
            <ColorSelectField
              value={priority}
              onChange={(v) => setPriority(v as TaskPriorityArg)}
              ariaLabel={t("task.priority")}
              options={priorityOptions(t)}
            />
          </div>
        </div>

        <div className="julow-task-detail__section">
          <p className="julow-task-detail__label">{t("task.due")}</p>
          <DatePickerField
            value={dueDate}
            onChange={(iso) => setDueDate(iso)}
            ariaLabel={t("task.due")}
            clearLabel={t("common.delete")}
          />
        </div>

        <div className="julow-task-detail__section">
          <p className="julow-task-detail__label">{t("task.tags")}</p>
          <div className="julow-tag-field">
            {tags.map((tag) => (
              <span key={tag} className="julow-tag-chip">
                {tag}
                <button
                  type="button"
                  aria-label={`${t("common.delete")} ${tag}`}
                  onClick={() => setTags(tags.filter((x) => x !== tag))}
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
        </div>

        <div className="julow-task-detail__section">
          <p className="julow-task-detail__label">{t("task.assignees")}</p>
          <AssigneePicker
            organizationId={organizationId}
            value={assignees}
            onChange={setAssigneeOverride}
          />
        </div>
      </div>
    </Modal>
  );
}
