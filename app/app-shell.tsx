"use client";

/**
 * app/app-shell.tsx — global chrome: demo-mode banner (PRD 20.3), the top bar
 * (workspace name + connector pills), plus the left nav for the product
 * surface (Feed / Chat / Approvals / Performance / Ledger / Settings).
 *
 * Brief v2 §3 "premium operator console": semi-dark cockpit sidebar (deep
 * #0B1220 = --color-primary) against light content, product mark, demo badge,
 * strong active states; elevated glassy top bar with refined connection
 * pills; faint radial accent glow on the app background. Under 768px the
 * left nav collapses into a hamburger menu in the top bar. Onboarding routes
 * render without the nav so the first-run flow stays a focused, linear track
 * (PRD 6.1, 7.1 screens 1-6).
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const NAV_ITEMS: Array<{ label: string; href: string }> = [
  { label: "Feed", href: "/feed" },
  { label: "Chat", href: "/chat" },
  { label: "Approvals", href: "/approvals" },
  { label: "Performance", href: "/performance" },
  { label: "Activation", href: "/activation" },
  { label: "Ledger", href: "/ledger" },
  { label: "Export", href: "/export" },
];

/** Connector status shown in the top bar — reliable, not flashy. */
const CONNECTIONS: Array<{
  name: string;
  state: "connected" | "recommended";
}> = [
  { name: "Shopify", state: "connected" },
  { name: "Klaviyo", state: "connected" },
  { name: "Meta", state: "connected" },
  { name: "GA4", state: "recommended" },
];

/** Routes that are part of the linear onboarding track (screens 1-6). */
function isOnboardingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return ["/setup", "/rules", "/connect", "/readiness"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isActivePath(pathname: string, href: string): boolean {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/feed" && pathname.startsWith("/opportunities"))
  );
}

/** PRD 20.3 — demo mode must be clearly labeled, on every screen. */
function DemoBanner() {
  return (
    <div className="border-b border-amber-200/70 bg-amber-50/80 px-4 py-1 text-center text-[11px] font-medium leading-5 text-amber-800">
      Demo workspace — sample data only. No real customer data is shown, and
      every send, sync, and launch is simulated.
    </div>
  );
}

/** Dependency-free product mark: growth spark on a deep-blue tile. */
function ProductMark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex shrink-0 items-center justify-center",
        size === "sm" ? "h-6 w-6 rounded-md" : "h-8 w-8 rounded-lg",
        "bg-gradient-to-br from-[#3b82f6] to-[#1e40af]",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_6px_rgb(2_6_23/0.45)]",
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"}
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 11.5 6.25 7.5l2.5 2.5L13.5 4.5" />
        <path d="M10.5 4.5h3v3" />
      </svg>
    </span>
  );
}

function ConnectionPill({
  name,
  state,
}: {
  name: string;
  state: "connected" | "recommended";
}) {
  const connected = state === "connected";
  return (
    <span
      title={connected ? `${name} — connected` : `${name} — recommended`}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "text-[11px] font-medium leading-5 whitespace-nowrap",
        "shadow-[0_1px_1px_rgb(15_23_42/0.04)]",
        connected
          ? "border-border bg-surface text-ink-secondary"
          : "border-blue-200/80 border-dashed bg-surface text-ink-muted",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          connected
            ? "bg-success shadow-[0_0_0_3px_rgb(5_150_105/0.15)]"
            : "bg-info shadow-[0_0_0_3px_rgb(37_99_235/0.14)]",
        )}
      />
      {name}
      <span className="sr-only">
        {connected ? " connected" : " recommended"}
      </span>
      {!connected ? (
        <span className="font-normal text-accent">Recommended</span>
      ) : null}
    </span>
  );
}

function NavLink({
  item,
  active,
  dark = false,
  onNavigate,
}: {
  item: { label: string; href: string };
  active: boolean;
  /** Cockpit sidebar (dark) vs mobile dropdown (light) treatments. */
  dark?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cx(
        "rounded-md px-3 py-1.5 text-sm transition-colors duration-150",
        dark
          ? active
            ? "bg-white/[0.09] font-semibold text-white shadow-[inset_2px_0_0_var(--color-accent)]"
            : "font-medium text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
          : active
            ? "bg-neutral-soft font-semibold text-ink shadow-[inset_2px_0_0_var(--color-accent)]"
            : "font-medium text-ink-muted hover:bg-surface-soft hover:text-ink",
      )}
    >
      {item.label}
    </Link>
  );
}

