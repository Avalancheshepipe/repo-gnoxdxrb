/**
 * Localized strings for the native shell. Russian + English, with automatic
 * system detection (default) and an explicit override exposed through the
 * I18nProvider. `t()` reads the currently active locale; the nav tree is keyed
 * by locale so a language switch re-renders all text.
 */
import { NativeModules, Platform } from "react-native";

type Dict = Record<string, string>;

const ru: Dict = {
  "nav.canvas": "Доска",
  "nav.home": "Главная",
  "nav.inbox": "Входящие",
  "nav.agents": "Агенты",
  "nav.automations": "Автоматизации",
  "inbox.title": "Входящие",
  "inbox.empty": "Пока нет задач в этом проекте.",
  "agents.title": "Агенты",
  "agents.description": "Команда ИИ-агентов вашего пространства.",
  "agents.placeholder": "Спросите агента…",
  "agents.intro": "Привет! Чем могу помочь сегодня?",
  "agents.chatTitle": "Чат с агентом",
  "agents.pick": "Выберите агента",
  "agents.roster": "Состав команды",
  "agents.activeNow": "Активны сейчас",
  "agents.totalRuns": "Всего запусков",
  "agents.responsibleFor": "Отвечает за",
  "agents.canDo": "Возможности",
  "agents.empty": "Агентов пока нет.",
  "agents.model": "Модель",
  "agents.runs": "Запусков",
  "agents.status": "Статус",
  "agents.status.online": "В сети",
  "agents.status.busy": "Занят",
  "agents.status.idle": "Ожидает",
  "agents.status.offline": "Не в сети",
  "agents.lead": "Ведущий",
  "automations.title": "Автоматизации",
  "automations.empty": "Автоматизаций пока нет.",
  "automations.trigger": "Триггер",
  "automations.action": "Действие",
  "automations.status": "Статус",
  "automations.enabled": "Включена",
  "automations.disabled": "Выключена",
  "automations.runsToday": "Запусков сегодня",
  "automations.aiManaged": "Под управлением ИИ",
  "canvas.title": "Доска",
  "canvas.loading": "Загрузка доски…",
  "home.greeting": "Привет,",
  "home.workspace": "Рабочее пространство",
  "home.openTasks": "Открытые задачи",
  "home.done": "готово",
  "home.openCanvas": "Открыть доску",
  "home.inProgress": "В работе",
  "home.tasksActive": "активных задач",
  "home.total": "всего",
  "home.enabled": "включено",
  "home.agentRuns": "запусков агентов",
  "home.shortcuts": "Быстрый доступ",
  "home.viewAll": "Все →",
  "home.canvasHint": "Визуальная доска проекта и ИИ-советник.",
  "home.inboxHint": "Задачи и приоритеты вашей команды.",
  "home.agentsHint": "Команда ИИ-агентов пространства.",
  "home.automationsHint": "Автоматические сценарии и триггеры.",
  "home.recentActivity": "Недавняя активность",
  "search.title": "Поиск",
  "search.placeholder": "Поиск задач и агентов…",
  "search.empty": "Ничего не найдено.",
  "search.hint": "Начните вводить запрос.",
  "search.tasks": "Задачи",
  "search.agents": "Агенты",
  "task.details": "Детали задачи",
  "task.description": "Описание",
  "task.noDescription": "Описание отсутствует.",
  "task.status": "Статус",
  "task.priority": "Приоритет",
  "task.due": "Срок",
  "task.project": "Проект",
  "task.assignees": "Исполнители",
  "task.noAssignees": "Без исполнителей",
  "task.tags": "Метки",
  "priority.urgent": "Срочно",
  "priority.high": "Высокий",
  "priority.medium": "Средний",
  "priority.low": "Низкий",
  "status.todo": "К выполнению",
  "status.in-progress": "В работе",
  "status.review": "На проверке",
  "status.done": "Готово",
  "status.backlog": "Бэклог",
  "status.blocked": "Заблокировано",
  "account.title": "Аккаунт",
  "account.appearance": "Оформление",
  "account.light": "Светлая",
  "account.dark": "Тёмная",
  "account.system": "Системная",
  "account.language": "Язык",
  "account.signOut": "Выйти",
  "common.send": "Отправить",
  "common.retry": "Повторить",
  "common.error": "Что-то пошло не так.",
  "common.back": "Назад",
  "common.view": "Просмотр",
  "common.close": "Закрыть",
  "workspace.empty": "Рабочее пространство не найдено. Войдите с demo@julow.dev или создайте его в веб-приложении.",
  "auth.welcome": "С возвращением",
  "auth.subtitle": "Войдите в рабочее пространство Julow.",
  "auth.email": "Эл. почта",
  "auth.password": "Пароль",
  "auth.signIn": "Войти",
  "auth.failed": "Не удалось войти",
  "auth.networkError": "Не удалось подключиться к серверу. Проверьте USB-кабель и что на ПК запущен npm run dev.",
  "voice.unavailableTitle": "Голосовой ввод",
  "voice.unavailableBody":
    "Пересоберите приложение (expo prebuild && expo run:android), чтобы включить распознавание речи.",
  "voice.permissionTitle": "Доступ к микрофону",
  "voice.permissionBody":
    "Разрешите Julow использовать микрофон, чтобы надиктовывать сообщения агенту голосом.",
  "voice.permissionAllow": "Разрешить доступ",
  "voice.permissionRequesting": "Запрос разрешения…",
  "voice.permissionDismiss": "Понятно",
  "agents.noAgent": "Сначала выберите агента.",
  "agents.thinking": "Думаю…",
  "agents.selectHint": "Выберите агента, чтобы начать чат.",
  "agents.openChat": "Открыть чат",
};

