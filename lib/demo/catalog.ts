/**
 * lib/demo/catalog.ts — deterministic ~150-product catalog for the demo
 * merchant "Brightleaf Botanicals" (Shopify DTC, beauty/wellness vertical —
 * matches the PRD 12.2 Shopify DTC template + beauty/wellness claims variant).
 *
 * Variety requirements (PRD 9.2 / 26A.7 + task):
 * - repeatPurchaseFlag + replenishmentWindowDays on consumables
 * - seasonal products (seasonalFlag)
 * - all five ContractRepeatability values represented
 */

import type { ContractRepeatability, DemoDataset } from "../contracts";
import { Rng, money } from "./prng";

export type DemoProduct = DemoDataset["products"][number];

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
    key: "skincare",
    count: 28,
    priceMin: 18,
    priceMax: 68,
    repeatPurchaseFlag: true,
    repeatability: "replenishable",
    seasonalShare: 0,
    replenMin: 30,
    replenMax: 60,
    adjectives: ["Dew", "Calm", "Bright", "Velvet", "Morning", "Petal", "Clover", "Amber", "Sage", "Linen"],
    nouns: ["Face Serum", "Day Cream", "Night Cream", "Cleansing Balm", "Facial Oil", "Eye Cream", "Toner Mist", "Clay Mask", "Lip Treatment", "Moisture Gel"],
  },
  {
    key: "supplements",
    count: 24,
    priceMin: 22,
    priceMax: 58,
    repeatPurchaseFlag: true,
    repeatability: "replenishable",
    seasonalShare: 0,
    replenMin: 28,
    replenMax: 45,
    adjectives: ["Daily", "Root", "Glow", "Restore", "Balance", "Vital", "Deep", "Clear"],
    nouns: ["Collagen Blend", "Greens Powder", "Omega Softgels", "Probiotic Capsules", "Magnesium Complex", "Adaptogen Drops", "B-Complex", "Sleep Gummies", "Iron Support"],
  },
  {
    key: "haircare",
    count: 14,
    priceMin: 16,
    priceMax: 42,
    repeatPurchaseFlag: true,
    repeatability: "replenishable",
    seasonalShare: 0,
    replenMin: 45,
    replenMax: 75,
    adjectives: ["Silk", "Meadow", "Coast", "Fern"],
    nouns: ["Shampoo Bar", "Conditioner", "Scalp Serum", "Hair Oil", "Leave-In Cream", "Repair Mask"],
  },
  {
    key: "body",
    count: 14,
    priceMin: 14,
    priceMax: 38,
    repeatPurchaseFlag: true,
    repeatability: "replenishable",
    seasonalShare: 0,
    replenMin: 40,
    replenMax: 70,
    adjectives: ["Grove", "Salt", "Honey", "Alpine"],
    nouns: ["Body Butter", "Hand Cream", "Body Wash", "Sugar Scrub", "Deodorant Stick", "Body Lotion"],
  },
  {
    key: "tea-wellness",
    count: 14,
    priceMin: 12,
    priceMax: 30,
    repeatPurchaseFlag: true,
    repeatability: "replenishable",
    seasonalShare: 0,
    replenMin: 30,
    replenMax: 50,
    adjectives: ["Quiet", "Sunrise", "Harvest", "Mint"],
    nouns: ["Herbal Tea", "Loose-Leaf Blend", "Wellness Tonic", "Cacao Mix", "Chai Blend"],
  },
  {
    key: "candles-home",
    count: 18,
    priceMin: 20,
    priceMax: 55,
    repeatPurchaseFlag: true,
    repeatability: "repeatable",
    seasonalShare: 0.2,
    adjectives: ["Cedar", "Hearth", "Dusk", "Juniper", "Wildflower"],
    nouns: ["Soy Candle", "Room Mist", "Reed Diffuser", "Incense Set", "Match Cloche"],
  },
  {
    key: "apparel",
    count: 12,
    priceMin: 28,
    priceMax: 85,
    repeatPurchaseFlag: false,
    repeatability: "unknown",
    seasonalShare: 0.15,
    adjectives: ["Studio", "Everyday", "Weekend"],
    nouns: ["Robe", "Headband Set", "Lounge Socks", "Tote Bag", "Sleep Mask", "Wrap Cardigan"],
  },
  {
    key: "gift-sets",
    count: 14,
    priceMin: 35,
    priceMax: 120,
    repeatPurchaseFlag: false,
    repeatability: "one_time_gift",
    seasonalShare: 0.5,
    adjectives: ["Signature", "Little", "Grand", "Thank-You"],
    nouns: ["Gift Set", "Ritual Box", "Discovery Kit", "Duo Set", "Sampler Crate"],
  },
  {
    key: "seasonal",
    count: 12,
    priceMin: 18,
    priceMax: 60,
    repeatPurchaseFlag: false,
    repeatability: "seasonal",
    seasonalShare: 1,
    adjectives: ["Winter", "Summer", "Autumn", "Solstice"],
    nouns: ["Advent Calendar", "SPF Stick", "Pumpkin Mask", "Cooling Mist", "Holiday Candle", "Beach Balm"],
  },
];

/** Builds the fixed 150-product catalog. Deterministic for a given Rng seed. */
export function buildCatalog(rng: Rng): DemoProduct[] {
  const products: DemoProduct[] = [];
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
        sourceProductId: `demo-prod-${String(index).padStart(3, "0")}`,
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

  return products; // 150 products
}