function TopBar({
  menuOpen,
  onToggleMenu,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-border/90 bg-surface/85 px-4 shadow-[0_4px_16px_-8px_rgb(15_23_42/0.08)] backdrop-blur-md md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleMenu}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-ink-secondary transition-colors duration-150 hover:bg-surface-soft hover:text-ink md:hidden"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            {menuOpen ? (
              <>
                <path d="M5 5l10 10" />
                <path d="M15 5L5 15" />
              </>
            ) : (
              <>
                <path d="M3.5 6h13" />
                <path d="M3.5 10h13" />
                <Link
            href="/"
            className="mb-2 block text-[11px] font-medium text-slate-400 transition-colors duration-150 hover:text-slate-200"
          >
            &larr; Sign-in page
          </Link>
          <path d="M3.5 14h13" />
              </>
            )}
          </svg>
        </button>
        <Link
          href="/feed"
          className="flex min-w-0 items-center gap-2 md:hidden"
        >
          <ProductMark size="sm" />
          <span className="block truncate text-sm font-semibold tracking-tight text-ink">
            AI Growth Operator
          </span>
        </Link>
        <span className="hidden min-w-0 items-baseline gap-2 md:flex">
          <span className="truncate text-sm font-semibold tracking-tight text-ink-800">
            Demo workspace
          </span>
          <span className="text-[10px] font-medium tracking-[0.14em] text-ink-soft uppercase">
            Simulated data
          </span>
        </span>
      </div>
      <div className="hidden items-center gap-1.5 sm:flex">
        {CONNECTIONS.map((c) => (
          <ConnectionPill key={c.name} name={c.name} state={c.state} />
        ))}
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Close the mobile menu whenever the route changes.
  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (isOnboardingPath(pathname)) {
    return (
      <div className="bg-app-glow flex min-h-full flex-1 flex-col">
        <DemoBanner />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <DemoBanner />
      <div className="flex flex-1">
        {/* Cockpit sidebar — deep navy against the light working canvas. */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-primary md:flex">
          <div className="px-4 pt-5 pb-4">
            <Link href="/feed" className="flex items-center gap-2.5 rounded-md">
              <ProductMark />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-tight text-white">
                  AI Growth Operator
                </span>
                <span className="block text-[10px] font-medium tracking-[0.14em] text-slate-500 uppercase">
                  Growth console
                </span>
              </span>
            </Link>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium leading-5 text-amber-300">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
              />
              Demo workspace
            </span>
          </div>
          <nav
            aria-label="Primary"
            className="flex flex-1 flex-col gap-0.5 border-t border-white/[0.07] p-2 pt-3"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                dark
                active={isActivePath(pathname, item.href)}
              />
            ))}
          </nav>
          <div className="border-t border-white/[0.07] p-3 text-[11px] leading-4 text-slate-500">
            Measured lift, not vendor math — and when we cannot prove it, we
            say so.
          </div>
        </aside>
        <div className="bg-app-glow flex min-w-0 flex-1 flex-col">
          <TopBar
            menuOpen={menuOpen}
            onToggleMenu={() => setMenuOpen((open) => !open)}
          />
          {menuOpen ? (
            <nav
              id="mobile-nav"
              aria-label="Primary"
              className="flex flex-col gap-0.5 border-b border-border bg-surface p-2 shadow-md md:hidden"
            >
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActivePath(pathname, item.href)}
                  onNavigate={() => setMenuOpen(false)}
                />
              ))}
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 sm:hidden">
                {CONNECTIONS.map((c) => (
                  <ConnectionPill key={c.name} name={c.name} state={c.state} />
                ))}
              </div>
              <div className="border-t border-border px-3 py-2 text-[11px] leading-4 text-ink-soft">
                Measured lift, not vendor math — and when we cannot prove it,
                we say so.
              </div>
            </nav>
          ) : null}
          <main className="min-w-0 flex-1 overflow-x-auto">
            <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
