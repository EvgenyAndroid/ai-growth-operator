/**
 * app/(dashboard)/performance/loading.tsx — route-level loading state for the
 * Performance Summary (design brief §Interaction: skeleton states). Mirrors
 * the page layout: screen-nav row, title, action picker, readout card. Pulse
 * animation is motion-safe (see Skeleton primitive); purely decorative.
 */

import { Skeleton } from "@/components/ui/primitives";

export default function PerformanceLoading() {
  return (
    <div
      className="w-full"
      aria-busy="true"
      aria-label="Loading performance summary"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-5 w-36" />
      </div>

      <div className="mt-6 space-y-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="mt-8 space-y-8">
        {/* Launched-actions picker placeholder */}
        <div className="rounded-card border border-border bg-surface p-5 shadow-card">
          <Skeleton className="h-5 w-44" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-40" />
          </div>
        </div>

        {/* Readout placeholder */}
        <div className="rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-40 rounded-full" />
            <Skeleton className="h-5 w-32 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-4 w-2/3" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-full max-w-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
