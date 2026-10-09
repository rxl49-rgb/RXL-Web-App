// Local trucking pickup & delivery pricing.
//
// Pickup can be any address in the USA; delivery must be within Florida.
// Price is based on ROUND-TRIP distance — the one-way driving distance
// between pickup and delivery, doubled (there + back), x per-mile rate —
// since the truck/van has to return after the drop-off. The "Distance"
// figure shown to the customer is this same doubled (round-trip) number,
// matching what they're actually billed for.
//
// There's also a flat minimum charge that governs short trips — e.g. Heavy
// Duty Truck's $80 minimum and $2.80/mi rate cross over at ~28.6 *billed*
// (round-trip) miles, i.e. a ~14.3-mile one-way trip (14.3 x 2 x 2.80 ≈ 80),
// so one-way routes up to ~14.3 miles are effectively billed at the flat
// $80 rate. Same idea for the Cargo Van: $60 minimum crosses over at ~13.3
// one-way miles (13.3 x 2 x 2.25 ≈ 60).
//
// Geocoding: OpenStreetMap Nominatim (free, no API key required).
// Driving distance: OSRM's public demo router (free, no API key required).
// If the routing service is unreachable, falls back to a straight-line
// (Haversine) estimate padded ~25% for typical road curvature.
//
// Note: Nominatim/OSRM's public servers are meant for light, non-commercial
// use (informal rate limit ~1 req/sec). Fine for a small quote tool — if
// this app gets meaningful volume, swap geocode()/drivingMiles() for a paid
// provider (Google Maps, Mapbox) using the same function signatures.

export interface TruckType {
  key: 'HEAVY_DUTY' | 'CARGO_VAN';
  label: string;
  ratePerMile: number;
  minFlatRate: number;
  flatRateMileRange: [number, number];
}

export const TRUCK_TYPES: Record<string, TruckType> = {
  HEAVY_DUTY: {
    key: 'HEAVY_DUTY',
    label: 'Heavy Duty Truck',
    ratePerMile: 2.8,
    minFlatRate: 80,
    // One-way mile range effectively covered by the $80 minimum, given
    // round-trip billing (see file header comment) — informational only,
    // not read anywhere in the price calculation itself.
    flatRateMileRange: [0, 14.3],
  },
  CARGO_VAN: {
    key: 'CARGO_VAN',
    label: 'Medium Duty Cargo Van',
    ratePerMile: 2.25,
    minFlatRate: 60,
    flatRateMileRange: [0, 26],
  },
};

// Per-piece surcharges, Heavy Duty Truck only — extra handling for palletized
// or boxed freight, added on top of the distance-based price. Not offered for
// the Cargo Van.
export const PALLET_CHARGE = 10;
export const BOX_CHARGE = 5;
const MAX_PIECES = 200; // sanity cap against garbage input, not a real fleet limit

export class TruckingQuoteError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface GeoResult {
  lat: number;
  lon: number;
  displayName: string;
  countryCode?: string;
  state?: string;
}

async function geocode(address: string): Promise<GeoResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'RXL-Logistics-QuoteTool/1.0',
        Accept: 'application/json',
      },
    });
  } catch {
    throw new TruckingQuoteError('Could not reach the address lookup service. Please try again in a moment.', 502);
  }
  if (!res.ok) return null;
  const data = (await res.json()) as any[];
  if (!data.length) return null;
  const top = data[0];
  return {
    lat: parseFloat(top.lat),
    lon: parseFloat(top.lon),
    displayName: top.display_name,
    countryCode: top.address?.country_code,
    state: top.address?.state,
  };
}

function haversineMiles(a: GeoResult, b: GeoResult): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

async function drivingMiles(a: GeoResult, b: GeoResult): Promise<{ miles: number; estimated: boolean }> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
    const res = await fetch(url);
    if (res.ok) {
      const data: any = await res.json();
      const meters = data?.routes?.[0]?.distance;
      if (typeof meters === 'number' && meters > 0) {
        return { miles: meters / 1609.344, estimated: false };
      }
    }
  } catch {
    // fall through to the straight-line estimate below
  }
  return { miles: haversineMiles(a, b) * 1.25, estimated: true };
}

