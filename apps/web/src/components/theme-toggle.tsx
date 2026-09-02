"use client";

import { Moon, SunMedium } from "lucide-react";
import { useSyncExternalStore } from "react";

const COOKIE_NAME = "theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const CHANGE_EVENT = "bizos:theme-changed";

function readThemeCookie(): "light" | "dark" | null {
  const match = document.cookie.match(/(?:^|;\s*)theme=(light|dark)(?:;|$)/);
  return match ? (match[1] as "light" | "dark") : null;
}

function isDarkNow(): boolean {
  const cookieTheme = readThemeCookie();
  return cookieTheme
    ? cookieTheme === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    media.removeEventListener("change", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function getServerSnapshot() {
  return false; // SSR already picked the right theme via the `theme` cookie in layout.tsx; this
  // return value only feeds the hydration pass below, not what actually renders on the server.
}

/**
 * Explicit light/dark override. Absent a cookie, the page already follows
 * `prefers-color-scheme` (see globals.css) — this button is only for
 * overriding that default and remembering the choice.
 *
 * `useSyncExternalStore` (not effect+setState) so the client's first
 * hydration render reads the same snapshot the server used, avoiding a
 * hydration mismatch, then resyncs to the real client state right after.
 */
export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, isDarkNow, getServerSnapshot);

  function toggle() {
    const next = isDark ? "light" : "dark";
    document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <SunMedium aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
    </button>
  );
}
