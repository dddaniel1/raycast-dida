import type { TaskStats } from "./storage.ts";

const BAR_WIDTH = 20;

const PRIORITY_LABEL: Record<number, string> = {
  0: "None",
  1: "Low",
  3: "Medium",
  5: "High",
};

function bar(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "";
  const len = Math.max(1, Math.round((value / max) * BAR_WIDTH));
  return "█".repeat(len);
}

function section(
  title: string,
  rows: Array<{ label: string; value: number }>,
): string {
  if (rows.length === 0) return "";
  const max = Math.max(...rows.map((r) => r.value));
  const labelWidth = Math.max(...rows.map((r) => r.label.length));
  const valueWidth = Math.max(...rows.map((r) => String(r.value).length));
  const lines = rows.map(({ label, value }) =>
    `${label.padEnd(labelWidth)}  ${String(value).padStart(valueWidth)} ${bar(value, max)}`.trimEnd(),
  );
  const fence = String.fromCharCode(96, 96, 96);
  return `### ${title}\n\n${fence}\n${lines.join("\n")}\n${fence}`;
}

/**
 * Renders TaskStats as a CommonMark detail view with monospace unicode bars.
 * Bars are normalized per section; exact counts always follow each bar.
 */
export function renderStatsMarkdown(
  stats: TaskStats,
  projectNames: Record<string, string> = {},
): string {
  const remaining = Object.values(stats.byProject).reduce(
    (sum, n) => sum + n,
    0,
  );
  const high = stats.byPriority[5] ?? 0;

  const overviewRows = [
    { label: "Completed", value: stats.weekCompleted },
    { label: "Remaining", value: remaining },
    { label: "Overdue", value: stats.overdue },
    { label: "High Priority", value: high },
  ];

  const projectRows = Object.entries(stats.byProject)
    .sort((a, b) => b[1] - a[1])
    .map(([pid, count]) => ({
      label: projectNames[pid] ?? pid,
      value: count,
    }));

  const priorityRows = Object.entries(stats.byPriority)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([pri, count]) => ({
      label: PRIORITY_LABEL[Number(pri)] ?? `P${pri}`,
      value: count,
    }));

  const sections = [
    section("Overview", overviewRows),
    section("By Project", projectRows),
    section("By Priority", priorityRows),
  ].filter(Boolean);

  return sections.join("\n\n");
}
