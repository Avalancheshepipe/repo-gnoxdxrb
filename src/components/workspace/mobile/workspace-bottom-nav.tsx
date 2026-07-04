"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { workspaceViewIcons } from "@/components/workspace/workspace-nav-icons";
import { getViewFromPath, sidebarViews } from "@/lib/workspace-data";

export function WorkspaceBottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const activeView = getViewFromPath(pathname);

  return (
    <nav
      className="julow-bottom-nav fixed inset-x-0 bottom-0 z-40 hidden"
      aria-label="Main navigation"
    >
      <div className="julow-bottom-nav__dock">
        {sidebarViews.map((view) => {
          const active = activeView === view.id;
          return (
            <Link
              key={view.id}
              href={view.href}
              className={`julow-bottom-nav__item${active ? " julow-bottom-nav__item--active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                icon={workspaceViewIcons[view.id]}
                size={24}
                className={active ? "text-accent" : "text-julow-muted"}
              />
              <span className="julow-bottom-nav__label">{t(`nav.${view.id}`)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
