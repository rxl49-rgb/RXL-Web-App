import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { calcFreightCharge, ratesFromSettings } from '../lib/freightRates';
import { getOrCreateFreightRateSettings } from './freightRates';
import { sendMail } from '../lib/mailer';

const router = Router();

// JMD/USD conversion used for the Discount panel on the Shipment Information screen.
// Admin-editable now — see routes/currency.ts (Pricing Presets > Exchange Rate in the admin UI).

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const PAYMENT_DIR = path.join(UPLOAD_ROOT, 'payment-invoices');
const ITEM_PHOTO_DIR = path.join(UPLOAD_ROOT, 'item-photos');
const CUSTOMER_INVOICE_DIR = path.join(UPLOAD_ROOT, 'customer-invoices');
fs.mkdirSync(PAYMENT_DIR, { recursive: true });
fs.mkdirSync(ITEM_PHOTO_DIR, { recursive: true });
fs.mkdirSync(CUSTOMER_INVOICE_DIR, { recursive: true });

const imageFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const ok = ['image/gif', 'image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype);
  cb(ok ? null : new Error('File must be .gif, .jpg, .jpeg or .png') as any, ok);
};

// Purchase invoices can be photos of a receipt or a PDF, unlike the other image-only uploads.
const invoiceFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const ok = ['image/gif', 'image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.mimetype);
  cb(ok ? null : new Error('File must be .gif, .jpg, .jpeg, .png or .pdf') as any, ok);
};

const uploadPaymentInvoice = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PAYMENT_DIR),
    filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const uploadItemPhoto = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ITEM_PHOTO_DIR),
    filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const uploadCustomerInvoice = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CUSTOMER_INVOICE_DIR),
    filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: invoiceFileFilter,
});

// Advance Charge, Cube, and Weight are still saved on the shipment for reference, but
// no longer feed into the Total — Total JMD/USD is only ever Fees + Freight + Duty Fee
// (net of discount) + GCT. Freight, Duty Fee, and GCT are entered/saved in JMD, so
// they're converted to USD (using the independent usdPerJmd rate) before combining
// with Fees (USD) into the total.
async function computeTotals(body: Record<string, any>) {
  const num = (v: any) => (v === undefined || v === null || v === '' ? 0 : parseFloat(v));
  const freightCharge = num(body.freightCharge);
  const dutyFee = num(body.dutyFee);
  const gct = num(body.gct);
  const discountPercent = num(body.discountPercent);

  let expensesTotal = 0;
  try {
    const expenses = typeof body.expenses === 'string' ? JSON.parse(body.expenses) : body.expenses;
    if (Array.isArray(expenses)) expensesTotal = expenses.reduce((s: number, e: any) => s + num(e.amount), 0);
  } catch {
    // ignore malformed expenses payload
  }

  // Discount only ever reduces the Duty Fee line, not the whole subtotal.
  const dutyFeeNet = Math.max(0, dutyFee - dutyFee * (discountPercent / 100));
  // Total JMD is a direct sum of Freight + GCT + Duty Fee (net of discount) — all
  // already JMD — plus Fees, which are entered in USD and converted to JMD at a fixed
  // rate before being added in. Total USD is then just Total JMD divided by that same
  // fixed rate. This is intentionally independent of the admin-configurable Pricing
  // Presets exchange rate, which still drives conversions everywhere else in the app.
  const ADVANCE_TOTAL_RATE_JMD_PER_USD = 160;
  const expensesJMD = expensesTotal * ADVANCE_TOTAL_RATE_JMD_PER_USD;
  const totalJMD = Math.round(Math.max(0, freightCharge + gct + dutyFeeNet + expensesJMD) / 100) * 100;
  const totalUSD = totalJMD / ADVANCE_TOTAL_RATE_JMD_PER_USD;
  return { totalUSD, totalJMD };
}

// Admin: calculate freight charge for a shipment based on weight (AIR) or dimensions (SEA),
// using the same rate schedule as the public quote calculator (lib/freightRates.ts).
router.post('/calc-freight', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { type, weight, dimensions } = req.body;
    if (type !== 'AIR' && type !== 'SEA') {
      return res.status(400).json({ error: 'type must be AIR or SEA' });
    }
    const rateSettings = await getOrCreateFreightRateSettings();
    const result = calcFreightCharge(
      type,
      weight !== undefined && weight !== null && weight !== '' ? parseFloat(weight) : null,
      dimensions || null,
      ratesFromSettings(rateSettings)
    );
    if (!result) {
      return res.status(400).json({
        error: type === 'AIR' ? 'Weight (lbs) is required for air freight' : 'Dimensions (L x W x H in inches) are required for sea freight',
      });
    }
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: track by number
router.get('/track/:trackingNumber', async (req: Request, res: Response) => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { trackingNumber: req.params.trackingNumber },
      include: { events: { orderBy: { timestamp: 'desc' } }, documents: true, items: true, batch: { select: { id: true, batchNumber: true } } },
    });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
    res.json(shipment);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Auth: customer shipments
