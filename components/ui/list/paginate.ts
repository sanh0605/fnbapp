export const ROWS_PER_PAGE = 20;

export interface PageSlice<T> {
  rows: T[];
  page: number;
  pageCount: number;
  firstIndex: number;
  lastIndex: number;
  total: number;
}

/**
 * Paginates an array of items for list views.
 * If rawPage is not an integer >= 1, defaults to 1.
 * If rawPage is above pageCount, clamps to pageCount.
 * pageCount is always >= 1, even when the input list is empty.
 * Empty list returns firstIndex 0, lastIndex 0.
 */
export function paginate<T>(
  all: T[],
  rawPage: string | number | undefined,
  perPage: number = ROWS_PER_PAGE
): PageSlice<T> {
  const total = all.length;
  const pageSize = perPage > 0 ? perPage : ROWS_PER_PAGE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  let parsedPage = 1;
  if (typeof rawPage === "number") {
    if (Number.isInteger(rawPage) && rawPage >= 1) {
      parsedPage = rawPage;
    }
  } else if (typeof rawPage === "string") {
    const trimmed = rawPage.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (n >= 1) {
        parsedPage = n;
      }
    }
  }

  if (parsedPage > pageCount) {
    parsedPage = pageCount;
  }
  if (parsedPage < 1) {
    parsedPage = 1;
  }

  if (total === 0) {
    return {
      rows: [],
      page: 1,
      pageCount: 1,
      firstIndex: 0,
      lastIndex: 0,
      total: 0,
    };
  }

  const firstIndex = (parsedPage - 1) * pageSize + 1;
  const lastIndex = Math.min(total, parsedPage * pageSize);
  const rows = all.slice(firstIndex - 1, lastIndex);

  return {
    rows,
    page: parsedPage,
    pageCount,
    firstIndex,
    lastIndex,
    total,
  };
}

/**
 * Returns a window of at most 5 page numbers centered around the current page.
 */
export function pageWindow(page: number, pageCount: number): number[] {
  if (pageCount <= 1) {
    return [1];
  }
  let start = Math.max(1, page - 2);
  let end = Math.min(pageCount, start + 4);
  if (end - start < 4) {
    start = Math.max(1, end - 4);
  }
  start = Math.max(1, start);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
}
