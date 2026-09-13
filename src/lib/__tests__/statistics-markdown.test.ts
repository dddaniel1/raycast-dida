import { strict as assert } from "node:assert";
import { test } from "node:test";

import { renderStatsMarkdown } from "../statistics-markdown.ts";

const STATS = {
  todayCompleted: 3,
  weekCompleted: 12,
  overdue: 2,
  byProject: { p1: 8, p2: 4 },
  byPriority: { 0: 4, 3: 6, 5: 2 },
};

test("renderStatsMarkdown overview with normalized bars and exact numbers", () => {
  const md = renderStatsMarkdown(STATS, { p1: "Work", p2: "Life" });
  // max overview value is 12 -> 20 chars; 2/12 of 20 rounds to 3
  assert.match(md, /Completed\s+12 ████████████████████/);
  assert.match(md, /Remaining\s+12 ████████████████████/);
  assert.match(md, /Overdue\s+2 ███/);
  assert.match(md, /High Priority\s+2 ███/);
});

test("renderStatsMarkdown byProject uses project names", () => {
  const md = renderStatsMarkdown(STATS, { p1: "Work", p2: "Life" });
  // max project value is 8 -> 20 chars; 4/8 -> 10 chars
  assert.match(md, /Work\s+8 ████████████████████/);
  assert.match(md, /Life\s+4 ██████████/);
  assert.doesNotMatch(md, /\bp1\b/);
});

test("renderStatsMarkdown byPriority uses priority labels", () => {
  const md = renderStatsMarkdown(STATS, {});
  // max priority value is 6 -> 20 chars; 4/6 -> 13 chars
  assert.match(md, /Medium\s+6 ████████████████████/);
  assert.match(md, /None\s+4 █████████████/);
});

test("renderStatsMarkdown handles empty stats", () => {
  const md = renderStatsMarkdown(
    {
      todayCompleted: 0,
      weekCompleted: 0,
      overdue: 0,
      byProject: {},
      byPriority: {},
    },
    {},
  );
  assert.match(md, /Completed\s+0/);
  assert.match(md, /Remaining\s+0/);
  assert.doesNotMatch(md, /█/);
});
