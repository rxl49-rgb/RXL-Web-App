import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'identification');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/gif', 'image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype);
    cb(ok ? null : new Error('Photo must be .gif, .jpg, .jpeg or .png') as any, ok);
  },
});

const SAFE_SELECT = {
  id: true,
  customerCode: true,
  name: true,
  firstName: true,
  lastName: true,
  aliasName: true,
  email: true,
  phone: true,
  phoneCarrier: true,
  trn: true,
  address: true,
  city: true,
  country: true,
  status: true,
  role: true,
  idType: true,
  idDocumentUrl: true,
  lastActiveAt: true,
  createdAt: true,
};

function buildWhere(query: Record<string, string>) {
  const { search, status } = query;
  const where: any = { role: 'CUSTOMER' };
  if (status && status !== 'ALL') where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
      { customerCode: { contains: search } },
      { trn: { contains: search } },
      { city: { contains: search } },
    ];
  }
  return where;
}

async function nextCustomerCode() {
  const count = await prisma.user.count();
  return `RXL${4000 + count + 1}`;
}

// Admin: list customers (paginated, searchable, filterable, sortable)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const page = parseInt(q.page || '1');
    const limit = parseInt(q.limit || '25');
    const sortBy = ['name', 'email', 'lastActiveAt', 'createdAt', 'customerCode'].includes(q.sortBy) ? q.sortBy : 'createdAt';
    const sortDir = q.sortDir === 'asc' ? 'asc' : 'desc';
    const where = buildWhere(q);

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: SAFE_SELECT,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ customers, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: export filtered customers as CSV
router.get('/export', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const where = buildWhere(req.query as Record<string, string>);
    const customers = await prisma.user.findMany({ where, select: SAFE_SELECT, orderBy: { createdAt: 'desc' } });

    const headers = ['Customer ID', 'Name', 'Email', 'Phone', 'TRN', 'Address', 'City', 'Country', 'Last Active', 'Status'];
    const rows = customers.map(c => [
      c.customerCode || '', c.name, c.email, c.phone || '', c.trn || '', c.address || '', c.city || '', c.country || '',
      c.lastActiveAt ? new Date(c.lastActiveAt).toISOString() : '', c.status,
    ]);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: single customer
router.get('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const customer = await prisma.user.findUnique({ where: { id: req.params.id }, select: SAFE_SELECT });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: a customer's login history ("login profile")
router.get('/:id/logins', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const customer = await prisma.user.findUnique({ where: { id: req.params.id }, select: SAFE_SELECT });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const logins = await prisma.loginEvent.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const successCount = logins.filter(l => l.success).length;
    res.json({
      customer,
      logins,
      summary: {
        totalLogins: successCount,
        failedAttempts: logins.length - successCount,
        lastLoginAt: logins.find(l => l.success)?.createdAt || null,
        lastActiveAt: customer.lastActiveAt,
      },
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

function fullName(firstName?: string, lastName?: string, fallback?: string) {
  const joined = [firstName, lastName].filter(Boolean).join(' ').trim();
  return joined || fallback || '';
}

// Admin: add customer
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, aliasName, name, email, phone, phoneCarrier, trn, address, city, country } = req.body;
    const resolvedName = fullName(firstName, lastName, name);
    if (!resolvedName || !email) return res.status(400).json({ error: 'Name and email are required' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const tempPassword = Math.random().toString(36).slice(-8) + 'Rx1!';
    const hashed = await bcrypt.hash(tempPassword, 12);
    const customerCode = await nextCustomerCode();

    const customer = await prisma.user.create({
      data: {
        name: resolvedName, firstName, lastName, aliasName, email, phone, phoneCarrier, trn, address, city, country,
        password: hashed, customerCode, role: 'CUSTOMER', status: 'ACTIVE',
      },
      select: SAFE_SELECT,
    });

    res.status(201).json({ customer, tempPassword });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update customer
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, aliasName, name, phone, phoneCarrier, trn, address, city, country } = req.body;
    const resolvedName = fullName(firstName, lastName, name);
    const customer = await prisma.user.update({
      where: { id: req.params.id },
      data: { name: resolvedName || undefined, firstName, lastName, aliasName, phone, phoneCarrier, trn, address, city, country },
      select: SAFE_SELECT,
    });
    res.json(customer);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: upload identification document (drivers license, passport, etc.)
router.post('/:id/identification', authenticate, requireAdmin, upload.single('document'), async (req: AuthRequest, res: Response) => {
  try {
    const { idType } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No document uploaded' });

    const idDocumentUrl = `/uploads/identification/${req.file.filename}`;
    const customer = await prisma.user.update({
      where: { id: req.params.id },
      data: { idType, idDocumentUrl },
      select: SAFE_SELECT,
    });
    res.json(customer);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Upload failed' });
  }
});

// Admin: change status (activate / deactivate / block)
router.patch('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const customer = await prisma.user.update({ where: { id: req.params.id }, data: { status }, select: SAFE_SELECT });
    res.json(customer);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: remove customer (soft delete)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const customer = await prisma.user.update({ where: { id: req.params.id }, data: { status: 'DELETED' }, select: SAFE_SELECT });
    res.json({ message: 'Customer removed', customer });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: notify a customer group (simulated — no email/SMS provider wired up yet)
router.post('/notify', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { target, customerCode, subject, message } = req.body as {
      target: 'CUSTOMER_NUMBER' | 'NEW' | 'ACTIVE';
      customerCode?: string;
      subject?: string;
      message?: string;
    };

    let where: any = { role: 'CUSTOMER', status: { not: 'DELETED' } };
    if (target === 'CUSTOMER_NUMBER') {
      if (!customerCode) return res.status(400).json({ error: 'customerCode is required for this target' });
      where.customerCode = customerCode;
    } else if (target === 'NEW') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      where.createdAt = { gte: sevenDaysAgo };
    } else if (target === 'ACTIVE') {
      where.status = 'ACTIVE';
    } else {
      return res.status(400).json({ error: 'Invalid notify target' });
    }

    const recipients = await prisma.user.findMany({ where, select: { id: true, name: true, email: true } });

    // NOTE: no email/SMS provider is wired up in this project yet.
    // This endpoint validates the recipient list and simulates the send so the
    // admin UI is fully functional; plug in a real provider (SES, Twilio, etc.)
    // here to actually deliver subject/message to each recipient's email/phone.

    res.json({ simulated: true, recipientCount: recipients.length, recipients: recipients.slice(0, 20), subject, message });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
