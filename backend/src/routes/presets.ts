import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const DEFAULT_RATES = [
  { type: 'AIR', base: 8.5, perKg: 4.2 },
  { type: 'SEA', base: 3.2, perKg: 1.8 },
  { type: 'GROUND', base: 2.1, perKg: 0.9 },
];

const DEFAULT_REGIONS = [
  { region: 'US', label: 'United States', multiplier: 1.0 },
  { region: 'CA', label: 'Canada', multiplier: 1.1 },
  { region: 'UK', label: 'United Kingdom', multiplier: 1.4 },
  { region: 'EU', label: 'Europe', multiplier: 1.3 },
  { region: 'AS', label: 'Asia', multiplier: 1.6 },
  { region: 'OTHER', label: 'Other', multiplier: 1.8 },
];

const DEFAULT_PRICING_PRESETS = [
  { title: '5%', percentage: 5, type: 'discount' },
  { title: '10%', percentage: 10, type: 'discount' },
  { title: '15%', percentage: 15, type: 'discount' },
  { title: '20%', percentage: 20, type: 'discount' },
  { title: '25%', percentage: 25, type: 'discount' },
  { title: '30%', percentage: 30, type: 'discount' },
  { title: '35%', percentage: 35, type: 'charge' },
  { title: 'TV 60 inch', percentage: 35, type: 'charge' },
  { title: 'TV 32 Inch', percentage: 39, type: 'charge' },
];

async function ensureSeeded() {
  const rateCount = await prisma.shippingRate.count();
  if (rateCount === 0) {
    await prisma.shippingRate.createMany({ data: DEFAULT_RATES });
  }
  const regionCount = await prisma.regionMultiplier.count();
  if (regionCount === 0) {
    await prisma.regionMultiplier.createMany({ data: DEFAULT_REGIONS });
  }
}

async function ensurePricingSeeded() {
  const count = await prisma.pricingPreset.count();
  if (count === 0) {
    await prisma.pricingPreset.createMany({ data: DEFAULT_PRICING_PRESETS });
  }
}

const DEFAULT_SHIPMENT_ISSUES = [
  'No issue',
  'Incorrect invoice',
  'Late Invoice submission',
  'Inadequate invoices',
  'Invoice incomplete - Show items purchased, cost & total.',
  'Unable to view invoice',
  'Insufficient Invoice (short)',
  'Invoice incomplete - Description of items needed.',
  'Price In Office..',
  'A complete breakdown of charges required',
];

async function ensureShipmentIssuesSeeded() {
  const count = await prisma.shipmentIssuePreset.count();
  if (count === 0) {
    await prisma.shipmentIssuePreset.createMany({ data: DEFAULT_SHIPMENT_ISSUES.map(title => ({ title })) });
  }
}

const DEFAULT_NOTIFICATION_PRESETS: { title: string; message: string }[] = [
  {
    title: 'Invoice Request',
    message: `Kindly upload invoices through our app or website, for tracking information shown on your account labeled Air_MAY_04_WK17-1.

Invoice upload demo.
App demo
https://youtube.com/shorts/wBZRu1aFenQ?feature=share
Website demo
https://youtu.be/XQnRTMA4QWk`,
  },
  {
    title: 'Urgent attention is required! Air_MAY_20_WK19-2',
    message: `Your immediate attention is required for Air_MAY_20_WK19-2.  Please upload invoices using our app or website directly.
Please review the issue with your shipment and promptly address it by uploading the necessary invoices to your account.

Invoice upload demo.
App demo
https://youtube.com/shorts/wBZRu1aFenQ?feature=share
Website demo
https://youtu.be/XQnRTMA4QWk`,
  },
  {
    title: 'Identification Request',
    message: `We did not receive a copy of your identification with your online application. Kindly provide a copy of a valid government-issued identification document via email in response to this message to activate your account.`,
  },
  {
    title: 'Account setup',
    message: `Please check your email for login instructions, if not seen in your inbox check spam/junk mail. It is recommended to change your password by clicking the picture icon top right corner and you will see the change password option.
Every Wednesday our system is updated with shipment info.

Link to Rxllogistics app
IOS
https://itunes.apple.com/us/app/rxllogistics/id1333319094?mt=8

Android
https://play.google.com/apps/testing/com.m3rdesignz.rxllogistics`,
  },
  {
    title: 'Shipping Instructions',
    message: `Name : Walrick Johnson RXL4414

10380 West State Road 84, STE 2,
Davie,
Florida,
Zip 33324

Shipping Instructions

Please read!
For orders being shipped directly from online or physical stores only. Failure to follow will result in a penalty or goods being held at Miami warehouse.
To process shipments handled by friends or family, please contact us at 876-363-6208 or email us @ info@rxllogistics.com for instructions.

For sending invoices:
Follow these steps to upload invoices:

1. Log in to our app.
2. Click the current or desired shipment.
3. Select the send invoice icon.
4. Click on the Add (plus) button at the top right-hand corner to upload invoices.

Website option:

1. Log in to our website.
2. Click the current or desired shipment.
3. Click on the Add (plus) button add purchase invoice button.
4. Click the upload button in order to upload invoices.

Air shipment Options

1. You can request air service through our mobile application or alternatively add the word AIR to your name and customer number (e.g., John Brown RXL12345 AIR). This will automatically process the shipment as air service, eliminating the need for a request through our application.
2. Before your shipment arrives at our warehouse, upload your tracking number to our app by clicking the plane icon at the bottom of the screen.
Then select the add (+) button and enter the tracking number(s) then save.

Inquiries - info@rxllogistics.com
Order Request - info@rxllogistics.com

Once the shipment arrives by Wednesday morning, the package is expected to be shipped on Friday and will arrive the following week. Unless there is a holiday that impacts it, Wednesday is the cut-off day for each week. Our web app is updated every Thursday/Friday with tracking information for shipments arriving the following week.

Items that are NOT permitted:

- Daggers
- Anything associated with guns
- Swords
- Stun gun
- Pepper spray
- Radar detectors
- BB guns
- Fireworks
- Dog Food
- Walkie talkie / handheld radio that operates more than 5 miles
- Fire extinguishers

If you are unsure about shipping a particular item, please contact us.

There is a minimum charge of JA$500 per shipment.`,
  },
  {
    title: 'Shipping Terms & Storage Policy',
    message: `By creating an account, using our services, or shipping items through our facility, you acknowledge and agree to the following terms:

1. Storage Policy

- 5 days free storage from the date the package arrives at our warehouse.
- Storage fees apply from Day 6 until the package is picked up or delivered.
- After 14 days, any unclaimed package will be considered abandoned.

2. Auction / Disposal

- Abandoned packages may be auctioned, sold, or disposed of at our discretion.
- Any proceeds will be applied to outstanding shipping, storage, or administrative costs.
- No compensation will be provided for abandoned items.

3. Customer Responsibility

- Customers must monitor package arrivals and arrange timely pickup or delivery.
- Failure to collect packages or clear balances within the storage window may result in forfeiture.

4. Acceptance of Terms
Use of any RXL Logistics services constitutes agreement to this Shipping & Storage Policy.`,
  },
  {
    title: 'Open Tomorrow',
    message: `Dear valued customers,
To serve you our customers better our office will be open tomorrow Saturday, November 11, 2023, from 9:00 am - 12:30 pm to accommodate pickups only, absolutely no pricing will be done in office.
We are grateful for your continued patience & support.`,
  },
];

