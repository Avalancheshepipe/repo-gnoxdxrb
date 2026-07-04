"use client";

import {
  Alert02Icon,
  LayoutGridIcon,
  Loading03Icon,
  Mic01Icon,
  MinusSignIcon,
  PlusSignIcon,
  SparklesIcon,
  StopIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useOnViewportChange,
  useReactFlow,
  useViewport,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { CanvasAdvisor } from "@/components/workspace/canvas-advisor";
import { flowNodeTypes } from "@/components/workspace/canvas-flow-nodes";
import { flowEdgeTypes } from "@/components/workspace/canvas-flow-edges";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import {
  buildFlowBoard,
  computeFlowLayout,
  isBoardNodeId,
  type BoardLayout,
  type CanvasNodeData,
} from "@/lib/canvas-build";
import { EMPTY_FLOW, taskChainFlow, type FlowGraph } from "@/lib/flow-graph";
import { api } from "@/lib/trpc";
import { useCanvasPresence, type RemoteCursor } from "@/lib/use-canvas-presence";
import { usePersistentState } from "@/lib/use-persistent-state";
import { useVoiceInput } from "@/lib/use-voice-input";

function CanvasLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3">
      <Icon icon={Loading03Icon} size={26} className="animate-spin text-accent" />
      <p className="text-sm text-julow-muted">{label}</p>
    </div>
  );
}

