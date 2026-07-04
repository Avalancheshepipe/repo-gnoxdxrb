"use client";

import {
  AiBrain01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  Link01Icon,
  Message01Icon,
  WorkflowCircle01Icon,
} from "@hugeicons/core-free-icons";
import { Button, Card, Chip } from "@heroui/react";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Toggle } from "@/components/ui/toggle";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import { api } from "@/lib/trpc";
import {
  deadlineRules,
  type DeadlineRule,
  type MessengerChannel,
} from "@/lib/workspace-data";

type AutomationRule = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  runsToday: number;
  aiManaged: boolean;
};

const platformLabels: Record<MessengerChannel["platform"], string> = {
  telegram: "Telegram",
  brf: "BRF",
  slack: "Slack",
  discord: "Discord",
};

const platformColors: Record<MessengerChannel["platform"], string> = {
  telegram: "text-sky-500",
  brf: "text-violet-500",
  slack: "text-purple-500",
  discord: "text-indigo-500",
};

function AutomationOverview({
  rules,
  channels,
}: {
  rules: AutomationRule[];
  channels: MessengerChannel[];
}) {
  const { t } = useI18n();
  const connected = channels.filter((c) => c.connected).length;
  const active = rules.filter((r) => r.enabled).length;
  const runsToday = rules.reduce((sum, r) => sum + r.runsToday, 0);

  const stats = [
    { label: t("automations.channelsConnected"), value: `${connected}/${channels.length}` },
    { label: t("automations.automationsOn"), value: String(active) },
    { label: t("automations.runsToday"), value: String(runsToday) },
  ];

  return (
    <div className="mb-8 grid grid-cols-1 gap-3 lg:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="glass-panel rounded-2xl px-4 py-3">
          <p className="text-[11px] font-medium text-julow-muted">{stat.label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

function MessengerCard({ channel }: { channel: MessengerChannel }) {
  const { t } = useI18n();
  return (
    <article className="glass-panel flex h-full flex-col rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-julow-glass-bg">
          <Icon
            icon={Message01Icon}
            size={16}
            className={platformColors[channel.platform]}
          />
        </div>
        <Chip
          size="sm"
          variant="soft"
          color={channel.connected ? "success" : "default"}
        >
          {channel.connected ? t("automations.connected") : t("automations.notConnected")}
        </Chip>
      </div>

      <h3 className="mt-3 text-sm font-medium">{channel.name}</h3>
      <p className="mt-0.5 text-xs text-julow-muted">{channel.handle}</p>

      <Chip size="sm" variant="soft" className="mt-3 w-fit">
        {platformLabels[channel.platform]}
      </Chip>

      <p className="mt-3 text-xs leading-relaxed text-julow-muted">
        {channel.connected
          ? t("automations.mentionHint")
          : t("automations.linkHint").replace(
              "{platform}",
              platformLabels[channel.platform],
            )}
      </p>

      {channel.connected && channel.lastMessage && (
        <p className="mt-auto truncate pt-3 text-[11px] text-julow-muted">
          {t("automations.latest")}: {channel.lastMessage}
        </p>
      )}

      {!channel.connected && (
        <Button size="sm" variant="outline" fullWidth className="mt-4">
          <Icon icon={Link01Icon} size={14} />
          {t("automations.connect")}
        </Button>
      )}
    </article>
  );
}

function AutomationRuleCard({
  rule,
  onToggle,
  disabled,
}: {
  rule: AutomationRule;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Card variant="secondary" className="glass-panel julow-automation-rule">
      <Card.Header className="flex-row items-start justify-between gap-4 pb-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Card.Title className="text-sm font-semibold">{rule.name}</Card.Title>
            {rule.aiManaged && (
              <Chip size="sm" variant="soft" color="accent">
                <Icon icon={AiBrain01Icon} size={12} />
                {t("automations.aiManaged")}
              </Chip>
            )}
          </div>
          <Card.Description className="mt-1 max-w-3xl text-xs leading-relaxed">
            {rule.description}
          </Card.Description>
        </div>
        <Toggle
          isSelected={rule.enabled}
          onChange={onToggle}
          isDisabled={disabled}
          aria-label={`Toggle ${rule.name}`}
        />
      </Card.Header>

      <Card.Content className="pt-3">
        <div className="julow-automation-flow">
          <div className="julow-automation-flow__step">
            <span className="julow-automation-flow__label">{t("automations.when")}</span>
            <p className="julow-automation-flow__value">{rule.trigger}</p>
          </div>

          <div className="julow-automation-flow__connector" aria-hidden>
            <Icon icon={ArrowRight01Icon} size={16} />
          </div>

          <div className="julow-automation-flow__step">
            <span className="julow-automation-flow__label">{t("automations.then")}</span>
            <p className="julow-automation-flow__value">{rule.action}</p>
          </div>
        </div>

        <div className="mt-3">
          <Chip size="sm" variant="soft" className="text-julow-muted">
            {rule.runsToday > 0
              ? t("automations.runsTodayCount").replace("{count}", String(rule.runsToday))
              : t("automations.noRunsToday")}
          </Chip>
        </div>
      </Card.Content>
    </Card>
  );
}

function DeadlineRuleCard({ rule }: { rule: DeadlineRule }) {
  const { t } = useI18n();
  return (
    <article className="glass-panel flex h-full flex-col rounded-2xl p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-julow-muted">
        {t("automations.appliesTo")}
      </p>
      <h3 className="mt-1 text-sm font-medium">{rule.taskPattern}</h3>

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-julow-muted">
        {t("automations.whatHappens")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-julow-muted">{rule.behavior}</p>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-[11px] text-julow-muted">
        <span>
          {t("automations.runs")}: {rule.nextRun}
        </span>
        <Chip size="sm" variant="soft">
          {rule.managedBy}
        </Chip>
      </div>
    </article>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: typeof Message01Icon;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <Icon icon={icon} size={18} className="text-accent" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-julow-muted">
        {description}
      </p>
    </div>
  );
}

function NewAutomationDialog({
  open,
  onClose,
  organizationId,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string | null;
}) {
  const { t } = useI18n();
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("");
  const [action, setAction] = useState("");
  const [aiManaged, setAiManaged] = useState(true);

  const create = api.automation.create.useMutation({
    onSuccess: async () => {
      if (organizationId)
        await utils.automation.list.invalidate({ organizationId });
      setName("");
      setDescription("");
      setTrigger("");
      setAction("");
      onClose();
    },
  });

  function submit() {
    if (!organizationId || !name.trim()) return;
    create.mutate({
      organizationId,
      name: name.trim(),
      description: description.trim() || undefined,
      trigger: { type: "custom", label: trigger.trim() || "Custom trigger" },
      action: { type: "custom", label: action.trim() || "Custom action" },
      aiManaged,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("automation.newTitle")}
      description={t("automation.newDescription")}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            isDisabled={!name.trim() || create.isPending}
            onPress={submit}
          >
            {create.isPending ? "…" : t("common.create")}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div>
          <label htmlFor="auto-name" className="julow-field-label">
            {t("automation.name")}
          </label>
          <input
            id="auto-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Deadline escalation"
            className="julow-input"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="auto-desc" className="julow-field-label">
            {t("automation.descLabel")}
          </label>
          <textarea
            id="auto-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this automation do?"
            rows={2}
            className="julow-input resize-none"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="auto-when" className="julow-field-label">
              {t("automation.when")}
            </label>
            <input
              id="auto-when"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="e.g. Due date −24h"
              className="julow-input"
            />
          </div>
          <div>
            <label htmlFor="auto-then" className="julow-field-label">
              {t("automation.then")}
            </label>
            <input
              id="auto-then"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="e.g. Send Telegram alert"
              className="julow-input"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Toggle isSelected={aiManaged} onChange={setAiManaged} aria-label="AI managed" />
          {t("automation.aiManaged")}
        </label>
      </div>
    </Modal>
  );
}

export function AutomationsView() {
  const { t } = useI18n();
  const { organizationId, isLive } = useTaskWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const utils = api.useUtils();

  const automationsQuery = api.automation.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: isLive, staleTime: 30_000 },
  );
  const integrationsQuery = api.integration.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: isLive, staleTime: 30_000 },
  );

  const toggle = api.automation.toggle.useMutation({
    onMutate: async ({ id, enabled }) => {
      if (!organizationId) return;
      await utils.automation.list.cancel({ organizationId });
      utils.automation.list.setData({ organizationId }, (prev) =>
        prev?.map((r) => (r.id === id ? { ...r, enabled } : r)),
      );
    },
    onSettled: () => {
      if (organizationId)
        void utils.automation.list.invalidate({ organizationId });
    },
  });

  const rules = automationsQuery.data ?? [];
  // MVP: Telegram only — hide Slack/Discord/other messenger cards.
  const channels = ((integrationsQuery.data ?? []) as MessengerChannel[]).filter(
    (c) => c.platform === "telegram",
  );

  return (
    <WorkspacePage
      wide
      title={t("automations.title")}
      description={t("automations.description")}
      actions={
        <Button size="sm" variant="primary" onPress={() => setCreateOpen(true)}>
          <Icon icon={WorkflowCircle01Icon} size={16} />
          {t("automations.newAutomation")}
        </Button>
      }
    >
      <AutomationOverview rules={rules} channels={channels} />

      <section className="mb-10">
        <SectionHeader
          icon={Message01Icon}
          title={t("automations.messengers")}
          description={t("automations.messengersDescription")}
        />
        {channels.length === 0 ? (
          <p className="text-sm text-julow-muted">{t("automations.noChannels")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {channels.map((channel) => (
              <MessengerCard key={channel.id} channel={channel} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <SectionHeader
          icon={WorkflowCircle01Icon}
          title={t("automations.workflows")}
          description={t("automations.workflowsDescription")}
        />
        {rules.length === 0 ? (
          <p className="text-sm text-julow-muted">{t("automations.noAutomations")}</p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <AutomationRuleCard
                key={rule.id}
                rule={rule}
                disabled={toggle.isPending}
                onToggle={(enabled) => toggle.mutate({ id: rule.id, enabled })}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          icon={Calendar03Icon}
          title={t("automations.deadlineAi")}
          description={t("automations.deadlineAiDescription")}
        />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {deadlineRules.map((rule) => (
            <DeadlineRuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      </section>

      <NewAutomationDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        organizationId={organizationId}
      />
    </WorkspacePage>
  );
}
