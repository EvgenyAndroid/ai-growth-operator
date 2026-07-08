"use client";

/**
 * app/app-shell.tsx — global chrome: demo-mode banner (PRD 20.3), the top bar
 * (workspace name + connector pills), plus the left nav for the product
 * surface (Feed / Chat / Approvals / Performance / Ledger / Settings).
 *
 * Brief v4 "premium cockpit rail" (supersedes v3 area 2 where conflicting):
 * dark cockpit sidebar with blue/emerald blooms + fine grid texture, inline
 * SVG nav icons matching the ProductMark glyph stroke, nav-group separator,
 * stronger active state (accent rail + blue glow), bottom "proof rail" card;
 * glass sticky top bar with refined connection pills + workspace badge; the
 * mesh-cockpit gradient on the app/login background (selective, subtle).
 * Content canvas is max-w-6xl (7xl on the feed, the visual hero). Under
 * 768px the left nav collapses into a hamburger menu in the top bar.
 * Onboarding routes render without the nav so the first-run flow stays a
 * focused, linear track (PRD 6.1, 7.1 screens 1-6).
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type NavIconName =
  | "home"
  | "feed"
  | "chat"
  | "approvals"
  | "performance"
  | "activation"
  | "ledger"
  | "export";

/**
 * Lightweight inline nav icons (brief v4) — same stroke style as the
 * ProductMark glyph (round caps/joins, no fills). Decorative only.
 */
const NAV_ICON_PATHS: Record<NavIconName, React.ReactNode> = {
  home: (
    <>
      <path d="m2.5 7.5 5.5-5 5.5 5" />
      <path d="M4.5 7v6h7V7" />
    </>
  ),
  feed: (
    <>
      <path d="M8 2.5 13.5 5 8 7.5 2.5 5 8 2.5Z" />
      <path d="M2.5 8 8 10.5 13.5 8" />
      <path d="M2.5 11 8 13.5 13.5 11" />
    </>
  ),
  chat: (
    <>
      <path d="M2.5 3.5h11V11H7L4 13.5V11H2.5v-7.5Z" />
      <path d="M5.5 7.25h5" />
    </>
  ),
  approvals: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="m5.5 8.1 1.8 1.8 3.2-3.6" />
    </>
  ),
  performance: (
    <>
      <path d="M3.5 13V9.5" />
      <path d="M8 13V5.5" />
      <path d="M12.5 13V7.5" />
      <path d="M2 13.5h12" />
    </>
  ),
  activation: <path d="M8.75 2.5 4.5 9h3L7.25 13.5 11.5 7h-3l.25-4.5Z" />,
  ledger: (
    <>
      <path d="M5 2.5h8v11H5A1.5 1.5 0 0 1 3.5 12V4A1.5 1.5 0 0 1 5 2.5Z" />
      <path d="M6.5 5.5h4" />
      <path d="M6.5 8h4" />
    </>
  ),
  export: (
    <>
      <path d="M8 9.5v-7" />
      <path d="M5.5 5 8 2.5 10.5 5" />
      <path d="M3 9.5v2.5A1.5 1.5 0 0 0 4.5 13.5h7A1.5 1.5 0 0 0 13 12V9.5" />
    </>
  ),
};

