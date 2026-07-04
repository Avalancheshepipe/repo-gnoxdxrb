"use client";

import { Button, buttonVariants } from "@heroui/react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useI18n } from "@/components/providers/i18n-provider";

export function AppHeader() {
  const { t } = useI18n();

  const nav = [
    { label: t("landing.nav.canvas"), href: "#canvas" },
    { label: t("landing.nav.agents"), href: "#agents" },
    { label: t("landing.nav.automation"), href: "#automation" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full px-6 py-4">
      <div className="glass-panel mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-5 py-3">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-1.5 text-sm text-julow-muted transition-colors hover:text-julow-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher compact className="hidden sm:inline-flex" />
          <ThemeToggle />
          <Link
            href="/sign-in"
            className={buttonVariants({ size: "sm", variant: "ghost", className: "hidden sm:inline-flex" })}
          >
            {t("landing.header.signIn")}
          </Link>
          <Link
            href="/sign-up"
            className={buttonVariants({ size: "sm", variant: "primary" })}
          >
            {t("landing.header.getStarted")}
          </Link>
        </div>
      </div>
    </header>
  );
}
