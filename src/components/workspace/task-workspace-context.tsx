"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/trpc";
import { formatDueLabel } from "@/lib/task-mappers";
import type {
  InboxTask,
  TaskAgentBrief,
  TaskPriority,
  TaskStatus,
} from "@/lib/workspace-data";

export type WorkspaceProject = {
  id: string;
  name: string;
  slug: string;
  taskCount: number;
};

export type WorkspaceUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

type NewTaskInput = {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
  tags?: string[];
  assigneeUserIds?: string[];
  assigneeAgentIds?: string[];
  agentBrief?: TaskAgentBrief | null;
  projectId?: string;
};

import { isQueryBootstrapping } from "@/lib/query-loading";

const ACTIVE_PROJECT_KEY = "julow_active_project";

function readActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_PROJECT_KEY);
}

type TaskWorkspaceContextValue = {
  /** True once the workspace list has resolved (auth + bootstrap complete). */
  ready: boolean;
  /** Backed by the real API. */
  isLive: boolean;
  organizationId: string | null;
  workspaceName: string;
  role: string | null;
  user: WorkspaceUser | null;

  projects: WorkspaceProject[];
  activeProjectId: string | null;
  /** The currently-selected project — the GLOBAL context every tab respects. */
  activeProject: WorkspaceProject | null;
  setActiveProjectId: (id: string) => void;

  /** Tasks scoped to the active project (the global context). */
  tasks: InboxTask[];
  isLoadingTasks: boolean;
  /** Workspace + project context ready (does not wait for task list). */
  isBootstrapping: boolean;
  selectedTask: InboxTask | null;
  selectedTaskId: string | null;
  /** Open a task's detail; switches active project when the task lives elsewhere. */
  openTask: (taskId: string, projectId?: string) => void;
  closeTask: () => void;
  updateTask: (taskId: string, patch: Partial<InboxTask>) => void;
  createTask: (input: NewTaskInput) => Promise<void>;
  isCreatingTask: boolean;
};

const TaskWorkspaceContext = createContext<TaskWorkspaceContextValue | null>(null);

