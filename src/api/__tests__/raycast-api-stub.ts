/**
 * Test-only stand-in for @raycast/api (which ships types only and cannot be
 * imported at runtime). Tests redirect the specifier here via a resolve hook.
 */

export interface StubPrefs {
  token: string;
  region?: "china" | "international";
  timezone?: string;
  inboxProjectId?: string;
}

export const __prefs: StubPrefs = { token: "tok-123" };

const storageMap = new Map<string, string>();

export function getPreferenceValues<T>(): T {
  return __prefs as unknown as T;
}

export const LocalStorage = {
  getItem: async (key: string) => storageMap.get(key),
  setItem: async (key: string, value: string) =>
    void storageMap.set(key, value),
  removeItem: async (key: string) => void storageMap.delete(key),
};
