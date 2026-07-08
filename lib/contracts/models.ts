/**
 * lib/contracts/models.ts — SERVER-ONLY half of the contract surface: type
 * re-exports of the generated Prisma models (see prisma/schema.prisma).
 *
 * Only server modules (lib/server, lib/recipes, lib/governance, lib/ledger,
 * lib/measurement, lib/demo, scripts) may import from here. Client components
 * and components/ui/primitives.tsx import from ../contracts (public surface)
 * instead — the server-only marker below makes a client import a build error.
 *
 * All exports are TYPE-ONLY, so `import type { ... } from ".../contracts/models"`
 * is fully erased at runtime and never drags the Prisma runtime anywhere.
 */

import "server-only"; // build-time guard: must never enter a client bundle

export type {
  Account,
  Customer,
  Product,
  Event,
  Audience,
  Action,
  Opportunity,
  Constitution,
  Holdout,
  HoldoutMembership,
  LedgerEntry,
  Integration,
  SyncRun,
  RecipeConfig,
  Draft,
  Approval,
  MeasurementWindow,
  ExportJob,
  Preference,
} from "../generated/prisma/client";

// Type-only: a value re-export would pull the Prisma runtime (node:module)
// into any importing bundle.
export type { Prisma } from "../generated/prisma/client";
