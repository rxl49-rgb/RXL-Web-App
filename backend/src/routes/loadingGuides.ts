import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendMail } from '../lib/mailer';

const router = Router();

interface MeasurementRow {
  description: string;
  height: number;
  width: number;
  length: number;
  pieces: number;
}

// Cubic feet for ONE unit: (H x W x L in inches) / 1728, rounded to the nearest whole
// number — matches the paper Loading Guide's "Cubes" column.
function computeUnitCubes(row: { height?: number; width?: number; length?: number }): number {
  const h = Number(row.height) || 0;
  const w = Number(row.width) || 0;
  const l = Number(row.length) || 0;
  if (!h || !w || !l) return 0;
  return Math.round((h * w * l) / 1728);
}

function buildItems(rawItems: MeasurementRow[]) {
  const items = (rawItems || []).map(r => {
    const pieces = Math.max(1, Number(r.pieces) || 1);
    return {
      description: r.description || '',
      height: Number(r.height) || 0,
      width: Number(r.width) || 0,
      length: Number(r.length) || 0,
      pieces,
      // Row total cubic feet — unit cubes x how many identical pieces this row covers.
      cubes: computeUnitCubes(r) * pieces,
    };
  });
  const totalCubes = items.reduce((s, i) => s + i.cubes, 0);
  const totalPieces = items.reduce((s, i) => s + i.pieces, 0);
  return { items, totalCubes, totalPieces };
}

// Sequential DR# suggestion — continues from the existing paper book (RXL13207 was the
// most recent physical entry at the time this feature was built). Always editable in
// the form, so admins can override to match the physical book exactly.
async function nextDrNumber() {
  const count = await prisma.loadingGuide.count();
  return `RXL${13207 + count + 1}`;
}

router.get('/next-dr-number', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ drNumber: await nextDrNumber() });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const search = (req.query.search as string) || '';
    const where = search
      ? { OR: [{ drNumber: { contains: search } }, { consignee: { contains: search } }, { destination: { contains: search } }] }
      : {};
    const guides = await prisma.loadingGuide.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(guides);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const guide = await prisma.loadingGuide.findUnique({ where: { id: req.params.id } });
    if (!guide) return res.status(404).json({ error: 'Loading guide not found' });
    res.json(guide);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { drNumber, dropOffDate, destination, dropOffBy, consignee, description, items } = req.body;
    if (!dropOffDate) return res.status(400).json({ error: 'Drop off date is required' });
    if (!destination || !destination.trim()) return res.status(400).json({ error: 'Destination is required' });
    if (!consignee || !consignee.trim()) return res.status(400).json({ error: 'Consignee is required' });

    const { items: builtItems, totalCubes, totalPieces } = buildItems(items);
    const finalDrNumber = (drNumber && drNumber.trim()) || (await nextDrNumber());

    const guide = await prisma.loadingGuide.create({
      data: {
        drNumber: finalDrNumber,
        dropOffDate: new Date(dropOffDate),
        destination: destination.trim(),
        dropOffBy: (dropOffBy && dropOffBy.trim()) || 'RXL Logistics',
        consignee: consignee.trim(),
        description: description || '',
        items: JSON.stringify(builtItems),
        totalCubes,
        totalPieces,
      },
    });
    res.status(201).json(guide);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'A loading guide with that DR# already exists' });
    res.status(400).json({ error: err.message || 'Failed to create loading guide' });
  }
});

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { drNumber, dropOffDate, destination, dropOffBy, consignee, description, items } = req.body;
    const { items: builtItems, totalCubes, totalPieces } = buildItems(items);

    const guide = await prisma.loadingGuide.update({
      where: { id: req.params.id },
      data: {
        ...(drNumber !== undefined ? { drNumber: drNumber.trim() } : {}),
        ...(dropOffDate !== undefined ? { dropOffDate: new Date(dropOffDate) } : {}),
        ...(destination !== undefined ? { destination: destination.trim() } : {}),
        ...(dropOffBy !== undefined ? { dropOffBy: dropOffBy.trim() || 'RXL Logistics' } : {}),
        ...(consignee !== undefined ? { consignee: consignee.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        items: JSON.stringify(builtItems),
        totalCubes,
        totalPieces,
      },
    });
    res.json(guide);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'A loading guide with that DR# already exists' });
    res.status(400).json({ error: err.message || 'Failed to update loading guide' });
  }
});

// Admin: email the loading guide to a given address (destination shop, driver, etc.) —
// uses the shared mailer (lib/mailer.ts), which logs a simulated send if SMTP isn't
// configured yet rather than failing the request.
router.post('/:id/email', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { to } = req.body;
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    const guide = await prisma.loadingGuide.findUnique({ where: { id: req.params.id } });
    if (!guide) return res.status(404).json({ error: 'Loading guide not found' });

    const items = JSON.parse(guide.items || '[]') as { description: string; height: number; width: number; length: number; pieces: number; cubes: number }[];
    const itemLines = items.map(i => `  ${(i.description || '—').padEnd(14)} PC:${i.pieces ?? 1}  H:${i.height}  W:${i.width}  L:${i.length}  Cubes:${i.cubes}`).join('\n');

    const subject = `Loading Guide — ${guide.drNumber}`;
    const body =
      `RXL Logistics — Loading Guide\n\n` +
      `DR#: ${guide.drNumber}\n` +
      `Drop Off Date: ${new Date(guide.dropOffDate).toDateString()}\n` +
      `Destination: ${guide.destination}\n` +
      `Drop Off By: ${guide.dropOffBy}\n` +
      `Consignee: ${guide.consignee}\n` +
      `Description: ${guide.description || '—'}\n\n` +
      `Measurements:\n${itemLines || '  (none)'}\n\n` +
      `Total Pieces: ${guide.totalPieces}\n` +
      `Total Cubes: ${guide.totalCubes}\n\n` +
      `— RXL Logistics`;

    const result = await sendMail(to, subject, body);
    res.json({ ...result, email: to });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.loadingGuide.delete({ where: { id: req.params.id } });
    res.json({ message: 'Loading guide removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
