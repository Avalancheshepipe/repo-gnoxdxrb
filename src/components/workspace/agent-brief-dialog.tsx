"use client";

import {
  BookOpen01Icon,
  PlayIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select-field";
import { Toggle } from "@/components/ui/toggle";
import { AgentOrbAvatar } from "@/components/workspace/agent-avatar";
import { api } from "@/lib/trpc";
import type { InboxTask, TaskAgentBriefTool } from "@/lib/workspace-data";

type AgentBriefDialogProps = {
  open: boolean;
  onClose: () => void;
  task: InboxTask;
  organizationId: string | null;
  /** When set, edit THIS agent's brief (no picker). Otherwise pick an agent. */
  agentId?: string | null;
};

const TOOL_KEYS: TaskAgentBriefTool[] = [
  "general",
  "research",
  "document",
  "report",
  "review",
];

/**
 * Brief ONE agent on a task: task-specific instructions, which real capability
 * (web research / document / report / review) it should use, and extra
 * knowledge. The brief is persisted per (task, agent) via `task.setBrief`.
 * "Assign & run" starts a real autonomous run using the agent's tools.
 */
export function AgentBriefDialog({
  open,
  onClose,
  task,
  organizationId,
  agentId: fixedAgentId,
}: AgentBriefDialogProps) {
  const { t, locale } = useI18n();
  const utils = api.useUtils();

  const agentsQuery = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: Boolean(organizationId) && open, staleTime: 60_000 },
  );
  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);

  const briefsQuery = api.task.briefs.useQuery(
    { taskId: task.id },
    { enabled: open, staleTime: 0 },
  );
  const briefs = useMemo(() => briefsQuery.data ?? [], [briefsQuery.data]);

  const [agentId, setAgentId] = useState(fixedAgentId ?? "");
  const [tool, setTool] = useState<TaskAgentBriefTool>("general");
  const [instructions, setInstructions] = useState("");
  const [webSearch, setWebSearch] = useState(true);
  const [researchQuery, setResearchQuery] = useState("");
  const [format, setFormat] = useState<"word" | "excel" | "pdf">("word");
  const [documentSpec, setDocumentSpec] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const seededRef = useRef<string>("");

  // Seed the agent selection once when the dialog opens.
  useEffect(() => {
    if (!open) {
      seededRef.current = "";
      return;
    }
    setAgentId(
      fixedAgentId ??
        task.assigneeAgentIds[0] ??
        agents.find((a) => a.name.toLowerCase().includes("orchestrator"))?.id ??
        agents[0]?.id ??
        "",
    );
  }, [open, fixedAgentId, task.id, task.assigneeAgentIds, agents]);

  // Seed the form fields from the selected agent's stored brief (once per
  // open+agent), so switching agents loads that agent's brief.
  useEffect(() => {
    if (!open || !agentId) return;
    const key = `${task.id}:${agentId}`;
    if (seededRef.current === key) return;
    if (briefsQuery.isLoading) return;
    seededRef.current = key;
    const brief = briefs.find((b) => b.agentId === agentId);
    setTool(brief?.tool ?? "general");
    setInstructions(brief?.instructions ?? "");
    setWebSearch(brief?.options?.webSearch ?? true);
    setResearchQuery(brief?.options?.researchQuery ?? "");
    setFormat(brief?.options?.format ?? "word");
    setDocumentSpec(brief?.options?.documentSpec ?? "");
    setKnowledge(brief?.knowledge ?? "");
  }, [open, agentId, task.id, briefs, briefsQuery.isLoading]);

  const setBrief = api.task.setBrief.useMutation();
  const runAgent = api.task.runAgent.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.task.list.invalidate(),
        utils.task.briefs.invalidate({ taskId: task.id }),
        utils.agentRun.invalidate(),
        utils.activity.invalidate(),
      ]);
      onClose();
    },
  });

  function buildBrief() {
    return {
      instructions: instructions.trim() || undefined,
      tool,
      options: {
        webSearch: tool === "research" ? webSearch : undefined,
        researchQuery:
          tool === "research" ? researchQuery.trim() || undefined : undefined,
        format: tool === "document" ? format : undefined,
        documentSpec:
          tool === "document" ? documentSpec.trim() || undefined : undefined,
      },
      knowledge: knowledge.trim() || undefined,
    };
  }

  async function save() {
    if (!agentId) return;
    await setBrief.mutateAsync({ taskId: task.id, agentId, ...buildBrief() });
    await Promise.all([
      utils.task.list.invalidate(),
      utils.task.briefs.invalidate({ taskId: task.id }),
    ]);
    onClose();
  }

  function run() {
    if (!agentId) return;
    runAgent.mutate({ taskId: task.id, agentId, brief: buildBrief(), locale });
  }

  const activeAgent = agents.find((a) => a.id === agentId) ?? null;
  const saving = setBrief.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-lg"
      title={t("brief.title")}
      description={t("brief.description")}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="outline" isDisabled={!agentId || saving} onPress={save}>
            {saving ? "…" : t("brief.save")}
          </Button>
          <Button
            variant="primary"
            isDisabled={!agentId || runAgent.isPending}
            onPress={run}
          >
            <Icon icon={PlayIcon} size={14} />
            {runAgent.isPending ? t("brief.running") : t("brief.assignRun")}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="flex items-center gap-2.5 rounded-xl border border-julow-glass-border bg-julow-glass-bg/40 px-3 py-2">
          {activeAgent && <AgentOrbAvatar seed={activeAgent.name} size="sm" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{task.title}</p>
            <p className="truncate text-[11px] text-julow-muted">
              {activeAgent ? activeAgent.role : t("brief.pickAgent")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {!fixedAgentId && (
            <div>
              <label className="julow-field-label">{t("brief.agent")}</label>
              <SelectField
                value={agentId}
                onChange={setAgentId}
                ariaLabel={t("brief.agent")}
                options={agents.map((a) => ({ value: a.id, label: a.name }))}
              />
            </div>
          )}
          <div className={fixedAgentId ? "sm:col-span-2" : undefined}>
            <label className="julow-field-label">{t("brief.tool")}</label>
            <SelectField
              value={tool}
              onChange={(v) => setTool(v as TaskAgentBriefTool)}
              ariaLabel={t("brief.tool")}
              options={TOOL_KEYS.map((k) => ({
                value: k,
                label: t(`brief.tool.${k}`),
              }))}
            />
          </div>
        </div>

        <div>
          <label className="julow-field-label">{t("brief.instructions")}</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={t("brief.instructionsPlaceholder")}
            rows={3}
            className="julow-input resize-none"
          />
        </div>

        {tool === "research" && (
          <div className="space-y-3 rounded-xl border border-julow-glass-border bg-julow-glass-bg/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Icon icon={Settings02Icon} size={15} className="text-accent" />
                {t("brief.webSearch")}
              </div>
              <Toggle
                isSelected={webSearch}
                onChange={setWebSearch}
                aria-label={t("brief.webSearch")}
              />
            </div>
            <input
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              placeholder={t("brief.researchPlaceholder")}
              className="julow-input"
            />
          </div>
        )}

        {tool === "document" && (
          <div className="space-y-3 rounded-xl border border-julow-glass-border bg-julow-glass-bg/30 p-3">
            <div>
              <label className="julow-field-label">{t("brief.format")}</label>
              <SelectField
                value={format}
                onChange={(v) => setFormat(v as "word" | "excel" | "pdf")}
                ariaLabel={t("brief.format")}
                options={[
                  { value: "word", label: t("brief.formatWord") },
                  { value: "excel", label: t("brief.formatExcel") },
                  { value: "pdf", label: t("brief.formatPdf") },
                ]}
              />
            </div>
            <div>
              <label className="julow-field-label">{t("brief.documentSpec")}</label>
              <textarea
                value={documentSpec}
                onChange={(e) => setDocumentSpec(e.target.value)}
                placeholder={t("brief.documentSpecPlaceholder")}
                rows={2}
                className="julow-input resize-none"
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setKnowledgeOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-julow-glass-border px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-julow-glass-bg/40"
        >
          <Icon icon={BookOpen01Icon} size={16} className="text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("brief.knowledge")}</p>
            <p className="truncate text-[11px] text-julow-muted">
              {knowledge.trim() ? knowledge.trim() : t("brief.knowledgeHint")}
            </p>
          </div>
        </button>
      </div>

      <Modal
        open={knowledgeOpen}
        onClose={() => setKnowledgeOpen(false)}
        elevated
        width="max-w-md"
        title={t("brief.knowledge")}
        description={t("brief.knowledgeDescription")}
        footer={
          <Button variant="primary" onPress={() => setKnowledgeOpen(false)}>
            {t("common.gotIt")}
          </Button>
        }
      >
        <textarea
          value={knowledge}
          onChange={(e) => setKnowledge(e.target.value)}
          placeholder={t("brief.knowledgePlaceholder")}
          rows={7}
          className="julow-input resize-none"
          autoFocus
        />
      </Modal>
    </Modal>
  );
}