router.get('/mine', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const shipments = await prisma.shipment.findMany({
      where: { userId: req.user!.id },
      include: { events: { orderBy: { timestamp: 'desc' }, take: 1 }, items: true, batch: { select: { id: true, batchNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(shipments);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: all shipments (filterable — used by the Freight screen)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const where: any = {};

    if (q.trackingNumber) where.trackingNumber = { contains: q.trackingNumber };
    if (q.batchId) where.batchId = q.batchId;
    if (q.pickupLocation && q.pickupLocation !== 'ALL') where.pickupLocation = q.pickupLocation;
    if (q.status && q.status !== 'ALL') where.status = q.status;
    if (q.dateFrom || q.dateTo) {
      where.createdAt = {};
      if (q.dateFrom) where.createdAt.gte = new Date(q.dateFrom);
      if (q.dateTo) where.createdAt.lte = new Date(new Date(q.dateTo).setHours(23, 59, 59, 999));
    }
    if (q.customerName) {
      where.user = {
        OR: [
          { name: { contains: q.customerName } },
          { email: { contains: q.customerName } },
        ],
      };
    }

    let shipments = await prisma.shipment.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phone: true, aliasName: true, address: true, city: true, country: true } },
        events: { orderBy: { timestamp: 'desc' }, take: 1 },
        batch: { select: { id: true, batchNumber: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (q.outstandingOnly === 'true') {
      shipments = shipments.filter(s => s.amountPaid < s.totalUSD);
    }

    res.json(shipments);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Auth: single shipment
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      include: { events: { orderBy: { timestamp: 'desc' } }, documents: true, items: true, user: { select: { name: true, email: true, phone: true } }, batch: { select: { id: true, batchNumber: true } } },
    });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
    if (shipment.userId && shipment.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(shipment);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create shipment
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { trackingNumber, userId, customerEmail, type, origin, destination, weight, cubeQty, dimensions, description, estimatedDelivery, pickupLocation, courierInfo, itemCount, batchId } = req.body;

    let resolvedUserId: string | undefined = userId || undefined;
    if (!resolvedUserId && customerEmail) {
      const match = await prisma.user.findUnique({ where: { email: customerEmail } });
      if (!match) return res.status(404).json({ error: `No customer found with email ${customerEmail}` });
      resolvedUserId = match.id;
    }

    // Origin/destination are no longer collected on the "Add Shipment" form when the shipment
    // is being created inside a batch (type is inferred from the batch label instead) — default
    // to the standard Miami warehouse -> Jamaica route when the caller doesn't supply them.
    const resolvedOrigin = origin || 'Miami, FL, USA';
    const resolvedDestination = destination || 'Montego Bay, Jamaica';

    const shipment = await prisma.shipment.create({
      data: {
        trackingNumber,
        userId: resolvedUserId,
        type,
        origin: resolvedOrigin,
        destination: resolvedDestination,
        weight,
        cubeQty,
        dimensions,
        description,
        pickupLocation,
        courierInfo,
        itemCount: itemCount ? parseInt(itemCount) : 1,
        batchId: batchId || undefined,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
        events: {
          create: { location: resolvedOrigin, description: 'Shipment created and processing' },
        },
      },
      include: { events: true, user: { select: { name: true, email: true } } },
    });
    res.status(201).json(shipment);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'That tracking number is already in use' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: merge additional tracking info into an EXISTING shipment — used by the Batches
// "Add Shipment" form when the selected customer already has a shipment in this batch,
// instead of creating a duplicate shipment row for them. Adds a new tracking item
// (courier + tracking #), converting the shipment's original legacy single
// courierInfo/trackingNumber pairing into its first item if it hasn't been already, and
// adds any additional cube quantity onto the shipment's existing cubeQty.
router.post('/:id/items', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { courier, trackingNumber, description, additionalCubeQty } = req.body;

    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    // First time an item is added to a shipment that was created via the old flat
    // courierInfo/trackingNumber fields — carry that original pairing forward as item #1
    // so it isn't lost once the shipment has a proper item list.
    if (shipment.items.length === 0 && (shipment.courierInfo || shipment.trackingNumber)) {
      await prisma.shipmentItem.create({
        data: {
          shipmentId: shipment.id,
          courier: shipment.courierInfo || 'Unknown',
          trackingNumber: shipment.trackingNumber,
        },
      });
    }

    await prisma.shipmentItem.create({
      data: { shipmentId: shipment.id, courier: courier || 'Unknown', trackingNumber: trackingNumber || undefined, description: description || undefined },
    });

    const cubeAdd = additionalCubeQty ? parseFloat(additionalCubeQty) : 0;
    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        itemCount: { increment: 1 },
        cubeQty: cubeAdd ? { increment: cubeAdd } : undefined,
      },
      include: { items: true, user: { select: { name: true, email: true } } },
    });
    res.status(201).json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to add tracking info' });
  }
});