export function TaskWorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: sessionData, isPending: sessionPending } = authClient.useSession();
  const sessionUser = sessionData?.user ?? null;
  const sessionReady = !sessionPending;

  const workspacesQuery = api.workspace.list.useQuery(undefined, {
    enabled: sessionReady,
    retry: false,
    staleTime: 60_000,
  });
  const workspace = workspacesQuery.data?.[0] ?? null;
  const organizationId = workspace?.id ?? null;
  const isLive = Boolean(organizationId);
  const ready = workspacesQuery.isSuccess;

  const projectsQuery = api.project.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: isLive, retry: false, staleTime: 60_000 },
  );

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(
    readActiveProjectId,
  );

  const projects: WorkspaceProject[] = useMemo(
    () =>
      (projectsQuery.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        taskCount: p._count?.tasks ?? 0,
      })),
    [projectsQuery.data],
  );

  // Always keep a valid active project — saved preference or first in the list.
  useEffect(() => {
    if (projects.length === 0) return;

    const isValid =
      activeProjectId != null && projects.some((p) => p.id === activeProjectId);
    if (isValid) return;

    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(ACTIVE_PROJECT_KEY)
        : null;
    const next = projects.find((p) => p.id === saved)?.id ?? projects[0]!.id;
    setActiveProjectIdState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, next);
    }
  }, [activeProjectId, projects]);

  // Tasks are scoped to the active project — the global context for every tab.
  const taskListInput = {
    organizationId: organizationId ?? "",
    projectId: activeProjectId ?? undefined,
  };
  const tasksQuery = api.task.list.useQuery(taskListInput, {
    enabled: isLive && Boolean(activeProjectId),
    retry: false,
  });

  const utils = api.useUtils();
  const updateMutation = api.task.update.useMutation({
    onSettled: () => {
      void utils.task.list.invalidate();
    },
  });
  const createMutation = api.task.create.useMutation({
    onSettled: () => {
      void utils.task.list.invalidate();
    },
  });

  const tasksQueryEnabled = isLive && Boolean(activeProjectId);

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const isBootstrapping =
    sessionPending ||
    isQueryBootstrapping(sessionReady, workspacesQuery) ||
    isQueryBootstrapping(isLive, projectsQuery) ||
    (isLive && projects.length > 0 && activeProjectId == null);

  const isLoadingTasks =
    isBootstrapping ||
    isQueryBootstrapping(tasksQueryEnabled, tasksQuery);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    }
  }, []);

  // Keep the latest active project id readable inside the stable openTask.
  const activeProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  const openTask = useCallback(
    (taskId: string, projectId?: string) => {
      setSelectedTaskId(taskId);
      const active = activeProjectIdRef.current;
      // Caller knows the project (e.g. a proposal card) — switch directly.
      if (projectId) {
        if (projectId !== active) setActiveProjectId(projectId);
        return;
      }
      if (!organizationId) return;
      // Already loaded under the active project? Nothing to switch.
      const loaded = active
        ? utils.task.list.getData({ organizationId, projectId: active })
        : undefined;
      if (loaded?.some((tk) => tk.id === taskId)) return;
      // Otherwise resolve the task's project (deep link to another project) and
      // switch to it so the detail panel can actually load it.
      void utils.task.byId
        .fetch({ id: taskId })
        .then((task) => {
          if (task?.projectId && task.projectId !== activeProjectIdRef.current) {
            setActiveProjectId(task.projectId);
          }
        })
        .catch(() => {});
    },
    [organizationId, utils, setActiveProjectId],
  );

  const closeTask = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  const updateTask = useCallback(
    (taskId: string, patch: Partial<InboxTask>) => {
      if (!organizationId || !activeProjectId) return;
      const key = { organizationId, projectId: activeProjectId };
      utils.task.list.setData(key, (prev) =>
        prev?.map((t) =>
          t.id === taskId
            ? {
                ...t,
                ...patch,
                ...(patch.dueDate !== undefined
                  ? { dueLabel: formatDueLabel(patch.dueDate || null, patch.status ?? t.status) }
                  : {}),
              }
            : t,
        ),
      );
      updateMutation.mutate({
        id: taskId,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.priority ? { priority: patch.priority } : {}),
        ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate || null } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.agentBrief !== undefined ? { agentBrief: patch.agentBrief } : {}),
      });
    },
    [organizationId, activeProjectId, utils, updateMutation],
  );

  const createTask = useCallback(
    async (input: NewTaskInput) => {
      const projectId = input.projectId ?? activeProjectId ?? projects[0]?.id;
      if (!projectId) return;
      await createMutation.mutateAsync({
        projectId,
        title: input.title,
        description: input.description,
        priority: input.priority ?? "medium",
        status: input.status ?? "todo",
        dueDate: input.dueDate ?? undefined,
        tags: input.tags ?? [],
        assigneeUserIds: input.assigneeUserIds ?? [],
        assigneeAgentIds: input.assigneeAgentIds ?? [],
        agentBrief: input.agentBrief ?? undefined,
      });
    },
    [activeProjectId, projects, createMutation],
  );

  const value = useMemo<TaskWorkspaceContextValue>(
    () => ({
      ready,
      isLive,
      organizationId,
      workspaceName: workspace?.name ?? "Workspace",
      role: workspace?.role ?? null,
      user: sessionUser
        ? {
            id: sessionUser.id,
            name: sessionUser.name,
            email: sessionUser.email,
            image: sessionUser.image,
          }
        : null,
      projects,
      activeProjectId,
      activeProject,
      setActiveProjectId,
      tasks,
      isLoadingTasks,
      isBootstrapping,
      selectedTask,
      selectedTaskId,
      openTask,
      closeTask,
      updateTask,
      createTask,
      isCreatingTask: createMutation.isPending,
    }),
    [
      ready,
      isLive,
      organizationId,
      workspace?.name,
      workspace?.role,
      sessionUser,
      projects,
      activeProjectId,
      activeProject,
      setActiveProjectId,
      tasks,
      isLoadingTasks,
      isBootstrapping,
      sessionPending,
      sessionReady,
      workspacesQuery.isSuccess,
      workspacesQuery.isError,
      projectsQuery.isSuccess,
      projectsQuery.isError,
      tasksQuery.isSuccess,
      tasksQuery.isError,
      selectedTask,
      selectedTaskId,
      openTask,
      closeTask,
      updateTask,
      createTask,
      createMutation.isPending,
    ],
  );

  return (
    <TaskWorkspaceContext.Provider value={value}>
      {children}
    </TaskWorkspaceContext.Provider>
  );
}

export function useTaskWorkspace() {
  const ctx = useContext(TaskWorkspaceContext);
  if (!ctx) {
    throw new Error("useTaskWorkspace must be used within TaskWorkspaceProvider");
  }
  return ctx;
}
