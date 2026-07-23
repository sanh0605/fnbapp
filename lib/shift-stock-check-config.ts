// Items checked at shift open/close. Matched by name against
// Semi_Products/Base_Ingredients at read time (not by id) so adding an
// item here -- or the owner creating it in the app -- takes effect
// immediately with no further code change. A name with no matching item
// yet is silently skipped, not an error.
export const SHIFT_CHECKED_ITEM_NAMES = ["Trứng luộc", "Khoai lang"];
