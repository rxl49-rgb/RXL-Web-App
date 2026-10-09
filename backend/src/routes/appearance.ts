import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

async function getOrCreateSettings() {
  let settings = await prisma.appearanceSetting.findFirst();
  if (!settings) {
    settings = await prisma.appearanceSetting.create({ data: {} });
  }
  return settings;
}

// Public: anyone loading the site (customer or admin) needs these values to paint the theme
router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update the theme colors
router.put('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { menuBarColor, buttonColor, headingTextColor, bodyTextColor, paneColor, pageBackgroundColor, requirePasswordOnDelete } = req.body;
    const existing = await getOrCreateSettings();
    const updated = await prisma.appearanceSetting.update({
      where: { id: existing.id },
      data: { menuBarColor, buttonColor, headingTextColor, bodyTextColor, paneColor, pageBackgroundColor, requirePasswordOnDelete },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
