/** Number formatting shared by valuation displays (Profile, future Vault). */

/**
 * Abbreviate large values: thousands → K, millions → M, billions → B,
 * two decimal places with trailing zeros trimmed (2,205,123 → "2.21M",
 * 50,000 → "50K"). Values under 1,000 render as-is.
 */
export function abbreviateValue(n: number): string {
  const abs = Math.abs(n);
  const fmt = (v: number, suffix: string) => {
    const s = v.toFixed(2).replace(/\.?0+$/, '');
    return `${s}${suffix}`;
  };
  if (abs >= 1e9) return fmt(n / 1e9, 'B');
  if (abs >= 1e6) return fmt(n / 1e6, 'M');
  if (abs >= 1e3) return fmt(n / 1e3, 'K');
  return n.toLocaleString('en-US');
}

/** Full number with thousands separators. */
export function exactValue(n: number): string {
  return n.toLocaleString('en-US');
}

/** True when abbreviation actually hides digits (worth a hold-to-reveal). */
export function isAbbreviated(n: number): boolean {
  return abbreviateValue(n) !== exactValue(n);
}
