"use client";

import { Switch } from "@heroui/react";

type ToggleProps = {
  isSelected?: boolean;
  defaultSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  isDisabled?: boolean;
  size?: "sm" | "md" | "lg";
  "aria-label"?: string;
};

/**
 * A visible on/off switch. HeroUI's bare <Switch> renders no control on its
 * own — the track + thumb must be composed explicitly.
 */
export function Toggle(props: ToggleProps) {
  return (
    <Switch {...props}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}
