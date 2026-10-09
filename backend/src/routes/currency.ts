import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

export async function getOrCreateCurrencySettings() {
  let settings = await prisma.currencySetting.findFirst();
  if (!settings) settings = await prisma.currencySetting.create({ data: {} });
  return settings;
}

// Public: the customer site, Freight POS screen, and Quote page all need the live rate
// to convert between JMD and USD, so this is unauthenticated.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await getOrCreateCurrencySettings();
    res.json(settings);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Both rates are independent — jmdPerUsd and usdPerJmd are not derived from each
// other, so either can be updated on its own (or both together in one request).
router.put('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { jmdPerUsd, usdPerJmd } = req.body;
    const data: Record<string, number> = {};
    if (jmdPerUsd !== undefined) {
      if (!jmdPerUsd || jmdPerUsd <= 0) return res.status(400).json({ error: 'jmdPerUsd must be a positive number' });
      data.jmdPerUsd = jmdPerUsd;
    }
    if (usdPerJmd !== undefined) {
      if (!usdPerJmd || usdPerJmd <= 0) return res.status(400).json({ error: 'usdPerJmd must be a positive number' });
      data.usdPerJmd = usdPerJmd;
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No rate provided' });
    const existing = await getOrCreateCurrencySettings();
    const updated = await prisma.currencySetting.update({ where: { id: existing.id }, data });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
