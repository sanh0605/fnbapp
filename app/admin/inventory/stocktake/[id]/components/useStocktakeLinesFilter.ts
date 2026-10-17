"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { stripDiacritics } from "@/lib/shared/duplicate-name-guard";
import type { StocktakeLineView } from "../../actions";

export type StocktakeTab = "ALL" | "BLANK" | "OFF" | "MATCH";

export function useStocktakeLinesFilter(
  lines: StocktakeLineView[],
  initialTab: StocktakeTab = "ALL"
) {
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const [activeTab, setActiveTabState] = useState<StocktakeTab>(initialTab);
  const [snapshotIds, setSnapshotIds] = useState<Set<string> | null>(() => {
    if (initialTab === "ALL") return null;
    return new Set(lines.filter((l) => l.state === initialTab).map((l) => l.id));
  });
  const [searchQuery, setSearchQuery] = useState("");

  const setActiveTab = useCallback((tab: StocktakeTab) => {
    setActiveTabState(tab);
    if (tab === "ALL") {
      setSnapshotIds(null);
    } else {
      setSnapshotIds(new Set(linesRef.current.filter((l) => l.state === tab).map((l) => l.id)));
    }
  }, []);

  const allCount = lines.length;
  const blankCount = lines.filter((l) => l.state === "BLANK").length;
  const offCount = lines.filter((l) => l.state === "OFF").length;
  const matchCount = lines.filter((l) => l.state === "MATCH").length;
  const hasBlank = blankCount > 0;

  const filteredLines = useMemo(() => {
    let result = lines;
    if (activeTab !== "ALL" && snapshotIds) {
      result = result.filter((l) => snapshotIds.has(l.id));
    }

    const q = searchQuery.trim();
    if (q) {
      const strippedQuery = stripDiacritics(q.toLowerCase());
      result = result.filter((l) => {
        const strippedName = stripDiacritics(l.itemName.toLowerCase());
        const strippedRef = stripDiacritics(l.itemReference.toLowerCase());
        return strippedName.includes(strippedQuery) || strippedRef.includes(strippedQuery);
      });
    }
    return result;
  }, [lines, activeTab, snapshotIds, searchQuery]);

  const groups = useMemo(() => {
    const map = new Map<string, { total: number; counted: number }>();
    for (const l of lines) {
      const g = l.groupName || "Khác";
      const existing = map.get(g) || { total: 0, counted: 0 };
      existing.total += 1;
      if (l.state !== "BLANK") {
        existing.counted += 1;
      }
      map.set(g, existing);
    }
    return map;
  }, [lines]);

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    allCount,
    blankCount,
    offCount,
    matchCount,
    hasBlank,
    filteredLines,
    groups,
  };
}
