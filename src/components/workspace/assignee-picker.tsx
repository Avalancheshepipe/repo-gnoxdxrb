"use client";

import { Add01Icon, Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Avatar, Button, Popover } from "@heroui/react";
import { useMemo } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { AgentOrbAvatar } from "@/components/workspace/agent-avatar";
import { api } from "@/lib/trpc";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type AssigneePickerValue = { userIds: string[]; agentIds: string[] };

type AssigneePickerProps = {
  organizationId: string | null;
  value: AssigneePickerValue;
  onChange: (next: AssigneePickerValue) => void;
};

/** Pick WHO works on a task — workspace members and/or agents. */
export function AssigneePicker({
  organizationId,
  value,
  onChange,
}: AssigneePickerProps) {
  const { t } = useI18n();
  const enabled = Boolean(organizationId);
  const membersQuery = api.workspace.members.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled, staleTime: 60_000 },
  );
  const agentsQuery = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled, staleTime: 60_000 },
  );

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);

  const toggleUser = (userId: string) => {
    const has = value.userIds.includes(userId);
    onChange({
      ...value,
      userIds: has
        ? value.userIds.filter((id) => id !== userId)
        : [...value.userIds, userId],
    });
  };
  const toggleAgent = (agentId: string) => {
    const has = value.agentIds.includes(agentId);
    onChange({
      ...value,
      agentIds: has
        ? value.agentIds.filter((id) => id !== agentId)
        : [...value.agentIds, agentId],
    });
  };

  const selectedMembers = members.filter((m) => value.userIds.includes(m.user.id));
  const selectedAgents = agents.filter((a) => value.agentIds.includes(a.id));
  const total = selectedMembers.length + selectedAgents.length;

  return (
    <div className="julow-assignee-picker">
      <div className="julow-assignee-picker__chips">
        {selectedMembers.map((m) => (
          <span key={`u-${m.user.id}`} className="julow-assignee-chip">
            <Avatar size="sm" color="default" className="julow-assignee-chip__avatar">
              <Avatar.Fallback>{initials(m.user.name ?? m.user.email)}</Avatar.Fallback>
            </Avatar>
            <span className="truncate">{m.user.name ?? m.user.email}</span>
            <button
              type="button"
              aria-label={t("common.delete")}
              className="julow-assignee-chip__remove"
              onClick={() => toggleUser(m.user.id)}
            >
              <Icon icon={Cancel01Icon} size={11} />
            </button>
          </span>
        ))}
        {selectedAgents.map((a) => (
          <span key={`a-${a.id}`} className="julow-assignee-chip julow-assignee-chip--agent">
            <AgentOrbAvatar seed={a.name} size="sm" className="julow-assignee-chip__avatar" />
            <span className="truncate">{a.name}</span>
            <button
              type="button"
              aria-label={t("common.delete")}
              className="julow-assignee-chip__remove"
              onClick={() => toggleAgent(a.id)}
            >
              <Icon icon={Cancel01Icon} size={11} />
            </button>
          </span>
        ))}

        <Popover>
          <Popover.Trigger>
            <button type="button" className="julow-assignee-add" aria-label={t("task.addAssignee")}>
              <Icon icon={Add01Icon} size={14} />
              {total === 0 && <span>{t("task.addAssignee")}</span>}
            </button>
          </Popover.Trigger>
          <Popover.Content
            placement="bottom start"
            className="julow-assignee-pop-content w-72 p-0"
          >
            <Popover.Dialog className="p-0">
              <div className="julow-assignee-pop">
                <p className="julow-assignee-pop__label">{t("task.members")}</p>
                {members.length === 0 && (
                  <p className="julow-assignee-pop__empty">{t("share.members")}</p>
                )}
                {members.map((m) => {
                  const checked = value.userIds.includes(m.user.id);
                  return (
                    <button
                      key={m.user.id}
                      type="button"
                      className={`julow-assignee-row ${checked ? "is-selected" : ""}`}
                      onClick={() => toggleUser(m.user.id)}
                    >
                      <Avatar size="sm" color="default">
                        <Avatar.Fallback>
                          {initials(m.user.name ?? m.user.email)}
                        </Avatar.Fallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-left">
                        {m.user.name ?? m.user.email}
                      </span>
                      {checked && <Icon icon={Tick02Icon} size={15} className="text-accent" />}
                    </button>
                  );
                })}

                <p className="julow-assignee-pop__label">{t("inbox.agents")}</p>
                {agents.map((a) => {
                  const checked = value.agentIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={`julow-assignee-row ${checked ? "is-selected" : ""}`}
                      onClick={() => toggleAgent(a.id)}
                    >
                      <AgentOrbAvatar seed={a.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-left">
                        {a.name}
                        <span className="block truncate text-[11px] text-julow-muted">
                          {a.role}
                        </span>
                      </span>
                      {checked && <Icon icon={Tick02Icon} size={15} className="text-accent" />}
                    </button>
                  );
                })}
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>
    </div>
  );
}
