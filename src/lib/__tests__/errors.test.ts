import { strict as assert } from "node:assert";
import { test } from "node:test";

import { ApiError } from "../errors.ts";
import { describeError } from "../errors.ts";

test("describeError maps ApiError status to actionable message", () => {
  const auth = describeError(new ApiError(401, "unauthorized"));
  assert.match(auth.description, /token/i);
  assert.equal(auth.retryable, false);

  const rate = describeError(new ApiError(429, "too many requests", 30));
  assert.match(rate.description, /30/);
  assert.equal(rate.retryable, true);

  const server = describeError(new ApiError(500, "boom"));
  assert.equal(server.retryable, true);

  const network = describeError(new TypeError("fetch failed"));
  assert.match(network.description, /network|connection/i);
  assert.equal(network.retryable, true);

  const plain = describeError(new Error("Project not found"));
  assert.match(plain.description, /Project not found/);
});
