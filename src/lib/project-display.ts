import { Color } from "@raycast/api";
import type { Project, ProjectViewMode } from "../types/dida";

const VIEW_MODE_LABEL: Record<ProjectViewMode, string> = {
  list: "列表",
  kanban: "看板",
  timeline: "时间线",
};

/** Known view modes only; unknown values fall back to undefined. */
export function viewModeLabel(
  viewMode: Project["viewMode"],
): string | undefined {
  if (!viewMode) return undefined;
  return VIEW_MODE_LABEL[viewMode];
}

/** TickTick palette -> Raycast built-in colors; unmapped hex returns undefined. */
const TICKTICK_COLOR_MAP: Record<string, Color> = {
  "#F18181": Color.Red,
  "#F4A261": Color.Orange,
  "#F8CE47": Color.Yellow,
  "#7BD88F": Color.Green,
  "#48A8D8": Color.Blue,
  "#9373C8": Color.Purple,
  "#E859A8": Color.Magenta,
};

const COLOR_NAME_LABEL: Record<string, string> = {
  "#F18181": "红色",
  "#F4A261": "橙色",
  "#F8CE47": "黄色",
  "#7BD88F": "绿色",
  "#48A8D8": "蓝色",
  "#9373C8": "紫色",
  "#E859A8": "洋红",
};

export function hexToRaycastColor(hex: string): Color | undefined {
  return TICKTICK_COLOR_MAP[hex.toUpperCase()];
}

/** Chinese color name for known palette entries; undefined otherwise. */
export function colorName(hex: string): string | undefined {
  return COLOR_NAME_LABEL[hex.toUpperCase()];
}
