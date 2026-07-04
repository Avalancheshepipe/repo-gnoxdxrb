"use client";

import { Activity01Icon } from "@hugeicons/core-free-icons";
import { Button, Popover } from "@heroui/react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { ActivityStatusMarker } from "@/components/workspace/activity-status";
import type { ActivityItem } from "@/lib/workspace-data";

export function InboxActivityMenu({ activities }: { activities: ActivityItem[] }) {
  const { t } = useI18n();
  const legend = [
    { type: "agent" as const, label: t("activity.agentAction") },
    { type: "task" as const, label: t("activity.taskUpdate") },
    { type: "automation" as const, label: t("activity.automation") },
  ];

  return (
    <Popover>
      <Popover.Trigger>
        <Button size="sm" variant="outline">
          <Icon icon={Activity01Icon} size={16} />
          {t("activity.title")}
        </Button>
      </Popover.Trigger>
      <Popover.Content placement="bottom end" className="w-[340px] p-0">
        <Popover.Dialog className="p-0">
          <div className="border-b border-julow-glass-border px-4 py-3">
            <Popover.Heading className="text-sm font-semibold">
              {t("activity.teamActivity")}
            </Popover.Heading>
            <p className="mt-0.5 text-xs text-julow-muted">{t("activity.live")}</p>
          </div>

          <ul className="max-h-[280px] overflow-y-auto px-4 py-3 scrollbar-none">
            {activities.map((item) => (
              <li key={item.id} className="flex gap-2.5 py-2 text-sm first:pt-0 last:pb-0">
                <ActivityStatusMarker status={item.status} type={item.type} />
                <div className="min-w-0">
                  <p className="leading-snug">
                    <span className="font-medium">{item.actor}</span>{" "}
                    <span className="text-julow-muted">{item.action}</span>{" "}
                    {item.target}
                  </p>
                  <p className="text-[11px] text-julow-muted">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-julow-glass-border px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-julow-muted">
              {t("activity.legend")}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {legend.map((item) => (
                <span
                  key={item.type}
                  className="inline-flex items-center gap-1.5 text-xs text-julow-muted"
                >
                  <ActivityStatusMarker status="done" type={item.type} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
