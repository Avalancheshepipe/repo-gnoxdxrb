import { Loading03Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import type { ActivityItem } from "@/lib/workspace-data";

const typeColorClass: Record<ActivityItem["type"], string> = {
  agent: "text-accent",
  task: "text-success",
  automation: "text-warning",
};

type ActivityStatusMarkerProps = {
  status: ActivityItem["status"];
  type: ActivityItem["type"];
};

export function ActivityStatusMarker({ status, type }: ActivityStatusMarkerProps) {
  const colorClass = typeColorClass[type];

  if (status === "live") {
    return (
      <Icon
        icon={Loading03Icon}
        size={12}
        className={`shrink-0 animate-spin ${colorClass}`}
        aria-hidden
      />
    );
  }

  return (
    <svg
      className={`size-3 shrink-0 ${colorClass}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
