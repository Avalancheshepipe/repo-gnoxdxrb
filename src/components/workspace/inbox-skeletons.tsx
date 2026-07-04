"use client";

import { Table } from "@heroui/react";
import { kanbanColumns } from "@/components/workspace/inbox-shared";

const KANBAN_CARD_COUNTS = [2, 1, 1, 1];

function Bone({
  className,
  block = false,
  round = false,
}: {
  className?: string;
  block?: boolean;
  round?: boolean;
}) {
  const shape = round
    ? "julow-skeleton--round"
    : block
      ? "julow-skeleton--block"
      : "julow-skeleton--pill";
  return (
    <div className={`julow-skeleton ${shape} ${className ?? ""}`} aria-hidden />
  );
}

function KanbanCardSkeleton() {
  return (
    <div className="julow-kanban-card glass-panel rounded-2xl p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <Bone className="h-4 flex-1" />
        <Bone className="h-6 w-16 shrink-0" />
      </div>
      <Bone className="mb-1.5 h-3 w-full" />
      <Bone className="mb-3 h-3 w-[80%]" />
      <div className="mb-3 flex gap-1.5">
        <Bone className="h-5 w-14" />
        <Bone className="h-5 w-12" />
      </div>
      <div className="flex items-center justify-between border-t border-julow-glass-border pt-2.5">
        <div className="flex -space-x-2">
          <Bone round className="size-8" />
          <Bone round className="size-8" />
        </div>
        <Bone className="h-3 w-20" />
      </div>
    </div>
  );
}

export function InboxKanbanSkeleton() {
  return (
    <div className="julow-kanban-board grid min-h-[480px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kanbanColumns.map((status, colIndex) => (
        <div
          key={status}
          className="julow-kanban-column flex min-h-[200px] flex-col rounded-2xl border border-julow-glass-border bg-julow-glass-bg/30"
        >
          <header className="flex items-center justify-between border-b border-julow-glass-border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Bone className="h-4 w-24" />
              <Bone round className="size-5" />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-2.5 p-2.5">
            {Array.from({ length: KANBAN_CARD_COUNTS[colIndex] ?? 1 }).map(
              (_, i) => (
                <KanbanCardSkeleton key={i} />
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InboxTableSkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <Table.Row key={i} id={`skeleton-${i}`}>
          <Table.Cell>
            <Bone block className="h-4 w-52 max-w-full" />
            <Bone block className="mt-2 h-3 w-72 max-w-full" />
          </Table.Cell>
          <Table.Cell>
            <Bone className="h-7 w-[4.75rem]" />
          </Table.Cell>
          <Table.Cell>
            <Bone className="h-7 w-16" />
          </Table.Cell>
          <Table.Cell>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                <Bone round className="size-8" />
                <Bone round className="size-8" />
              </div>
              <Bone className="hidden h-4 w-24 lg:block" />
            </div>
          </Table.Cell>
          <Table.Cell>
            <Bone className="h-4 w-28" />
          </Table.Cell>
          <Table.Cell className="hidden lg:table-cell">
            <div className="flex gap-1.5">
              <Bone className="h-7 w-16" />
              <Bone className="h-7 w-14" />
            </div>
          </Table.Cell>
          <Table.Cell className="hidden md:table-cell">
            <Bone className="h-4 w-32" />
          </Table.Cell>
        </Table.Row>
      ))}
    </>
  );
}
