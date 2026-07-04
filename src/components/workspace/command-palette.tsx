"use client";

import {
  AiBrain01Icon,
  ArrowRight01Icon,
  CanvasIcon,
  InboxIcon,
  Search01Icon,
  Task01Icon,
  WorkflowCircle01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { Button, SearchField } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { AgentOrbAvatar } from "@/components/workspace/agent-avatar";
import { useTaskWorkspace } from "@/components/workspace/task-workspace-context";
import {
  buildCommandPaletteGroups,
  flattenCommandGroups,
  type CommandGroup,
  type CommandResult,
} from "@/lib/command-palette-search";
import { openAgentChat } from "@/lib/workspace-events";
import { api } from "@/lib/trpc";

const GROUP_LABEL: Record<CommandGroup["id"], string> = {
  tasks: "commandPalette.group.tasks",
  agents: "commandPalette.group.agents",
  people: "commandPalette.group.people",
  pages: "commandPalette.group.pages",
};

const PAGE_ICONS: Record<string, IconSvgElement> = {
  canvas: CanvasIcon,
  inbox: InboxIcon,
  agents: AiBrain01Icon,
  automations: WorkflowCircle01Icon,
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type PaletteContextValue = {
  listId: string;
  query: string;
  setQuery: (q: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  groups: CommandGroup[];
  flat: CommandResult[];
  debouncedQuery: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  close: () => void;
  select: (item: CommandResult) => void;
  onInputKeyDown: (e: React.KeyboardEvent) => void;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

function usePaletteContext() {
  const ctx = useContext(PaletteContext);
  if (!ctx) {
    throw new Error("Command palette components must be used within CommandPaletteRoot");
  }
  return ctx;
}

function usePaletteData(query: string) {
  const { tasks, organizationId, isLive } = useTaskWorkspace();
  const { t } = useI18n();
  const debouncedQuery = useDebouncedValue(query, 150);

  const agentsQuery = api.agent.list.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: isLive, staleTime: 60_000 },
  );
  const membersQuery = api.workspace.members.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: isLive, staleTime: 60_000 },
  );

  const pageLabel = useCallback(
    (id: string) => t(`nav.${id}` as "nav.canvas"),
    [t],
  );

  const groups = useMemo(
    () =>
      buildCommandPaletteGroups({
        query: debouncedQuery,
        tasks,
        agents: agentsQuery.data ?? [],
        members: membersQuery.data ?? [],
        pageLabel,
      }),
    [debouncedQuery, tasks, agentsQuery.data, membersQuery.data, pageLabel],
  );

  return { groups, flat: flattenCommandGroups(groups), debouncedQuery };
}

function usePaletteActions(onOpenShare?: () => void) {
  const router = useRouter();
  const pathname = usePathname();
  const { openTask } = useTaskWorkspace();

  return useCallback(
    (item: CommandResult) => {
      switch (item.kind) {
        case "task":
          openTask(item.id);
          if (!pathname.startsWith("/app/inbox")) {
            router.push(`/app/inbox?task=${item.id}`);
          } else {
            router.replace(`/app/inbox?task=${item.id}`, { scroll: false });
          }
          break;
        case "agent":
          openAgentChat(item.id);
          break;
        case "person":
          onOpenShare?.();
          break;
        case "page":
          router.push(item.href);
          break;
      }
    },
    [openTask, pathname, router, onOpenShare],
  );
}

export function CommandPaletteRoot({
  children,
  onOpenShare,
}: {
  children: ReactNode;
  onOpenShare?: () => void;
}) {
  const listId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const { groups, flat, debouncedQuery } = usePaletteData(query);
  const runAction = usePaletteActions(onOpenShare);

  useEffect(() => setActiveIndex(0), [debouncedQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.matchMedia("(min-width: 1024px)").matches) {
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        } else {
          setMobileOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const select = useCallback(
    (item: CommandResult) => {
      close();
      runAction(item);
    },
    [close, runAction],
  );

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        inputRef.current?.blur();
        return;
      }
      if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        setOpen(true);
        return;
      }
      if (flat.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % flat.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flat[activeIndex];
        if (item) select(item);
      }
    },
    [open, flat, activeIndex, close, select],
  );

  const value = useMemo<PaletteContextValue>(
    () => ({
      listId,
      query,
      setQuery,
      open,
      setOpen,
      mobileOpen,
      setMobileOpen,
      activeIndex,
      setActiveIndex,
      groups,
      flat,
      debouncedQuery,
      inputRef,
      anchorRef,
      close,
      select,
      onInputKeyDown,
    }),
    [
      listId,
      query,
      open,
      mobileOpen,
      activeIndex,
      groups,
      flat,
      debouncedQuery,
      close,
      select,
      onInputKeyDown,
    ],
  );

  return (
    <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
  );
}