function NavIcon({
  name,
  className,
}: {
  name: NavIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={cx("h-4 w-4 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {NAV_ICON_PATHS[name]}
    </svg>
  );
}

type NavItem = { label: string; href: string; icon: NavIconName };

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Feed", href: "/feed", icon: "feed" },
  { label: "Chat", href: "/chat", icon: "chat" },
  { label: "Approvals", href: "/approvals", icon: "approvals" },
  { label: "Performance", href: "/performance", icon: "performance" },
  { label: "Activation", href: "/activation", icon: "activation" },
  { label: "Ledger", href: "/ledger", icon: "ledger" },
  { label: "Export", href: "/export", icon: "export" },
];

/** Nav groups (brief v4): operate up top, proof surfaces below a separator. */
const NAV_GROUPS: Array<{ label: string | null; items: NavItem[] }> = [
  { label: null, items: NAV_ITEMS.slice(0, 4) },
  { label: "Prove", items: NAV_ITEMS.slice(4) },
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

/** Dependency-free product mark: growth spark on a gradient icon tile. */
function ProductMark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex shrink-0 items-center justify-center",
        size === "sm" ? "h-6 w-6 rounded-md" : "h-8 w-8 rounded-lg",
        "bg-gradient-to-br from-[#3b82f6] via-[#2563eb] to-[#1e40af]",
        "ring-1 ring-white/20",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_6px_rgb(2_6_23/0.45),0_4px_14px_-2px_var(--glow-blue)]",
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
        "transition-[background-color,border-color,box-shadow] duration-150 ease-out",
        connected
          ? "border-border bg-surface text-ink-secondary hover:border-emerald-300/70 hover:shadow-[0_1px_1px_rgb(15_23_42/0.04),0_2px_10px_-2px_var(--glow-emerald)]"
          : "border-blue-200/80 border-dashed bg-blue-50/40 text-ink-muted hover:border-blue-300 hover:bg-blue-50/70",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          connected
            ? "connector-dot-live bg-success shadow-[0_0_0_3px_rgb(5_150_105/0.15)]"
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
  item: NavItem;
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
        "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm",
        "transition-[color,background-color,box-shadow] duration-150 ease-out",
        dark
          ? active
            ? // Active-nav glow rail (brief v4): stronger accent rail + a
              // blue bloom behind the row and a soft outer proof glow.
              "bg-white/[0.1] font-semibold text-white shadow-[inset_3px_0_0_var(--color-accent),inset_16px_0_26px_-12px_var(--glow-proof),0_0_22px_-4px_var(--glow-proof)]"
            : "font-medium text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
          : active
            ? "bg-neutral-soft font-semibold text-ink shadow-[inset_3px_0_0_var(--color-accent),inset_14px_0_24px_-12px_var(--glow-proof)]"
            : "font-medium text-ink-muted hover:bg-surface-soft hover:text-ink",
      )}
    >
      <NavIcon
        name={item.icon}
        className={cx(
          "transition-colors duration-150",
          dark
            ? active
              ? "text-sky-300"
              : "text-slate-500 group-hover:text-slate-300"
            : active
              ? "text-accent"
              : "text-ink-soft group-hover:text-ink-muted",
        )}
      />
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
    <header className="glass-topbar sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-border/90 px-4 shadow-[0_4px_16px_-8px_rgb(15_23_42/0.08)] md:px-6">
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
        <span className="hidden min-w-0 items-center gap-2.5 md:flex">
          <span className="truncate text-sm font-semibold tracking-tight text-ink-800">
            Demo workspace
          </span>
          {/* Workspace badge (brief v4 topbar polish). */}
          <span className="ring-highlight inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50/80 px-2 py-px text-[10px] font-medium tracking-[0.1em] text-amber-700 uppercase">
            <span
              aria-hidden="true"
              className="h-1 w-1 shrink-0 rounded-full bg-amber-500"
            />
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

  // Onboarding track renders {children} exactly ONCE — no duplicate render
  // (checked per brief v4's allowed logic-adjacent fix; none was needed).
  if (isOnboardingPath(pathname)) {
    return (
      <div className="bg-mesh-cockpit flex min-h-full flex-1 flex-col">
        <DemoBanner />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    );
  }

  // The feed is the visual hero (brief v4) — it gets the widest canvas.
  const wideCanvas =
    pathname.startsWith("/feed") || pathname.startsWith("/opportunities");

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <DemoBanner />
      <div className="flex flex-1">
        {/* Cockpit sidebar — dark panel, blue/emerald blooms, grid texture. */}
        <aside className="bg-cockpit-rail hidden w-60 shrink-0 flex-col border-r border-white/10 md:flex">
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
            className="flex flex-1 flex-col border-t border-white/[0.07] p-2 pt-3"
          >
            {NAV_GROUPS.map((group, gi) => (
              <React.Fragment key={group.label ?? gi}>
                {gi > 0 ? (
                  // Nav-group separator (brief v4): hairline + micro label.
                  <div className="mt-3 mb-1 border-t border-white/[0.07] px-3 pt-2.5">
                    <span className="text-[10px] font-medium tracking-[0.16em] text-slate-600 uppercase">
                      {group.label}
                    </span>
                  </div>
                ) : null}
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      dark
                      active={isActivePath(pathname, item.href)}
                    />
                  ))}
                </div>
              </React.Fragment>
            ))}
          </nav>
          {/* Bottom "proof rail" card (brief v4 — exact two lines). */}
          <div className="border-t border-white/[0.07] p-3">
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_0_24px_-8px_var(--glow-money)]">
              <p className="flex items-center gap-1.5 text-[11px] leading-4 font-semibold text-emerald-200">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgb(16_185_129/0.18)]"
                />
                Proof rails active
              </p>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                Holdout-verified where controlled. Directional where not.
              </p>
            </div>
          </div>
        </aside>
        <div className="bg-mesh-cockpit flex min-w-0 flex-1 flex-col">
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
              <div className="border-t border-border px-3 py-2">
                <p className="flex items-center gap-1.5 text-[11px] leading-4 font-semibold text-ink-secondary">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-success shadow-[0_0_0_3px_rgb(5_150_105/0.15)]"
                  />
                  Proof rails active
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-ink-soft">
                  Holdout-verified where controlled. Directional where not.
                </p>
              </div>
            </nav>
          ) : null}
          <main className="min-w-0 flex-1 overflow-x-auto">
            <div
              className={cx(
                "mx-auto w-full px-4 py-6 md:px-6",
                wideCanvas ? "max-w-7xl" : "max-w-6xl",
              )}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