// Admin: update the full "Shipment Information" panel — pickup detail, notes, and advance charge calculator
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body;
    const { totalUSD, totalJMD } = await computeTotals(body);

    const num = (v: any) => (v === undefined || v === null || v === '' ? undefined : parseFloat(v));

    const shipment = await prisma.shipment.update({
      where: { id: req.params.id },
      data: {
        origin: body.origin || undefined,
        destination: body.destination || undefined,
        pickupLocation: body.pickupLocation,
        courierInfo: body.courierInfo,
        issueStatus: body.issueStatus,
        batchDescription: body.batchDescription,
        customerNotes: body.customerNotes,
        managerComments: body.managerComments,
        status: body.status || undefined,
        custInvoiceTotal: num(body.custInvoiceTotal),
        advancePercent: num(body.advancePercent),
        cubeQty: num(body.cubeQty),
        cubeAmount: num(body.cubeAmount),
        weightQty: num(body.weightQty),
        weightAmount: num(body.weightAmount),
        freightCharge: num(body.freightCharge),
        dutyPercent: num(body.dutyPercent),
        dutyFee: num(body.dutyFee),
        expenses: body.expenses ? (typeof body.expenses === 'string' ? body.expenses : JSON.stringify(body.expenses)) : undefined,
        gct: num(body.gct),
        discountPercent: num(body.discountPercent),
        amountPaid: num(body.amountPaid),
        totalUSD,
        totalJMD,
      },
      include: { user: { select: { name: true, email: true, phone: true } }, batch: { select: { id: true, batchNumber: true } } },
    });
    res.json(shipment);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: record a payment, optionally attaching an invoice image. Logs a Payment ledger
// entry (used by the Transaction Report) and increments the shipment's running amountPaid.
router.post('/:id/payment-invoice', authenticate, requireAdmin, uploadPaymentInvoice.single('invoice'), async (req: AuthRequest, res: Response) => {
  try {
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    const { amount, paymentType, referenceNumber, comment } = req.body;
    const paymentAmount = amount !== undefined && amount !== '' ? parseFloat(amount) : 0;

    let urls: string[] = [];
    try { urls = shipment.paymentInvoiceUrls ? JSON.parse(shipment.paymentInvoiceUrls) : []; } catch { urls = []; }
    if (req.file) {
      urls.push(`/uploads/payment-invoices/${req.file.filename}`);
      urls = urls.slice(-2);
    }

    if (paymentAmount > 0) {
      await prisma.payment.create({
        data: { shipmentId: shipment.id, amount: paymentAmount, paymentType: paymentType || 'Cash', referenceNumber, comment },
      });
    }

    const updated = await prisma.shipment.update({
      where: { id: req.params.id },
      data: { paymentInvoiceUrls: JSON.stringify(urls), amountPaid: shipment.amountPaid + paymentAmount },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Upload failed' });
  }
});

// Admin: record a payment without an invoice image
router.patch('/:id/payment', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    const { amount, paymentType, referenceNumber, comment } = req.body;
    const paymentAmount = parseFloat(amount) || 0;

    if (paymentAmount > 0) {
      await prisma.payment.create({
        data: { shipmentId: shipment.id, amount: paymentAmount, paymentType: paymentType || 'Cash', referenceNumber, comment },
      });
    }

    const updated = await prisma.shipment.update({
      where: { id: req.params.id },
      data: { amountPaid: shipment.amountPaid + paymentAmount },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: upload one or more item photos — appended to the existing set. The
// itemPhotoUrl column stores a JSON-stringified array of URLs (same pattern as
// customerInvoiceUrls/paymentInvoiceUrls) so multiple photos can be kept per shipment.
router.post('/:id/item-photo', authenticate, requireAdmin, uploadItemPhoto.array('photos', 10), async (req: AuthRequest, res: Response) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) return res.status(400).json({ error: 'No photo uploaded' });

    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    let urls: string[] = [];
    try { urls = shipment.itemPhotoUrl ? JSON.parse(shipment.itemPhotoUrl) : []; } catch { urls = shipment.itemPhotoUrl ? [shipment.itemPhotoUrl] : []; }
    urls.push(...files.map(f => `/uploads/item-photos/${f.filename}`));

    const updated = await prisma.shipment.update({ where: { id: req.params.id }, data: { itemPhotoUrl: JSON.stringify(urls) } });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Upload failed' });
  }
});

// Admin: remove a single item photo (pass { url } in the body), or all of them if
// no url is given.
router.delete('/:id/item-photo', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    const { url } = req.body || {};
    let itemPhotoUrl: string | null = null;
    if (url) {
      let urls: string[] = [];
      try { urls = shipment.itemPhotoUrl ? JSON.parse(shipment.itemPhotoUrl) : []; } catch { urls = shipment.itemPhotoUrl ? [shipment.itemPhotoUrl] : []; }
      urls = urls.filter(u => u !== url);
      itemPhotoUrl = urls.length > 0 ? JSON.stringify(urls) : null;
    }

    const updated = await prisma.shipment.update({ where: { id: req.params.id }, data: { itemPhotoUrl } });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to remove photo' });
  }
});

