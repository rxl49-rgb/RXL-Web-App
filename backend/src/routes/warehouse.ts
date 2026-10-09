import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

function buildWhere(query: Record<string, string>) {
  const { search, dateFrom, dateTo } = query;
  const where: any = {};
  if (search) where.label = { contains: search };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }
  return where;
}

// Admin: list warehouse receipts (paginated, date range + search)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const page = parseInt(q.page || '1');
    const limit = parseInt(q.limit || '10');
    const where = buildWhere(q);

    const [receipts, total] = await Promise.all([
      prisma.warehouseReceipt.findMany({
        where,
        include: { batch: { select: { id: true, batchNumber: true } }, items: { select: { id: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.warehouseReceipt.count({ where }),
    ]);

    const shaped = (receipts as any[]).map((r: any) => ({
      id: r.id,
      label: r.label,
      totalItemsScanned: r.items.length,
      createdAt: r.createdAt,
      batch: r.batch,
    }));

    res.json({ receipts: shaped, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: export receipts as CSV
router.get('/export', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const where = buildWhere(req.query as Record<string, string>);
    const receipts = await prisma.warehouseReceipt.findMany({ where, include: { batch: { select: { batchNumber: true } }, items: { select: { id: true } } }, orderBy: { createdAt: 'desc' } });
    const headers = ['Bill Receipt Number', 'Total Items Scanned', 'Date Created', 'Assigned To'];
    const rows = (receipts as any[]).map((r: any) => [r.label, String(r.items.length), new Date(r.createdAt).toISOString(), r.batch?.batchNumber || '']);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="warehouse-receipts.csv"');
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: receipt detail — scanned items
router.get('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const receipt = await prisma.warehouseReceipt.findUnique({
      where: { id: req.params.id },
      include: { batch: { select: { id: true, batchNumber: true } }, items: { orderBy: { dateReceived: 'desc' } } },
    });
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    res.json(receipt);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: assign or unassign a receipt to/from a batch
router.patch('/:id/assign-batch', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { batchId } = req.body;
    const receipt = await prisma.warehouseReceipt.update({
      where: { id: req.params.id },
      data: { batchId: batchId || null },
      include: { batch: { select: { id: true, batchNumber: true } } },
    });
    res.json(receipt);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: remove a receipt (and its scanned items)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.warehouseScanItem.deleteMany({ where: { receiptId: req.params.id } });
    await prisma.warehouseReceipt.delete({ where: { id: req.params.id } });
    res.json({ message: 'Receipt removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: remove a single scanned item from a receipt
router.delete('/:id/items/:itemId', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.warehouseScanItem.delete({ where: { id: req.params.itemId } });
    res.json({ message: 'Item removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
