import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { getOrCreateCurrencySettings } from './currency';

const router = Router();

function dateRange(q: Record<string, string>) {
  const range: any = {};
  if (q.dateFrom) range.gte = new Date(q.dateFrom);
  if (q.dateTo) range.lte = new Date(new Date(q.dateTo).setHours(23, 59, 59, 999));
  return Object.keys(range).length ? range : undefined;
}

// Admin: Transaction Report — every payment recorded within a date range ("End of day" view)
router.get('/transactions', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const where: any = {};
    const range = dateRange(q);
    if (range) where.createdAt = range;
    if (q.pickupLocation && q.pickupLocation !== 'ALL') where.shipment = { pickupLocation: q.pickupLocation };

    let payments = await prisma.payment.findMany({
      where,
      include: {
        shipment: {
          include: { user: { select: { name: true, email: true } }, batch: { select: { batchNumber: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (q.search) {
      const s = q.search.toLowerCase();
      payments = (payments as any[]).filter((p: any) =>
        p.shipment?.user?.name?.toLowerCase().includes(s) ||
        p.referenceNumber?.toLowerCase().includes(s) ||
        p.shipment?.batch?.batchNumber?.toLowerCase().includes(s)
      );
    }

    const rows = (payments as any[]).map((p: any) => ({
      id: p.id,
      customerName: p.shipment?.user?.name || 'Unassigned',
      batchLabel: p.shipment?.batch?.batchNumber || null,
      itemCount: p.shipment?.itemCount || 1,
      paymentType: p.paymentType,
      referenceNumber: p.referenceNumber || '',
      comment: p.comment || '',
      date: p.createdAt,
      totalCharges: p.shipment?.totalUSD || 0,
      amountPaid: p.amount,
      amountOwed: Math.max(0, (p.shipment?.totalUSD || 0) - (p.shipment?.amountPaid || 0)),
    }));

    const totals = rows.reduce((acc, r) => ({
      items: acc.items + r.itemCount,
      totalCharges: acc.totalCharges + r.totalCharges,
      amountPaid: acc.amountPaid + r.amountPaid,
      amountOwed: acc.amountOwed + r.amountOwed,
    }), { items: 0, totalCharges: 0, amountPaid: 0, amountOwed: 0 });

    res.json({ rows, totals });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Outstanding Payment Report — items already picked up (delivered) with a balance owed
router.get('/outstanding', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const where: any = { status: 'DELIVERED' };
    const range = dateRange(q);
    if (range) where.createdAt = range;
    if (q.pickupLocation && q.pickupLocation !== 'ALL') where.pickupLocation = q.pickupLocation;

    let shipments = await prisma.shipment.findMany({
      where,
      include: { user: { select: { name: true, email: true, phone: true } }, batch: { select: { batchNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });

    shipments = (shipments as any[]).filter((s: any) => s.amountPaid < s.totalUSD);

    if (q.search) {
      const s = q.search.toLowerCase();
      shipments = (shipments as any[]).filter((sh: any) => sh.user?.name?.toLowerCase().includes(s) || sh.user?.email?.toLowerCase().includes(s));
    }

    const rows = (shipments as any[]).map((s: any) => ({
      id: s.id,
      customerName: s.user?.name || 'Unassigned',
      batchLabel: s.batch?.batchNumber || null,
      itemCount: s.itemCount,
      email: s.user?.email || '',
      phone: s.user?.phone || '',
      totalCharges: s.totalUSD,
      amountPaid: s.amountPaid,
      amountOwed: Math.max(0, s.totalUSD - s.amountPaid),
    }));

    const totals = rows.reduce((acc, r) => ({
      items: acc.items + r.itemCount,
      totalCharges: acc.totalCharges + r.totalCharges,
      amountPaid: acc.amountPaid + r.amountPaid,
      amountOwed: acc.amountOwed + r.amountOwed,
    }), { items: 0, totalCharges: 0, amountPaid: 0, amountOwed: 0 });

    res.json({ rows, totals });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Outstanding Payment Report By Batch — same as above, scoped to one batch
router.get('/outstanding-by-batch', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    if (!q.batchId) return res.json({ rows: [], totals: { items: 0, totalCharges: 0, amountPaid: 0, amountOwed: 0 } });

    let shipments = await prisma.shipment.findMany({
      where: { status: 'DELIVERED', batchId: q.batchId },
      include: { user: { select: { name: true, email: true, phone: true } }, batch: { select: { batchNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });

    shipments = (shipments as any[]).filter((s: any) => s.amountPaid < s.totalUSD);

    if (q.search) {
      const s = q.search.toLowerCase();
      shipments = (shipments as any[]).filter((sh: any) => sh.user?.name?.toLowerCase().includes(s) || sh.user?.email?.toLowerCase().includes(s));
    }

    const rows = (shipments as any[]).map((s: any) => ({
      id: s.id,
      customerName: s.user?.name || 'Unassigned',
      batchLabel: s.batch?.batchNumber || null,
      itemCount: s.itemCount,
      email: s.user?.email || '',
      phone: s.user?.phone || '',
      totalCharges: s.totalUSD,
      amountPaid: s.amountPaid,
      amountOwed: Math.max(0, s.totalUSD - s.amountPaid),
    }));

    const totals = rows.reduce((acc, r) => ({
      items: acc.items + r.itemCount,
      totalCharges: acc.totalCharges + r.totalCharges,
      amountPaid: acc.amountPaid + r.amountPaid,
      amountOwed: acc.amountOwed + r.amountOwed,
    }), { items: 0, totalCharges: 0, amountPaid: 0, amountOwed: 0 });

    res.json({ rows, totals });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Profit & Loss — freight/shipping revenue (Payments) + other income vs. expenses,
// both pulled from the Biz Journal ledger. JMD entries are converted to USD using the
// independently-set JMD->USD rate (Pricing Presets > Exchange Rate) so everything nets
// out in one currency.
router.get('/profit-loss', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const range = dateRange(q);
    const { jmdPerUsd, usdPerJmd } = await getOrCreateCurrencySettings();
    const toUSD = (amount: number, currency: string) => (currency === 'JMD' ? amount * usdPerJmd : amount);

    const paymentWhere: any = {};
    if (range) paymentWhere.createdAt = range;

    const journalWhere: any = { voided: false };
    if (range) journalWhere.createdAt = range;

    const [payments, journalEntries] = await Promise.all([
      prisma.payment.findMany({ where: paymentWhere }),
      prisma.bizJournalEntry.findMany({ where: journalWhere, orderBy: { createdAt: 'desc' } }),
    ]);

    const freightRevenue = payments.reduce((s, p) => s + p.amount, 0);

    const incomeEntries = journalEntries.filter(e => e.entryType === 'INCOME');
    const expenseEntries = journalEntries.filter(e => e.entryType === 'EXPENSE');

    const otherIncome = incomeEntries.reduce((s, e) => s + toUSD(e.amount, e.currency), 0);
    const totalExpenses = expenseEntries.reduce((s, e) => s + toUSD(e.amount, e.currency), 0);

    // Group expenses by title so the report reads like a P&L statement (Rent, Salaries, Supplies, ...)
    const expenseByCategory: Record<string, number> = {};
    for (const e of expenseEntries) {
      expenseByCategory[e.title] = (expenseByCategory[e.title] || 0) + toUSD(e.amount, e.currency);
    }

    const totalIncome = freightRevenue + otherIncome;
    const netProfit = totalIncome - totalExpenses;

    res.json({
      freightRevenue,
      otherIncome,
      totalIncome,
      totalExpenses,
      netProfit,
      expenseByCategory: Object.entries(expenseByCategory)
        .map(([title, amount]) => ({ title, amount }))
        .sort((a, b) => b.amount - a.amount),
      incomeEntries: incomeEntries.map(e => ({ id: e.id, title: e.title, currency: e.currency, amount: e.amount, amountUSD: toUSD(e.amount, e.currency), createdAt: e.createdAt })),
      expenseEntries: expenseEntries.map(e => ({ id: e.id, title: e.title, currency: e.currency, amount: e.amount, amountUSD: toUSD(e.amount, e.currency), createdAt: e.createdAt })),
      jmdPerUsd,
      usdPerJmd,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
