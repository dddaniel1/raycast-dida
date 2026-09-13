import { strict as assert } from "node:assert";
import { registerHooks } from "node:module";
import { beforeEach, test, type TestContext } from "node:test";

import { ApiError } from "../../lib/errors.ts";

// -- module boundary redirect: @raycast/api has no runtime entry, so the
//    specifier resolves to a local stub (preferences + LocalStorage). --
const stubUrl = new URL("./raycast-api-stub.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, _context, nextResolve) {
    if (specifier === "@raycast/api") {
      return { url: stubUrl, shortCircuit: true };
    }
    try {
      return nextResolve(specifier, _context);
    } catch (err) {
      // bundler-style extensionless relative imports only work under the
      // bundler; retry with .ts so node's ESM loader can resolve them.
      if (
        err instanceof Error &&
        (err as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND" &&
        (specifier.startsWith("./") || specifier.startsWith("../"))
      ) {
        return nextResolve(specifier + ".ts", _context);
      }
      throw err;
    }
  },
});

import { __prefs as prefState } from "./raycast-api-stub.ts";

const { request, validateToken } = await import("../client.ts");
const { BASE_URLS, getBaseUrl, getInboxProjectId, getTimezone } =
  await import("../../lib/preferences.ts");
const { cacheGet, cacheInvalidate, cacheSet } =
  await import("../../lib/cache.ts");
const {
  batchTasks,
  completeTask,
  completeTasks,
  createTask,
  deleteTask,
  getCompletedTasks,
  getTask,
  moveTasks,
  uncompleteTask,
  updateTask,
} = await import("../tasks.ts");
const {
  aggregateTasks,
  createProject,
  deleteProject,
  getProject,
  getProjectData,
  getProjects,
  updateProject,
  VIEW_MODES,
} = await import("../projects.ts");

interface Call {
  url: string;
  init: RequestInit;
}

function mockFetch(
  t: TestContext,
  responder: (call: Call) => Response,
): Call[] {
  const calls: Call[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const call = { url: String(input), init };
      calls.push(call);
      return responder(call);
    },
  );
  return calls;
}

function jsonRes(
  status: number,
  body?: unknown,
  headers?: Record<string, string>,
): Response {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
    headers,
  });
}

const bodyOf = (call: Call): Record<string, unknown> =>
  JSON.parse(call.init.body as string) as Record<string, unknown>;

beforeEach(async () => {
  // endpoint tests must hit the mocked fetch, not leftovers in the cache
  await cacheInvalidate();
});

async function rejectsApi(
  promise: Promise<unknown>,
  check: (err: ApiError) => boolean,
): Promise<void> {
  try {
    await promise;
    assert.fail("expected the promise to reject");
  } catch (err) {
    assert.ok(err instanceof ApiError, "expected an ApiError");
    assert.ok(check(err));
  }
}

// -- client.request --

test("request sends bearer auth and parses JSON responses", async (t) => {
  const calls = mockFetch(t, () => jsonRes(200, [{ id: "p" }]));
  const result = await request<unknown[]>("/project");
  assert.deepEqual(result, [{ id: "p" }]);
  assert.equal(calls[0].url, BASE_URLS.china + "/project");
  assert.equal(calls[0].init.method, "GET");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer tok-123");
  assert.equal(headers["Content-Type"], "application/json");
});

test("request serializes the body as JSON for POST", async (t) => {
  const calls = mockFetch(t, () => jsonRes(200, { ok: 1 }));
  await request("/task", { method: "POST", body: { a: 1 } });
  assert.equal(calls[0].init.method, "POST");
  assert.equal(typeof calls[0].init.body, "string");
  assert.deepEqual(bodyOf(calls[0]), { a: 1 });
});

test("empty 200 body resolves to undefined", async (t) => {
  mockFetch(t, () => new Response("", { status: 200 }));
  assert.equal(await request("/project/p1/task/t1/complete"), undefined);
});

test("401 / 403 / 404 map to ApiError with the response status", async (t) => {
  for (const status of [401, 403, 404]) {
    mockFetch(t, () => jsonRes(status, {}));
    await rejectsApi(request("/project"), (err) => err.status === status);
  }
});

test("429 surfaces the Retry-After delay", async (t) => {
  mockFetch(t, () => jsonRes(429, {}, { "Retry-After": "7" }));
  await rejectsApi(request("/project"), (err) => {
    assert.equal(err.retryAfter, 7);
    assert.match(err.message, /7 秒后重试/);
    return err.status === 429;
  });
});

