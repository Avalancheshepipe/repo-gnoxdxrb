"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { ListBox, Select } from "@heroui/react";
import { Icon } from "@/components/ui/icon";

export type SelectOption = { value: string; label: string; description?: string };

type SelectFieldProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  className?: string;
  placeholder?: string;
  selectedDescription?: string;
};

/** Thin wrapper over HeroUI's native Select for app-styled dropdowns. */
export function SelectField({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  placeholder,
  selectedDescription,
}: SelectFieldProps) {
  const selected = options.find((o) => o.value === value);

  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value || null}
      onSelectionChange={(key) => {
        if (key != null) onChange(String(key));
      }}
      placeholder={placeholder}
      className={className}
      fullWidth
    >
      <Select.Trigger
        className="julow-select-trigger"
        title={selectedDescription}
      >
        <span className="select__value truncate">
          {selected?.label ?? placeholder ?? ""}
        </span>
        <Icon icon={ArrowDown01Icon} size={16} className="text-julow-muted" />
      </Select.Trigger>
      <Select.Popover className="julow-select-popover">
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.value} id={o.value} textValue={o.label}>
              <span className="truncate">{o.label}</span>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
