import prisma from '../lib/prisma';
import { sendMail } from '../lib/mailer';

// 'node-cron' is loaded lazily via require() + try/catch, same reasoning as lib/mailer.ts —
// if it isn't installed yet, the backend should still boot (and admin login should still
// work) with only the scheduled reminder job disabled, rather than the whole server crashing.
function getCron(): typeof import('node-cron') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('node-cron');
  } catch {
    console.warn('[automation] "node-cron" is not installed — run `npm install` in backend/. Scheduled reminders are disabled until then (the "Run now" button still works).');
    return null;
  }
}

// READY status was renamed "Ready For Pick Up" on the customer-facing side but the
// underlying status string stored on Shipment is still OUT_FOR_DELIVERY (see lib/freight.ts).
const READY_STATUS = 'OUT_FOR_DELIVERY';

async function getSettings() {
  let settings = await prisma.automationSetting.findFirst();
  if (!settings) settings = await prisma.automationSetting.create({ data: {} });
  return settings;
}

function subtractBusinessDays(days: number): Date {
  const d = new Date();
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return d;
}

// Outstanding-pickup reminder — shipment has been sitting at "Ready For Pick Up" for
// `outstandingReminderDays` calendar days and hasn't had a reminder sent yet.
export async function runOutstandingReminders() {
  const settings = await getSettings();
  if (!settings.outstandingEnabled) return { checked: 0, sent: 0 };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - settings.outstandingReminderDays);

  const shipments = await prisma.shipment.findMany({
    where: {
      status: READY_STATUS,
      readyReminderSentAt: null,
      updatedAt: { lte: cutoff },
    },
    include: { user: { select: { name: true, email: true } } },
  });

  let sent = 0;
  for (const s of shipments) {
    if (!s.user?.email) continue;
    const subject = `Reminder: Your shipment ${s.trackingNumber} is ready for pick up`;
    const body = `Hi ${s.user.name || 'there'},\n\nThis is a reminder that your shipment (${s.trackingNumber}) is ready for pick up at our facility. Please arrange collection at your earliest convenience.\n\nThank you,\nRXL Logistics`;
    const result = await sendMail(s.user.email, subject, body);
    await prisma.shipment.update({ where: { id: s.id }, data: { readyReminderSentAt: new Date() } });
    if (result.sent || result.simulated) sent++;
  }
  return { checked: shipments.length, sent };
}

// Storage-fee notice — shipment has been "Ready For Pick Up" for `storageFeeDays`
// *business* days (per the seeded Shipping Terms & Storage Policy: 5 free days, fees from Day 6).
export async function runStorageFeeReminders() {
  const settings = await getSettings();
  if (!settings.storageFeeEnabled) return { checked: 0, sent: 0 };

  const cutoff = subtractBusinessDays(settings.storageFeeDays);

  const shipments = await prisma.shipment.findMany({
    where: {
      status: READY_STATUS,
      storageFeeSentAt: null,
      updatedAt: { lte: cutoff },
    },
    include: { user: { select: { name: true, email: true } } },
  });

  const preset = await prisma.notificationPreset.findFirst({ where: { title: 'Shipping Terms & Storage Policy' } });
  const policyText = preset?.message ||
    `Storage fees apply from Day 6 after arrival until your package is picked up. Please arrange collection as soon as possible to avoid additional charges.`;

  let sent = 0;
  for (const s of shipments) {
    if (!s.user?.email) continue;
    const subject = `Storage fee notice for shipment ${s.trackingNumber}`;
    const body = `Hi ${s.user.name || 'there'},\n\nYour shipment (${s.trackingNumber}) has been ready for pick up for ${settings.storageFeeDays}+ business days and is now accruing storage fees.\n\n${policyText}\n\nThank you,\nRXL Logistics`;
    const result = await sendMail(s.user.email, subject, body);
    await prisma.shipment.update({ where: { id: s.id }, data: { storageFeeSentAt: new Date() } });
    if (result.sent || result.simulated) sent++;
  }
  return { checked: shipments.length, sent };
}

export async function runAllAutomationReminders() {
  const outstanding = await runOutstandingReminders();
  const storageFee = await runStorageFeeReminders();
  return { outstanding, storageFee };
}

// Runs once a day at 8:00am server time. Only takes effect once the process that
// imports this module calls startAutomationCron() (see index.ts). If 'node-cron' isn't
// installed, this quietly no-ops instead of throwing — the rest of the app (including
// login) keeps working, and the admin "Run now" button is unaffected either way.
export function startAutomationCron() {
  const cron = getCron();
  if (!cron) return;
  cron.schedule('0 8 * * *', () => {
    runAllAutomationReminders()
      .then(r => console.log('[automation] daily reminder run', r))
      .catch(err => console.error('[automation] daily reminder run failed', err));
  });
}
