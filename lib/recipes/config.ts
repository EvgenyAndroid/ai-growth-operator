/**
 * lib/recipes/config.ts — resolve per-account recipe parameters (26A.9 RecipeConfig).
 *
 * Merges RECIPE_CONFIG_DEFAULTS with whatever the merchant stored, keeping the
 * result deterministic and type-safe: only known numeric keys are accepted,
 * everything else falls back to the sane default (PRD 10.1 / 26A.6).
 */

import {
  RECIPE_CONFIG_DEFAULTS,
  type RecipeConfigShape,
  type RecipeId,
} from "../contracts";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Merge stored params/overrides (Json columns — untrusted shape) over the
 * defaults for one recipe. Later sources win. Non-finite / non-numeric /
 * non-positive values are rejected in favor of the default.
 */
export function resolveRecipeConfig<R extends RecipeId>(
  recipeId: R,
  ...stored: unknown[]
): RecipeConfigShape[R] {
  const defaults = RECIPE_CONFIG_DEFAULTS[recipeId];
  const out: Record<string, number> = { ...defaults };
  for (const source of stored) {
    if (!isPlainObject(source)) continue;
    for (const key of Object.keys(defaults)) {
      const v = source[key];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        out[key] = v;
      }
    }
  }
  return out as RecipeConfigShape[R];
}
