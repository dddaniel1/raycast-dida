import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

interface Preference {
  name: string;
  type: string;
  default?: string;
  required?: boolean;
  data?: Array<{ title: string; value: string }>;
}

const manifest = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as {
  preferences: Preference[];
  commands: Array<{
    name: string;
    title: string;
    description: string;
    mode: string;
  }>;
};

test("timezone preference is a dropdown with common IANA zones", () => {
  const timezone = manifest.preferences.find(
    (preference) => preference.name === "timezone",
  );

  assert.equal(timezone?.type, "dropdown");
  assert.equal(timezone?.default, "system");
  assert.ok(timezone?.data?.some(({ value }) => value === "system"));
  assert.ok(timezone?.data?.some(({ value }) => value === "Asia/Shanghai"));
  assert.ok(timezone?.data?.some(({ value }) => value === "UTC"));
});

test("Inbox Project ID preference is optional with the account default", () => {
  const inbox = manifest.preferences.find(
    ({ name }) => name === "inboxProjectId",
  );

  assert.equal(inbox?.type, "textfield");
  assert.equal(inbox?.required, false);
  assert.equal(inbox?.default, "inbox1015263871");
});

test("Today Tasks is exposed as a view command", () => {
  const command = manifest.commands.find(({ name }) => name === "today-tasks");

  assert.deepEqual(command, {
    name: "today-tasks",
    title: "Today Tasks",
    description: "Browse tasks due today",
    mode: "view",
  });
});

test("commands that render forms are declared as view mode", () => {
  const formCommands = [
    "quick-add-task",
    "create-task",
    "create-project",
    "clipboard-to-task",
  ];

  for (const name of formCommands) {
    const command = manifest.commands.find((entry) => entry.name === name);
    assert.equal(command?.mode, "view", name + " must be a view command");
  }
});

test("Validate Token is not exposed in root search", () => {
  assert.equal(
    manifest.commands.some(({ name }) => name === "validate-token"),
    false,
  );
});

test("Favorite Filters is not exposed as a root search command", () => {
  assert.equal(
    manifest.commands.some(({ name }) => name === "favorite-filters"),
    false,
  );
});
