import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

export async function getOrCreateFreightRateSettings() {
  let settings = await prisma.freightRateSetting.findFirst();
  if (!settings) settings = await prisma.freightRateSetting.create({ data: {} });
  return settings;
}

// Public: the public quote calculator, admin shipment calculator, and Pricing Presets
// screen all need the live rates.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await getOrCreateFreightRateSettings();
    res.json(settings);
  } catch (err) {
    console.error('GET /freight-rates failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update the Sea Freight (per cubic ft) and Air Freight (tiered per lb) rates.
router.put('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const fields = ['seaRatePerCubicFt', 'airRate1to10', 'airRate11to30', 'airRate31to50', 'airRate51to100', 'airRate100plus'] as const;
    const data: Record<string, number> = {};
    for (const key of fields) {
      const val = parseFloat(req.body[key]);
      if (isNaN(val) || val < 0) return res.status(400).json({ error: `${key} must be a non-negative number` });
      data[key] = val;
    }
    const existing = await getOrCreateFreightRateSettings();
    const updated = await prisma.freightRateSetting.update({ where: { id: existing.id }, data });
    res.json(updated);
  } catch (err) {
    console.error('PUT /freight-rates failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
