"use client";

import { useMemo, useState } from "react";
import { stripDiacritics } from "@/lib/shared/duplicate-name-guard";
import type { StocktakeLineView } from "../../actions";

export type StocktakeTab = "ALL" | "BLANK" | "OFF" | "MATCH";

export function useStocktakeLinesFilter(
  lines: StocktakeLineView[],
  initialTab: StocktakeTab = "ALL"
) {
  const [activeTab, setActiveTab] = useState<StocktakeTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");

  const allCount = lines.length;
  const blankCount = lines.filter((l) => l.state === "BLANK").length;
  const offCount = lines.filter((l) => l.state === "OFF").length;
  const matchCount = lines.filter((l) => l.state === "MATCH").length;
  const hasBlank = blankCount > 0;

  const filteredLines = useMemo(() => {
    let result = lines;
    if (activeTab === "BLANK") {
      result = result.filter((l) => l.state === "BLANK");
    } else if (activeTab === "OFF") {
      result = result.filter((l) => l.state === "OFF");
    } else if (activeTab === "MATCH") {
      result = result.filter((l) => l.state === "MATCH");
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
  }, [lines, activeTab, searchQuery]);

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
