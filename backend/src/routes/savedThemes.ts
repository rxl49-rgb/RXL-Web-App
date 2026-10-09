import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Admin: list all saved web design themes (built-in + custom), newest last so
// the original built-ins stay first in the picker grid.
router.get('/', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const themes = await prisma.savedTheme.findMany({ orderBy: { createdAt: 'asc' } });
    res.json(themes);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: save the currently-active (or any) color combination as a new named theme.
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, menuBarColor, buttonColor, headingTextColor, bodyTextColor, paneColor, pageBackgroundColor } = req.body as {
      name: string; menuBarColor: string; buttonColor: string; headingTextColor: string; bodyTextColor: string; paneColor: string; pageBackgroundColor?: string;
    };
    if (!name || !name.trim()) return res.status(400).json({ error: 'Theme name is required' });
    const theme = await prisma.savedTheme.create({
      data: {
        name: name.trim(),
        menuBarColor, buttonColor, headingTextColor, bodyTextColor, paneColor,
        pageBackgroundColor: pageBackgroundColor || '#ffffff',
      },
    });
    res.status(201).json(theme);
  } catch {
    res.status(400).json({ error: 'A theme with that name already exists' });
  }
});

// Admin: remove a saved theme (does not affect whatever colors are currently active).
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.savedTheme.delete({ where: { id: req.params.id } });
    res.json({ message: 'Theme removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
