"use client";

import {
  AiBrain01Icon,
  CanvasIcon,
  WorkflowCircle01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { Card } from "@heroui/react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/components/providers/i18n-provider";

export function FeatureGrid() {
  const { t } = useI18n();

  const features: {
    id: string;
    titleKey: string;
    descriptionKey: string;
    icon: IconSvgElement;
  }[] = [
    {
      id: "agents",
      titleKey: "landing.features.agents.title",
      descriptionKey: "landing.features.agents.description",
      icon: AiBrain01Icon,
    },
    {
      id: "canvas",
      titleKey: "landing.features.canvas.title",
      descriptionKey: "landing.features.canvas.description",
      icon: CanvasIcon,
    },
    {
      id: "automation",
      titleKey: "landing.features.automation.title",
      descriptionKey: "landing.features.automation.description",
      icon: WorkflowCircle01Icon,
    },
  ];

  return (
    <section className="px-6 pb-20 md:pb-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("landing.features.title")}
          </h2>
          <p className="mt-3 leading-relaxed text-julow-muted">
            {t("landing.features.subtitle")}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.id}
              id={feature.id}
              variant="secondary"
              className="glass-panel scroll-mt-28 julow-landing-enter"
            >
              <Card.Header className="flex-col items-start gap-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon icon={feature.icon} size={20} />
                </div>
                <Card.Title className="text-base">{t(feature.titleKey)}</Card.Title>
              </Card.Header>
              <Card.Content>
                <Card.Description className="text-sm leading-relaxed">
                  {t(feature.descriptionKey)}
                </Card.Description>
              </Card.Content>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
