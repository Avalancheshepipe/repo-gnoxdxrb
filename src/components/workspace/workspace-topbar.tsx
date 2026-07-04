"use client";

import {
  AiBrain01Icon,
  CheckmarkBadge01Icon,
  Logout01Icon,
  Share01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { Avatar, Button, Popover } from "@heroui/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useI18n } from "@/components/providers/i18n-provider";
import { Logo } from "@/components/brand/logo";
import { Icon } from "@/components/ui/icon";
import {
  CommandPaletteDesktop,
  CommandPaletteMobileOverlay,
  CommandPaletteMobileSearch,
  CommandPaletteRoot,
} from "@/components/workspace/command-palette";
import { WorkspaceProjectPicker } from "@/components/workspace/mobile/workspace-project-picker";
import { ApprovalsDialog } from "@/components/workspace/approvals-dialog";
import { ShareDialog } from "@/components/workspace/share-dialog";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import { authClient } from "@/lib/auth-client";
import { LOCALE_LABEL, LOCALES } from "@/lib/i18n";
import { api } from "@/lib/trpc";
import { getViewFromPath } from "@/lib/workspace-data";

type WorkspaceTopbarProps = {
  variant?: "desktop" | "mobile";
};

function initials(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

export function WorkspaceTopbar({ variant = "desktop" }: WorkspaceTopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);
  const view = getViewFromPath(pathname);
  const { workspaceName, user, organizationId, role, activeProject, ready } =
    useTaskWorkspace();
  const projectLabel = activeProject?.name ?? (ready ? workspaceName : t("common.loading"));
  const [shareOpen, setShareOpen] = useState(false);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const pendingApprovals = api.approval.requests.pendingCount.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: Boolean(organizationId), refetchInterval: 30_000 },
  );
  const pendingCount = pendingApprovals.data ?? 0;
  const [signingOut, setSigningOut] = useState(false);
  const isMobile = variant === "mobile";

  const canInvite = role === "owner" || role === "admin";
  const label = user?.name ?? user?.email ?? "You";

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const headerClass = isMobile
    ? "julow-mobile-topbar julow-mobile-solid flex h-[var(--topbar-height)] shrink-0 items-center gap-2 px-3"
    : "glass-panel-subtle flex h-[var(--topbar-height)] shrink-0 items-center gap-2 border-b border-julow-glass-border px-3 sm:gap-3 sm:px-4";

  return (
    <CommandPaletteRoot onOpenShare={() => setShareOpen(true)}>
      <header className={headerClass}>
        {isMobile ? (
          <>
            <Link href="/app" className="flex shrink-0 items-center" aria-label="Home">
              <Logo showWordmark={false} size={26} href={null} />
            </Link>
            <div className="julow-mobile-topbar__center">
              <WorkspaceProjectPicker />
              <CommandPaletteMobileSearch />
            </div>
          </>
        ) : null}

        {!isMobile && (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-[11px] font-semibold text-accent">
              {initials(projectLabel)}
            </span>
            <span className="truncate text-sm font-medium" title={projectLabel}>
              {projectLabel}
            </span>
            {view !== "home" && (
              <>
                <span className="shrink-0 text-sm text-julow-muted">/</span>
                <span className="truncate text-sm text-julow-muted">
                  {t(`nav.${view}`)}
                </span>
              </>
            )}
          </div>
        )}

        <div className="hidden w-full max-w-lg shrink-0 lg:block">
          <CommandPaletteDesktop />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-1.5">
          <button
            type="button"
            aria-label={t("approvals.title")}
            title={t("approvals.title")}
            onClick={() => setApprovalsOpen(true)}
            className="relative flex size-8 items-center justify-center rounded-lg text-julow-muted outline-none ring-accent/40 transition-colors hover:bg-julow-glass-bg hover:text-julow-fg focus-visible:ring-2"
          >
            <Icon icon={CheckmarkBadge01Icon} size={18} />
            {pendingCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </button>
          <Button
            size="sm"
            variant="outline"
            className="hidden sm:inline-flex"
            onPress={() => setShareOpen(true)}
          >
            <Icon icon={Share01Icon} size={16} />
            {t("common.share")}
          </Button>

          <Popover>
            <Popover.Trigger>
              <button
                type="button"
                aria-label="Account menu"
                className="rounded-full outline-none ring-accent/40 focus-visible:ring-2"
              >
                <Avatar size="sm" color="accent">
                  <Avatar.Fallback>{initials(label)}</Avatar.Fallback>
                </Avatar>
              </button>
            </Popover.Trigger>
            <Popover.Content placement="bottom end" className="w-60 p-0">
              <Popover.Dialog className="p-0">
                <div className="border-b border-julow-glass-border px-4 py-3">
                  <p className="truncate text-sm font-medium">{label}</p>
                  {user?.email && (
                    <p className="truncate text-xs text-julow-muted">{user.email}</p>
                  )}
                </div>
                <div className="p-1.5">
                  <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-julow-muted">
                    {t("common.theme")}
                  </div>
                  <div className="mb-1 flex gap-1 px-1.5">
                    {(["light", "dark"] as const).map((theme) => (
                      <button
                        key={theme}
                        type="button"
                        onClick={() => setTheme(theme)}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          themeMounted && resolvedTheme === theme
                            ? "bg-accent/15 text-accent"
                            : "text-julow-muted hover:bg-julow-glass-bg hover:text-julow-fg"
                        }`}
                      >
                        {t(`theme.${theme}`)}
                      </button>
                    ))}
                  </div>
                  <div className="my-1 border-t border-julow-glass-border" />
                  <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-julow-muted">
                    {t("common.language")}
                  </div>
                  <div className="mb-1 flex gap-1 px-1.5">
                    {LOCALES.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLocale(l)}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          locale === l
                            ? "bg-accent/15 text-accent"
                            : "text-julow-muted hover:bg-julow-glass-bg hover:text-julow-fg"
                        }`}
                      >
                        {LOCALE_LABEL[l]}
                      </button>
                    ))}
                  </div>
                  <div className="my-1 border-t border-julow-glass-border" />
                  {canInvite && (
                    <button
                      type="button"
                      onClick={() => setShareOpen(true)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-julow-fg transition-colors hover:bg-julow-glass-bg"
                    >
                      <Icon icon={UserGroupIcon} size={16} className="text-julow-muted" />
                      {t("common.invitePeople")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={signOut}
                    disabled={signingOut}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-julow-fg transition-colors hover:bg-julow-glass-bg disabled:opacity-60"
                  >
                    <Icon icon={Logout01Icon} size={16} className="text-julow-muted" />
                    {signingOut ? "…" : t("common.signOut")}
                  </button>
                </div>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        </div>

        <ApprovalsDialog
          open={approvalsOpen}
          onClose={() => setApprovalsOpen(false)}
          organizationId={organizationId}
        />

        <ShareDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          organizationId={organizationId}
          workspaceName={workspaceName}
        />
      </header>

      <CommandPaletteMobileOverlay />
    </CommandPaletteRoot>
  );
}