// Customer: upload one or more purchase invoice(s) for their own shipment (Shipment
// Details page). Admins may also upload on a customer's behalf.
router.post('/:id/customer-invoice', authenticate, uploadCustomerInvoice.array('files', 10), async (req: AuthRequest, res: Response) => {
  try {
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
    if (shipment.userId && shipment.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    let urls: string[] = [];
    try { urls = shipment.customerInvoiceUrls ? JSON.parse(shipment.customerInvoiceUrls) : []; } catch { urls = []; }
    urls.push(...files.map(f => `/uploads/customer-invoices/${f.filename}`));

    const updated = await prisma.shipment.update({
      where: { id: req.params.id },
      data: { customerInvoiceUrls: JSON.stringify(urls) },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Upload failed' });
  }
});

// Customer: remove all uploaded purchase invoice(s) for their own shipment.
router.delete('/:id/customer-invoice', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
    if (shipment.userId && shipment.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.shipment.update({ where: { id: req.params.id }, data: { customerInvoiceUrls: null } });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: email a payment receipt to the customer — used by the "Email receipt" icon
// on the Freight POS screen. Uses the shared mailer (lib/mailer.ts), which logs a
// simulated send if SMTP isn't configured yet rather than failing the request.
router.post('/:id/email-receipt', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { name: true, email: true } }, batch: { select: { batchNumber: true } } },
    });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
    if (!shipment.user?.email) return res.status(400).json({ error: 'This customer has no email on file' });

    const balance = Math.max(0, (shipment.totalUSD || 0) - (shipment.amountPaid || 0));
    const subject = `Your RXL Logistics receipt — ${shipment.trackingNumber}`;
    const body = `Hi ${shipment.user.name || 'there'},\n\n` +
      `Here is your receipt for shipment ${shipment.trackingNumber}${shipment.batch ? ` (Batch ${shipment.batch.batchNumber})` : ''}.\n\n` +
      `Total Charges (USD): $${(shipment.totalUSD || 0).toFixed(2)}\n` +
      `Amount Paid (USD): $${(shipment.amountPaid || 0).toFixed(2)}\n` +
      `Balance (USD): $${balance.toFixed(2)}\n\n` +
      `Thank you,\nRXL Logistics`;

    const result = await sendMail(shipment.user.email, subject, body);
    res.json({ ...result, email: shipment.user.email });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: add tracking event
router.post('/:id/events', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { location, description } = req.body;
    const event = await prisma.trackingEvent.create({
      data: { shipmentId: req.params.id, location, description },
    });
    res.status(201).json(event);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update shipment status
router.patch('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const shipment = await prisma.shipment.update({
      where: { id: req.params.id },
      data: { status, deliveredAt: status === 'DELIVERED' ? new Date() : undefined },
    });
    res.json(shipment);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
