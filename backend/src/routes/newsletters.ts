import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendMail } from '../lib/mailer';
import { generateNewsletter } from '../lib/ai';

const router = Router();

// Rough HTML -> plain-text fallback for the email's text/plain part (some inboxes /
// spam filters prefer a message that has one). Not meant to be pixel-perfect.
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/(div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Admin: AI-assisted draft generation — given a short topic/instruction, returns a
// suggested subject + HTML body the admin can review, tweak and save. Requires
// ANTHROPIC_API_KEY in the backend .env; returns 503 with a clear message if unset.
router.post('/generate', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Describe what the email should say' });

    const result = await generateNewsletter(prompt.trim());
    if (!result) {
      return res.status(503).json({ error: 'AI generation is not configured — add ANTHROPIC_API_KEY to the backend environment to enable this.' });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI generation failed' });
  }
});

router.get('/', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const newsletters = await prisma.newsletter.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(newsletters);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const newsletter = await prisma.newsletter.findUnique({ where: { id: req.params.id } });
    if (!newsletter) return res.status(404).json({ error: 'Newsletter not found' });
    res.json(newsletter);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, htmlContent } = req.body;
    if (!subject || !subject.trim()) return res.status(400).json({ error: 'Subject is required' });
    const newsletter = await prisma.newsletter.create({
      data: { subject: subject.trim(), htmlContent: htmlContent || '' },
    });
    res.status(201).json(newsletter);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create newsletter' });
  }
});

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, htmlContent } = req.body;
    const newsletter = await prisma.newsletter.update({
      where: { id: req.params.id },
      data: {
        ...(subject !== undefined ? { subject: subject.trim() } : {}),
        ...(htmlContent !== undefined ? { htmlContent } : {}),
      },
    });
    res.json(newsletter);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update newsletter' });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.newsletter.delete({ where: { id: req.params.id } });
    res.json({ message: 'Newsletter removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: send a single test copy — lets the admin see exactly what customers will
// receive before blasting the full list. Doesn't touch status/recipientCount.
router.post('/:id/send-test', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { to } = req.body;
    if (!to || !isValidEmail(to)) return res.status(400).json({ error: 'A valid email address is required' });
    const newsletter = await prisma.newsletter.findUnique({ where: { id: req.params.id } });
    if (!newsletter) return res.status(404).json({ error: 'Newsletter not found' });

    const result = await sendMail(to, `[TEST] ${newsletter.subject}`, stripHtml(newsletter.htmlContent), newsletter.htmlContent);
    res.json({ ...result, email: to });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: send to every active customer on file. Sequential sends (matches the pattern
// used by the automation reminder jobs) — fine at this app's current customer volume;
// each send falls back to a simulated/logged send if SMTP isn't configured.
router.post('/:id/send', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const newsletter = await prisma.newsletter.findUnique({ where: { id: req.params.id } });
    if (!newsletter) return res.status(404).json({ error: 'Newsletter not found' });
    if (!newsletter.subject.trim()) return res.status(400).json({ error: 'Subject is required before sending' });
    if (!newsletter.htmlContent.trim()) return res.status(400).json({ error: 'Content is required before sending' });

    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER', status: 'ACTIVE', email: { not: '' } },
      select: { email: true },
    });

    const text = stripHtml(newsletter.htmlContent);
    let sentCount = 0;
    let simulatedCount = 0;
    let failedCount = 0;
    for (const c of customers) {
      try {
        const result = await sendMail(c.email, newsletter.subject, text, newsletter.htmlContent);
        if (result.simulated) simulatedCount++; else sentCount++;
      } catch {
        failedCount++;
      }
    }

    const updated = await prisma.newsletter.update({
      where: { id: req.params.id },
      data: { status: 'SENT', recipientCount: customers.length, sentAt: new Date() },
    });

    res.json({ newsletter: updated, sentCount, simulatedCount, failedCount, totalRecipients: customers.length });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
