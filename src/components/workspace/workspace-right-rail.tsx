"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AgentPanelFull,
  AgentStrip,
} from "@/components/workspace/agent-panel";
import { TaskDetailPanel } from "@/components/workspace/task-detail-panel";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import type { InboxTask } from "@/lib/workspace-data";

const RAIL_MS = 360;
const TASK_REVEAL_AFTER_COMPRESS_MS = 120;
const TASK_REVEAL_INSTANT_MS = 24;

type TaskExit = "left" | "right" | null;

type WorkspaceRightRailProps = {
  showAgentPanel?: boolean;
  collapsed: boolean;
  onToggle: () => void;
};

export function WorkspaceRightRail({
  showAgentPanel = true,
  collapsed,
  onToggle,
}: WorkspaceRightRailProps) {
  const { selectedTask, selectedTaskId, closeTask, updateTask } = useTaskWorkspace();
  const [taskMounted, setTaskMounted] = useState(false);
  const [heldTask, setHeldTask] = useState<InboxTask | null>(null);
  const [taskExit, setTaskExit] = useState<TaskExit>(null);
  const [taskSwapping, setTaskSwapping] = useState(false);
  const [taskContentReady, setTaskContentReady] = useState(false);
  const [taskSlotDelayed, setTaskSlotDelayed] = useState(false);
  const [agentRevealed, setAgentRevealed] = useState(!collapsed);
  const [agentExpanding, setAgentExpanding] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const swapTimerRef = useRef<number | null>(null);
  const taskRevealTimerRef = useRef<number | null>(null);
  const taskMountedRef = useRef(false);
  const prevTaskIdRef = useRef<string | null>(null);
  const agentSlotRef = useRef<HTMLDivElement>(null);
  const wasStripRef = useRef(collapsed);
  const agentWasWideRef = useRef(!collapsed);

  const taskOpen = Boolean(selectedTaskId);
  const taskSlotOpen = taskOpen || taskMounted;
  const taskExiting = taskMounted && !taskOpen;
  const agentStripVisible = taskOpen || collapsed;
  const agentSlotWide = !taskOpen && !collapsed;

  useEffect(() => {
    agentWasWideRef.current = !collapsed && !taskOpen;
  }, [collapsed, taskOpen]);

  useEffect(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (selectedTaskId) {
      taskMountedRef.current = true;
      setTaskMounted(true);
      setTaskExit(null);
      return;
    }

    if (!taskMountedRef.current) return;

    closeTimerRef.current = window.setTimeout(() => {
      taskMountedRef.current = false;
      setTaskMounted(false);
      setHeldTask(null);
      setTaskExit(null);
      setTaskContentReady(false);
      setTaskSlotDelayed(false);
      closeTimerRef.current = null;
    }, RAIL_MS);

    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [selectedTaskId]);

  useEffect(() => {
    if (selectedTask) {
      setHeldTask(selectedTask);
    }
  }, [selectedTask]);

  useEffect(() => {
    const prev = prevTaskIdRef.current;
    prevTaskIdRef.current = selectedTaskId;

    if (!selectedTaskId || !prev || selectedTaskId === prev) return;

    if (swapTimerRef.current !== null) {
      window.clearTimeout(swapTimerRef.current);
    }

    setTaskSwapping(true);
    setTaskContentReady(true);
    swapTimerRef.current = window.setTimeout(() => {
      setTaskSwapping(false);
      swapTimerRef.current = null;
    }, 180);

    return () => {
      if (swapTimerRef.current !== null) {
        window.clearTimeout(swapTimerRef.current);
        swapTimerRef.current = null;
      }
    };
  }, [selectedTaskId]);

  useEffect(() => {
    if (taskRevealTimerRef.current !== null) {
      window.clearTimeout(taskRevealTimerRef.current);
      taskRevealTimerRef.current = null;
    }

    if (!taskOpen) {
      setTaskContentReady(false);
      setTaskSlotDelayed(false);
      return;
    }

    const fromWideAgent = agentWasWideRef.current;
    setTaskSlotDelayed(fromWideAgent);

    const slotDelay = fromWideAgent ? TASK_REVEAL_AFTER_COMPRESS_MS : 0;
    const contentDelay = fromWideAgent
      ? TASK_REVEAL_AFTER_COMPRESS_MS + TASK_REVEAL_INSTANT_MS
      : TASK_REVEAL_INSTANT_MS;

    if (fromWideAgent) {
      taskRevealTimerRef.current = window.setTimeout(() => {
        setTaskSlotDelayed(false);
        taskRevealTimerRef.current = null;
      }, slotDelay);
    }

    const contentTimer = window.setTimeout(() => {
      setTaskContentReady(true);
    }, contentDelay);

    return () => {
      if (taskRevealTimerRef.current !== null) {
        window.clearTimeout(taskRevealTimerRef.current);
        taskRevealTimerRef.current = null;
      }
      window.clearTimeout(contentTimer);
    };
  }, [taskOpen, selectedTaskId]);

  useEffect(() => {
    const stripNow = taskOpen || collapsed;

    if (stripNow) {
      setAgentExpanding(false);
      wasStripRef.current = true;
      setAgentRevealed(false);
      return;
    }

    if (!wasStripRef.current) {
      setAgentExpanding(false);
      setAgentRevealed(true);
      return;
    }

    wasStripRef.current = false;
    setAgentExpanding(true);
    setAgentRevealed(true);

    const done = window.setTimeout(() => {
      setAgentExpanding(false);
    }, RAIL_MS);

    return () => window.clearTimeout(done);
  }, [taskOpen, collapsed]);

  const displayTask = selectedTask ?? heldTask;
  const showTaskContent = Boolean(displayTask && taskSlotOpen);

  const handleCloseTask = useCallback(() => {
    setTaskExit("left");
    closeTask();
  }, [closeTask]);

  const handleFocusAgent = useCallback(() => {
    if (taskOpen) {
      setTaskExit("right");
      closeTask();
      return;
    }
    onToggle();
  }, [taskOpen, closeTask, onToggle]);

  const handleAgentCollapse = useCallback(() => {
    setAgentRevealed(false);
    setAgentExpanding(false);
    onToggle();
  }, [onToggle]);

  const taskSlotExpanded =
    taskSlotOpen && !taskExiting && !taskSlotDelayed;

  if (!showAgentPanel && !showTaskContent) return null;

  const railClass = [
    "julow-right-rail",
    taskSlotExpanded ? " julow-right-rail--task-slot-open" : "",
    taskOpen ? " julow-right-rail--task-open" : "",
    taskContentReady && taskOpen ? " julow-right-rail--task-ready" : "",
    taskExiting ? "julow-right-rail--task-closing" : "",
    taskExiting && taskExit === "right" ? "julow-right-rail--task-exit-right" : "",
    taskExiting && taskExit === "left" ? "julow-right-rail--task-exit-left" : "",
    agentSlotWide ? "julow-right-rail--agent-wide" : "",
    agentExpanding ? "julow-right-rail--agent-expanding" : "",
    agentRevealed ? "julow-right-rail--agent-revealed" : "",
    taskSwapping ? "julow-right-rail--task-swapping" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={railClass} data-task-open={taskOpen ? "true" : "false"}>
      <div
        className="julow-right-rail__task-slot"
        aria-hidden={!showTaskContent}
      >
        {displayTask && (
          <div key={displayTask.id} className="julow-right-rail__task-inner">
            <TaskDetailPanel
              task={displayTask}
              onClose={handleCloseTask}
              onUpdate={updateTask}
              embedded
            />
          </div>
        )}
      </div>

      {showAgentPanel && (
        <div
          ref={agentSlotRef}
          className={`julow-right-rail__agent-slot${agentStripVisible ? " julow-right-rail__agent-slot--strip-visible" : ""}${agentSlotWide ? " julow-right-rail__agent-slot--wide" : ""}`}
        >
          <div className="julow-agent-slot__clip">
            <div
              className={`julow-agent-slot__strip${agentStripVisible ? " is-visible" : ""}`}
            >
              <AgentStrip
                variant={taskOpen ? "focus-agent" : "expand"}
                onPress={handleFocusAgent}
              />
            </div>
            <div className="julow-agent-slot__full">
              <AgentPanelFull onCollapse={handleAgentCollapse} embedded />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
