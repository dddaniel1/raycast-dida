/**
 * Session cache for API GET results, mirrored to LocalStorage so lists open
 * instantly and survive restarts. Mutations invalidate by key prefix.
 */

import { LocalStorage } from "@raycast/api";

// ponytail: one JSON blob for the whole cache; fine at personal-task scale,
// split per-key entries if it ever grows large.
const KEY = "api-cache-v1";
const TTL_MS = 5 * 60 * 1000;

interface Entry {
  value: unknown;
  expires: number;
}

let memory: Record<string, Entry> | undefined;

async function load(): Promise<Record<string, Entry>> {
  if (memory) return memory;
  try {
    memory = JSON.parse(
      (await LocalStorage.getItem<string>(KEY)) ?? "{}",
    ) as Record<string, Entry>;
  } catch {
    memory = {};
  }
  return memory;
}

async function save(map: Record<string, Entry>): Promise<void> {
  memory = map;
  await LocalStorage.setItem(KEY, JSON.stringify(map));
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const entry = (await load())[key];
  if (!entry || entry.expires < Date.now()) return undefined;
  return entry.value as T;
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const map = await load();
  map[key] = { value, expires: Date.now() + TTL_MS };
  await save(map);
}

export async function cacheInvalidate(prefix = ""): Promise<void> {
  const map = await load();
  for (const key of Object.keys(map)) {
    if (key.startsWith(prefix)) delete map[key];
  }
  await save(map);
}
