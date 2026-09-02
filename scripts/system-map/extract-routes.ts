export type RouteActions = { route: string; actions: string[] };
export function extractRoutes(pages: { route: string; imports: string[] }[]): RouteActions[] {
  return pages
    .map(p => ({ route: p.route, actions: [...new Set(p.imports)].sort() }))
    .sort((a, b) => a.route.localeCompare(b.route));
}
