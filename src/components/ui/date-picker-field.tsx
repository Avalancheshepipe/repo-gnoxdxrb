"use client";

import { Calendar03Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { Calendar, DateField, DatePicker } from "@heroui/react";
import { I18nProvider } from "@heroui/react/rac";
import {
  getLocalTimeZone,
  parseDate,
  type DateValue,
} from "@internationalized/date";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";

/** Accepts a full ISO datetime or a plain YYYY-MM-DD date. */
function isoToDateValue(value?: string | null): DateValue | null {
  if (!value) return null;
  try {
    return parseDate(value.slice(0, 10));
  } catch {
    return null;
  }
}

function dateValueToIso(value: DateValue | null): string | null {
  if (!value) return null;
  try {
    return value.toDate(getLocalTimeZone()).toISOString();
  } catch {
    return null;
  }
}

type DatePickerFieldProps = {
  value?: string | null;
  onChange: (iso: string | null) => void;
  ariaLabel: string;
  className?: string;
  /** Show a clear (×) button when a date is set. */
  clearable?: boolean;
  clearLabel?: string;
};

/**
 * App-styled wrapper over HeroUI's DatePicker (built on react-aria). Reads/writes
 * an ISO date string so it drops into existing task forms in place of a native
 * <input type="date">. Solid popover, adaptive, keyboard-accessible.
 */
export function DatePickerField({
  value,
  onChange,
  ariaLabel,
  className,
  clearable = true,
  clearLabel = "Clear",
}: DatePickerFieldProps) {
  const { locale } = useI18n();
  const localeTag = locale === "ru" ? "ru-RU" : "en-US";
  const current = isoToDateValue(value);

  return (
    <I18nProvider locale={localeTag}>
      <DatePicker
        aria-label={ariaLabel}
        value={current}
        onChange={(v) => onChange(dateValueToIso(v))}
        className={`julow-datepicker ${className ?? ""}`.trim()}
      >
        <DateField.Group className="julow-datepicker__group">
        <DateField.Input className="julow-datepicker__segments">
          {(segment) => (
            <DateField.Segment
              segment={segment}
              className="julow-datepicker__segment"
            />
          )}
        </DateField.Input>
        {clearable && current && (
          <button
            type="button"
            aria-label={clearLabel}
            className="julow-datepicker__clear"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange(null);
            }}
          >
            <Icon icon={Cancel01Icon} size={13} />
          </button>
        )}
        <DatePicker.Trigger className="julow-datepicker__trigger">
          <Icon icon={Calendar03Icon} size={15} />
        </DatePicker.Trigger>
      </DateField.Group>
      <DatePicker.Popover className="julow-datepicker__popover">
        <Calendar className="julow-calendar">
          <header className="julow-calendar__header">
            <Calendar.NavButton slot="previous" className="julow-calendar__nav" />
            <Calendar.Heading className="julow-calendar__heading" />
            <Calendar.NavButton slot="next" className="julow-calendar__nav" />
          </header>
          <Calendar.Grid className="julow-calendar__grid">
            <Calendar.GridHeader>
              {(day) => (
                <Calendar.HeaderCell className="julow-calendar__weekday">
                  {day}
                </Calendar.HeaderCell>
              )}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => (
                <Calendar.Cell date={date} className="julow-calendar__cell" />
              )}
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </DatePicker.Popover>
      </DatePicker>
    </I18nProvider>
  );
}
