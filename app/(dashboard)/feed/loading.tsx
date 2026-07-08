/**
 * app/(dashboard)/feed/loading.tsx — route-level loading state for the
 * Opportunity Feed (design brief §Interaction: skeleton states). Mirrors the
 * page layout: title row, found-money hero (with stat tiles), opportunity
 * cards, and the xl-only Operator-status rail. Pulse animation is
 * motion-safe (see Skeleton primitive); purely decorative.
 */

import { Skeleton } from "@/components/ui/primitives";

export default function FeedLoading() {
  return (
    <main
      className="mx-auto w-full max-w-4xl xl:max-w-none"
      aria-busy="true"
      aria-label="Loading opportunity feed"
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-44" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-32" />
            </div>
          </header>

          {/* Found-money hero placeholder (money gradient surface, emerald
              rail, executive-scale value, stat-tile row) */}
          <div className="money-hero relative overflow-hidden rounded-card border border-emerald-200/60 px-6 py-6">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-200 to-emerald-300"
            />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-3 h-12 w-72" />
            <Skeleton className="mt-3 h-4 w-full max-w-md" />
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>

          {/* Opportunity card placeholders */}
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-card border border-border bg-surface p-5 shadow-card"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-md" />
                  <Skeleton className="h-5 w-2/5 min-w-40" />
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-3/4" />
                <div className="mt-4 flex items-center justify-between gap-4">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-9 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operator-status rail placeholder (xl only — stacks are skipped on
            mobile to keep the loading view short) */}
        <div className="hidden xl:block xl:w-[300px] xl:shrink-0">
          <div className="proof-card space-y-3 rounded-card p-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </main>
  );
}