test("5xx maps to a server-error message", async (t) => {
  mockFetch(t, () => jsonRes(503, {}));
  await rejectsApi(request("/project"), (err) => {
    assert.match(err.message, /服务器错误/);
    return err.status === 503;
  });
});

test("network failure maps to ApiError with status 0", async (t) => {
  const calls = mockFetch(t, () => {
    throw new TypeError("connection refused");
  });
  await rejectsApi(request("/project"), (err) => {
    assert.match(err.message, /网络错误/);
    return err.status === 0;
  });
  assert.equal(calls.length, 1);
});

test("missing token fails before any request is made", async (t) => {
  prefState.token = "";
  try {
    const calls = mockFetch(t, () => jsonRes(200, []));
    await rejectsApi(request("/project"), (err) =>
      err.message.includes("Token"),
    );
    assert.equal(calls.length, 0);
  } finally {
    prefState.token = "tok-123";
  }
});

test("validateToken succeeds on 200 and rejects on 401", async (t) => {
  mockFetch(t, () => jsonRes(200, []));
  assert.equal(await validateToken(), true);
  mockFetch(t, () => jsonRes(401, {}));
  await rejectsApi(validateToken(), (err) => err.status === 401);
});

// -- preferences --

test("region maps to the documented base urls", () => {
  assert.equal(
    getBaseUrl({ token: "t", region: "china" }),
    "https://api.dida365.com/open/v1",
  );
  assert.equal(
    getBaseUrl({ token: "t", region: "international" }),
    "https://api.ticktick.com/open/v1",
  );
  assert.equal(getBaseUrl({ token: "t" }), BASE_URLS.china);
});

test("timezone prefers the setting and falls back to the system zone", () => {
  assert.equal(getTimezone({ token: "t", timezone: "UTC" }), "UTC");
  const systemZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  assert.equal(getTimezone({ token: "t" }), systemZone);
  assert.equal(getTimezone({ token: "t", timezone: "system" }), systemZone);
});

test("inbox project id is trimmed and omitted when empty", () => {
  assert.equal(
    getInboxProjectId({ token: "t", inboxProjectId: " inbox123 " }),
    "inbox123",
  );
  assert.equal(getInboxProjectId({ token: "t" }), undefined);
  assert.equal(
    getInboxProjectId({ token: "t", inboxProjectId: "   " }),
    undefined,
  );
});

// -- cache --

test("cache miss then hit", async () => {
  assert.equal(await cacheGet<{ v: number }>("k"), undefined);
  await cacheSet("k", { v: 1 });
  assert.deepEqual(await cacheGet<{ v: number }>("k"), { v: 1 });
});

test("expired cache entry returns undefined", async (t) => {
  t.mock.timers.enable({ apis: ["Date"] });
  await cacheSet("stale", 1);
  t.mock.timers.tick(6 * 60 * 1000);
  assert.equal(await cacheGet<number>("stale"), undefined);
});

test("cacheInvalidate removes matching prefixes only", async () => {
  await cacheSet("project-data:p1", 1);
  await cacheSet("project-data:p2", 2);
  await cacheSet("projects:0:200", 3);
  await cacheInvalidate("project-data:");
  assert.equal(await cacheGet<number>("project-data:p1"), undefined);
  assert.equal(await cacheGet<number>("project-data:p2"), undefined);
  assert.equal(await cacheGet<number>("projects:0:200"), 3);
});

// -- task endpoints --

test("createTask posts to /task with serialized dates and checklist status", async (t) => {
  const calls = mockFetch(t, () =>
    jsonRes(200, { id: "t1", projectId: "p1", title: "x" }),
  );
  const ms = Date.parse("2026-03-15T15:30:00+08:00");
  const task = await createTask({
    title: "x",
    projectId: "p1",
    priority: 3,
    startDate: ms,
    dueDate: ms,
    items: [{ id: "i1", title: "step", status: 2 }],
  });
  assert.equal(task.id, "t1");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].url, BASE_URLS.china + "/task");
  const body = bodyOf(calls[0]);
  assert.equal(body.title, "x");
  assert.equal(body.priority, 3);
  for (const key of ["startDate", "dueDate"]) {
    const value = body[key] as string;
    assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}$/);
    assert.equal(Date.parse(value), ms);
  }
  const items = body.items as Array<{ status: number }>;
  assert.equal(items[0].status, 1);
});

test("updateTask carries id and projectId in the body", async (t) => {
  const calls = mockFetch(t, () =>
    jsonRes(200, { id: "t9", projectId: "p1", title: "y" }),
  );
  await updateTask("p1", "t9", { projectId: "p1", title: "y" });
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].url, BASE_URLS.china + "/task/t9");
  const body = bodyOf(calls[0]);
  assert.equal(body.id, "t9");
  assert.equal(body.projectId, "p1");
});