function CommandPaletteList({
  groups,
  activeIndex,
  onHover,
  onSelect,
  listId,
  activeId,
}: {
  groups: CommandGroup[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (item: CommandResult) => void;
  listId: string;
  activeId: string;
}) {
  const { t } = useI18n();
  let flatIndex = 0;

  return (
    <div
      id={listId}
      role="listbox"
      aria-activedescendant={activeId}
      className="julow-command-palette__list workspace-scroll max-h-[min(24rem,calc(100vh-12rem))] overflow-y-auto p-1.5"
    >
      {groups.map((group) => (
        <div key={group.id} className="mb-1 last:mb-0">
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-julow-muted">
            {t(GROUP_LABEL[group.id])}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const index = flatIndex++;
              const selected = index === activeIndex;
              const optionId = `${listId}-opt-${index}`;
              return (
                <CommandPaletteRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  selected={selected}
                  optionId={optionId}
                  onHover={() => onHover(index)}
                  onSelect={() => onSelect(item)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CommandPaletteRow({
  item,
  selected,
  optionId,
  onHover,
  onSelect,
}: {
  item: CommandResult;
  selected: boolean;
  optionId: string;
  onHover: () => void;
  onSelect: () => void;
}) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      id={optionId}
      role="option"
      aria-selected={selected}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={`julow-command-palette__item ${selected ? "is-active" : ""}`}
    >
      <span className="julow-command-palette__item-icon">
        {item.kind === "task" && <Icon icon={Task01Icon} size={15} />}
        {item.kind === "agent" && (
          <AgentOrbAvatar seed={item.name} size="sm" className="!size-6" />
        )}
        {item.kind === "person" && (
          <span className="flex size-6 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">
            {personInitials(item.name)}
          </span>
        )}
        {item.kind === "page" && (
          <Icon icon={PAGE_ICONS[item.id] ?? ArrowRight01Icon} size={15} />
        )}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-julow-fg">
          {item.kind === "task"
            ? item.title
            : item.kind === "page"
              ? item.label
              : item.name}
        </span>
        <span className="block truncate text-[11px] text-julow-muted">
          {item.kind === "task" && (
            <>
              {item.status}
              {item.tags.length > 0 ? ` · ${item.tags.slice(0, 2).join(", ")}` : ""}
            </>
          )}
          {item.kind === "agent" && `@${item.handle} · ${item.role}`}
          {item.kind === "person" && `@${item.handle} · ${item.role}`}
          {item.kind === "page" && t("commandPalette.goToHint")}
        </span>
      </span>
      {selected && (
        <kbd className="julow-command-palette__enter-hint" aria-hidden>
          ↵
        </kbd>
      )}
    </button>
  );
}

function CommandPalettePanel({
  showHint = true,
}: {
  showHint?: boolean;
}) {
  const { t } = useI18n();
  const {
    listId,
    groups,
    flat,
    debouncedQuery,
    activeIndex,
    setActiveIndex,
    select,
  } = usePaletteContext();
  const activeId = `${listId}-opt-${activeIndex}`;
  const empty = flat.length === 0 && debouncedQuery.length > 0;

  return (
    <div className="julow-command-palette glass-panel julow-command-palette--dropdown">
      {empty ? (
        <p className="px-4 py-8 text-center text-sm text-julow-muted">
          {t("commandPalette.empty")}
        </p>
      ) : (
        <CommandPaletteList
          groups={groups}
          activeIndex={activeIndex}
          onHover={setActiveIndex}
          onSelect={select}
          listId={listId}
          activeId={activeId}
        />
      )}
      {showHint && (
        <div className="flex items-center justify-between border-t border-julow-glass-border px-3 py-2 text-[10px] text-julow-muted">
          <span className="hidden sm:inline">{t("commandPalette.hint")}</span>
          <span className="flex items-center gap-2">
            <kbd className="julow-command-palette__kbd">↑↓</kbd>
            <kbd className="julow-command-palette__kbd">↵</kbd>
            <kbd className="julow-command-palette__kbd">esc</kbd>
          </span>
        </div>
      )}
    </div>
  );
}

export function CommandPaletteDesktop() {
  const { t } = useI18n();
  const {
    listId,
    query,
    setQuery,
    open,
    setOpen,
    flat,
    debouncedQuery,
    inputRef,
    anchorRef,
    onInputKeyDown,
  } = usePaletteContext();

  const showDropdown = open && (flat.length > 0 || debouncedQuery.length > 0);

  return (
    <div ref={anchorRef} className="relative w-full">
      <SearchField fullWidth className="julow-topbar-search">
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onInputKeyDown}
            placeholder={t("common.searchPlaceholder")}
            aria-controls={listId}
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            role="combobox"
          />
          <kbd className="julow-topbar-search__kbd" aria-hidden>
            ⌘K
          </kbd>
        </SearchField.Group>
      </SearchField>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-50">
          <CommandPalettePanel />
        </div>
      )}
    </div>
  );
}

export function CommandPaletteMobileSearch() {
  const { t } = useI18n();
  const { setMobileOpen } = usePaletteContext();

  return (
    <SearchField
      fullWidth
      className="julow-mobile-search julow-topbar-search lg:hidden"
      onClick={() => setMobileOpen(true)}
    >
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          readOnly
          placeholder={t("common.searchPlaceholder")}
          aria-label={t("commandPalette.open")}
          onFocus={() => setMobileOpen(true)}
        />
      </SearchField.Group>
    </SearchField>
  );
}

export function CommandPaletteMobileTrigger() {
  const { t } = useI18n();
  const { setMobileOpen } = usePaletteContext();

  return (
    <Button
      size="sm"
      variant="ghost"
      isIconOnly
      className="lg:hidden"
      aria-label={t("commandPalette.open")}
      onPress={() => setMobileOpen(true)}
    >
      <Icon icon={Search01Icon} size={18} />
    </Button>
  );
}

export function CommandPaletteMobileOverlay() {
  const { t } = useI18n();
  const {
    mobileOpen,
    setMobileOpen,
    listId,
    query,
    setQuery,
    flat,
    debouncedQuery,
    activeIndex,
    setActiveIndex,
    select,
    groups,
  } = usePaletteContext();
  const panelRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!mobileOpen) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    const frame = requestAnimationFrame(() => mobileInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [mobileOpen, setQuery, setActiveIndex]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setMobileOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [mobileOpen, setMobileOpen]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setMobileOpen(false);
      return;
    }
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[activeIndex];
      if (item) {
        setMobileOpen(false);
        select(item);
      }
    }
  };

  if (!mobileOpen) return null;

  const activeId = `${listId}-opt-${activeIndex}`;
  const empty = flat.length === 0 && debouncedQuery.length > 0;

  return createPortal(
    <div className="julow-command-palette-backdrop">
      <button
        type="button"
        className="julow-command-palette-backdrop__shade"
        aria-label={t("common.cancel")}
        onClick={() => setMobileOpen(false)}
      />
      <div
        ref={panelRef}
        className="julow-command-palette julow-command-palette--overlay glass-panel"
        onKeyDown={onKeyDown}
      >
        <div className="border-b border-julow-glass-border p-3">
          <SearchField fullWidth className="julow-topbar-search">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                ref={mobileInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.searchPlaceholder")}
                aria-controls={listId}
                aria-expanded
                aria-autocomplete="list"
                role="combobox"
              />
            </SearchField.Group>
          </SearchField>
        </div>
        {empty ? (
          <p className="px-4 py-8 text-center text-sm text-julow-muted">
            {t("commandPalette.empty")}
          </p>
        ) : (
          <CommandPaletteList
            groups={groups}
            activeIndex={activeIndex}
            onHover={setActiveIndex}
            onSelect={(item) => {
              setMobileOpen(false);
              select(item);
            }}
            listId={listId}
            activeId={activeId}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

/** @deprecated Use CommandPaletteRoot + Desktop/Mobile parts */
export function CommandPaletteTrigger({ onOpenShare }: { onOpenShare?: () => void }) {
  return (
    <CommandPaletteRoot onOpenShare={onOpenShare}>
      <CommandPaletteDesktop />
      <CommandPaletteMobileTrigger />
      <CommandPaletteMobileOverlay />
    </CommandPaletteRoot>
  );
}
