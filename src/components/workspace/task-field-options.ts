import type { ColorOption } from "@/components/ui/color-select-field";
import type { TaskPriority, TaskStatus } from "@/lib/workspace-data";

type Translate = (key: string) => string;

/** Color-coded status options for the status picker. */
export function statusOptions(t: Translate): (ColorOption & { value: TaskStatus })[] {
  return [
    { value: "todo", label: t("canvas.todo"), tone: "default" },
    { value: "in-progress", label: t("canvas.inProgress"), tone: "accent" },
    { value: "review", label: t("canvas.review"), tone: "warning" },
    { value: "done", label: t("canvas.done"), tone: "success" },
  ];
}

/** Color-coded priority options for the priority picker. */
export function priorityOptions(t: Translate): (ColorOption & { value: TaskPriority })[] {
  return [
    { value: "low", label: t("priority.low"), tone: "default" },
    { value: "medium", label: t("priority.medium"), tone: "accent" },
    { value: "high", label: t("priority.high"), tone: "warning" },
    { value: "urgent", label: t("priority.urgent"), tone: "danger" },
  ];
}