test("getTask reads from the documented per-project endpoint", async (t) => {
  const calls = mockFetch(t, () =>
    jsonRes(200, { id: "t2", projectId: "p7", title: "z" }),
  );
  const task = await getTask("p7", "t2");
  assert.equal(task.id, "t2");
  assert.equal(calls[0].url, BASE_URLS.china + "/project/p7/task/t2");
});

test("completeTask posts the complete endpoint", async (t) => {
  const calls = mockFetch(t, () => new Response("", { status: 200 }));
  await completeTask("p1", "t1");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].url, BASE_URLS.china + "/project/p1/task/t1/complete");
});

test("uncompleteTask reopens via updateTask with status 0", async (t) => {
  await cacheSet("task:p1:t1", { id: "t1" });
  const calls = mockFetch(t, () =>
    jsonRes(200, { id: "t1", projectId: "p1", status: 0 }),
  );
  await uncompleteTask("p1", "t1");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].url, BASE_URLS.china + "/task/t1");
  const body = bodyOf(calls[0]);
  assert.equal(body.id, "t1");
  assert.equal(body.projectId, "p1");
  assert.equal(body.status, 0);
  assert.equal(await cacheGet("task:p1:t1"), undefined);
  await cacheSet("project-data:p1", 1);
});

test("deleteTask sends DELETE to the task endpoint", async (t) => {
  const calls = mockFetch(t, () => new Response("", { status: 200 }));
  await deleteTask("p1", "t1");
  assert.equal(calls[0].init.method, "DELETE");
  assert.equal(calls[0].url, BASE_URLS.china + "/project/p1/task/t1");
});

test("completeTasks caps ids at 50 and posts the batch endpoint", async (t) => {
  const calls = mockFetch(t, () => jsonRes(200, ["a"]));
  const ids = Array.from({ length: 55 }, (_, i) => "id" + i);
  const result = await completeTasks({ projectId: "p1", taskIds: ids });
  assert.deepEqual(result, ["a"]);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].url, BASE_URLS.china + "/task/completeTasks");
  const body = bodyOf(calls[0]);
  assert.equal(body.projectId, "p1");
  assert.equal((body.taskIds as string[]).length, 50);
});

test("moveTasks posts the move items as a bare array", async (t) => {
  const calls = mockFetch(t, () => jsonRes(200, [{ id: "t1", etag: "e" }]));
  const items = [{ fromProjectId: "p1", toProjectId: "p2", taskId: "t1" }];
  const result = await moveTasks(items);
  assert.deepEqual(result, [{ id: "t1", etag: "e" }]);
  assert.equal(calls[0].url, BASE_URLS.china + "/task/move");
  assert.deepEqual(JSON.parse(calls[0].init.body as string), items);
});

test("batchTasks caps each group at 50 and update entries carry id", async (t) => {
  const calls = mockFetch(t, () => jsonRes(200, { id2etag: {}, id2error: {} }));
  const adds = Array.from({ length: 55 }, (_, i) => ({
    title: "n" + i,
  }));
  const updates = [{ id: "t1", projectId: "p1", title: "u1" }];
  const result = await batchTasks({ add: adds, update: updates });
  assert.deepEqual(result, { id2etag: {}, id2error: {} });
  assert.equal(calls[0].url, BASE_URLS.china + "/task/batch");
  const body = bodyOf(calls[0]);
  assert.equal((body.add as unknown[]).length, 50);
  const sentUpdates = body.update as Array<Record<string, unknown>>;
  assert.equal(sentUpdates[0].id, "t1");
  assert.equal(sentUpdates[0].projectId, "p1");
});

test("getCompletedTasks sends dates with milliseconds", async (t) => {
  const calls = mockFetch(t, () => jsonRes(200, []));
  const start = Date.parse("2026-03-01T00:00:00+08:00");
  const end = Date.parse("2026-03-31T23:59:59+08:00");
  await getCompletedTasks({
    projectIds: ["p1"],
    start: new Date(start),
    end: new Date(end),
  });
  assert.equal(calls[0].url, BASE_URLS.china + "/task/completed");
  const body = bodyOf(calls[0]);
  assert.deepEqual(body.projectIds, ["p1"]);
  for (const key of ["startDate", "endDate"]) {
    const value = body[key] as string;
    assert.match(
      value,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{4}$/,
    );
    assert.equal(Date.parse(value), key === "startDate" ? start : end);
  }
});

