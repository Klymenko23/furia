/** Суми в кількох валютах: { EUR: 1650, UAH: 18000 } */
export type Sums = Record<string, number>;

export function addSum(s: Sums, currency: string, v: number) {
  if (!v) return s;
  s[currency] = Math.round(((s[currency] ?? 0) + v) * 100) / 100;
  return s;
}

export function mergeSums(...list: Sums[]) {
  const out: Sums = {};
  for (const s of list) for (const [c, v] of Object.entries(s)) addSum(out, c, v);
  return out;
}

/** Чи є хоч одна відʼємна сума */
export const hasNegative = (s: Sums) => Object.values(s).some((v) => v < 0);
