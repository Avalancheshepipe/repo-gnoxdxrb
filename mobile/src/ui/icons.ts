/**
 * Central icon registry for the native app. We import each glyph by its own
 * subpath (resolved via package `exports`) so Metro only bundles the icons we
 * actually use — the full set is ~10k glyphs. These are the same Hugeicons the
 * web app uses, for visual parity.
 */
import AiBrain01Icon from "@hugeicons/core-free-icons/AiBrain01Icon";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import Calendar03Icon from "@hugeicons/core-free-icons/Calendar03Icon";
import CanvasIcon from "@hugeicons/core-free-icons/CanvasIcon";
import DashboardSquare01Icon from "@hugeicons/core-free-icons/DashboardSquare01Icon";
import Globe02Icon from "@hugeicons/core-free-icons/Globe02Icon";
import InboxIcon from "@hugeicons/core-free-icons/InboxIcon";
import Logout01Icon from "@hugeicons/core-free-icons/Logout01Icon";
import Mic01Icon from "@hugeicons/core-free-icons/Mic01Icon";
import Moon02Icon from "@hugeicons/core-free-icons/Moon02Icon";
import RefreshIcon from "@hugeicons/core-free-icons/RefreshIcon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import SentIcon from "@hugeicons/core-free-icons/SentIcon";
import SparklesIcon from "@hugeicons/core-free-icons/SparklesIcon";
import Sun03Icon from "@hugeicons/core-free-icons/Sun03Icon";
import Task01Icon from "@hugeicons/core-free-icons/Task01Icon";
import ViewIcon from "@hugeicons/core-free-icons/ViewIcon";
import WorkflowCircle01Icon from "@hugeicons/core-free-icons/WorkflowCircle01Icon";

import type { IconSvgElement } from "./Icon";

const cast = (icon: unknown) => icon as IconSvgElement;

export const Icons = {
  agent: cast(AiBrain01Icon),
  arrowDown: cast(ArrowDown01Icon),
  arrowLeft: cast(ArrowLeft01Icon),
  arrowRight: cast(ArrowRight01Icon),
  calendar: cast(Calendar03Icon),
  canvas: cast(CanvasIcon),
  home: cast(DashboardSquare01Icon),
  globe: cast(Globe02Icon),
  inbox: cast(InboxIcon),
  logout: cast(Logout01Icon),
  mic: cast(Mic01Icon),
  moon: cast(Moon02Icon),
  refresh: cast(RefreshIcon),
  search: cast(Search01Icon),
  send: cast(SentIcon),
  sparkles: cast(SparklesIcon),
  sun: cast(Sun03Icon),
  task: cast(Task01Icon),
  view: cast(ViewIcon),
  automations: cast(WorkflowCircle01Icon),
};
