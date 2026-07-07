"use client";

/**
 * app/app-shell.tsx — global chrome: demo-mode banner (PRD 20.3) plus the
 * left nav for the product surface (Feed / Chat / Approvals / Performance /
 * Ledger / Settings). Onboarding routes render without the nav so the
 * first-run flow stays a focused, linear track (PRD 6.1, 7.1 screens 1-6).
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS: Array<{ label: string; href: string }> = [
  { label: "Feed", href: "/feed" },
  { label: "Chat", href: "/chat" },
  { label: "Approvals", href: "/approvals" },
  { label: "Performance", href: "/performance" },
  { label: "Activation", href: "/activation" },
  { label: "Ledger", href: "/ledger" },
  { label: "Export", href: "/export" },
];

/** Routes that are part of the linear onboarding track (screens 1-6). */
function isOnboardingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return ["/setup", "/rules", "/connect", "/readiness"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** PRD 20.3 — demo mode must be clearly labeled, on every screen. */
function DemoBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
      Demo workspace — sample data only. No real customer data is shown, and
      every send, sync, and launch is simulated.
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isOnboardingPath(pathname)) {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-stone-50">
        <DemoBanner />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-stone-50">
      <DemoBanner />
      <div className="flex flex-1">
        <aside className="flex w-52 shrink-0 flex-col border-r border-stone-200 bg-white">
          <div className="border-b border-stone-200 px-4 py-4">
            <Link href="/feed" className="block">
              <span className="text-sm font-semibold tracking-tight text-stone-900">
                AI Growth Operator
              </span>
            </Link>
            <span className="mt-1 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Demo workspace
            </span>
          </div>
          <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 p-2">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`) ||
                (item.href === "/feed" && pathname.startsWith("/opportunities"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-stone-50"
                      : "rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-stone-200 p-3 text-[11px] leading-4 text-stone-400">
            Measured lift, not vendor math — and when we cannot prove it, we
            say so.
          </div>
        </aside>
        <main className="flex-1 overflow-x-auto">
          <div className="mx-auto w-full max-w-5xl px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
