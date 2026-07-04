"use client";

import {
  AiChat01Icon,
  CanvasIcon,
  Loading03Icon,
  WorkflowCircle01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { Card, Chip } from "@heroui/react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/components/providers/i18n-provider";

export function ProductPreview() {
  const { t } = useI18n();

  const modules: {
    titleKey: string;
    badgeKey: string;
    descriptionKey: string;
    accent: string;
    icon: IconSvgElement;
  }[] = [
    {
      titleKey: "landing.preview.agentChat.title",
      badgeKey: "landing.preview.agentChat.badge",
      descriptionKey: "landing.preview.agentChat.description",
      accent: "from-violet-500/20 to-indigo-500/10",
      icon: AiChat01Icon,
    },
    {
      titleKey: "landing.preview.canvas.title",
      badgeKey: "landing.preview.canvas.badge",
      descriptionKey: "landing.preview.canvas.description",
      accent: "from-orange-500/20 to-amber-500/10",
      icon: CanvasIcon,
    },
    {
      titleKey: "landing.preview.queue.title",
      badgeKey: "landing.preview.queue.badge",
      descriptionKey: "landing.preview.queue.description",
      accent: "from-sky-500/20 to-blue-500/10",
      icon: WorkflowCircle01Icon,
    },
  ];

  return (
    <section id="canvas" className="px-6 pb-20 md:pb-28">
      <div className="mx-auto max-w-6xl">
        <div className="glass-panel julow-landing-enter overflow-hidden rounded-3xl p-1">
          <div className="rounded-[1.35rem] bg-julow-bg/40 p-6 md:p-10">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex gap-2">
                <span className="size-3 rounded-full bg-red-400/80" />
                <span className="size-3 rounded-full bg-amber-400/80" />
                <span className="size-3 rounded-full bg-emerald-400/80" />
              </div>
              <Chip size="sm" variant="soft">
                {t("landing.preview.glassWorkspace")}
              </Chip>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {modules.map((mod) => (
                <Card
                  key={mod.titleKey}
                  variant="secondary"
                  className={`glass-panel bg-gradient-to-br ${mod.accent} p-0`}
                >
                  <Card.Header className="flex-row items-center justify-between gap-2 px-5 pt-5">
                    <div className="flex items-center gap-2">
                      <Icon
                        icon={mod.icon}
                        size={16}
                        className="text-julow-muted"
                      />
                      <Card.Title className="text-sm font-medium">
                        {t(mod.titleKey)}
                      </Card.Title>
                    </div>
                    <Chip size="sm" variant="soft">
                      {t(mod.badgeKey)}
                    </Chip>
                  </Card.Header>
                  <Card.Content className="px-5 pb-5">
                    <p className="text-sm leading-relaxed text-julow-muted">
                      {t(mod.descriptionKey)}
                    </p>
                    <div className="mt-4 h-16 rounded-xl bg-julow-bg/30" />
                  </Card.Content>
                </Card>
              ))}
            </div>

            <div className="mt-4 glass-panel rounded-2xl px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Icon
                    icon={Loading03Icon}
                    size={16}
                    className="animate-spin"
                  />
                </div>
                <div className="flex-1">
                  <div className="h-2.5 w-32 rounded-full bg-julow-fg/10" />
                  <div className="mt-2 h-2 w-48 rounded-full bg-julow-fg/5" />
                </div>
                <Chip size="sm" variant="soft" color="success">
                  {t("landing.preview.agentRunning")}
                </Chip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
