import { strict as assert } from "node:assert";
import { test } from "node:test";

import { quickAddToTaskInput } from "../quick-add.ts";

const now = new Date("2026-09-13T10:00:00+08:00");

test("argument quick add: 买猫粮 明天 creates all-day task without a form", () => {
  const input = quickAddToTaskInput("买猫粮 明天", [], now);
  assert.equal(input.title, "买猫粮");
  assert.ok(input.dueDate && input.dueDate > now.getTime());
  assert.equal(input.isAllDay, true);
  assert.equal(input.priority, undefined);
  assert.equal(input.projectId, undefined);
});

test("argument quick add maps markers to project id and numeric priority", () => {
  const projects = [{ id: "p1", name: "工作" }];
  const input = quickAddToTaskInput(
    "明天下午3点开会 #工作 !high",
    projects,
    now,
  );
  assert.equal(input.title, "开会");
  assert.equal(input.projectId, "p1");
  assert.equal(input.priority, 5);
  assert.ok(input.dueDate);
  assert.equal(new Date(input.dueDate!).getHours(), 15);
});
