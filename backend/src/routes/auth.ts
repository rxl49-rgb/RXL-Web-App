import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendMail } from '../lib/mailer';

const router = Router();

const WELCOME_EMAIL_SUBJECT = 'Welcome to RXL Logistics';
const WELCOME_EMAIL_TEXT = `Welcome to RXL Logistics

Your application has been successfully received and is currently being processed. Please allow up to 24 hours for your account to be activated.

Once your account is active, you will receive a confirmation email containing your shipping instructions, warehouse information, and important policies. Account activations are processed during regular business hours.

Thank you for choosing RXL Logistics.`;

const ID_DOCUMENT_DIR = path.join(process.cwd(), 'uploads', 'id-documents');
fs.mkdirSync(ID_DOCUMENT_DIR, { recursive: true });

const uploadIdDocument = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ID_DOCUMENT_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/gif', 'image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.mimetype);
    cb(ok ? null : new Error('Government ID must be a .gif, .jpg, .jpeg, .png or .pdf') as any, ok);
  },
});

router.post('/register', uploadIdDocument.single('idDocument'), async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, phone, address, city, trn } = req.body;
    if (!firstName || !lastName || !email || !password || !phone || !address || !city || !trn) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Government ID is required' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const count = await prisma.user.count();
    const name = `${firstName} ${lastName}`.trim();
    const idDocumentUrl = `/uploads/id-documents/${req.file.filename}`;
    const user = await prisma.user.create({
      data: {
        name, firstName, lastName, email, password: hashed, phone, address, city, trn,
        idType: 'Government ID', idDocumentUrl, status: 'PENDING',
        customerCode: `RXL${4000 + count + 1}`, lastActiveAt: new Date(),
      },
      select: { id: true, name: true, email: true, phone: true, role: true, customerCode: true, status: true, createdAt: true },
    });

    // New accounts require admin activation before the customer can sign in — no token
    // is issued here. Best-effort welcome email; failure to send should not fail signup.
    try {
      await sendMail(user.email, WELCOME_EMAIL_SUBJECT, WELCOME_EMAIL_TEXT);
    } catch (mailErr) {
      console.warn('[auth] Failed to send welcome email:', mailErr);
    }

    res.status(201).json({ user, pending: true, message: WELCOME_EMAIL_TEXT });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'];

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await prisma.loginEvent.create({ data: { userId: user.id, ip, userAgent, success: false } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'PENDING') return res.status(403).json({ error: 'Account under review', code: 'PENDING' });
    if (user.status === 'BLOCKED') return res.status(403).json({ error: 'This account has been blocked' });
    if (user.status === 'DELETED') return res.status(403).json({ error: 'This account is no longer active' });

    await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    await prisma.loginEvent.create({ data: { userId: user.id, ip, userAgent, success: true } });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, phone: true, role: true, address: true, city: true, country: true, trn: true, customerCode: true, status: true, createdAt: true },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Re-verifies the current admin/staff user's own account password. Used to gate
// destructive actions (e.g. deleting a batch) behind a password re-entry step,
// separate from the session token which stays valid across the whole visit.
router.post('/verify-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(401).json({ error: 'Invalid session' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ valid: false, error: 'Incorrect password' });

    res.json({ valid: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, address, city, country } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name, phone, address, city, country },
      select: { id: true, name: true, email: true, phone: true, role: true, address: true, city: true, country: true, trn: true, customerCode: true, status: true, createdAt: true },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
