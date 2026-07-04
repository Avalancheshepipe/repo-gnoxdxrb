"use client";

import {
  AiBrain01Icon,
  ArrowRight01Icon,
  CanvasIcon,
  InboxIcon,
  WorkflowCircle01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import Link from "next/link";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import type { WorkspaceView } from "@/lib/workspace-data";

type SectionCard = {
  id: Exclude<WorkspaceView, "home">;
  href: string;
  icon: IconSvgElement;
  titleKey: string;
  descriptionKey: string;
};

const sections: SectionCard[] = [
  {
    id: "canvas",
    href: "/app/board",
    icon: CanvasIcon,
    titleKey: "nav.canvas",
    descriptionKey: "home.section.board",
  },
  {
    id: "inbox",
    href: "/app/inbox",
    icon: InboxIcon,
    titleKey: "nav.inbox",
    descriptionKey: "home.section.inbox",
  },
  {
    id: "automations",
    href: "/app/automations",
    icon: WorkflowCircle01Icon,
    titleKey: "nav.automations",
    descriptionKey: "home.section.automations",
  },
];

export function WorkspaceHome() {
  const { t } = useI18n();
  const { activeProject, user, ready } = useTaskWorkspace();

  const greetingName = user?.name?.trim().split(/\s+/)[0] ?? null;
  const projectName = activeProject?.name ?? "…";

  return (
    <div className="workspace-scroll h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center px-4 py-10 md:px-8 md:py-16">
        <div>
          <p className="text-sm font-medium text-accent">
            {greetingName
              ? t("home.greeting").replace("{name}", greetingName)
              : t("home.greetingAnonymous")}
          </p>
          <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-4xl">
            {ready
              ? t("home.title").replace("{project}", projectName)
              : t("common.loading")}
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-julow-muted md:text-base">
            {t("home.subtitle")}
          </p>
        </div>

        <p className="relative mt-10 text-xs font-medium uppercase tracking-wider text-julow-muted">
          {t("home.pickSection")}
        </p>

        <div className="relative mt-4 grid gap-3 sm:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={section.href}
              className="group julow-home-card"
            >
              <span aria-hidden className="julow-home-card__mesh" />
              <span aria-hidden className="julow-home-card__noise" />
              <span aria-hidden className="julow-home-card__glare" />
              <span className="julow-home-card__content">
                <span className="julow-home-card__icon">
                  <Icon icon={section.icon} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-julow-fg">
                      {t(section.titleKey)}
                    </h2>
                    <Icon
                      icon={ArrowRight01Icon}
                      size={16}
                      className="julow-home-card__arrow shrink-0 text-julow-muted"
                    />
                  </span>
                  <p className="mt-1 text-sm leading-relaxed text-julow-muted">
                    {t(section.descriptionKey)}
                  </p>
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
