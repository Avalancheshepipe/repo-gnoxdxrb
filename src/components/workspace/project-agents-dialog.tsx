"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { AgentOrbAvatar } from "@/components/workspace/agent-avatar";
import { api } from "@/lib/trpc";

type ProjectAgentsDialogProps = {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName: string;
  organizationId: string | null;
};

/**
 * Subscribe agents (the fixed roster) to a project — their zone of
 * responsibility. Optional per-project instructions refine how each works here.
 */
export function ProjectAgentsDialog({
  open,
  onClose,
  projectId,
  projectName,
  organizationId,
}: ProjectAgentsDialogProps) {
  const { t } = useI18n();
  const utils = api.useUtils();

  const agentsQuery = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: Boolean(organizationId) && open, staleTime: 60_000 },
  );
  const subsQuery = api.project.agents.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) && open },
  );

  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);
  const subs = useMemo(() => subsQuery.data ?? [], [subsQuery.data]);
  const subById = useMemo(
    () => new Map(subs.map((s) => [s.agentId, s])),
    [subs],
  );

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setDrafts(Object.fromEntries(subs.map((s) => [s.agentId, s.instructions])));
  }, [open, subs]);

  const subscribe = api.project.subscribeAgent.useMutation({
    onSuccess: () => projectId && void utils.project.agents.invalidate({ projectId }),
  });
  const unsubscribe = api.project.unsubscribeAgent.useMutation({
    onSuccess: () => projectId && void utils.project.agents.invalidate({ projectId }),
  });

  if (!projectId) return null;

  const toggle = (agentId: string, on: boolean) => {
    if (!on) {
      unsubscribe.mutate({ projectId, agentId });
      return;
    }
    subscribe.mutate({ projectId, agentId, instructions: drafts[agentId] || undefined });
  };

  const saveInstructions = (agentId: string) => {
    if (!subById.has(agentId)) return;
    subscribe.mutate({ projectId, agentId, instructions: drafts[agentId] || undefined });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-lg"
      title={t("projectAgents.title")}
      description={`${t("projectAgents.description")} ${projectName}`}
      footer={
        <Button variant="primary" onPress={onClose}>
          {t("common.gotIt")}
        </Button>
      }
    >
      <div className="space-y-2.5">
        {agents.map((a) => {
          const subscribed = subById.has(a.id);
          return (
            <div
              key={a.id}
              className={`rounded-xl border p-3 transition-colors ${
                subscribed
                  ? "border-accent/40 bg-accent/5"
                  : "border-julow-glass-border bg-julow-glass-bg/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AgentOrbAvatar seed={a.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-[11px] text-julow-muted">{a.role}</p>
                </div>
                <Button
                  size="sm"
                  variant={subscribed ? "secondary" : "outline"}
                  onPress={() => toggle(a.id, !subscribed)}
                >
                  {subscribed && <Icon icon={Tick02Icon} size={14} />}
                  {subscribed
                    ? t("projectAgents.subscribed")
                    : t("projectAgents.subscribe")}
                </Button>
              </div>
              {subscribed && (
                <input
                  value={drafts[a.id] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [a.id]: e.target.value }))
                  }
                  onBlur={() => saveInstructions(a.id)}
                  placeholder={t("projectAgents.instructionsPlaceholder")}
                  className="julow-input mt-2.5"
                />
              )}
            </div>
          );
        })}
        {agents.length === 0 && (
          <p className="text-sm text-julow-muted">{t("agents.noActivity")}</p>
        )}
      </div>
    </Modal>
  );
}
