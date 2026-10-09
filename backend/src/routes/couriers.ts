import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const COURIER_LOGO_DIR = path.join(UPLOAD_ROOT, 'couriers');
fs.mkdirSync(COURIER_LOGO_DIR, { recursive: true });

const imageFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const ok = ['image/gif', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype);
  cb(ok ? null : new Error('Logo must be .gif, .jpg, .jpeg, .png or .webp') as any, ok);
};

const uploadCourierLogo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, COURIER_LOGO_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: imageFilter,
});

// Public: list couriers — used site-wide (admin + customer pages) to look up a courier's
// logo by name when displaying tracking info. No auth required so the customer-facing
// Shipment Details / Track pages can render logos too.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const couriers = await prisma.courier.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    res.json(couriers);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list ALL couriers (including inactive) for the management screen.
router.get('/admin/all', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const couriers = await prisma.courier.findMany({ orderBy: { name: 'asc' } });
    res.json(couriers);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create courier
router.post('/', authenticate, requireAdmin, uploadCourierLogo.single('logo'), async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Courier name is required' });
    const logoUrl = req.file ? `/uploads/couriers/${req.file.filename}` : undefined;
    const courier = await prisma.courier.create({ data: { name: name.trim(), logoUrl } });
    res.status(201).json(courier);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'A courier with that name already exists' });
    res.status(400).json({ error: err.message || 'Failed to create courier' });
  }
});

// Admin: update courier (name and/or logo)
router.put('/:id', authenticate, requireAdmin, uploadCourierLogo.single('logo'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, active } = req.body;
    const data: any = {};
    if (name !== undefined && name.trim()) data.name = name.trim();
    if (active !== undefined) data.active = active === 'true' || active === true;
    if (req.file) data.logoUrl = `/uploads/couriers/${req.file.filename}`;
    const courier = await prisma.courier.update({ where: { id: req.params.id }, data });
    res.json(courier);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'A courier with that name already exists' });
    res.status(400).json({ error: err.message || 'Failed to update courier' });
  }
});

// Admin: toggle active/inactive
router.patch('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.courier.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Courier not found' });
    const courier = await prisma.courier.update({ where: { id: req.params.id }, data: { active: !existing.active } });
    res.json(courier);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete courier
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.courier.delete({ where: { id: req.params.id } });
    res.json({ message: 'Courier removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
