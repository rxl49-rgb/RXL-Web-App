import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const SAFE_SELECT = {
  id: true, name: true, email: true, phone: true, city: true, officeLocation: true,
  country: true, userType: true, status: true, lastActiveAt: true, createdAt: true,
};

function buildWhere(query: Record<string, string>) {
  const { search } = query;
  const where: any = { role: { not: 'CUSTOMER' } };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
      { userType: { contains: search } },
    ];
  }
  return where;
}

// Admin: list staff users (anyone whose role isn't the plain CUSTOMER role)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const where = buildWhere(req.query as Record<string, string>);
    const users = await prisma.user.findMany({ where, select: SAFE_SELECT, orderBy: { createdAt: 'asc' } });
    res.json({ users, total: users.length });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create a staff user
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, city, officeLocation, country, userType } = req.body;
    if (!name || !email || !userType) return res.status(400).json({ error: 'Name, email and user type are required' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const tempPassword = Math.random().toString(36).slice(-8) + 'Rx1!';
    const hashed = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: { name, email, phone, city, officeLocation, country, userType, password: hashed, role: 'ADMIN', status: 'ACTIVE' },
      select: SAFE_SELECT,
    });
    res.status(201).json({ user, tempPassword });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update a staff user
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, city, officeLocation, country, userType, status } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { name, phone, city, officeLocation, country, userType, status },
      select: SAFE_SELECT,
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: toggle active/suspended
router.patch('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'SUSPENDED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { status }, select: SAFE_SELECT });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
