import {
  CanvasIcon,
  InboxIcon,
  WorkflowCircle01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { WorkspaceView } from "@/lib/workspace-data";

export const workspaceViewIcons: Record<
  Exclude<WorkspaceView, "home">,
  IconSvgElement
> = {
  canvas: CanvasIcon,
  inbox: InboxIcon,
  automations: WorkflowCircle01Icon,
};
