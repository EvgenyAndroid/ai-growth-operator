/**
 * lib/recipes/run.ts — dispatch a RecipeInput to its deterministic recipe.
 * Pure: no I/O. Loader/server code obtains the snapshot separately.
 *
 * Vertical selection routes everything (lib/verticals.ts): the caller passes
 * the account's vertical so the SHARED meta_seed_suppression recipe runs the
 * LOCAL wiring (POS wording + coverage disclosure) for local_service accounts
 * while DTC accounts keep byte-identical v0 behavior (default vertical).
 */

import type { RecipeId, RecipeInput, RecipeResult, Vertical } from "../contracts";
import { runAbandonedCheckoutRecovery } from "./abandoned-checkout";
import { runLapsedWinback } from "./lapsed-winback";
import {
  runCateringUpsell,
  runLocalLapsedRegular,
  runLocalMetaSeed,
} from "./local";
import { runMetaSeedSuppression } from "./meta-seed";
import type { RecipeDataSnapshot } from "./types";

export function runRecipe<R extends RecipeId>(
  input: RecipeInput<R>,
  snapshot: RecipeDataSnapshot,
  vertical: Vertical = "shopify_dtc",
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
      // SHARED recipe — same deterministic core; LOCAL wiring adds the POS
      // coverage disclosure (trust rule #9). Directional as ever, both ways.
      return (
        vertical === "local_service"
          ? runLocalMetaSeed(
              input as RecipeInput<"meta_seed_suppression">,
              snapshot,
            )
          : runMetaSeedSuppression(
              input as RecipeInput<"meta_seed_suppression">,
              snapshot,
            )
      ) as RecipeResult<R>;
    case "local_lapsed_regular":
      return runLocalLapsedRegular(
        input as RecipeInput<"local_lapsed_regular">,
        snapshot,
      ) as RecipeResult<R>;
    case "catering_upsell":
      return runCateringUpsell(
        input as RecipeInput<"catering_upsell">,
        snapshot,
      ) as RecipeResult<R>;
    default: {
      const never: never = input.recipeId;
      throw new Error(`Unknown recipeId: ${String(never)}`);
    }
  }
}
