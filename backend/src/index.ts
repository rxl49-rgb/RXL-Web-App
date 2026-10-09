import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import shipmentRoutes from './routes/shipments';
import quoteRoutes from './routes/quotes';
import placesRoutes from './routes/places';
import customerRoutes from './routes/customers';
import presetRoutes from './routes/presets';
import batchRoutes from './routes/batches';
import bizJournalRoutes from './routes/biz-journal';
import manifestRoutes from './routes/manifests';
import warehouseRoutes from './routes/warehouse';
import reportRoutes from './routes/reports';
import roleRoutes from './routes/roles';
import staffUserRoutes from './routes/staff-users';
import bulletinRoutes from './routes/bulletins';
import advertisementRoutes from './routes/advertisements';
import mobileInfoRoutes from './routes/mobile-info';
import appearanceRoutes from './routes/appearance';
import automationRoutes from './routes/automation';
import currencyRoutes from './routes/currency';
import revenueTrackerRoutes from './routes/revenueTracker';
import savedThemeRoutes from './routes/savedThemes';
import freightRatesRoutes from './routes/freightRates';
import courierRoutes from './routes/couriers';
import loadingGuideRoutes from './routes/loadingGuides';
import newsletterRoutes from './routes/newsletters';
import { startAutomationCron } from './jobs/automationReminders';
import prisma from './lib/prisma';

const app = express();
const PORT = parseInt(process.env.PORT || '5000');

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'RXL Logistics API', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/presets', presetRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/biz-journal', bizJournalRoutes);
app.use('/api/manifests', manifestRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/staff-users', staffUserRoutes);
app.use('/api/bulletins', bulletinRoutes);
app.use('/api/advertisements', advertisementRoutes);
app.use('/api/mobile-info', mobileInfoRoutes);
app.use('/api/appearance', appearanceRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/revenue-batches', revenueTrackerRoutes);
app.use('/api/saved-themes', savedThemeRoutes);
app.use('/api/freight-rates', freightRatesRoutes);
app.use('/api/couriers', courierRoutes);
app.use('/api/loading-guides', loadingGuideRoutes);
app.use('/api/newsletters', newsletterRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// One-time seed: if no couriers exist yet, carry over the 5 couriers that were
// previously hardcoded in the app (FedEx, UPS, USPS, DHL, GOFO) along with their
// already-uploaded logo files, so switching to the DB-driven Couriers list doesn't
// lose the existing logos admins/customers already see.
async function seedDefaultCouriers() {
  const count = await prisma.courier.count();
  if (count > 0) return;
  await prisma.courier.createMany({
    data: [
      { name: 'FedEx', logoUrl: '/couriers/fedex.png' },
      { name: 'UPS', logoUrl: '/couriers/ups-shield-2.png' },
      { name: 'USPS', logoUrl: '/couriers/usps.png' },
      { name: 'DHL', logoUrl: '/couriers/dhl.webp' },
      { name: 'GOFO', logoUrl: '/couriers/gofo.png' },
    ],
  });
}

app.listen(PORT, () => {
  console.log(`\n🚀 RXL Logistics API running on http://localhost:${PORT}`);
  console.log(`📦 Health check: http://localhost:${PORT}/health\n`);
  try {
    startAutomationCron();
  } catch (err) {
    console.error('[automation] failed to start scheduled reminders (non-fatal):', err);
  }
  seedDefaultCouriers().catch(err => console.error('[couriers] seed failed (non-fatal):', err));
});

export default app;
