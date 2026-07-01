export type EffectiveRecipe = {
  id?: string;
  target_type?: string;
  target_id?: string;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

export function selectEffectiveRecipe(
  recipes: EffectiveRecipe[],
  targetType: string,
  targetId: string,
  asOf: string,
): EffectiveRecipe | null {
  const asOfMs = new Date(asOf).getTime();
  if (!Number.isFinite(asOfMs)) {
    throw new Error(`Invalid recipe as-of timestamp: ${asOf}`);
  }

  const candidates = recipes.filter((recipe) => {
    if (recipe.target_type !== targetType || recipe.target_id !== targetId) {
      return false;
    }
    if (recipe.status && recipe.status !== "ACTIVE") {
      return false;
    }

    const startValue = recipe.start_date || recipe.created_at;
    const startMs = startValue ? new Date(startValue).getTime() : 0;
    if (Number.isFinite(startMs) && startMs > asOfMs) {
      return false;
    }

    if (recipe.end_date) {
      const endMs = new Date(recipe.end_date).getTime();
      if (!Number.isFinite(endMs) || endMs <= asOfMs) {
        return false;
      }
    }
    return true;
  });

  candidates.sort((left, right) => {
    const leftEffective = new Date(
      left.start_date || left.created_at || 0,
    ).getTime();
    const rightEffective = new Date(
      right.start_date || right.created_at || 0,
    ).getTime();
    if (leftEffective !== rightEffective) {
      return rightEffective - leftEffective;
    }

    const leftCreated = new Date(left.created_at || 0).getTime();
    const rightCreated = new Date(right.created_at || 0).getTime();
    if (leftCreated !== rightCreated) {
      return rightCreated - leftCreated;
    }
    return String(right.id || "").localeCompare(String(left.id || ""));
  });

  return candidates[0] || null;
}
