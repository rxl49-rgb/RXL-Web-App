import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

interface ExpenseLine { label: string; amount: number }

function parseExpenses(json: string): ExpenseLine[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function serialize(batch: { id: string; label: string; month: string; revenue: number; collectedAmount: number; expensesJson: string; createdAt: Date; updatedAt: Date }) {
  const expenses = parseExpenses(batch.expensesJson);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  return {
    id: batch.id,
    label: batch.label,
    month: batch.month,
    revenue: batch.revenue,
    collectedAmount: batch.collectedAmount,
    expenses,
    totalExpenses,
    profit: batch.revenue - totalExpenses,
    outstanding: Math.max(0, batch.revenue - batch.collectedAmount),
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

// Admin: list revenue batches, optionally filtered by month ("YYYY-MM")
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query as Record<string, string>;
    const where: any = {};
    if (month) where.month = month;
    const batches = await prisma.revenueBatch.findMany({ where, orderBy: [{ month: 'desc' }, { createdAt: 'desc' }] });
    res.json(batches.map(serialize));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: aggregated stats + breakdown by month across all batches
router.get('/monthly-totals', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const batches = await prisma.revenueBatch.findMany();
    const serialized = batches.map(serialize);

    const byMonth = new Map<string, { month: string; batchCount: number; revenue: number; collectedAmount: number; totalExpenses: number; profit: number; outstanding: number }>();
    for (const b of serialized) {
      const existing = byMonth.get(b.month) || { month: b.month, batchCount: 0, revenue: 0, collectedAmount: 0, totalExpenses: 0, profit: 0, outstanding: 0 };
      existing.batchCount += 1;
      existing.revenue += b.revenue;
      existing.collectedAmount += b.collectedAmount;
      existing.totalExpenses += b.totalExpenses;
      existing.profit += b.profit;
      existing.outstanding += b.outstanding;
      byMonth.set(b.month, existing);
    }

    const months = Array.from(byMonth.values()).sort((a, b) => b.month.localeCompare(a.month));
    type Totals = { batchCount: number; revenue: number; collectedAmount: number; totalExpenses: number; profit: number; outstanding: number };
    const overall: Totals = serialized.reduce(
      (acc: Totals, b: ReturnType<typeof serialize>): Totals => ({
        batchCount: acc.batchCount + 1,
        revenue: acc.revenue + b.revenue,
        collectedAmount: acc.collectedAmount + b.collectedAmount,
        totalExpenses: acc.totalExpenses + b.totalExpenses,
        profit: acc.profit + b.profit,
        outstanding: acc.outstanding + b.outstanding,
      }),
      { batchCount: 0, revenue: 0, collectedAmount: 0, totalExpenses: 0, profit: 0, outstanding: 0 }
    );

    res.json({ months, overall });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create revenue batch
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { label, month, revenue, collectedAmount, expenses } = req.body as {
      label: string; month: string; revenue: number; collectedAmount: number; expenses?: ExpenseLine[];
    };
    if (!label || !month) return res.status(400).json({ error: 'Label and month are required' });
    const batch = await prisma.revenueBatch.create({
      data: {
        label,
        month,
        revenue: revenue || 0,
        collectedAmount: collectedAmount || 0,
        expensesJson: JSON.stringify(expenses || []),
      },
    });
    res.status(201).json(serialize(batch));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update revenue batch
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { label, month, revenue, collectedAmount, expenses } = req.body as {
      label: string; month: string; revenue: number; collectedAmount: number; expenses?: ExpenseLine[];
    };
    const batch = await prisma.revenueBatch.update({
      where: { id: req.params.id },
      data: {
        label,
        month,
        revenue: revenue || 0,
        collectedAmount: collectedAmount || 0,
        expensesJson: JSON.stringify(expenses || []),
      },
    });
    res.json(serialize(batch));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete revenue batch
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.revenueBatch.delete({ where: { id: req.params.id } });
    res.json({ message: 'Batch removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Reusable custom expense labels (Profit & Loss > Expense Labels) ---

router.get('/expense-labels', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const labels = await prisma.revenueExpenseLabel.findMany({ orderBy: { label: 'asc' } });
    res.json(labels);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/expense-labels', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { label } = req.body as { label: string };
    if (!label || !label.trim()) return res.status(400).json({ error: 'Label is required' });
    const created = await prisma.revenueExpenseLabel.create({ data: { label: label.trim() } });
    res.status(201).json(created);
  } catch {
    res.status(400).json({ error: 'That label already exists' });
  }
});

router.delete('/expense-labels/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.revenueExpenseLabel.delete({ where: { id: req.params.id } });
    res.json({ message: 'Label removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
