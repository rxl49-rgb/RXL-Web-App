import { Router, Response } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1 * 1024 * 1024 } });

function buildWhere(query: Record<string, string>) {
  const { search, dateFrom, dateTo, status } = query;
  const where: any = {};
  if (search) {
    where.batchNumber = { contains: search };
  }
  if (status && status !== 'ALL') where.status = status;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }
  return where;
}

async function nextBatchNumber() {
  const count = await prisma.batch.count();
  const today = new Date();
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  return `BATCH_${stamp}_${count + 1}`;
}

// Admin: list batches (paginated, searchable, date range)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const page = parseInt(q.page || '1');
    const limit = parseInt(q.limit || '10');
    const where = buildWhere(q);

    const [batches, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        include: { shipments: { select: { itemCount: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.batch.count({ where }),
    ]);

    const shaped = (batches as any[]).map((b: any) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      pickupLocation: b.pickupLocation,
      status: b.status,
      createdAt: b.createdAt,
      totalItems: b.shipments.reduce((s: number, sh: any) => s + sh.itemCount, 0),
    }));

    res.json({ batches: shaped, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: export batches as CSV
router.get('/export', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const where = buildWhere(req.query as Record<string, string>);
    const batches = await prisma.batch.findMany({ where, include: { shipments: { select: { itemCount: true } } }, orderBy: { createdAt: 'desc' } });
    const headers = ['Batch Number', 'Total Items', 'Date Created', 'Status'];
    const rows = (batches as any[]).map((b: any) => [b.batchNumber, String(b.shipments.reduce((s: number, sh: any) => s + sh.itemCount, 0)), new Date(b.createdAt).toISOString(), b.status]);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="batches.csv"');
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create an empty batch
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { batchNumber, pickupLocation } = req.body;
    const batch = await prisma.batch.create({
      data: {
        batchNumber: batchNumber || (await nextBatchNumber()),
        pickupLocation: pickupLocation || undefined,
      },
    });
    res.status(201).json(batch);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'That batch number already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: batch detail — shipments grouped by customer
router.get('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: req.params.id },
      include: {
        shipments: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, aliasName: true, address: true, city: true, country: true } },
            items: true,
            batch: { select: { id: true, batchNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json(batch);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Batch Tally — flat list of every tracking number expected in this batch
// (one entry per ShipmentItem if the shipment has structured items, else one entry
// for the shipment's own legacy trackingNumber), each with its tallied status. Used
// by the Tally screen to show scan progress against a chosen batch.
router.get('/:id/tally', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: req.params.id },
      include: {
        shipments: {
          include: {
            user: { select: { name: true } },
            items: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const entries: any[] = [];
    for (const s of batch.shipments as any[]) {
      if (s.items.length > 0) {
        for (const item of s.items) {
          if (!item.trackingNumber) continue;
          entries.push({
            key: `item:${item.id}`,
            trackingNumber: item.trackingNumber,
            courier: item.courier || null,
            customerName: s.user?.name || 'Unassigned',
            shipmentTrackingNumber: s.trackingNumber,
            tallied: item.tallied,
            talliedAt: item.talliedAt,
          });
        }
      } else if (s.trackingNumber) {
        entries.push({
          key: `shipment:${s.id}`,
          trackingNumber: s.trackingNumber,
          courier: s.courierInfo || null,
          customerName: s.user?.name || 'Unassigned',
          shipmentTrackingNumber: s.trackingNumber,
          tallied: s.tallied,
          talliedAt: s.talliedAt,
        });
      }
    }

    const talliedCount = entries.filter(e => e.tallied).length;
    res.json({ batchId: batch.id, batchNumber: batch.batchNumber, entries, talliedCount, totalCount: entries.length });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Batch Tally — scan/enter one tracking number. Marks it tallied if it belongs
// to this batch and isn't already tallied; reports back which case happened so the
// scan UI can give clear match / duplicate / not-in-batch feedback.
router.post('/:id/tally/scan', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const raw = (req.body?.trackingNumber || '').trim();
    if (!raw) return res.status(400).json({ error: 'No tracking number provided' });

    const batch = await prisma.batch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    // Match against ShipmentItem rows in this batch first (structured tracking#s),
    // then fall back to a shipment's own legacy trackingNumber.
    const item = await prisma.shipmentItem.findFirst({
      where: { trackingNumber: raw, shipment: { batchId: batch.id } },
      include: { shipment: { include: { user: { select: { name: true } } } } },
    });

    if (item) {
      if (item.tallied) {
        return res.json({ result: 'duplicate', trackingNumber: raw, customerName: (item as any).shipment.user?.name || 'Unassigned' });
      }
      await prisma.shipmentItem.update({ where: { id: item.id }, data: { tallied: true, talliedAt: new Date() } });
      return res.json({ result: 'matched', trackingNumber: raw, customerName: (item as any).shipment.user?.name || 'Unassigned' });
    }

    const shipment = await prisma.shipment.findFirst({
      where: { trackingNumber: raw, batchId: batch.id },
      include: { user: { select: { name: true } } },
    });

    if (shipment) {
      if (shipment.tallied) {
        return res.json({ result: 'duplicate', trackingNumber: raw, customerName: shipment.user?.name || 'Unassigned' });
      }
      await prisma.shipment.update({ where: { id: shipment.id }, data: { tallied: true, talliedAt: new Date() } });
      return res.json({ result: 'matched', trackingNumber: raw, customerName: shipment.user?.name || 'Unassigned' });
    }

    res.json({ result: 'not_found', trackingNumber: raw });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Batch Tally — reset all tallied flags for this batch (start the count over).
router.post('/:id/tally/reset', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.shipmentItem.updateMany({ where: { shipment: { batchId: req.params.id } }, data: { tallied: false, talliedAt: null } });
    await prisma.shipment.updateMany({ where: { batchId: req.params.id }, data: { tallied: false, talliedAt: null } });
    res.json({ message: 'Tally reset' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update batch status (cascades to all shipments in the batch)
router.patch('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const batch = await prisma.batch.update({ where: { id: req.params.id }, data: { status } });
    await prisma.shipment.updateMany({ where: { batchId: req.params.id }, data: { status } });
    res.json(batch);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: import freight data — CSV of tracking numbers, attaches existing shipments to this batch
router.post('/:id/import', authenticate, requireAdmin, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const batch = await prisma.batch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

    const text = req.file.buffer.toString('utf-8');
    const trackingNumbers = text
      .split(/\r?\n/)
      .map(l => l.split(',')[0]?.trim())
      .filter(l => l && l.toLowerCase() !== 'tracking number' && l.toLowerCase() !== 'trackingnumber');

    let matched = 0;
    const unmatched: string[] = [];
    for (const tn of trackingNumbers) {
      const shipment = await prisma.shipment.findUnique({ where: { trackingNumber: tn } });
      if (shipment) {
        await prisma.shipment.update({ where: { id: shipment.id }, data: { batchId: batch.id } });
        matched++;
      } else {
        unmatched.push(tn);
      }
    }

    res.json({ matched, unmatched });
  } catch {
    res.status(400).json({ error: 'Import failed' });
  }
});

// Admin: notify all customers with shipments in this batch (simulated — no email/SMS provider wired up yet)
router.post('/:id/notify', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, message } = req.body;
    const shipments = await prisma.shipment.findMany({
      where: { batchId: req.params.id, userId: { not: null } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const seen = new Set<string>();
    const recipients = shipments
      .map(s => s.user)
      .filter((u): u is NonNullable<typeof u> => !!u && !seen.has(u.id) && !!seen.add(u.id));

    // NOTE: no email/SMS provider is wired up in this project yet — this simulates the send.
    res.json({ simulated: true, recipientCount: recipients.length, recipients, subject, message });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: remove a batch (shipments are detached, not deleted)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.shipment.updateMany({ where: { batchId: req.params.id }, data: { batchId: null } });
    await prisma.batch.delete({ where: { id: req.params.id } });
    res.json({ message: 'Batch removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
