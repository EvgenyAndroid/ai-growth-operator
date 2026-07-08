/**
 * app/(dashboard)/feed/loading.tsx — route-level loading state for the
 * Opportunity Feed (design brief §Interaction: skeleton states). Mirrors the
 * page layout: title row, found-money header, then opportunity cards. Pulse
 * animation is motion-safe (see Skeleton primitive); purely decorative.
 */

import { Skeleton } from "@/components/ui/primitives";

export default function FeedLoading() {
  return (
    <main
      className="mx-auto w-full max-w-4xl space-y-6"
      aria-busy="true"
      aria-label="Loading opportunity feed"
    >
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

      {/* Found-money hero placeholder (emerald rail, large value) */}
      <div className="relative overflow-hidden rounded-card border border-emerald-200/60 bg-surface px-6 py-6 shadow-card">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1 bg-emerald-200"
        />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-11 w-64" />
        <Skeleton className="mt-3 h-4 w-full max-w-md" />
      </div>

      {/* Opportunity card placeholders */}
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-card border border-border bg-surface p-5 shadow-card"
          >
            <div className="flex flex-wrap items-center gap-2">
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
    </main>
  );
}
