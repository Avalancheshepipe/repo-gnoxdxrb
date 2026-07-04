"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { ColorSelectField } from "@/components/ui/color-select-field";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Icon } from "@/components/ui/icon";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Modal } from "@/components/ui/modal";
import { AssigneePicker } from "@/components/workspace/assignee-picker";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import {
  priorityOptions,
  statusOptions,
} from "@/components/workspace/task-field-options";
import type { TaskPriority, TaskStatus } from "@/lib/workspace-data";

export function NewTaskDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { activeProject, activeProjectId, organizationId, createTask, isCreatingTask } =
    useTaskWorkspace();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [assignees, setAssignees] = useState<{ userIds: string[]; agentIds: string[] }>({
    userIds: [],
    agentIds: [],
  });

  function reset() {
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setDueDate(null);
    setTags([]);
    setTagDraft("");
    setAssignees({ userIds: [], agentIds: [] });
  }

  function close() {
    reset();
    onClose();
  }

  function addTag() {
    const v = tagDraft.trim().toLowerCase();
    if (!v || tags.includes(v)) {
      setTagDraft("");
      return;
    }
    setTags((prev) => [...prev, v]);
    setTagDraft("");
  }

  async function submit() {
    if (!title.trim() || !activeProjectId) return;
    await createTask({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      dueDate,
      tags,
      assigneeUserIds: assignees.userIds,
      assigneeAgentIds: assignees.agentIds,
    });
    close();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      width="max-w-xl"
      title={t("common.newTask")}
      description={
        activeProject
          ? `${t("newTask.inProject")} ${activeProject.name}`
          : t("newTask.description")
      }
      footer={
        <>
          <Button variant="ghost" onPress={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            isDisabled={!title.trim() || !activeProjectId || isCreatingTask}
            onPress={submit}
          >
            {isCreatingTask ? "…" : t("common.create")}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div>
          <label htmlFor="task-title" className="julow-field-label">
            {t("newTask.titleField")}
          </label>
          <input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("newTask.titlePlaceholder")}
            className="julow-input"
            autoFocus
          />
        </div>

        <div>
          <label className="julow-field-label">{t("task.description")}</label>
          <div className="julow-task-detail__editor">
            <MarkdownEditor
              value={description}
              onChange={setDescription}
              placeholder={t("newTask.descPlaceholder")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="julow-field-label">{t("task.status")}</label>
            <ColorSelectField
              value={status}
              onChange={(v) => setStatus(v as TaskStatus)}
              ariaLabel={t("task.status")}
              options={statusOptions(t)}
            />
          </div>
          <div>
            <label className="julow-field-label">{t("task.priority")}</label>
            <ColorSelectField
              value={priority}
              onChange={(v) => setPriority(v as TaskPriority)}
              ariaLabel={t("task.priority")}
              options={priorityOptions(t)}
            />
          </div>
          <div>
            <label className="julow-field-label">{t("task.due")}</label>
            <DatePickerField
              value={dueDate}
              onChange={setDueDate}
              ariaLabel={t("task.due")}
              clearLabel={t("common.delete")}
            />
          </div>
        </div>

        <div>
          <label className="julow-field-label">{t("task.tags")}</label>
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

        <div>
          <label className="julow-field-label">{t("task.assignees")}</label>
          <AssigneePicker
            organizationId={organizationId}
            value={assignees}
            onChange={setAssignees}
          />
        </div>
      </div>
    </Modal>
  );
}
