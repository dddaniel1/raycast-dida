import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  deleteTemplate,
  getFavoriteFilters,
  getRecentTasks,
  getTemplates,
  recordRecentTask,
  saveTemplate,
  toggleFavoriteFilter,
  type LocalStore,
} from "../storage.ts";

function fakeStore(): LocalStore {
  const map = new Map<string, string>();
  return {
    getItem: async (key: string) => map.get(key),
    setItem: async (key: string, value: string) => void map.set(key, value),
    removeItem: async (key: string) => void map.delete(key),
  };
}

test("recent tasks: newest first, deduped, capped at 20", async () => {
  const store = fakeStore();
  await recordRecentTask(store, { id: "t1", projectId: "p1", title: "a" });
  await recordRecentTask(store, { id: "t2", projectId: "p1", title: "b" });
  await recordRecentTask(store, { id: "t1", projectId: "p1", title: "a2" });
  const recent = await getRecentTasks(store);
  assert.deepEqual(
    recent.map((task) => task.id),
    ["t1", "t2"],
  );
  assert.equal(recent[0].title, "a2");
  for (let i = 0; i < 25; i++) {
    await recordRecentTask(store, {
      id: "x" + i,
      projectId: "p",
      title: "x",
    });
  }
  assert.equal((await getRecentTasks(store)).length, 20);
});

test("favorite filters toggle on and off by view", async () => {
  const store = fakeStore();
  await toggleFavoriteFilter(store, "today", "今天");
  await toggleFavoriteFilter(store, "overdue", "已过期");
  assert.deepEqual(await getFavoriteFilters(store), [
    { view: "today", label: "今天" },
    { view: "overdue", label: "已过期" },
  ]);
  await toggleFavoriteFilter(store, "today", "今天");
  assert.deepEqual(await getFavoriteFilters(store), [
    { view: "overdue", label: "已过期" },
  ]);
});

test("templates: empty default, save, overwrite by id, delete", async () => {
  const store = fakeStore();
  assert.deepEqual(await getTemplates(store), []);
  await saveTemplate(store, { id: "tpl1", name: "日报", title: "写日报" });
  await saveTemplate(store, { id: "tpl2", name: "购物", title: "买菜" });
  await saveTemplate(store, {
    id: "tpl1",
    name: "日报",
    title: "写日报",
    priority: 3,
  });
  const all = await getTemplates(store);
  assert.equal(all.length, 2);
  assert.equal(all.find((tpl) => tpl.id === "tpl1")?.priority, 3);
  await deleteTemplate(store, "tpl2");
  assert.deepEqual(
    (await getTemplates(store)).map((tpl) => tpl.id),
    ["tpl1"],
  );
});
