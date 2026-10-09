import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const AD_IMAGE_DIR = path.join(UPLOAD_ROOT, 'advertisements');
fs.mkdirSync(AD_IMAGE_DIR, { recursive: true });

const imageFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const ok = ['image/gif', 'image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype);
  cb(ok ? null : new Error('Photo must be .gif, .jpg, .jpeg or .png') as any, ok);
};

const uploadAdImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AD_IMAGE_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: imageFilter,
});

// Public: active advertisements for the storefront hero carousel — no auth required.
router.get('/active', async (_req: Request, res: Response) => {
  try {
    const advertisements = await prisma.advertisement.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    });
    res.json(advertisements);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list advertisements, paginated + searchable
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
    const advertisements = await prisma.advertisement.findMany({ where, orderBy: { updatedAt: 'desc' } });
    res.json({ advertisements, total: advertisements.length });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create advertisement
router.post('/', authenticate, requireAdmin, uploadAdImage.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, status } = req.body;
    const imageUrl = req.file ? `/uploads/advertisements/${req.file.filename}` : undefined;
    const ad = await prisma.advertisement.create({ data: { title, message, imageUrl, status: status || 'ACTIVE' } });
    res.status(201).json(ad);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create advertisement' });
  }
});

// Admin: update advertisement
router.put('/:id', authenticate, requireAdmin, uploadAdImage.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, status } = req.body;
    const data: any = { title, message, status };
    if (req.file) data.imageUrl = `/uploads/advertisements/${req.file.filename}`;
    const ad = await prisma.advertisement.update({ where: { id: req.params.id }, data });
    res.json(ad);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update advertisement' });
  }
});

// Admin: toggle active/inactive
router.patch('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.advertisement.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Advertisement not found' });
    const nextStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const ad = await prisma.advertisement.update({ where: { id: req.params.id }, data: { status: nextStatus } });
    res.json(ad);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete advertisement
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.advertisement.delete({ where: { id: req.params.id } });
    res.json({ message: 'Advertisement removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
