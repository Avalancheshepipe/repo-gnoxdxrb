"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { ListBox, Select } from "@heroui/react";
import { Icon } from "@/components/ui/icon";

export type ColorTone =
  | "default"
  | "accent"
  | "warning"
  | "success"
  | "danger";

export type ColorOption = { value: string; label: string; tone?: ColorTone };

type ColorSelectFieldProps = {
  value: string;
  onChange: (value: string) => void;
  options: ColorOption[];
  ariaLabel: string;
  className?: string;
};

/**
 * HeroUI Select that color-codes each option (status / priority). The trigger
 * reflects the ACTIVE option's color (dot + tinted border); the selected item
 * is highlighted in its own color.
 */
export function ColorSelectField({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: ColorSelectFieldProps) {
  const active = options.find((o) => o.value === value);
  const tone: ColorTone = active?.tone ?? "default";

  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value || null}
      onSelectionChange={(key) => {
        if (key != null) onChange(String(key));
      }}
      className={className}
      fullWidth
    >
      <Select.Trigger
        className="julow-select-trigger julow-color-select__trigger"
        data-tone={tone}
      >
        <span className="julow-color-select__value">
          <span
            className={`julow-color-dot julow-color-dot--${tone}`}
            aria-hidden
          />
          <span className="truncate">{active?.label ?? ""}</span>
        </span>
        <Icon icon={ArrowDown01Icon} size={16} className="text-julow-muted" />
      </Select.Trigger>
      <Select.Popover className="julow-select-popover julow-color-select__popover">
        <ListBox>
          {options.map((o) => (
            <ListBox.Item
              key={o.value}
              id={o.value}
              textValue={o.label}
              className="julow-color-select__item"
              data-tone={o.tone ?? "default"}
            >
              <span
                className={`julow-color-dot julow-color-dot--${o.tone ?? "default"}`}
                aria-hidden
              />
              <span>{o.label}</span>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
