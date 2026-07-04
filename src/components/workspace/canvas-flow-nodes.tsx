"use client";

import {
  AiBrain01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  Flag02Icon,
  Note01Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { Streamdown } from "streamdown";
import { DocIcon } from "@/components/brand/office-icons";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/components/providers/i18n-provider";
import type {
  FlowStepData,
  NoteNodeData,
  ProjectNodeData,
} from "@/lib/canvas-build";

const handleClass = "!size-2 !border-2 !border-accent/40 !bg-julow-bg";

function ProjectNodeComponent({ data }: NodeProps<Node<ProjectNodeData>>) {
  const { t } = useI18n();
  return (
    <div className="julow-canvas-node julow-canvas-project group w-[240px] rounded-2xl px-4 py-3.5">
      <p className="text-sm font-semibold leading-snug text-julow-fg">
        {t("canvas.context")}
      </p>
      {data.description ? (
        <div className="julow-streamdown mt-1.5 max-h-36 overflow-hidden text-xs leading-relaxed text-julow-muted">
          <Streamdown>{data.description}</Streamdown>
        </div>
      ) : (
        <p className="mt-1.5 text-xs italic leading-relaxed text-julow-muted">
          {t("canvas.contextClickHint")}
        </p>
      )}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
}

const FLOW_KIND_ICON: Record<string, IconSvgElement> = {
  start: Flag02Icon,
  stage: AiBrain01Icon,
  milestone: Target01Icon,
  goal: CheckmarkCircle02Icon,
  task: CheckListIcon,
};

function FlowStepComponent({ data }: NodeProps<Node<FlowStepData>>) {
  const { t } = useI18n();
  const kind = data.nodeKind || "stage";
  const icon = FLOW_KIND_ICON[kind] ?? AiBrain01Icon;
  const kindLabel = t(`canvas.kind.${kind}`);

  return (
    <div
      className={`julow-canvas-node julow-canvas-flow julow-canvas-flow--${kind} w-[230px] rounded-2xl p-3.5`}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="flex size-6 items-center justify-center rounded-lg bg-accent/12 text-accent">
          <Icon icon={icon} size={14} />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-julow-muted">
          {kindLabel}
        </span>
      </div>
      <h3 className="text-sm font-medium leading-snug text-julow-fg">
        {data.title}
      </h3>
      {data.subtitle && (
        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-julow-muted">
          {data.subtitle}
        </p>
      )}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
}

function NoteNodeComponent({ data }: NodeProps<Node<NoteNodeData>>) {
  const isDoc =
    data.nodeType === "document" ||
    /(\.docx?|\.xlsx?|\bword\b|\bexcel\b|документ|report|отчёт|отчет)/i.test(
      `${data.title} ${data.body}`,
    );

  return (
    <div className="julow-canvas-node julow-canvas-note w-[230px] rounded-2xl p-3.5">
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="mb-1.5 flex size-7 items-center justify-center rounded-lg bg-accent/12 text-accent">
        {isDoc ? <DocIcon size={18} /> : <Icon icon={Note01Icon} size={15} />}
      </div>
      <h3 className="text-sm font-medium leading-snug text-julow-fg">
        {data.title}
      </h3>
      {data.body && (
        <div className="julow-streamdown mt-1 line-clamp-4 text-xs leading-relaxed text-julow-muted">
          <Streamdown>{data.body}</Streamdown>
        </div>
      )}
    </div>
  );
}

export const flowNodeTypes = {
  projectNode: memo(ProjectNodeComponent),
  flowNode: memo(FlowStepComponent),
  noteNode: memo(NoteNodeComponent),
};