/** Other members' live cursors, transformed from flow coords to screen. */
function RemoteCursors({ cursors }: { cursors: RemoteCursor[] }) {
  const { x, y, zoom } = useViewport();
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {cursors.map((c) => (
        <div
          key={c.clientId}
          className="absolute left-0 top-0 flex items-center gap-1"
          style={{ transform: `translate(${c.x * zoom + x}px, ${c.y * zoom + y}px)` }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M1 1l5.5 13 2-5.5L14 6.5 1 1z"
              fill={c.color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
            style={{ backgroundColor: c.color }}
          >
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function ZoomToolbar({
  onContext,
  onTidy,
  onGenerate,
  onHelp,
  onToggleAdvisor,
  generating,
  hasFlow,
}: {
  onContext: () => void;
  onTidy: () => void;
  onGenerate: () => void;
  onHelp: () => void;
  onToggleAdvisor: () => void;
  generating: boolean;
  hasFlow: boolean;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { t } = useI18n();
  const [zoom, setZoom] = useState(100);
  useOnViewportChange({ onChange: (v) => setZoom(Math.round(v.zoom * 100)) });

  return (
    <Panel
      position="top-left"
      className="julow-zoom-toolbar !m-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-start gap-1.5"
    >
      <div className="flex max-w-full flex-wrap items-center gap-1.5">
        <div className="julow-context-split glass-panel-subtle flex h-8 shrink-0 items-stretch overflow-hidden rounded-lg">
          <button
            type="button"
            onClick={onContext}
            className="flex items-center px-2.5 text-xs font-medium text-julow-muted transition-colors hover:bg-julow-glass-bg hover:text-julow-fg"
          >
            {t("canvas.context")}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHelp();
            }}
            aria-label={t("canvas.help.title")}
            className="julow-context-help-trigger flex w-7 shrink-0 items-center justify-center self-stretch text-xs font-medium text-julow-muted transition-colors hover:bg-julow-glass-bg hover:text-julow-fg"
          >
            ?
          </button>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="glass-panel-subtle flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-accent transition-colors hover:text-julow-fg disabled:opacity-60"
        >
          <Icon
            icon={generating ? Loading03Icon : SparklesIcon}
            size={14}
            className={generating ? "animate-spin" : undefined}
          />
          <span className="hidden sm:inline">
            {hasFlow ? t("canvas.regenerateFlow") : t("canvas.generateFlow")}
          </span>
        </button>
      </div>

      <div className="flex max-w-full flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={onToggleAdvisor}
          className="glass-panel-subtle flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-julow-muted transition-colors hover:text-julow-fg"
        >
          <Icon icon={SparklesIcon} size={14} />
          <span className="hidden sm:inline">{t("canvas.openAdvisor")}</span>
        </button>
        <button
          type="button"
          onClick={onTidy}
          className="glass-panel-subtle flex size-8 items-center justify-center rounded-lg text-julow-muted transition-colors hover:text-julow-fg"
          aria-label={t("canvas.tidyBoard")}
        >
          <Icon icon={LayoutGridIcon} size={14} />
        </button>
        <button
          type="button"
          onClick={() => zoomOut({ duration: 200 })}
          className="glass-panel-subtle flex size-8 items-center justify-center rounded-lg text-julow-muted transition-colors hover:text-julow-fg"
          aria-label={t("canvas.zoomOut")}
        >
          <Icon icon={MinusSignIcon} size={16} />
        </button>
        <button
          type="button"
          onClick={() => fitView({ padding: 0.3, duration: 300 })}
          className="glass-panel-subtle min-w-[3.25rem] rounded-lg px-2 py-1.5 text-center text-xs text-julow-muted transition-colors hover:text-julow-fg"
        >
          {zoom}%
        </button>
        <button
          type="button"
          onClick={() => zoomIn({ duration: 200 })}
          className="glass-panel-subtle flex size-8 items-center justify-center rounded-lg text-julow-muted transition-colors hover:text-julow-fg"
          aria-label={t("canvas.zoomIn")}
        >
          <Icon icon={PlusSignIcon} size={16} />
        </button>
      </div>
    </Panel>
  );
}

function ProjectCanvas({ projectId }: { projectId: string }) {
  const { t, locale } = useI18n();
  const { organizationId, user } = useTaskWorkspace();
  const utils = api.useUtils();
  const { screenToFlowPosition } = useReactFlow();

  const projectQuery = api.project.byId.useQuery({ id: projectId });
  const canvasQuery = api.canvas.get.useQuery({ projectId });
  const tasksQuery = api.task.list.useQuery(
    { organizationId: organizationId ?? "", projectId, archived: "all" },
    { enabled: Boolean(organizationId) },
  );
  const realtimeQuery = api.canvas.realtimeAuth.useQuery({ projectId });
  const saveLayout = api.canvas.saveLayout.useMutation();
  const moveNode = api.canvas.moveNode.useMutation();
  const [flowError, setFlowError] = useState<string | null>(null);
  const generateFlow = api.canvas.generateFlow.useMutation({
    onSuccess: (r) => {
      if (!r.ok) {
        setFlowError(r.error ?? t("canvas.generateFlowFailed"));
        return;
      }
      setFlowError(null);
    },
    onError: (e) => setFlowError(e.message),
    onSettled: () => utils.canvas.get.invalidate({ projectId }),
  });
  const layoutSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorThrottle = useRef(0);

  const [advisorOpen, setAdvisorOpen] = usePersistentState(
    "julow_canvas_advisor_open",
    false,
  );

  const flow: FlowGraph = useMemo(
    () => canvasQuery.data?.flowGraph ?? EMPTY_FLOW,
    [canvasQuery.data?.flowGraph],
  );
  const savedLayout = useMemo(
    () => (canvasQuery.data?.boardLayout ?? {}) as BoardLayout,
    [canvasQuery.data?.boardLayout],
  );

  // Tasks hidden from the canvas chain: completed + archived (kept in DB).
  const hiddenTaskIds = useMemo(() => {
    const s = new Set<string>();
    for (const tk of tasksQuery.data ?? []) {
      if (tk.status === "done" || tk.archived) s.add(tk.id);
    }
    return s;
  }, [tasksQuery.data]);

  const presence = useCanvasPresence({
    projectId,
    wsUrl: realtimeQuery.data?.wsUrl,
    token: realtimeQuery.data?.token,
    user: user ? { id: user.id, name: user.name } : null,
  });

  const ready =
    Boolean(projectQuery.data) &&
    (canvasQuery.isSuccess || canvasQuery.isError);

  const built = useMemo(() => {
    const empty = {
      nodes: [] as Node<CanvasNodeData>[],
      edges: [] as ReturnType<typeof buildFlowBoard>["edges"],
      layout: {} as BoardLayout,
    };
    if (!projectQuery.data) return empty;
    try {
      return buildFlowBoard({
        project: {
          name: projectQuery.data.name,
          description: projectQuery.data.description ?? "",
        },
        flow,
        hiddenTaskIds,
        savedLayout,
      });
    } catch (err) {
      console.error("[canvas] buildFlowBoard failed; rendering empty", err);
      return empty;
    }
  }, [projectQuery.data, flow, hiddenTaskIds, savedLayout]);

  const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>([]);
  useLayoutEffect(() => {
    setNodes(built.nodes);
  }, [built]);

  const persistNodePosition = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      if (nodeId.startsWith("note-")) {
        moveNode.mutate({
          id: nodeId.slice("note-".length),
          x: position.x,
          y: position.y,
        });
        return;
      }
      if (!isBoardNodeId(nodeId)) return;
      if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current);
      layoutSaveTimer.current = setTimeout(() => {
        saveLayout.mutate({ projectId, positions: { [nodeId]: position } });
      }, 400);
    },
    [moveNode, saveLayout, projectId],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<CanvasNodeData>>[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node<CanvasNodeData>) =>
      persistNodePosition(node.id, node.position),
    [persistNodePosition],
  );

  const tidyBoard = useCallback(() => {
    const layout = computeFlowLayout(taskChainFlow(flow, hiddenTaskIds));
    setNodes((nds) =>
      nds.map((n) => {
        const pos = layout[n.id];
        return pos ? { ...n, position: pos } : n;
      }),
    );
    saveLayout.mutate({ projectId, positions: layout });
  }, [flow, hiddenTaskIds, projectId, saveLayout]);

  const onPanePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const now = Date.now();
      if (now - cursorThrottle.current < 45) return;
      cursorThrottle.current = now;
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      presence.setCursor({ x: pos.x, y: pos.y });
    },
    [screenToFlowPosition, presence],
  );

  const [ctxOpen, setCtxOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [ctxDraft, setCtxDraft] = useState("");
  useEffect(() => {
    if (ctxOpen) setCtxDraft(projectQuery.data?.description ?? "");
  }, [ctxOpen, projectQuery.data?.description]);
  const voice = useVoiceInput(
    (text) => setCtxDraft((d) => (d ? `${d} ${text}` : text)),
    locale,
  );
  const updateProject = api.project.update.useMutation({
    onSuccess: async () => {
      await utils.project.byId.invalidate({ id: projectId });
      setCtxOpen(false);
    },
  });

  const onNodeClick = useCallback(
    (_: unknown, node: Node<CanvasNodeData>) => {
      if (node.type === "projectNode") setCtxOpen(true);
    },
    [],
  );

  const descLen = (projectQuery.data?.description ?? "").trim().length;
  const needsContext = flow.nodes.length === 0 && descLen < 40;

  if (!ready) return <CanvasLoader label={t("canvas.loading")} />;

  return (
    <div className="relative flex h-full min-h-0 w-full">
      <div
        className="relative h-full min-h-0 flex-1"
        onPointerMove={onPanePointerMove}
        onPointerLeave={() => presence.setCursor(null)}
      >
        {needsContext && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex -translate-x-1/2 justify-center">
            <div className="glass-panel pointer-events-auto flex items-center gap-2 rounded-xl px-3 py-2 text-xs shadow-lg">
              <Icon icon={Alert02Icon} size={15} className="text-warning" />
              <span className="text-julow-fg">{t("canvas.needContext.body")}</span>
              <Button size="sm" variant="primary" onPress={() => setCtxOpen(true)}>
                {t("canvas.needContext.action")}
              </Button>
            </div>
          </div>
        )}

        {flowError && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex -translate-x-1/2 justify-center">
            <div className="glass-panel pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-3 py-2 text-xs shadow-lg">
              <Icon icon={Alert02Icon} size={15} className="text-danger" />
              <span className="text-julow-fg">{flowError}</span>
              <Button size="sm" variant="ghost" onPress={() => setFlowError(null)}>
                {t("common.gotIt")}
              </Button>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={built.edges}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          nodeTypes={flowNodeTypes}
          edgeTypes={flowEdgeTypes}
          defaultEdgeOptions={{ type: "smoothstep" }}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1.1 }}
          minZoom={0.2}
          maxZoom={2}
          panOnDrag
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          className="julow-flow h-full w-full"
        >
          <ZoomToolbar
            onContext={() => setCtxOpen(true)}
            onTidy={tidyBoard}
            onGenerate={() => generateFlow.mutate({ projectId })}
            onHelp={() => setHelpOpen(true)}
            onToggleAdvisor={() => setAdvisorOpen((v) => !v)}
            generating={generateFlow.isPending}
            hasFlow={flow.nodes.length > 0}
          />
          <RemoteCursors cursors={presence.cursors} />
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="color-mix(in oklch, var(--julow-fg) 14%, transparent)"
          />
        </ReactFlow>
      </div>

      {advisorOpen ? (
        <CanvasAdvisor
          organizationId={organizationId}
          projectId={projectId}
          onClose={() => setAdvisorOpen(false)}
        />
      ) : null}

      <Modal
        open={ctxOpen}
        onClose={() => setCtxOpen(false)}
        title={t("canvas.context")}
        description={projectQuery.data?.name}
        width="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onPress={() => setCtxOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              isDisabled={updateProject.isPending}
              onPress={() =>
                updateProject.mutate({ id: projectId, description: ctxDraft })
              }
            >
              {updateProject.isPending ? "…" : t("canvas.saveContext")}
            </Button>
          </>
        }
      >
        <div className="relative">
          <textarea
            value={ctxDraft}
            onChange={(e) => setCtxDraft(e.target.value)}
            placeholder={t("canvas.contextPlaceholder")}
            rows={7}
            className="julow-input resize-none pb-10 pr-12"
          />
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("chat.voiceInput")}
            isDisabled={voice.busy}
            onPress={voice.toggle}
            data-recording={voice.recording ? "true" : undefined}
            className="julow-canvas-context-mic"
          >
            <Icon
              icon={voice.busy ? Loading03Icon : voice.recording ? StopIcon : Mic01Icon}
              size={15}
              className={voice.busy ? "animate-spin" : undefined}
            />
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-julow-muted">
          {t("canvas.contextEmpty")}
        </p>
      </Modal>

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t("canvas.help.title")}
        width="max-w-md"
        footer={
          <Button variant="primary" onPress={() => setHelpOpen(false)}>
            {t("common.gotIt")}
          </Button>
        }
      >
        <div className="julow-streamdown text-sm leading-relaxed text-julow-muted">
          <p className="whitespace-pre-line">{t("canvas.help.body")}</p>
        </div>
      </Modal>
    </div>
  );
}

export function CanvasBoard() {
  const { activeProjectId, isLive, isBootstrapping } = useTaskWorkspace();
  const { t } = useI18n();

  const showCanvas = isLive && Boolean(activeProjectId) && !isBootstrapping;

  return (
    <div className="julow-canvas-board relative h-full min-h-0 w-full overflow-hidden md:mx-2 md:mb-2 md:rounded-2xl md:glass-panel-subtle">
      <ReactFlowProvider>
        <div className="h-full min-h-0 w-full">
          {showCanvas ? (
            <ProjectCanvas key={activeProjectId!} projectId={activeProjectId!} />
          ) : (
            <CanvasLoader label={t("canvas.loading")} />
          )}
        </div>
      </ReactFlowProvider>
    </div>
  );
}
