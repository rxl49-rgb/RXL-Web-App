import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const DEFAULT_SHIPPING_INSTRUCTIONS = `## Shipping Instructions

**Please read!**

For orders being shipped directly from online or physical stores only.
Failure to follow will result in a penalty or goods being held at Miami warehouse.

To process shipments handled by friends or family, please contact us at **876-363-6208**
or email [info@rxllogistics.com](mailto:info@rxllogistics.com)

---

### For sending invoices:

Follow these steps to upload invoices:

1. Log in to our app
2. Click the current or desired shipment
3. Select the send invoice icon
4. Click the Add (+) button at the top right to upload invoices

**Website option:**

1. Log in to our website
2. Click the current or desired shipment
3. Click the Add (+) purchase invoice button
4. Click upload to submit invoices

---

### Air Shipment Options

1. Request air service through the mobile app
   OR add "AIR" to your name and customer number
   _(e.g., John Brown RXL12345 AIR)_

2. Before your shipment arrives, upload your tracking number:
   - Tap the plane icon
   - Tap (+)
   - Enter tracking number(s) and save

---

**Inquiries:** [info@rxllogistics.com](mailto:info@rxllogistics.com)
**Order Requests:** [info@rxllogistics.com](mailto:info@rxllogistics.com)

---

Once shipments arrive by Wednesday morning, they ship Friday and arrive the following week.
Wednesday is the weekly cutoff (subject to holidays).`;

async function ensureSeeded() {
  const count = await prisma.mobileInfoEntry.count();
  if (count === 0) {
    await prisma.mobileInfoEntry.create({
      data: { title: 'Shipping Instructions', message: DEFAULT_SHIPPING_INSTRUCTIONS, status: 'ACTIVE', updatedAt: new Date('2026-03-20T18:35:58') },
    });
  }
}

// Admin: list mobile info / policy entries
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureSeeded();
    const q = req.query as Record<string, string>;
    const where: any = {};
    if (q.search) {
      where.OR = [
        { title: { contains: q.search } },
        { message: { contains: q.search } },
      ];
    }
    const entries = await prisma.mobileInfoEntry.findMany({ where, orderBy: { updatedAt: 'desc' } });
    res.json({ entries, total: entries.length });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create entry
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, status } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });
    const entry = await prisma.mobileInfoEntry.create({ data: { title, message, status: status || 'ACTIVE' } });
    res.status(201).json(entry);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update entry
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, status } = req.body;
    const entry = await prisma.mobileInfoEntry.update({ where: { id: req.params.id }, data: { title, message, status } });
    res.json(entry);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete entry
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.mobileInfoEntry.delete({ where: { id: req.params.id } });
    res.json({ message: 'Entry removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
