import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Admin: list bulletins, paginated + searchable
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const where: any = {};
    if (q.search) {
      where.OR = [
        { title: { contains: q.search } },
        { message: { contains: q.search } },
      ];
    }
    const bulletins = await prisma.bulletin.findMany({ where, orderBy: { updatedAt: 'desc' } });
    res.json({ bulletins, total: bulletins.length });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create bulletin
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, status } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });
    const bulletin = await prisma.bulletin.create({ data: { title, message, status: status || 'ACTIVE' } });
    res.status(201).json(bulletin);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update bulletin
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, status } = req.body;
    const bulletin = await prisma.bulletin.update({ where: { id: req.params.id }, data: { title, message, status } });
    res.json(bulletin);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: toggle active/inactive
router.patch('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.bulletin.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Bulletin not found' });
    const nextStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const bulletin = await prisma.bulletin.update({ where: { id: req.params.id }, data: { status: nextStatus } });
    res.json(bulletin);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete bulletin
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.bulletin.delete({ where: { id: req.params.id } });
    res.json({ message: 'Bulletin removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
