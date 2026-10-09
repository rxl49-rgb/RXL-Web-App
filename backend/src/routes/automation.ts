import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { runAllAutomationReminders } from '../jobs/automationReminders';

const router = Router();

async function getOrCreateSettings() {
  let settings = await prisma.automationSetting.findFirst();
  if (!settings) settings = await prisma.automationSetting.create({ data: {} });
  return settings;
}

router.get('/', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { outstandingEnabled, outstandingReminderDays, storageFeeEnabled, storageFeeDays } = req.body;
    const existing = await getOrCreateSettings();
    const updated = await prisma.automationSetting.update({
      where: { id: existing.id },
      data: { outstandingEnabled, outstandingReminderDays, storageFeeEnabled, storageFeeDays },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Manual trigger — lets an admin fire the daily job immediately instead of waiting for
// the 8am cron tick, mainly useful for testing SMTP setup and reminder wording.
router.post('/run-now', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await runAllAutomationReminders();
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
