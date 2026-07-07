/**
 * lib/recipes/shared.ts — deterministic helpers shared by the three recipes.
 * Pure functions only; no I/O, no Date.now(), no randomness.
 */

import type { Customer, Event } from "../contracts";
import type { ExistingFlowSnapshot, RecipeDataSnapshot } from "./types";

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

/** Purchase-like event types. */
const PURCHASE_TYPES = new Set(["purchase", "repeat_purchase"]);

export function isPurchaseEvent(e: Event): boolean {
  return PURCHASE_TYPES.has(e.eventType);
}

/** Stable sort key so identical snapshots always order identically. */
export function customerSortKey(c: Customer): string {
  return `${c.emailLower ?? ""}|${c.id}`;
}

export function sortCustomers(customers: Customer[]): Customer[] {
  return [...customers].sort((a, b) =>
    customerSortKey(a) < customerSortKey(b) ? -1 : 1,
  );
}

/** Events sorted ascending by timestamp then id (defensive re-sort). */
export function sortEvents(events: Event[]): Event[] {
  return [...events].sort((a, b) => {
    const dt = a.eventTimestamp.getTime() - b.eventTimestamp.getTime();
    return dt !== 0 ? dt : a.id < b.id ? -1 : 1;
  });
}

/** Map customerId -> events of the given types, in ascending time order. */
export function eventsByCustomer(
  events: Event[],
  types?: string[],
): Map<string, Event[]> {
  const wanted = types ? new Set(types) : null;
  const map = new Map<string, Event[]>();
  for (const e of sortEvents(events)) {
    if (!e.customerId) continue;
    if (wanted && !wanted.has(e.eventType)) continue;
    const list = map.get(e.customerId);
    if (list) list.push(e);
    else map.set(e.customerId, [e]);
  }
  return map;
}

/** Customer ids that have an unsubscribe event (no boolean field on Customer). */
export function unsubscribedCustomerIds(events: Event[]): Set<string> {
  const ids = new Set<string>();
  for (const e of events) {
    if (e.eventType === "unsubscribe" && e.customerId) ids.add(e.customerId);
  }
  return ids;
}

/** Lowercase-email membership of ACTIVE existing flows of a given type (26B.11 / 26B.12). */
export function activeFlowMemberEmails(
  flows: ExistingFlowSnapshot[],
  type: "recovery" | "winback",
): Set<string> {
  const emails = new Set<string>();
  for (const f of flows) {
    if (!f.active || f.type !== type) continue;
    for (const email of f.memberCustomerEmails) emails.add(email.toLowerCase());
  }
  return emails;
}

/** Whether a customer is a member of the given lowercase-email set. */
export function isFlowMember(c: Customer, emails: Set<string>): boolean {
  return c.emailLower != null && emails.has(c.emailLower.toLowerCase());
}

/** Does the customer have a Klaviyo profile id in sourceCustomerIds Json? */
export function hasKlaviyoProfile(c: Customer): boolean {
  const ids = c.sourceCustomerIds;
  return (
    typeof ids === "object" &&
    ids !== null &&
    !Array.isArray(ids) &&
    typeof (ids as Record<string, unknown>).klaviyo === "string"
  );
}

/**
 * Merchant average order value from purchase events (value present); falls
 * back to customer aggregates. Returns null when no purchase history exists.
 */
export function computeAov(snapshot: RecipeDataSnapshot): number | null {
  let sum = 0;
  let n = 0;
  for (const e of snapshot.events) {
    if (isPurchaseEvent(e) && typeof e.value === "number" && e.value > 0) {
      sum += e.value;
      n += 1;
    }
  }
  if (n > 0) return sum / n;
  let revenue = 0;
  let orders = 0;
  for (const c of snapshot.customers) {
    revenue += c.totalRevenue;
    orders += c.totalOrders;
  }
  return orders > 0 ? revenue / orders : null;
}

/** Deterministic median (sorted copy; average of middle two for even length). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Purchase intervals in days for one customer. Prefers stored
 * purchaseIntervalStats.intervals; falls back to purchase-event gaps.
 */
export function purchaseIntervalsDays(
  c: Customer,
  purchases: Event[] | undefined,
): number[] {
  const stats = c.purchaseIntervalStats;
  if (typeof stats === "object" && stats !== null && !Array.isArray(stats)) {
    const raw = (stats as Record<string, unknown>).intervals;
    if (Array.isArray(raw)) {
      const nums = raw.filter(
        (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
      );
      if (nums.length > 0) return nums;
    }
  }
  if (!purchases || purchases.length < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < purchases.length; i += 1) {
    const gap =
      (purchases[i].eventTimestamp.getTime() -
        purchases[i - 1].eventTimestamp.getTime()) /
      MS_PER_DAY;
    if (gap > 0) out.push(gap);
  }
  return out;
}

/** Round a dollar figure to a whole dollar; clamp at >= 0. */
export function roundDollars(v: number): number {
  return Math.max(0, Math.round(v));
}

/** Format helpers for explanation copy. */
export function fmtDollars(v: number): string {
  return `$${roundDollars(v).toLocaleString("en-US")}`;
}

export function fmtPct(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

/** Percentile rank in [0,1] of each value (higher value -> higher rank). Ties share a rank. */
export function percentileRanks(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [1];
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v || a.i - b.i);
  const ranks = new Array<number>(n);
  let pos = 0;
  while (pos < n) {
    let end = pos;
    while (end + 1 < n && indexed[end + 1].v === indexed[pos].v) end += 1;
    // average position of the tie group, normalized
    const rank = (pos + end) / 2 / (n - 1);
    for (let k = pos; k <= end; k += 1) ranks[indexed[k].i] = rank;
    pos = end + 1;
  }
  return ranks;
}

/** Share of customers carrying the 26B.12 join key (source completeness proxy). */
export function identityJoinCoverage(customers: Customer[]): number {
  if (customers.length === 0) return 0;
  const withKey = customers.filter((c) => c.emailLower != null).length;
  return withKey / customers.length;
}

/** True when every required source is fresh (feeds confidence + freshness gate copy). */
export function allSourcesFresh(snapshot: RecipeDataSnapshot): boolean {
  return snapshot.freshness.every((f) => !f.isStale);
}
