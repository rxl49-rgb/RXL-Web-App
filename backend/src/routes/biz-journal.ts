import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

function buildWhere(query: Record<string, string>) {
  const { entryType, currency, dateFrom, dateTo, search } = query;
  const where: any = {};
  if (entryType && entryType !== 'ALL') where.entryType = entryType;
  if (currency && currency !== 'ALL') where.currency = currency;
  if (search) where.title = { contains: search };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }
  return where;
}

// Admin: list transactions
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const where = buildWhere(req.query as Record<string, string>);
    const entries = await prisma.bizJournalEntry.findMany({
      where,
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(entries);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: this month's income/expense totals, per currency (no FX conversion — literal per-currency sums)
router.get('/summary', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const entries = await prisma.bizJournalEntry.findMany({
      where: { voided: false, createdAt: { gte: monthStart } },
    });

    const sum = (entryType: string, currency: string) =>
      (entries as any[]).filter((e: any) => e.entryType === entryType && e.currency === currency).reduce((s: number, e: any) => s + e.amount, 0);

    res.json({
      income: { JMD: sum('INCOME', 'JMD'), USD: sum('INCOME', 'USD') },
      expense: { JMD: sum('EXPENSE', 'JMD'), USD: sum('EXPENSE', 'USD') },
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: export as CSV
router.get('/export', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const where = buildWhere(req.query as Record<string, string>);
    const entries = await prisma.bizJournalEntry.findMany({ where, include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: 'asc' } });
    const headers = ['Title', 'Type', 'Currency', 'Payment Type', 'Amount', 'Created By', 'Last Update', 'Voided'];
    const rows = (entries as any[]).map((e: any) => [e.title, e.entryType, e.currency, e.paymentType, String(e.amount), e.createdBy?.name || '', new Date(e.updatedAt).toISOString(), e.voided ? 'Yes' : 'No']);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="biz-journal.csv"');
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create transaction
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, entryType, currency, paymentType, amount, notes } = req.body;
    if (!title || !entryType || !amount) return res.status(400).json({ error: 'Title, type and amount are required' });
    if (!['INCOME', 'EXPENSE'].includes(entryType)) return res.status(400).json({ error: 'Invalid entry type' });

    const entry = await prisma.bizJournalEntry.create({
      data: {
        title,
        entryType,
        currency: currency || 'JMD',
        paymentType: paymentType || 'Cash',
        amount: parseFloat(amount),
        notes: notes || undefined,
        createdById: req.user!.id,
      },
      include: { createdBy: { select: { name: true } } },
    });
    res.status(201).json(entry);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update transaction
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, entryType, currency, paymentType, amount, notes } = req.body;
    const entry = await prisma.bizJournalEntry.update({
      where: { id: req.params.id },
      data: {
        title,
        entryType,
        currency,
        paymentType,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        notes,
      },
      include: { createdBy: { select: { name: true } } },
    });
    res.json(entry);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: void/restore a transaction (soft — kept for the record, excluded from totals while voided)
router.patch('/:id/void', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { voided } = req.body;
    const entry = await prisma.bizJournalEntry.update({
      where: { id: req.params.id },
      data: { voided: voided !== undefined ? !!voided : true },
      include: { createdBy: { select: { name: true } } },
    });
    res.json(entry);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
