import { z } from "zod";
import { parseFlowGraph, type FlowGraph } from "@/lib/flow-graph";
import { generateProjectFlow, suggestForFlow } from "@/server/ai/flow";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertProjectAccess } from "@/server/trpc/util";

const nodeTypeEnum = z.enum(["task", "note", "agent", "milestone"]);
const edgeKindEnum = z.enum(["relates", "blocks", "produces", "assigned"]);

const positionSchema = z.object({ x: z.number(), y: z.number() });

type BoardLayoutJson = Record<string, { x: number; y: number }>;

type CanvasNodeDto = {
  id: string;
  type: z.infer<typeof nodeTypeEnum>;
  title: string;
  subtitle?: string;
  status?: string;
  x: number;
  y: number;
  width: number;
  connections: string[];
};

type CanvasEdgeDto = {
  id: string;
  source: string;
  target: string;
  kind: string;
};

function parseBoardLayout(value: unknown): BoardLayoutJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: BoardLayoutJson = {};
  for (const [id, pos] of Object.entries(value as Record<string, unknown>)) {
    const x = (pos as { x?: unknown } | null)?.x;
    const y = (pos as { y?: unknown } | null)?.y;
    if (
      pos &&
      typeof pos === "object" &&
      typeof x === "number" &&
      Number.isFinite(x) &&
      typeof y === "number" &&
      Number.isFinite(y)
    ) {
      out[id] = { x, y };
    }
  }
  return out;
}

function nodeTypeToDb(t: z.infer<typeof nodeTypeEnum>) {
  return t.toUpperCase() as "TASK" | "NOTE" | "AGENT" | "MILESTONE";
}

