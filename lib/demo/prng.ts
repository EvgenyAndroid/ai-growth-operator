/**
 * lib/demo/prng.ts — deterministic seeded PRNG for the demo dataset.
 *
 * Mulberry32: tiny, fast, deterministic. NO Date.now()-dependent randomness
 * anywhere in the demo module (PRD 25.1 + task rule): the same seed always
 * produces the exact same dataset.
 */

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick one element. Throws on empty input (demo pools are never empty). */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("Rng.pick: empty array");
    return arr[this.int(0, arr.length - 1)] as T;
  }

  /** Fisher-Yates shuffle into a NEW array (input untouched). */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  /** n distinct elements sampled without replacement. */
  sample<T>(arr: readonly T[], n: number): T[] {
    if (n >= arr.length) return this.shuffle(arr);
    return this.shuffle(arr).slice(0, n);
  }
}

/** Median of a non-empty numeric array (does not mutate input). */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("median: empty array");
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Round to 2 decimal places (currency). */
export function money(n: number): number {
  return Math.round(n * 100) / 100;
}
