import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

async function userCountFor(roleName: string) {
  if (roleName === 'Customer') {
    return prisma.user.count({ where: { role: 'CUSTOMER' } });
  }
  return prisma.user.count({ where: { userType: roleName } });
}

// Admin: list roles with live user counts
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const where: any = {};
    if (q.search) where.name = { contains: q.search };

    const roles = await prisma.role.findMany({ where, orderBy: { createdAt: 'asc' } });
    const shaped = await Promise.all((roles as any[]).map(async (r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      updatedAt: r.updatedAt,
      userCount: await userCountFor(r.name),
    })));

    res.json({ roles: shaped, total: shaped.length });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create role
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const role = await prisma.role.create({ data: { name, description } });
    res.status(201).json(role);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'A role with that name already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update role
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const role = await prisma.role.update({ where: { id: req.params.id }, data: { name, description } });
    res.json(role);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete role (blocked while users are still assigned to it)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const role = await prisma.role.findUnique({ where: { id: req.params.id } });
    if (!role) return res.status(404).json({ error: 'Role not found' });
    const count = await userCountFor(role.name);
    if (count > 0) return res.status(400).json({ error: `Cannot delete — ${count} user(s) still have this role` });
    await prisma.role.delete({ where: { id: req.params.id } });
    res.json({ message: 'Role removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
