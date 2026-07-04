"use client";

import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { AgentPanelFull } from "@/components/workspace/agent-panel";
import { TaskDetailPanel } from "@/components/workspace/task-detail-panel";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";

type WorkspaceMobileOverlaysProps = {
  showAgentPanel?: boolean;
};

export function WorkspaceMobileOverlays({
  showAgentPanel = true,
}: WorkspaceMobileOverlaysProps) {
  const { selectedTask, selectedTaskId, closeTask, updateTask } = useTaskWorkspace();
  const [agentOpen, setAgentOpen] = useState(false);

  useEffect(() => {
    const openAgents = () => setAgentOpen(true);
    window.addEventListener("julow:open-agents-mobile", openAgents);
    return () => window.removeEventListener("julow:open-agents-mobile", openAgents);
  }, []);

  return (
    <>
      <Drawer.Root
        open={Boolean(selectedTaskId && selectedTask)}
        onOpenChange={(open) => {
          if (!open) closeTask();
        }}
        modal
      >
        <Drawer.Portal>
          <Drawer.Overlay className="julow-sheet-overlay" />
            <Drawer.Content
              className="julow-sheet julow-sheet--task"
              data-vaul-custom-container="true"
            >
              <div className="julow-sheet-handle" aria-hidden />
              <div className="julow-sheet__inner">
                {selectedTask && (
                  <TaskDetailPanel
                    task={selectedTask}
                    onClose={closeTask}
                    onUpdate={updateTask}
                    className="min-h-0 flex-1"
                  />
                )}
              </div>
            </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {showAgentPanel && (
        <Drawer.Root open={agentOpen} onOpenChange={setAgentOpen} modal>
          <Drawer.Portal>
            <Drawer.Overlay className="julow-sheet-overlay" />
            <Drawer.Content
              className="julow-sheet julow-sheet--agent"
              data-vaul-custom-container="true"
            >
              <div className="julow-sheet-handle" aria-hidden />
              <div className="julow-sheet__inner">
                <AgentPanelFull
                  onCollapse={() => setAgentOpen(false)}
                  embedded
                  className="w-full max-w-full min-w-0"
                />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </>
  );
}