export interface TruckingQuoteInput {
  pickupAddress: string;
  deliveryAddress: string;
  truckType: string;
  // Heavy Duty Truck only — number of pallets / boxes being shipped, each
  // adding a flat per-piece handling surcharge on top of the distance price.
  pallets?: number;
  boxes?: number;
}

export interface TruckingQuoteResult {
  price: number;
  distancePrice: number;
  pallets: number;
  boxes: number;
  palletCharge: number;
  boxCharge: number;
  // Round-trip (there + back) distance — what's shown to the customer as
  // "Distance" and what the price is actually based on.
  miles: number;
  // One-way driving distance, kept around for reference/debugging — not
  // shown to the customer.
  oneWayMiles: number;
  estimatedDistance: boolean;
  truckType: TruckType;
  pickup: { address: string; resolved: string };
  delivery: { address: string; resolved: string };
}

export async function calculateTruckingQuote(input: TruckingQuoteInput): Promise<TruckingQuoteResult> {
  const truckType = TRUCK_TYPES[input.truckType];
  if (!truckType) {
    throw new TruckingQuoteError('Select a valid truck type.');
  }
  if (!input.pickupAddress?.trim()) {
    throw new TruckingQuoteError('Pickup address is required.');
  }
  if (!input.deliveryAddress?.trim()) {
    throw new TruckingQuoteError('Delivery address is required.');
  }

  const [pickup, delivery] = await Promise.all([
    geocode(input.pickupAddress),
    geocode(input.deliveryAddress),
  ]);

  if (!pickup) {
    throw new TruckingQuoteError("We couldn't locate the pickup address. Please check it and try again.");
  }
  if (!delivery) {
    throw new TruckingQuoteError("We couldn't locate the delivery address. Please check it and try again.");
  }
  if (pickup.countryCode && pickup.countryCode.toLowerCase() !== 'us') {
    throw new TruckingQuoteError('Pickup address must be within the USA.');
  }
  const deliveryIsFlorida = (delivery.state || '').toLowerCase() === 'florida';
  if (delivery.countryCode?.toLowerCase() !== 'us' || !deliveryIsFlorida) {
    throw new TruckingQuoteError('This trucking service currently delivers within Florida only.');
  }

  // Pallets/boxes are Heavy Duty Truck only — silently ignored for the Cargo
  // Van even if somehow sent, rather than erroring, since the frontend only
  // ever shows those fields for Heavy Duty.
  const isHeavyDuty = truckType.key === 'HEAVY_DUTY';
  const pallets = isHeavyDuty ? validatePieceCount(input.pallets, 'Pallets') : 0;
  const boxes = isHeavyDuty ? validatePieceCount(input.boxes, 'Boxes') : 0;

  const { miles, estimated } = await drivingMiles(pickup, delivery);
  const oneWayMiles = Math.round(miles * 10) / 10;
  // Bill for the round trip (pickup -> delivery -> back), not just the
  // one-way leg — the truck has to drive back after drop-off. This doubled
  // figure is also what's shown to the customer as "Distance", since it's
  // what the price is actually based on.
  const billedMiles = oneWayMiles * 2;
  const metered = billedMiles * truckType.ratePerMile;
  const distancePrice = Math.round(Math.max(metered, truckType.minFlatRate) * 100) / 100;

  const palletCharge = pallets * PALLET_CHARGE;
  const boxCharge = boxes * BOX_CHARGE;
  const price = Math.round((distancePrice + palletCharge + boxCharge) * 100) / 100;

  return {
    price,
    distancePrice,
    pallets,
    boxes,
    palletCharge,
    boxCharge,
    miles: billedMiles,
    oneWayMiles,
    estimatedDistance: estimated,
    truckType,
    pickup: { address: input.pickupAddress, resolved: pickup.displayName },
    delivery: { address: input.deliveryAddress, resolved: delivery.displayName },
  };
}

function validatePieceCount(value: number | undefined, label: string): number {
  if (value === undefined || value === null || (value as unknown as string) === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new TruckingQuoteError(`${label} must be a whole number of 0 or more.`);
  }
  if (n > MAX_PIECES) {
    throw new TruckingQuoteError(`${label} can't exceed ${MAX_PIECES}. Contact us for larger loads.`);
  }
  return n;
}
