import { getPreferenceValues } from "@raycast/api";

export type Region = "china" | "international";

export interface Preferences {
  token: string;
  timezone?: string;
  region?: Region;
  inboxProjectId?: string;
}

export const BASE_URLS: Record<Region, string> = {
  china: "https://api.dida365.com/open/v1",
  international: "https://api.ticktick.com/open/v1",
};

export function getPreferences(): Preferences {
  return getPreferenceValues<Preferences>();
}

export function getBaseUrl(prefs: Preferences = getPreferences()): string {
  return BASE_URLS[prefs.region ?? "china"];
}

export function getTimezone(prefs: Preferences = getPreferences()): string {
  return !prefs.timezone || prefs.timezone === "system"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : prefs.timezone;
}

export function getInboxProjectId(
  prefs: Preferences = getPreferences(),
): string | undefined {
  const value = prefs.inboxProjectId?.trim();
  return value ? value : undefined;
}