async function ensureNotificationsSeeded() {
  const count = await prisma.notificationPreset.count();
  if (count === 0) {
    await prisma.notificationPreset.createMany({ data: DEFAULT_NOTIFICATION_PRESETS });
  }
}

// Admin: shipping presets (rates per freight type + region multipliers)
router.get('/shipping', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureSeeded();
    const [rates, regions] = await Promise.all([
      prisma.shippingRate.findMany({ orderBy: { type: 'asc' } }),
      prisma.regionMultiplier.findMany({ orderBy: { region: 'asc' } }),
    ]);
    res.json({ rates, regions });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/shipping/rates/:type', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { base, perKg } = req.body;
    const rate = await prisma.shippingRate.update({ where: { type: req.params.type }, data: { base: parseFloat(base), perKg: parseFloat(perKg) } });
    res.json(rate);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/shipping/regions/:region', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { multiplier } = req.body;
    const region = await prisma.regionMultiplier.update({ where: { region: req.params.region }, data: { multiplier: parseFloat(multiplier) } });
    res.json(region);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: pricing presets (reusable discount/charge percentages)
router.get('/pricing', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensurePricingSeeded();
    const q = req.query as Record<string, string>;
    const where: any = {};
    if (q.search) where.title = { contains: q.search };
    const presets = await prisma.pricingPreset.findMany({ where, orderBy: { createdAt: 'asc' } });
    res.json({ presets, total: presets.length });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/pricing', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, percentage, type, active } = req.body;
    if (!title || percentage === undefined) return res.status(400).json({ error: 'Title and percentage are required' });
    const preset = await prisma.pricingPreset.create({
      data: { title, percentage: parseFloat(percentage), type: type || 'discount', active: active !== undefined ? !!active : true },
    });
    res.status(201).json(preset);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/pricing/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, percentage, type, active } = req.body;
    const preset = await prisma.pricingPreset.update({
      where: { id: req.params.id },
      data: { title, percentage: percentage !== undefined ? parseFloat(percentage) : undefined, type, active },
    });
    res.json(preset);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/pricing/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.pricingPreset.delete({ where: { id: req.params.id } });
    res.json({ message: 'Pricing preset removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: shipment issue presets (reasons selectable on the Freight/Batches "issue" dropdown)
router.get('/shipment-issues', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureShipmentIssuesSeeded();
    const q = req.query as Record<string, string>;
    const where: any = {};
    if (q.search) where.title = { contains: q.search };
    const issues = await prisma.shipmentIssuePreset.findMany({ where, orderBy: { createdAt: 'asc' } });
    res.json({ issues, total: issues.length });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/shipment-issues', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, active } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const issue = await prisma.shipmentIssuePreset.create({ data: { title, active: active !== undefined ? !!active : true } });
    res.status(201).json(issue);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/shipment-issues/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, active } = req.body;
    const issue = await prisma.shipmentIssuePreset.update({ where: { id: req.params.id }, data: { title, active } });
    res.json(issue);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/shipment-issues/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.shipmentIssuePreset.delete({ where: { id: req.params.id } });
    res.json({ message: 'Shipment issue preset removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: notification presets (reusable message templates for customer notifications)
router.get('/notifications', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureNotificationsSeeded();
    const q = req.query as Record<string, string>;
    const where: any = {};
    if (q.search) where.title = { contains: q.search };
    const notifications = await prisma.notificationPreset.findMany({ where, orderBy: { createdAt: 'asc' } });
    res.json({ notifications, total: notifications.length });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/notifications', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, active } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });
    const notification = await prisma.notificationPreset.create({
      data: { title, message, active: active !== undefined ? !!active : true },
    });
    res.status(201).json(notification);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/notifications/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, active } = req.body;
    const notification = await prisma.notificationPreset.update({
      where: { id: req.params.id },
      data: { title, message, active },
    });
    res.json(notification);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/notifications/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notificationPreset.delete({ where: { id: req.params.id } });
    res.json({ message: 'Notification preset removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
