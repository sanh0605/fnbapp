import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/**
 * Replaces the old auto-reload-on-every-keystroke pattern (lib/use-url-
 * state.ts) with an explicit "apply" step: callers bind inputs to `draft`/
 * `setField`, then call `applyFilters()` (from a button click or an Enter
 * keypress) to actually sync the URL and trigger the server refetch.
 * `isPending` (from React's useTransition) lets the UI show a clear loading
 * state for the one thing that previously had none -- Next's loading.tsx/
 * Suspense does not fire for a same-route searchParams-only change.
 */

/** Pure, framework-free so it's directly unit-testable without mocking
 * next/navigation: builds the next query string from a draft filter object,
 * omitting any key whose value equals its default (keeps URLs clean, same
 * convention lib/use-url-state.ts already used). */
export function buildFilterSearchParams<T extends Record<string, string>>(
  currentParams: URLSearchParams,
  draft: T,
  defaults: T,
): URLSearchParams {
  const params = new URLSearchParams(currentParams.toString());
  for (const key of Object.keys(defaults)) {
    const value = draft[key];
    if (value && value !== defaults[key]) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }
  return params;
}

export function readFilterValuesFromParams<T extends Record<string, string>>(
  searchParams: URLSearchParams,
  defaults: T,
): T {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    const fromUrl = searchParams.get(key as string);
    result[key] = (fromUrl as T[keyof T]) ?? defaults[key];
  }
  return result;
}

export function useFilterForm<T extends Record<string, string>>(defaults: T) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [draft, setDraft] = useState<T>(() => readFilterValuesFromParams(searchParams, defaults));

  // Keep the draft in sync with externally-driven URL changes (back/forward
  // navigation), but not while our own transition is in flight -- once it
  // resolves, searchParams will already match draft, so this is a no-op then.
  useEffect(() => {
    if (isPending) return;
    setDraft(readFilterValuesFromParams(searchParams, defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isPending]);

  function setField<K extends keyof T>(key: K, value: T[K]): void {
    setDraft(prev => ({ ...prev, [key]: value }));
  }

  // `overrides` lets a caller apply a value it just set in the same event
  // handler (e.g. a status-tab click that both updates and immediately
  // submits): `setField` schedules a state update, so `draft` inside this
  // closure would otherwise still hold the pre-click value.
  function applyFilters(overrides?: Partial<T>): void {
    const params = buildFilterSearchParams(searchParams, { ...draft, ...overrides }, defaults);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return { draft, setField, applyFilters, isPending };
}
