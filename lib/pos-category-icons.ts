/**
 * Map category name to representative emoji for POS product cards.
 * Falls back to generic cup if no match.
 *
 * Used when product has no image_url — gives cards a more professional
 * look than the generic 🥤 for every item.
 */

const CATEGORY_EMOJI: Array<{ keywords: string[]; emoji: string }> = [
  { keywords: ["cà phê", "ca phe", "coffee"], emoji: "☕" },
  { keywords: ["trà", "tra", "tea"], emoji: "🍵" },
  { keywords: ["yogurt", "yaourt", "sữa chua"], emoji: "🥛" },
  { keywords: ["trà sữa", "tra sua", "milk tea"], emoji: "🧋" },
  { keywords: ["sinh tố", "sinh to", "smoothie"], emoji: "🥤" },
  { keywords: ["nước ép", "nuoc ep", "juice"], emoji: "🧃" },
  { keywords: ["đá xay", "da xay", "frappe"], emoji: "🧊" },
  { keywords: ["bia", "beer"], emoji: "🍺" },
  { keywords: ["bánh", "banh", "cake", "dessert"], emoji: "🍰" },
  { keywords: ["đồ ăn", "do an", "food", "snack"], emoji: "🍜" },
];

const DEFAULT_EMOJI = "🥤";

export function categoryIcon(categoryName: string | undefined | null): string {
  if (!categoryName) return DEFAULT_EMOJI;
  const lower = categoryName.toLowerCase();
  for (const { keywords, emoji } of CATEGORY_EMOJI) {
    if (keywords.some((k) => lower.includes(k))) return emoji;
  }
  return DEFAULT_EMOJI;
}
