/**
 * lib/recipes/run.ts — dispatch a RecipeInput to its deterministic recipe.
 * Pure: no I/O. Loader/server code obtains the snapshot separately.
 */

import type { RecipeId, RecipeInput, RecipeResult } from "../contracts";
import { runAbandonedCheckoutRecovery } from "./abandoned-checkout";
import { runLapsedWinback } from "./lapsed-winback";
import { runMetaSeedSuppression } from "./meta-seed";
import type { RecipeDataSnapshot } from "./types";

export function runRecipe<R extends RecipeId>(
  input: RecipeInput<R>,
  snapshot: RecipeDataSnapshot,
): RecipeResult<R> {
  switch (input.recipeId) {
    case "abandoned_checkout_recovery":
      return runAbandonedCheckoutRecovery(
        input as RecipeInput<"abandoned_checkout_recovery">,
        snapshot,
      ) as RecipeResult<R>;
    case "lapsed_winback":
      return runLapsedWinback(
        input as RecipeInput<"lapsed_winback">,
        snapshot,
      ) as RecipeResult<R>;
    case "meta_seed_suppression":
      return runMetaSeedSuppression(
        input as RecipeInput<"meta_seed_suppression">,
        snapshot,
      ) as RecipeResult<R>;
    default: {
      const never: never = input.recipeId;
      throw new Error(`Unknown recipeId: ${String(never)}`);
    }
  }
}
