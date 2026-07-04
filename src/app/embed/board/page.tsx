"use client";

import { CanvasBoard } from "@/components/workspace/canvas-board";
import { TaskWorkspaceProvider } from "@/components/workspace/task-workspace-context";

/**
 * Native canvas surface. Loaded inside the mobile app's WebView. Unlike
 * `/app/board`, this route is NOT behind the server-side auth redirect — the
 * Android WebView can't forward the session cookie on the initial SSR request,
 * so we authenticate client-side instead (the native app injects the session
 * cookie into the document before content loads, so same-origin tRPC requests
 * carry it). Rendered full-bleed with no workspace chrome.
 */
export default function EmbedBoardPage() {
  return (
    <div className="julow-embed-board fixed inset-0 flex flex-col overflow-hidden bg-transparent">
      <TaskWorkspaceProvider>
        <CanvasBoard />
      </TaskWorkspaceProvider>
    </div>
  );
}
