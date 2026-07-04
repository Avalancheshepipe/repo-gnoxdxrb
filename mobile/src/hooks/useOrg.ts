import { authClient } from "../auth";
import { api } from "../api";

/**
 * Resolves the signed-in user's active workspace.
 */
export function useOrg() {
  const session = authClient.useSession();
  const workspaces = api.workspace.list.useQuery(undefined, {
    enabled: Boolean(session.data),
    staleTime: 60_000,
    retry: 2,
    networkMode: "always",
  });

  const sessionPending = session.isPending;
  const workspacePending =
    Boolean(session.data) && !workspaces.isFetched && !workspaces.isError;
  const isReady =
    !sessionPending &&
    (!session.data || workspaces.isFetched || workspaces.isError);
  const organizationId = workspaces.data?.[0]?.id;

  return {
    organizationId,
    workspaceName: workspaces.data?.[0]?.name,
    isLoading: sessionPending || workspacePending,
    isReady,
    hasWorkspace: Boolean(organizationId),
    workspaceError: workspaces.error,
  };
}

type ListQuery = {
  isFetched: boolean;
  isError: boolean;
  isPending: boolean;
  isFetching: boolean;
  fetchStatus: string;
  data?: unknown[] | null;
};

export function listScreenState(
  org: ReturnType<typeof useOrg>,
  query: ListQuery,
  count: number,
) {
  if (!org.isReady || org.isLoading) {
    return { phase: "loading" as const };
  }
  if (org.workspaceError) {
    return { phase: "error" as const };
  }
  if (!org.hasWorkspace) {
    return { phase: "no-workspace" as const };
  }
  if (query.isError) {
    return { phase: "error" as const };
  }
  const waiting =
    query.isPending ||
    query.isFetching ||
    query.fetchStatus === "fetching" ||
    !query.isFetched;
  if (waiting && count === 0) {
    return { phase: "loading" as const };
  }
  if (query.isFetched && count === 0) {
    return { phase: "empty" as const };
  }
  return { phase: "ready" as const };
}
