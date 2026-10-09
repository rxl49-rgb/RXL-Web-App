import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

function buildWhere(query: Record<string, string>) {
  const { search } = query;
  const where: any = {};
  if (search) {
    where.OR = [
      { groupLabel: { contains: search } },
      { billOfLading: { contains: search } },
      { containerNumber: { contains: search } },
      { vessel: { contains: search } },
      { portOfLading: { contains: search } },
    ];
  }
  return where;
}

function parseDate(v: any) {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

// Admin: list manifests (paginated + searchable, ordered newest group first)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const page = parseInt(q.page || '1');
    const limit = parseInt(q.limit || '10');
    const where = buildWhere(q);

    const [manifests, total] = await Promise.all([
      prisma.manifest.findMany({
        where,
        include: { billsOfLading: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.manifest.count({ where }),
    ]);

    res.json({ manifests, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: export as CSV
router.get('/export', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const where = buildWhere(req.query as Record<string, string>);
    const manifests = await prisma.manifest.findMany({ where, orderBy: { createdAt: 'desc' } });
    const headers = ['Week', 'Bill of Lading', 'Master Bill of Lading', 'Reported Date (KGN)', 'Reported Date (MBY)', 'Container Number', 'Vessel', 'Port of Lading', 'Status'];
    const rows = (manifests as any[]).map((m: any) => [
      m.groupLabel, m.billOfLading, m.masterBillOfLading || '',
      m.reportedDateKgn ? new Date(m.reportedDateKgn).toISOString().slice(0, 10) : '',
      m.reportedDateMby ? new Date(m.reportedDateMby).toISOString().slice(0, 10) : '',
      m.containerNumber, m.vessel, m.portOfLading, m.status,
    ]);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="manifests.csv"');
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create manifest
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { groupLabel, billOfLading, masterBillOfLading, reportedDateKgn, reportedDateMby, containerNumber, vessel, portOfLading, status } = req.body;
    if (!groupLabel || !billOfLading || !containerNumber || !vessel || !portOfLading) {
      return res.status(400).json({ error: 'Week, Bill of Lading, Container Number, Vessel and Port of Lading are required' });
    }
    const manifest = await prisma.manifest.create({
      data: {
        groupLabel, billOfLading, containerNumber, vessel, portOfLading,
        masterBillOfLading: masterBillOfLading || '',
        status: status || 'PENDING',
        reportedDateKgn: parseDate(reportedDateKgn),
        reportedDateMby: parseDate(reportedDateMby),
      },
    });
    res.status(201).json(manifest);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update manifest core fields
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { groupLabel, billOfLading, masterBillOfLading, reportedDateKgn, reportedDateMby, containerNumber, vessel, portOfLading, status } = req.body;
    const data: any = {
      reportedDateKgn: parseDate(reportedDateKgn),
      reportedDateMby: parseDate(reportedDateMby),
    };
    if (groupLabel !== undefined) data.groupLabel = groupLabel;
    if (billOfLading !== undefined) data.billOfLading = billOfLading;
    if (masterBillOfLading !== undefined) data.masterBillOfLading = masterBillOfLading || '';
    if (containerNumber !== undefined) data.containerNumber = containerNumber;
    if (vessel !== undefined) data.vessel = vessel;
    if (portOfLading !== undefined) data.portOfLading = portOfLading;
    if (status !== undefined) data.status = status;

    const manifest = await prisma.manifest.update({ where: { id: req.params.id }, data });
    res.json(manifest);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list Bill of Lading records for a manifest (a manifest can have many)
router.get('/:manifestId/bols', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const bols = await prisma.billOfLading.findMany({ where: { manifestId: req.params.manifestId }, orderBy: { createdAt: 'asc' } });
    res.json(bols);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: add a new Bill of Lading to a manifest
router.post('/:manifestId/bols', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      documentNumber, dockReceiptNumber, shipper, consignee, notifyingParty,
      blDescription, numberOfPackages, measurementCft, weightLbs, weightKgs, charges,
    } = req.body;
    const bol = await prisma.billOfLading.create({
      data: {
        manifestId: req.params.manifestId,
        documentNumber: documentNumber || '',
        dockReceiptNumber: dockReceiptNumber || '',
        shipper: shipper || '',
        consignee: consignee || '',
        notifyingParty: notifyingParty || '',
        blDescription: blDescription || '',
        numberOfPackages: numberOfPackages || '',
        measurementCft: measurementCft || '',
        weightLbs: weightLbs || '',
        weightKgs: weightKgs || '',
        charges: charges || '',
      },
    });
    res.status(201).json(bol);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update a specific Bill of Lading
router.put('/bols/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      documentNumber, dockReceiptNumber, shipper, consignee, notifyingParty,
      blDescription, numberOfPackages, measurementCft, weightLbs, weightKgs, charges,
    } = req.body;
    const data: any = {};
    if (documentNumber !== undefined) data.documentNumber = documentNumber || '';
    if (dockReceiptNumber !== undefined) data.dockReceiptNumber = dockReceiptNumber || '';
    if (shipper !== undefined) data.shipper = shipper || '';
    if (consignee !== undefined) data.consignee = consignee || '';
    if (notifyingParty !== undefined) data.notifyingParty = notifyingParty || '';
    if (blDescription !== undefined) data.blDescription = blDescription || '';
    if (numberOfPackages !== undefined) data.numberOfPackages = numberOfPackages || '';
    if (measurementCft !== undefined) data.measurementCft = measurementCft || '';
    if (weightLbs !== undefined) data.weightLbs = weightLbs || '';
    if (weightKgs !== undefined) data.weightKgs = weightKgs || '';
    if (charges !== undefined) data.charges = charges || '';

    const bol = await prisma.billOfLading.update({ where: { id: req.params.id }, data });
    res.json(bol);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete a specific Bill of Lading
router.delete('/bols/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.billOfLading.delete({ where: { id: req.params.id } });
    res.json({ message: 'Bill of Lading removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: toggle received/pending status
router.patch('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['PENDING', 'RECEIVED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const manifest = await prisma.manifest.update({ where: { id: req.params.id }, data: { status } });
    res.json(manifest);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete manifest
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.manifest.delete({ where: { id: req.params.id } });
    res.json({ message: 'Manifest removed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
