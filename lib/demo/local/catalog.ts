/**
 * lib/demo/local/catalog.ts — deterministic ~40-product catalog for the LOCAL
 * demo merchant "Cardamom & Rye", a neighborhood bakery-café on a Square-like
 * POS. Categories: pastries, coffee (drinks + retail beans), breads, and
 * CATERING SKUs including large-order items priced well above the
 * catering_upsell largeOrderThreshold (60).
 *
 * Deterministic for a given Rng seed — no Date.now() anywhere.
 */

import type { ContractRepeatability, DemoDataset } from "../../contracts";
import { Rng, money } from "../prng";

export type LocalDemoProduct = DemoDataset["products"][number];

interface CategorySpec {
  key: string;
  count: number;
  priceMin: number;
  priceMax: number;
  repeatPurchaseFlag: boolean;
  repeatability: ContractRepeatability;
  /** Probability a product in this category is seasonal. */
  seasonalShare: number;
  replenMin?: number;
  replenMax?: number;
  adjectives: string[];
  nouns: string[];
}

const CATEGORIES: CategorySpec[] = [
  {
    key: "pastries",
    count: 12,
    priceMin: 3.25,
    priceMax: 6.75,
    repeatPurchaseFlag: true,
    repeatability: "repeatable",
    seasonalShare: 0.15,
    adjectives: ["Cardamom", "Morning", "Brown-Butter", "Sea-Salt", "Rye", "Honey"],
    nouns: [
      "Croissant", "Morning Bun", "Kouign-Amann", "Cinnamon Knot", "Almond Twist",
      "Danish", "Scone", "Galette Slice", "Shortbread", "Cruffin",
    ],
  },
  {
    key: "coffee-drinks",
    count: 8,
    priceMin: 3.0,
    priceMax: 6.75,
    repeatPurchaseFlag: true,
    repeatability: "repeatable",
    seasonalShare: 0.1,
    adjectives: ["House", "Single-Origin", "Oat-Milk", "Iced", "Double"],
    nouns: ["Latte", "Cappuccino", "Cortado", "Drip Coffee", "Espresso", "Cold Brew", "Mocha", "Chai"],
  },
  {
    key: "coffee-beans",
    count: 4,
    priceMin: 14,
    priceMax: 24,
    repeatPurchaseFlag: true,
    repeatability: "replenishable",
    seasonalShare: 0,
    replenMin: 21,
    replenMax: 35,
    adjectives: ["Hearthside", "Kilimanjaro", "Cascara", "Decaf"],
    nouns: ["Whole-Bean Bag", "Espresso Blend", "Filter Roast", "Sampler Trio"],
  },
  {
    key: "breads",
    count: 8,
    priceMin: 6,
    priceMax: 13,
    repeatPurchaseFlag: true,
    repeatability: "replenishable",
    seasonalShare: 0.1,
    replenMin: 5,
    replenMax: 10,
    adjectives: ["Country", "Seeded", "Dark", "Sprouted", "Olive"],
    nouns: ["Sourdough Loaf", "Rye Loaf", "Baguette", "Focaccia", "Miche", "Ciabatta", "Boule", "Batard"],
  },
  {
    // CATERING SKUs — large-order items. Prices sit at/above the
    // catering_upsell largeOrderThreshold (60) so single catering orders read
    // as large POS tickets.
    key: "catering",
    count: 8,
    priceMin: 55,
    priceMax: 260,
    repeatPurchaseFlag: false,
    repeatability: "repeatable",
    seasonalShare: 0.25,
    adjectives: ["Office", "Meeting", "Weekend", "Celebration"],
    nouns: [
      "Pastry Box (24 ct)", "Breakfast Platter", "Sandwich Board", "Coffee Traveler Set",
      "Dessert Table Spread", "Brunch Package", "Bread Basket (12 loaves)", "Full-Sheet Cake",
    ],
  },
];

/** Builds the fixed 40-product catalog. Deterministic for a given Rng seed. */
export function buildLocalCatalog(rng: Rng): LocalDemoProduct[] {
  const products: LocalDemoProduct[] = [];
  const usedNames = new Set<string>();
  let index = 0;

  for (const cat of CATEGORIES) {
    for (let i = 0; i < cat.count; i += 1) {
      index += 1;
      let name = `${rng.pick(cat.adjectives)} ${rng.pick(cat.nouns)}`;
      let variant = 2;
      while (usedNames.has(name)) {
        name = `${rng.pick(cat.adjectives)} ${rng.pick(cat.nouns)} No. ${variant}`;
        variant += 1;
      }
      usedNames.add(name);

      const price = money(rng.float(cat.priceMin, cat.priceMax));
      const seasonalFlag = rng.chance(cat.seasonalShare);
      const replenishmentWindowDays =
        cat.replenMin !== undefined && cat.replenMax !== undefined
          ? rng.int(cat.replenMin, cat.replenMax)
          : undefined;

      products.push({
        sourceProductId: `local-prod-${String(index).padStart(3, "0")}`,
        name,
        category: cat.key,
        price,
        repeatPurchaseFlag: cat.repeatPurchaseFlag,
        ...(replenishmentWindowDays !== undefined ? { replenishmentWindowDays } : {}),
        seasonalFlag,
        repeatability: cat.repeatability,
      });
    }
  }

  return products; // 40 products
}