export const canvasRouter = router({
  /** Returns the session token + ws url the client uses to join the realtime doc. */
  realtimeAuth: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.user.id, input.projectId);
      return {
        token: ctx.session.session.token,
        wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234",
        projectId: input.projectId,
        user: {
          id: ctx.user.id,
          name: ctx.user.name,
          image: ctx.user.image ?? null,
        },
      };
    }),

  get: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.user.id, input.projectId);

      // The board must ALWAYS render. Tolerate a stale Prisma client, a missing
      // `boardLayout` column, malformed layout JSON, or an empty doc by degrading
      // to an empty-but-renderable structure (the client recomputes positions).
      let nodes: CanvasNodeDto[] = [];
      let edges: CanvasEdgeDto[] = [];
      let boardLayout: BoardLayoutJson = {};
      let flowGraph: FlowGraph = { nodes: [], edges: [] };

      try {
        const [rawNodes, rawEdges, doc] = await Promise.all([
          ctx.prisma.canvasNode.findMany({
            where: { projectId: input.projectId },
            include: { outgoingEdges: { select: { targetId: true } } },
          }),
          ctx.prisma.canvasEdge.findMany({
            where: { projectId: input.projectId },
          }),
          ctx.prisma.canvasDoc
            .findUnique({
              where: { projectId: input.projectId },
              select: { boardLayout: true, flowGraph: true },
            })
            // Isolate the doc read: even if selecting it fails (stale client /
            // missing column), nodes + edges still load.
            .catch(() => null),
        ]);

        nodes = rawNodes.map((n) => ({
          id: n.id,
          type: n.type.toLowerCase() as z.infer<typeof nodeTypeEnum>,
          title: n.title,
          subtitle: n.subtitle ?? undefined,
          status: n.status ?? undefined,
          x: n.x,
          y: n.y,
          width: n.width,
          connections: n.outgoingEdges.map((e) => e.targetId),
        }));
        edges = rawEdges.map((e) => ({
          id: e.id,
          source: e.sourceId,
          target: e.targetId,
          kind: e.kind.toLowerCase(),
        }));
        boardLayout = parseBoardLayout(doc?.boardLayout);
        flowGraph = parseFlowGraph(doc?.flowGraph);
      } catch (err) {
        console.error("[canvas.get] returning empty board after error", err);
      }

      return { nodes, edges, boardLayout, flowGraph };
    }),

  /** Generate (or regenerate) the AI project flow graph. Persisted + shared. */
  generateFlow: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.user.id, input.projectId, [
        "owner",
        "admin",
        "member",
      ]);
      try {
        const graph = await generateProjectFlow(input.projectId);
        return { ok: true as const, flowGraph: graph };
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : "Generation failed",
          flowGraph: { nodes: [], edges: [] } as FlowGraph,
        };
      }
    }),

  /** AI advisory suggestions about the current flow + tasks. */
  suggest: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        locale: z.enum(["ru", "en"]).default("ru"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.user.id, input.projectId);
      try {
        const suggestions = await suggestForFlow(input.projectId, input.locale);
        return { ok: true as const, suggestions };
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : "Suggestion failed",
          suggestions: [] as string[],
        };
      }
    }),

  addNode: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        type: nodeTypeEnum,
        title: z.string().min(1).max(200),
        subtitle: z.string().max(500).optional(),
        status: z.string().optional(),
        x: z.number().default(0),
        y: z.number().default(0),
        width: z.number().default(200),
        taskId: z.string().optional(),
        agentId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.user.id, input.projectId, ["owner", "admin", "member"]);
      const { type, ...rest } = input;
      return ctx.prisma.canvasNode.create({
        data: { ...rest, type: nodeTypeToDb(type) },
      });
    }),

  moveNode: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        x: z.number(),
        y: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const node = await ctx.prisma.canvasNode.findUnique({
        where: { id: input.id },
        select: { projectId: true },
      });
      if (!node) throw new Error("Node not found");
      await assertProjectAccess(ctx.user.id, node.projectId, ["owner", "admin", "member"]);
      return ctx.prisma.canvasNode.update({
        where: { id: input.id },
        data: { x: input.x, y: input.y },
      });
    }),

  saveLayout: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        positions: z.record(z.string(), positionSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.user.id, input.projectId, ["owner", "admin", "member"]);
      try {
        const existing = await ctx.prisma.canvasDoc
          .findUnique({
            where: { projectId: input.projectId },
            select: { boardLayout: true },
          })
          .catch(() => null);
        const merged: BoardLayoutJson = {
          ...parseBoardLayout(existing?.boardLayout),
          ...input.positions,
        };
        await ctx.prisma.canvasDoc.upsert({
          where: { projectId: input.projectId },
          update: { boardLayout: merged },
          create: { projectId: input.projectId, boardLayout: merged },
        });
        return { ok: true as const, boardLayout: merged };
      } catch (err) {
        // A failed layout persist must never surface as a hard error to the
        // board (positions are best-effort and recomputed on load anyway).
        console.error("[canvas.saveLayout] failed", err);
        return { ok: false as const, boardLayout: {} as BoardLayoutJson };
      }
    }),

  link: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        sourceId: z.string().min(1),
        targetId: z.string().min(1),
        kind: edgeKindEnum.default("relates"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectAccess(ctx.user.id, input.projectId, ["owner", "admin", "member"]);
      return ctx.prisma.canvasEdge.upsert({
        where: {
          sourceId_targetId_kind: {
            sourceId: input.sourceId,
            targetId: input.targetId,
            kind: input.kind.toUpperCase() as
              | "RELATES"
              | "BLOCKS"
              | "PRODUCES"
              | "ASSIGNED",
          },
        },
        create: {
          projectId: input.projectId,
          sourceId: input.sourceId,
          targetId: input.targetId,
          kind: input.kind.toUpperCase() as
            | "RELATES"
            | "BLOCKS"
            | "PRODUCES"
            | "ASSIGNED",
        },
        update: {},
      });
    }),

  removeNode: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const node = await ctx.prisma.canvasNode.findUnique({
        where: { id: input.id },
        select: { projectId: true },
      });
      if (!node) return { ok: true };
      await assertProjectAccess(ctx.user.id, node.projectId, ["owner", "admin", "member"]);
      await ctx.prisma.canvasNode.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
