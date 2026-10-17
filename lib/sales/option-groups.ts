export type OptionGroup = { id: string; name: string; selection_mode: "ONE" | "MANY"; max_total: number | null; allow_standalone: boolean; sort_order: number; status: string };
export type OptionRow = { id: string; name: string; price: number | string; status: string; group_id: string | null; is_default: boolean; max_qty: number | null; product_id: string | null };
export type GroupLink = { group_id: string; product_id: string };
// One entry per portion, as stored in order_lines_v2.modifiers_snapshot_json.
export type Pick = { id: string; name: string; price: number | string };
export type ProductOptionGroup = { group: OptionGroup; options: OptionRow[]; defaultId: string | null };

export function optionGroupsForProduct(productId: string, groups: OptionGroup[], links: GroupLink[], options: OptionRow[]): ProductOptionGroup[] {
  const ticked = new Set(links.filter((l) => l.product_id === productId).map((l) => l.group_id));
  return groups
    .filter((g) => g.status === "ACTIVE" && ticked.has(g.id))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "vi"))
    .map((group) => {
      const own = options.filter((o) => o.group_id === group.id && o.status === "ACTIVE");
      const def = group.selection_mode === "ONE" ? own.find((o) => o.is_default) : undefined;
      return { group, options: own, defaultId: def?.id ?? null };
    })
    .filter((x) => x.options.length > 0);
}

const inGroup = (picks: Pick[], g: ProductOptionGroup) => picks.filter((p) => g.options.some((o) => o.id === p.id));

export function litOptionId(picks: Pick[], g: ProductOptionGroup): string | null {
  return inGroup(picks, g)[0]?.id ?? g.defaultId;
}

// Chọn một: the default is never stored, so tapping it (or the lit pick) clears the group's pick.
export function pickOne(picks: Pick[], g: ProductOptionGroup, option: OptionRow): Pick[] {
  const rest = picks.filter((p) => !g.options.some((o) => o.id === p.id));
  if (picks.some((p) => p.id === option.id) || option.id === g.defaultId) return rest;
  return [...rest, { id: option.id, name: option.name, price: option.price }];
}

export function canAddPortion(picks: Pick[], g: ProductOptionGroup, option: OptionRow): boolean {
  const own = picks.filter((p) => p.id === option.id).length;
  return own < (option.max_qty ?? Infinity) && inGroup(picks, g).length < (g.group.max_total ?? Infinity);
}

export function orderPicks(picks: Pick[], groups: ProductOptionGroup[]): Pick[] {
  const pos = new Map<string, [number, number]>();
  groups.forEach((g, gi) => g.options.forEach((o, oi) => pos.set(o.id, [gi, oi])));
  const end: [number, number] = [Infinity, 0];
  return [...picks].sort((a, b) => {
    const [ga, oa] = pos.get(a.id) ?? end;
    const [gb, ob] = pos.get(b.id) ?? end;
    return ga - gb || oa - ob;
  });
}