// -- project endpoints --

test("getProjects requests offset and limit", async (t) => {
  const calls = mockFetch(t, () => jsonRes(200, []));
  assert.deepEqual(await getProjects(), []);
  assert.equal(calls[0].url, BASE_URLS.china + "/project?offset=0&limit=200");
});

test("getProject and getProjectData use the documented paths", async (t) => {
  const calls = mockFetch(t, (call) =>
    call.url.endsWith("/data")
      ? jsonRes(200, { tasks: [{ id: "t1" }] })
      : jsonRes(200, { id: "p9", name: "List" }),
  );
  const project = await getProject("p9");
  assert.equal(project.id, "p9");
  const data = await getProjectData("p9");
  assert.equal(data.tasks?.[0]?.id, "t1");
  assert.deepEqual(
    calls.map((c) => c.url.replace(BASE_URLS.china, "")),
    ["/project/p9", "/project/p9/data"],
  );
});

test("createProject normalizes color and validates payload", async (t) => {
  const calls = mockFetch(t, () => jsonRes(200, { id: "p1", name: "n" }));
  await createProject({
    name: "n",
    color: "ff0000",
    sortOrder: "3",
    viewMode: "kanban",
    kind: "TASK",
  });
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].url, BASE_URLS.china + "/project");
  const body = bodyOf(calls[0]);
  assert.equal(body.color, "#ff0000");
  assert.equal(body.sortOrder, 3);
  assert.equal(body.viewMode, "kanban");
  assert.equal(body.kind, "TASK");

  const invalid = mockFetch(t, () => jsonRes(200, {}));
  await assert.rejects(createProject({ name: "n", color: "red" }), /颜色格式/);
  assert.equal(invalid.length, 0);
});

test("updateProject posts and deleteProject deletes the project path", async (t) => {
  const calls = mockFetch(t, () => jsonRes(200, { id: "p1" }));
  await updateProject("p1", { name: "n2" });
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].url, BASE_URLS.china + "/project/p1");
  await deleteProject("p1");
  assert.equal(calls[1].init.method, "DELETE");
  assert.equal(calls[1].url, BASE_URLS.china + "/project/p1");
});

test("aggregateTasks merges per-project data and skips failing projects", async (t) => {
  mockFetch(t, (call) => {
    if (call.url.includes("/project?")) {
      return jsonRes(200, [{ id: "p1" }, { id: "p2" }, { id: "p3" }]);
    }
    if (call.url.includes("/project/p1/data")) {
      return jsonRes(200, { tasks: [{ id: "t1", projectId: "p1" }] });
    }
    if (call.url.includes("/project/p2/data")) {
      return jsonRes(500, {});
    }
    return jsonRes(200, { tasks: [{ id: "t3", projectId: "p3" }] });
  });
  const tasks = await aggregateTasks();
  assert.deepEqual(
    tasks.map((task) => task.id),
    ["t1", "t3"],
  );
});

test("aggregateTasks includes configured inbox tasks", async (t) => {
  const calls = mockFetch(t, (call) => {
    if (call.url.includes("/project?")) {
      return jsonRes(200, [{ id: "p1" }]);
    }
    if (call.url.includes("/project/inbox123/data")) {
      return jsonRes(200, { tasks: [{ id: "inbox-task" }] });
    }
    return jsonRes(200, { tasks: [{ id: "project-task" }] });
  });

  const tasks = await aggregateTasks(4, "inbox123");

  assert.deepEqual(
    tasks.map((task) => task.id),
    ["project-task", "inbox-task"],
  );
  assert.ok(calls.some((call) => call.url.endsWith("/project/inbox123/data")));
});

test("aggregateTasks surfaces inbox loading failures", async (t) => {
  mockFetch(t, (call) => {
    if (call.url.includes("/project?")) {
      return jsonRes(200, [{ id: "p1" }]);
    }
    if (call.url.includes("/project/inbox123/data")) {
      return jsonRes(404, {});
    }
    return jsonRes(200, { tasks: [] });
  });

  await assert.rejects(
    aggregateTasks(4, "inbox123"),
    /Inbox Project ID.*extension preferences/s,
  );
});

test("VIEW_MODES matches the official view modes and rejects outline", async (t) => {
  assert.deepEqual(VIEW_MODES, ["list", "kanban", "timeline"]);
  const calls = mockFetch(t, () => jsonRes(200, {}));
  await assert.rejects(
    createProject({ name: "n", viewMode: "outline" }),
    /视图模式/,
  );
  await createProject({ name: "n", viewMode: "timeline" });
  assert.equal(calls.length, 1);
});
