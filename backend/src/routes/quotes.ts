import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { calcFreightCharge, ratesFromSettings } from '../lib/freightRates';
import { getOrCreateFreightRateSettings } from './freightRates';
import { calculateTruckingQuote, TruckingQuoteError } from '../lib/trucking';

const router = Router();

// Fallback defaults for GROUND only, used if the admin-configurable presets haven't been seeded yet.
// Air and Sea use the fixed company rate schedule below instead (not preset-driven).
const FALLBACK_RATES: Record<string, { base: number; perKg: number }> = {
  GROUND: { base: 2.1, perKg: 0.9 },
};

const FALLBACK_REGIONS: Record<string, number> = {
  US: 1.0, CA: 1.1, UK: 1.4, EU: 1.3, AS: 1.6, OTHER: 1.8,
};

// Air/Sea rate schedule now lives in lib/freightRates.ts, shared with the admin
// Batches freight-charge calculator (routes/shipments.ts /calc-freight).
// Trucking pickup & delivery pricing lives in lib/trucking.ts.

function getRegion(location: string): string {
  const l = location.toUpperCase();
  if (l.includes('US') || l.includes('UNITED STATES') || l.includes('USA')) return 'US';
  if (l.includes('CANADA') || l.includes('CA')) return 'CA';
  if (l.includes('UK') || l.includes('UNITED KINGDOM') || l.includes('ENGLAND')) return 'UK';
  if (l.includes('EUROPE') || l.includes('EU') || l.includes('GERMANY') || l.includes('FRANCE')) return 'EU';
  if (l.includes('CHINA') || l.includes('JAPAN') || l.includes('KOREA') || l.includes('ASIA')) return 'AS';
  return 'OTHER';
}

// Public: calculate quote.
// AIR and SEA use the fixed company rate schedule (tiered per-lb / cubic-measurement).
// TRUCKING is mileage-based, pickup anywhere in the USA, delivery within Florida only.
// GROUND falls back to the older admin-editable base+perKg preset system.
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { type, weight, dimensions } = req.body;
    const origin = req.body.origin || '';
    const destination = req.body.destination || '';
    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }

    // TRUCKING has its own request/response shape (addresses + miles instead of
    // weight/dimensions), so it's handled as an early return, isolated from the
    // AIR/SEA/GROUND flow below.
    if (type === 'TRUCKING') {
      try {
        const result = await calculateTruckingQuote({
          pickupAddress: req.body.pickupAddress || origin,
          deliveryAddress: req.body.deliveryAddress || destination,
          truckType: req.body.truckType,
          pallets: req.body.pallets,
          boxes: req.body.boxes,
        });
        return res.json({
          type,
          truckType: result.truckType.key,
          truckTypeLabel: result.truckType.label,
          origin: result.pickup.resolved,
          destination: result.delivery.resolved,
          pickupAddress: result.pickup.address,
          deliveryAddress: result.delivery.address,
          miles: result.miles,
          estimatedDistance: result.estimatedDistance,
          rateApplied: `$${result.truckType.ratePerMile.toFixed(2)}/mi, $${result.truckType.minFlatRate} minimum`,
          distancePrice: result.distancePrice,
          pallets: result.pallets,
          boxes: result.boxes,
          palletCharge: result.palletCharge,
          boxCharge: result.boxCharge,
          price: result.price,
          currency: 'USD',
          transitDays: 1,
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      } catch (err: any) {
        if (err instanceof TruckingQuoteError) {
          return res.status(err.status).json({ error: err.message });
        }
        console.error('[quotes] trucking calc failed:', err);
        return res.status(502).json({ error: 'Could not calculate distance for those addresses right now. Please try again.' });
      }
    }

    let price: number;
    let chargeableWeight: number | null = null;
    let cubicFeet: number | null = null;
    let rateApplied: string | null = null;

    if (type === 'AIR' || type === 'SEA') {
      const rateSettings = await getOrCreateFreightRateSettings();
      const rates = ratesFromSettings(rateSettings);

      if (type === 'AIR') {
        const w = parseFloat(weight);
        if (!w || w <= 0) return res.status(400).json({ error: 'Weight (lbs) is required for air freight' });
        const result = calcFreightCharge('AIR', w, null, rates);
        if (!result) return res.status(400).json({ error: 'Weight (lbs) is required for air freight' });
        price = result.price;
        chargeableWeight = result.chargeableWeight;
        rateApplied = result.rateApplied;
      } else {
        if (!dimensions) return res.status(400).json({ error: 'Dimensions (L x W x H in inches) are required for sea freight' });
        const result = calcFreightCharge('SEA', weight ? parseFloat(weight) : null, dimensions, rates);
        if (!result) return res.status(400).json({ error: 'Enter dimensions as L x W x H in inches, e.g. 24 x 18 x 12' });
        price = result.price;
        chargeableWeight = result.chargeableWeight;
        cubicFeet = result.cubicFeet;
        rateApplied = result.rateApplied;
      }
    } else {
      // GROUND — legacy base+perKg preset system (admin-configurable via ShippingRate/RegionMultiplier)
      if (!weight) return res.status(400).json({ error: 'Weight is required for ground freight' });
      const [dbRate, dbRegions] = await Promise.all([
        prisma.shippingRate.findUnique({ where: { type } }),
        prisma.regionMultiplier.findMany(),
      ]);
      const rate = dbRate ? { base: dbRate.base, perKg: dbRate.perKg } : FALLBACK_RATES.GROUND;
      const regionMap: Record<string, number> = dbRegions.length
        ? Object.fromEntries(dbRegions.map(r => [r.region, r.multiplier]))
        : FALLBACK_REGIONS;
      const destRegion = getRegion(destination);
      const originRegion = getRegion(origin);
      const multiplier = Math.max(regionMap[destRegion] ?? 1.8, regionMap[originRegion] ?? 1.8);
      const w = parseFloat(weight);
      price = (rate.base + rate.perKg * w) * multiplier;
      chargeableWeight = w;
    }

    price = parseFloat(price.toFixed(2));
    const transitDays = type === 'AIR' ? 3 : type === 'SEA' ? 21 : 7;

    res.json({
      type,
      origin,
      destination,
      weight: chargeableWeight,
      dimensions,
      cubicFeet: cubicFeet !== null ? parseFloat(cubicFeet.toFixed(2)) : null,
      rateApplied,
      price,
      currency: 'USD',
      transitDays,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Auth: save a quote (also used to confirm a booking — pass status: 'booked')
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { type, origin, destination, weight, dimensions, description, price, status } = req.body;
    const quote = await prisma.quote.create({
      data: {
        type,
        origin,
        destination,
        weight,
        dimensions,
        description,
        price,
        userId: req.user!.id,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ...(status ? { status } : {}),
      },
    });
    res.status(201).json(quote);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Auth: user quotes
router.get('/mine', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const quotes = await prisma.quote.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quotes);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