const en: Dict = {
  "nav.canvas": "Canvas",
  "nav.home": "Home",
  "nav.inbox": "Inbox",
  "nav.agents": "Agents",
  "nav.automations": "Automations",
  "inbox.title": "Inbox",
  "inbox.empty": "No tasks yet in this project.",
  "agents.title": "Agents",
  "agents.description": "The AI agent team for your workspace.",
  "agents.placeholder": "Ask an agent…",
  "agents.intro": "Hi! How can I help today?",
  "agents.chatTitle": "Agent chat",
  "agents.pick": "Choose an agent",
  "agents.roster": "Team roster",
  "agents.activeNow": "Active now",
  "agents.totalRuns": "Total runs",
  "agents.responsibleFor": "Responsible for",
  "agents.canDo": "Capabilities",
  "agents.empty": "No agents yet.",
  "agents.model": "Model",
  "agents.runs": "Runs",
  "agents.status": "Status",
  "agents.status.online": "Online",
  "agents.status.busy": "Busy",
  "agents.status.idle": "Idle",
  "agents.status.offline": "Offline",
  "agents.lead": "Lead",
  "automations.title": "Automations",
  "automations.empty": "No automations yet.",
  "automations.trigger": "Trigger",
  "automations.action": "Action",
  "automations.status": "Status",
  "automations.enabled": "Enabled",
  "automations.disabled": "Disabled",
  "automations.runsToday": "Runs today",
  "automations.aiManaged": "AI-managed",
  "canvas.title": "Canvas",
  "canvas.loading": "Loading board…",
  "home.greeting": "Hello,",
  "home.workspace": "Workspace",
  "home.openTasks": "Open tasks",
  "home.done": "done",
  "home.openCanvas": "Open canvas",
  "home.inProgress": "In progress",
  "home.tasksActive": "active tasks",
  "home.total": "total",
  "home.enabled": "enabled",
  "home.agentRuns": "agent runs",
  "home.shortcuts": "Quick access",
  "home.viewAll": "View all →",
  "home.canvasHint": "Visual project board and AI advisor.",
  "home.inboxHint": "Tasks and priorities for your team.",
  "home.agentsHint": "Your workspace AI agent team.",
  "home.automationsHint": "Automated workflows and triggers.",
  "home.recentActivity": "Recent activity",
  "search.title": "Search",
  "search.placeholder": "Search tasks and agents…",
  "search.empty": "Nothing found.",
  "search.hint": "Start typing to search.",
  "search.tasks": "Tasks",
  "search.agents": "Agents",
  "task.details": "Task details",
  "task.description": "Description",
  "task.noDescription": "No description.",
  "task.status": "Status",
  "task.priority": "Priority",
  "task.due": "Due",
  "task.project": "Project",
  "task.assignees": "Assignees",
  "task.noAssignees": "No assignees",
  "task.tags": "Tags",
  "priority.urgent": "Urgent",
  "priority.high": "High",
  "priority.medium": "Medium",
  "priority.low": "Low",
  "status.todo": "To do",
  "status.in-progress": "In progress",
  "status.review": "In review",
  "status.done": "Done",
  "status.backlog": "Backlog",
  "status.blocked": "Blocked",
  "account.title": "Account",
  "account.appearance": "Appearance",
  "account.light": "Light",
  "account.dark": "Dark",
  "account.system": "System",
  "account.language": "Language",
  "account.signOut": "Sign out",
  "common.send": "Send",
  "common.retry": "Retry",
  "common.error": "Something went wrong.",
  "common.back": "Back",
  "common.view": "View",
  "common.close": "Close",
  "workspace.empty": "No workspace found. Sign in with demo@julow.dev or create one in the web app.",
  "auth.welcome": "Welcome back",
  "auth.subtitle": "Sign in to your Julow workspace.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.signIn": "Sign in",
  "auth.failed": "Sign in failed",
  "auth.networkError": "Could not reach the server. Check the USB cable and that npm run dev is running on your PC.",
  "voice.unavailableTitle": "Voice input",
  "voice.unavailableBody":
    "Rebuild the app (expo prebuild && expo run:android) to enable speech recognition.",
  "voice.permissionTitle": "Microphone access",
  "voice.permissionBody":
    "Allow Julow to use your microphone so you can dictate messages to the agent.",
  "voice.permissionAllow": "Allow access",
  "voice.permissionRequesting": "Requesting permission…",
  "voice.permissionDismiss": "Got it",
  "agents.noAgent": "Pick an agent first.",
  "agents.thinking": "Thinking…",
  "agents.selectHint": "Choose an agent to start chatting.",
  "agents.openChat": "Open chat",
};

export type Locale = "ru" | "en";
export type LocaleMode = "system" | Locale;

function deviceLocale(): string {
  try {
    if (Platform.OS === "ios") {
      return (
        NativeModules.SettingsManager?.settings?.AppleLocale ??
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ??
        "en"
      );
    }
    return NativeModules.I18nManager?.localeIdentifier ?? "en";
  } catch {
    return "en";
  }
}

function resolve(mode: LocaleMode): Locale {
  if (mode === "system") {
    return deviceLocale().toLowerCase().startsWith("ru") ? "ru" : "en";
  }
  return mode;
}

let currentMode: LocaleMode = "system";
let activeLocale: Locale = resolve(currentMode);

export function setLocaleMode(mode: LocaleMode): void {
  currentMode = mode;
  activeLocale = resolve(mode);
}

export function getLocaleMode(): LocaleMode {
  return currentMode;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

export function t(key: keyof typeof ru): string {
  const dict = activeLocale === "ru" ? ru : en;
  return dict[key] ?? en[key] ?? (key as string);
}
