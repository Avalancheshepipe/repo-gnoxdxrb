"use client";

import { Moon01Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button isIconOnly size="sm" variant="ghost" aria-label="Toggle theme">
        <span className="size-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onPress={() => setTheme(isDark ? "light" : "dark")}
    >
      <Icon icon={isDark ? Sun01Icon : Moon01Icon} size={16} strokeWidth={2} />
    </Button>
  );
}
