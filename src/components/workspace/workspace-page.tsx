import type { ReactNode } from "react";

type WorkspacePageProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Full-width layout for dense views like Inbox */
  wide?: boolean;
};

export function WorkspacePage({
  title,
  description,
  actions,
  children,
  wide = false,
}: WorkspacePageProps) {
  return (
    <div className="workspace-scroll h-full overflow-y-auto">
      <div
        className={
          wide
            ? "mx-auto max-w-[1600px] px-4 py-4 md:px-8 md:py-6"
            : "mx-auto max-w-6xl p-4 md:p-6"
        }
      >
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-julow-muted">
              {description}
            </p>
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
