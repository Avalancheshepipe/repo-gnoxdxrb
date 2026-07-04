// Maps an agent's configured `tools` (Json array on the Agent model) to the
// concrete tool sets it may use — both in autonomous worker runs and in chat
// proposals. The capability checkboxes in the agent dialog write canonical
// keys (create_task, research, …), but seed/demo agents store human-readable
// labels ("Web search", "Canvas context", …). We normalize BOTH so filtering
// is meaningful in every case, with a sane default when nothing is recognized.

export const TOOL_KEYS = [
  "create_task",
  "update_task",
  "research",
  "create_document",
  "review",
  "test",
  "report",
  "canvas",
  "delegate",
] as const;

export type ToolKey = (typeof TOOL_KEYS)[number];

/** Used when an agent has no recognizable tools configured. */
export const DEFAULT_AGENT_TOOLS: ToolKey[] = [
  "create_task",
  "update_task",
  "research",
  "create_document",
  "review",
  "test",
  "report",
  "canvas",
  "delegate",
];

// Each canonical key + the display labels / synonyms that should map to it.
const SYNONYMS: Record<ToolKey, string[]> = {
  create_task: ["create_task", "create tasks", "create task", "создавать задачи", "task creation", "task routing"],
  update_task: ["update_task", "update tasks", "update task", "изменять задачи", "status change", "task routing"],
  research: ["research", "web search", "web research", "research & web scan", "исследование и веб-поиск", "веб-поиск"],
  create_document: [
    "create_document", "create documents", "создавать документы", "documents", "document",
    "markdown", "release notes", "tone matching", "a/b variants", "localization", "word", "excel",
  ],
  review: ["review", "review & verdicts", "проверка и вердикты", "pr review", "code review", "verdict", "typescript"],
  test: ["test", "testing", "тестирование", "qa", "typescript"],
  report: ["report", "reports", "отчёты", "отчеты", "analytics", "release notes"],
  canvas: ["canvas", "canvas notes", "canvas context", "заметки на доске", "контекст доски"],
  delegate: ["delegate", "delegate work", "делегировать работу", "task routing", "deadline ai", "messenger relay", "orchestration"],
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// normalized-synonym -> canonical keys (a synonym like "task routing" maps to
// several keys, giving orchestrator-style agents a richer toolset).
const SYNONYM_INDEX: Map<string, ToolKey[]> = (() => {
  const index = new Map<string, ToolKey[]>();
  for (const key of TOOL_KEYS) {
    for (const syn of SYNONYMS[key]) {
      const n = norm(syn);
      const list = index.get(n) ?? [];
      if (!list.includes(key)) list.push(key);
      index.set(n, list);
    }
  }
  return index;
})();

/** Normalize an agent's raw `tools` value into canonical tool keys. */
export function normalizeAgentTools(tools: unknown): ToolKey[] {
  if (!Array.isArray(tools)) return [...DEFAULT_AGENT_TOOLS];
  const out = new Set<ToolKey>();
  for (const raw of tools) {
    if (typeof raw !== "string") continue;
    const matched = SYNONYM_INDEX.get(norm(raw));
    if (matched) for (const key of matched) out.add(key);
  }
  if (out.size === 0) return [...DEFAULT_AGENT_TOOLS];
  return TOOL_KEYS.filter((k) => out.has(k));
}

/** Autonomous (worker) tool names this agent may call. */
export function workerToolNames(keys: ToolKey[]): Set<string> {
  const s = new Set<string>();
  const has = (k: ToolKey) => keys.includes(k);
  if (has("create_task")) s.add("create_task");
  if (has("update_task")) {
    s.add("update_task");
    s.add("archive_task");
  }
  if (has("canvas")) s.add("add_canvas_note");
  if (has("delegate")) s.add("split_task");
  if (has("research")) s.add("research");
  if (has("create_document")) s.add("create_document");
  if (has("report")) s.add("create_report");
  if (has("review")) s.add("review_task");
  if (has("test")) s.add("validate_task");
  return s;
}

/** Approval-gated chat proposal tool names this agent may emit. */
export function proposalToolNames(keys: ToolKey[]): Set<string> {
  const s = new Set<string>();
  const has = (k: ToolKey) => keys.includes(k);
  if (has("create_task")) s.add("propose_create_task");
  if (has("update_task")) {
    s.add("propose_update_task");
    s.add("propose_assign_task");
    s.add("propose_bulk_update_tasks");
    s.add("propose_archive_task");
  }
  if (has("delegate")) {
    s.add("propose_delegate");
    s.add("propose_delegate_task");
    s.add("propose_assign_task");
    s.add("propose_create_automation");
  }
  if (has("canvas")) s.add("propose_canvas_node");
  if (has("create_document")) s.add("propose_create_document");
  if (has("report")) s.add("propose_report");
  if (has("review")) s.add("propose_review");
  if (has("test")) s.add("propose_test");
  if (has("delegate")) s.add("propose_send_email");
  return s;
}

const TOOL_DESCRIPTIONS: Record<ToolKey, { en: string; ru: string }> = {
  create_task: {
    en: "create and track new tasks",
    ru: "создавать и отслеживать задачи",
  },
  update_task: {
    en: "update a task's status, priority, description and tags",
    ru: "менять статус, приоритет, описание и теги задач",
  },
  research: {
    en: "search the web and summarize findings with sources",
    ru: "искать в интернете и давать сводку с источниками",
  },
  create_document: {
    en: "generate real Word/Excel documents with a download link",
    ru: "создавать реальные документы Word/Excel со ссылкой на скачивание",
  },
  review: {
    en: "review a task and record an approve / changes-requested verdict",
    ru: "проверять задачу и выносить вердикт (одобрено / нужны правки)",
  },
  test: {
    en: "validate a task against acceptance criteria / a checklist",
    ru: "проверять задачу по критериям приёмки / чек-листу",
  },
  report: {
    en: "compile a real report from live workspace data",
    ru: "составлять отчёт по реальным данным рабочего пространства",
  },
  canvas: {
    en: "add notes to the project canvas",
    ru: "добавлять заметки на доску проекта",
  },
  delegate: {
    en: "split large objectives into parallel sub-tasks",
    ru: "разбивать большие задачи на параллельные под-задачи",
  },
};

/** Human-readable bullet lines describing the agent's REAL enabled tools. */
export function describeTools(keys: ToolKey[], locale: "ru" | "en"): string[] {
  return keys.map((k) => `- ${TOOL_DESCRIPTIONS[k][locale]}`);
}

/** Short capability labels (for the snapshot roster), so the orchestrator can
 *  auto-select the right agent for a piece of work. */
export function capabilityLabels(keys: ToolKey[], locale: "ru" | "en"): string[] {
  return keys.map((k) => TOOL_DESCRIPTIONS[k][locale]);
}

// A per-task brief's "tool" → the capability key an agent must have to do it.
const BRIEF_TOOL_CAPABILITY: Record<string, ToolKey | null> = {
  research: "research",
  document: "create_document",
  report: "report",
  review: "review",
  general: null,
};

/** The capability key a per-task brief's `tool` needs (null for general). */
export function capabilityForBriefTool(tool?: string | null): ToolKey | null {
  return tool ? BRIEF_TOOL_CAPABILITY[tool] ?? null : null;
}
