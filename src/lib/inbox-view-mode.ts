import type { InboxViewMode } from "@/components/workspace/views/inbox-tasks-panel";
import { WORKSPACE_MOBILE_QUERY } from "@/lib/use-media-query";

export function defaultInboxViewMode(): InboxViewMode {
  if (
    typeof window !== "undefined" &&
    window.matchMedia(WORKSPACE_MOBILE_QUERY).matches
  ) {
    return "kanban";
  }
  return "list";
}
