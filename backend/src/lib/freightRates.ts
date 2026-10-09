// Shared company freight rate schedule — used by both the public quote calculator
// (routes/quotes.ts) and the admin Batches freight-charge calculator (routes/shipments.ts).
// Keeping this in one place means the two always agree on price. Rates are admin-editable
// (Pricing Presets screen, backed by the FreightRateSetting model / routes/freightRates.ts);
// the constants below are only the fallback defaults used before the settings row exists.

export interface AirRateTier { maxLbs: number; ratePerLb: number }

export const DEFAULT_AIR_RATE_TIERS: AirRateTier[] = [
  { maxLbs: 10, ratePerLb: 3.00 },
  { maxLbs: 30, ratePerLb: 2.50 },
  { maxLbs: 50, ratePerLb: 2.25 },
  { maxLbs: 100, ratePerLb: 2.15 },
  { maxLbs: Infinity, ratePerLb: 2.00 }, // 101+ lbs
];

// Sea Freight Calculation — cubic measurement from L x W x H (inches) / 1728, times $/cu ft.
export const DEFAULT_SEA_RATE_PER_CUBIC_FT = 5.25;

export interface FreightRates {
  seaRatePerCubicFt: number;
  airTiers: AirRateTier[];
}

export const DEFAULT_FREIGHT_RATES: FreightRates = {
  seaRatePerCubicFt: DEFAULT_SEA_RATE_PER_CUBIC_FT,
  airTiers: DEFAULT_AIR_RATE_TIERS,
};

// Builds the AIR tier list from a FreightRateSetting DB row (flat $-per-lb columns).
export function airTiersFromSettings(s: { airRate1to10: number; airRate11to30: number; airRate31to50: number; airRate51to100: number; airRate100plus: number }): AirRateTier[] {
  return [
    { maxLbs: 10, ratePerLb: s.airRate1to10 },
    { maxLbs: 30, ratePerLb: s.airRate11to30 },
    { maxLbs: 50, ratePerLb: s.airRate31to50 },
    { maxLbs: 100, ratePerLb: s.airRate51to100 },
    { maxLbs: Infinity, ratePerLb: s.airRate100plus },
  ];
}

export function ratesFromSettings(s: { seaRatePerCubicFt: number; airRate1to10: number; airRate11to30: number; airRate31to50: number; airRate51to100: number; airRate100plus: number }): FreightRates {
  return { seaRatePerCubicFt: s.seaRatePerCubicFt, airTiers: airTiersFromSettings(s) };
}

export function airRatePerLb(weightLbs: number, tiers: AirRateTier[] = DEFAULT_AIR_RATE_TIERS): number {
  const tier = tiers.find(t => weightLbs <= t.maxLbs);
  return (tier ?? tiers[tiers.length - 1]).ratePerLb;
}

export function parseDimensions(dimensions: string): [number, number, number] | null {
  const parts = dimensions.split('x').map(d => parseFloat(d.trim()));
  if (parts.length !== 3 || parts.some(n => !n || n <= 0)) return null;
  return [parts[0], parts[1], parts[2]];
}

export function cubicFeetFromDimensions(dimensions: string): number | null {
  const parts = parseDimensions(dimensions);
  if (!parts) return null;
  return (parts[0] * parts[1] * parts[2]) / 1728;
}

export interface FreightCalcResult {
  price: number;
  chargeableWeight: number | null;
  cubicFeet: number | null;
  rateApplied: string | null;
}

// Computes the freight charge for AIR (per-lb tiered) or SEA (per-cubic-ft) shipments.
// Returns null price if the required input (weight for AIR, dimensions for SEA) is missing/invalid.
// `rates` defaults to the fallback schedule above if the caller hasn't loaded the admin-editable
// settings (e.g. via lib/freightRateSettings.ts).
export function calcFreightCharge(type: 'AIR' | 'SEA', weight?: number | null, dimensions?: string | null, rates: FreightRates = DEFAULT_FREIGHT_RATES): FreightCalcResult | null {
  if (type === 'AIR') {
    const w = weight ?? 0;
    if (!w || w <= 0) return null;
    const ratePerLb = airRatePerLb(w, rates.airTiers);
    return {
      price: parseFloat((w * ratePerLb).toFixed(2)),
      chargeableWeight: w,
      cubicFeet: null,
      rateApplied: `$${ratePerLb.toFixed(2)}/lb`,
    };
  }
  if (type === 'SEA') {
    if (!dimensions) return null;
    const cubicFeet = cubicFeetFromDimensions(dimensions);
    if (cubicFeet === null) return null;
    return {
      price: parseFloat((cubicFeet * rates.seaRatePerCubicFt).toFixed(2)),
      chargeableWeight: weight ?? null,
      cubicFeet: parseFloat(cubicFeet.toFixed(2)),
      rateApplied: `$${rates.seaRatePerCubicFt.toFixed(2)}/cu ft`,
    };
  }
  return null;
}
