// Shared constants + helpers for the Batches and Freight admin screens.

// Shipment status progression, in order: Received Florida -> In Transit ->
// At Ports In Jamaica -> Freight Processing -> Ready For Pick Up -> Collected.
export const STATUS_OPTIONS = [
  { value: 'RECEIVED_FLORIDA', label: 'Received Florida' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'AT_PORT_JAMAICA', label: 'At Ports In Jamaica' },
  { value: 'PROCESSING', label: 'Freight Processing' },
  { value: 'OUT_FOR_DELIVERY', label: 'Ready For Pick Up' },
  { value: 'DELIVERED', label: 'Collected' },
];

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.label]));

export const STATUS_STYLE: Record<string, string> = {
  RECEIVED_FLORIDA: 'bg-cyan-100 text-cyan-700',
  // In Transit — blue text.
  IN_TRANSIT: 'bg-blue-50 dark:bg-blue-500/15 text-blue-500 dark:text-blue-400',
  // At Ports In Jamaica — red text.
  AT_PORT_JAMAICA: 'bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400',
  // Freight Processing — orange text.
  PROCESSING: 'bg-orange-50 dark:bg-orange-500/15 text-orange-500 dark:text-orange-400',
  // Ready For Pick Up — green text.
  OUT_FOR_DELIVERY: 'bg-green-50 dark:bg-green-500/15 text-green-500 dark:text-green-400',
  // Collected — gold text.
  DELIVERED: 'bg-amber-50 dark:bg-amber-500/15 text-amber-500 dark:text-amber-400',
};

export const PICKUP_LOCATIONS = ['Falmouth', 'Freeport', 'Kingston', 'Montego Bay', 'May Pen', 'Ocho Rios', 'Other'];

export const ISSUE_OPTIONS = ['No issue', 'Damaged item', 'Missing item', 'Wrong address', 'Customs hold'];

// JMD/USD conversion — admin-editable (Pricing Presets > Exchange Rate). This fallback
// is only used before the live rate has loaded from /api/currency.
export const DEFAULT_EXCHANGE_RATE_JMD_PER_USD = 158;
// Independently customizable JMD -> USD rate (not derived as 1/DEFAULT_EXCHANGE_RATE_JMD_PER_USD).
export const DEFAULT_EXCHANGE_RATE_USD_PER_JMD = 0.006329;

export interface Expense { label: string; amount: number; percent?: number; baseAmount?: number }

export function parseExpenses(raw: string | null | undefined): Expense[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Purchase invoice(s) the customer has uploaded themselves on their Shipment Details page.
export function customerInvoiceUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
}

// General Consumption Tax rate (Jamaica). GCT is tax-inclusive on the Advance Charge
// total — see computeCharges() below.
export const GCT_RATE = 16.5;

// Fixed JMD/USD rate used for the Advance Charge Total (and its JMD-denominated line
// items — Freight, Duty Fee, Discount, GCT — wherever they're shown in USD, e.g. on the
// printed customer invoice). Intentionally independent of the admin-configurable
// Pricing Presets exchange rate (jmdPerUsd / usdPerJmd), which drives conversions
// everywhere else in the app.
export const ADVANCE_TOTAL_RATE_JMD_PER_USD = 160;

// Rounds a JMD-denominated calculated result to the nearest 100 (common practice for
// JMD cash amounts). Used for auto-calculated results only — manual overrides are left
// exactly as typed.
export function roundToHundred(n: number): number {
  return Math.round(n / 100) * 100;
}

export function computeCharges(input: {
  custInvoiceTotal: number;
  advancePercent: number;
  cubeAmount: number;
  weightAmount: number;
  freightCharge: number;
  dutyFee: number;
  expenses: Expense[];
  gctEnabled: boolean;
  discountPercent: number;
}, jmdPerUsd: number = DEFAULT_EXCHANGE_RATE_JMD_PER_USD, usdPerJmd: number = DEFAULT_EXCHANGE_RATE_USD_PER_JMD) {
  // Advance Charge, Cube, and Weight are still tracked on the shipment for reference,
  // but no longer feed into the Total. Total JMD is a direct sum of Freight + GCT +
  // Duty Fee (net of discount) — all already JMD — plus Fees, which are entered in USD
  // and converted to JMD at a fixed rate before being added in. Total USD is then just
  // Total JMD divided by that same fixed rate. This fixed rate is intentionally
  // independent of the admin-configurable Pricing Presets exchange rate (jmdPerUsd /
  // usdPerJmd), which still drives conversions everywhere else in the app.
  const advanceCharge = input.custInvoiceTotal * (input.advancePercent / 100);
  const expensesTotal = input.expenses.reduce((s, e) => s + (e.amount || 0), 0);
  // Discount is only ever applied against the Duty Fee line, not the whole subtotal.
  const dutyFeeNet = Math.max(0, input.dutyFee - input.dutyFee * (input.discountPercent / 100));
  const expensesJMD = expensesTotal * ADVANCE_TOTAL_RATE_JMD_PER_USD;
  const preTaxSubtotal = Math.max(0, input.freightCharge + dutyFeeNet + expensesJMD);
  // GCT is tax-inclusive: it's 16.5% of the final Total JMD, which itself includes
  // GCT. Solved algebraically: Total = subtotal / (1 - rate), GCT = Total - subtotal.
  const totalJMDRaw = input.gctEnabled ? preTaxSubtotal / (1 - GCT_RATE / 100) : preTaxSubtotal;
  const totalJMD = roundToHundred(totalJMDRaw);
  // GCT is derived from the rounded Total JMD so the two always add back up exactly.
  const gct = Math.max(0, totalJMD - preTaxSubtotal);
  const totalUSD = totalJMD / ADVANCE_TOTAL_RATE_JMD_PER_USD;
  return { advanceCharge, expensesTotal, totalUSD, totalJMD, gct };
}

// Maps a shipment's customer to the printInvoice() Bill-To fields — prefers the
// business alias name (if set) as the main heading, with the contact person's real
// name shown as a "Contact:" sub-line, matching the invoice template.
export function customerInvoiceFields(user: { name: string; email: string; phone?: string | null; aliasName?: string | null; address?: string | null; city?: string | null; country?: string | null } | null | undefined) {
  const name = user?.aliasName || user?.name || 'Unassigned';
  const contact = user?.aliasName && user.aliasName !== user.name ? user.name : undefined;
  const address = [user?.address, user?.city, user?.country].filter(Boolean).join(', ') || undefined;
  return {
    customerName: name,
    customerContact: contact,
    customerAddress: address,
    customerPhone: user?.phone || undefined,
    customerEmail: user?.email || '—',
  };
}

export function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// RXL Logistics company details shown in the invoice "From" panel — used by both the
// Freight (All Freight) and Shipment Information View/Update printed invoices.
export const COMPANY_INFO = {
  name: 'RXL Logistics',
  address: '10380 W State Rd 84 Unit 2, Davie, FL 33324',
  phone: '(954) 669-6738',
  email: 'info@rxllogistics.com',
  website: 'www.rxllogistics.com',
};

// Bank details shown in the invoice "Payment Method" panel.
export const PAYMENT_METHOD_INFO = {
  bank: 'NCB Business',
  accountName: 'RXL LOGISTICS',
  branch: 'Fairview',
  accountType: 'Checking',
  accountJmd: '431451972',
  accountUsd: '435893511',
};

// Deterministic invoice number derived from today's date + the tracking number, since
// there's no persisted invoice-number counter — e.g. INV-2026-0721.
function generateInvoiceNumber(trackingNumber: string): string {
  const year = new Date().getFullYear();
  const digits = (trackingNumber || '').replace(/\D/g, '');
  const suffix = (digits.slice(-4) || String(Date.now()).slice(-4)).padStart(4, '0');
  return `INV-${year}-${suffix}`;
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// One-line description shown under each line-item's bold label, matched by the label
// text the callers already use — falls back to blank for custom Fee labels.
function describeCharge(label: string): string {
  if (/^advance charge/i.test(label)) return 'Advance Payment';
  if (/^cube$/i.test(label)) return 'Sea Freight — Cube Charge';
  if (/^weight$/i.test(label)) return 'Air Freight — Weight Charge';
  if (/^freight$/i.test(label)) return 'Shipping & Handling';
  if (/^duty fee$/i.test(label)) return 'Customs Duty';
  if (/^gct$/i.test(label)) return 'General Consumption Tax';
  if (/^discount$/i.test(label)) return 'Discount Applied';
  return '';
}

const INVOICE_ICONS = {
  building: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v18"/><path d="M14 9h5a1 1 0 0 1 1 1v12"/><path d="M9 6h1"/><path d="M9 10h1"/><path d="M9 14h1"/><path d="M14 13h1"/><path d="M14 17h1"/><path d="M4 22h16"/></svg>',
  person: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  pin: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  phone: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L7.9 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/></svg>',
  mail: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
  globe: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg>',
  bank: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V9"/><path d="M19 21V9"/><path d="M9 21V9"/><path d="M15 21V9"/><path d="M2 9l10-6 10 6"/></svg>',
};

export function printInvoice(opts: {
  batchNumber?: string;
  trackingNumber: string;
  customerName: string;
  customerContact?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail: string;
  charges: { label: string; amount: number }[];
  totalUSD: number;
  totalJMD: number;
  amountPaid?: number;
}) {
  const win = window.open('', '_blank', 'width=800,height=1000');
  if (!win) return;

  const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const issueDate = new Date();
  // Payment terms are Due on Receipt — the due date matches the issue date.
  const dueDate = new Date(issueDate);

  const itemRows = opts.charges.map(c => {
    // The "Total Charges" line shows the batch name as its description instead of a
    // generic subtitle, so the customer can see which batch this invoice covers.
    const desc = /^total charges$/i.test(c.label) ? (opts.batchNumber || '') : describeCharge(c.label);
    return `
      <tr>
        <td style="padding:16px 4px;border-bottom:1px solid #eef0f3;">
          <div style="font-weight:700;color:#111827;">${esc(c.label)}</div>
          ${desc ? `<div style="color:#6b7280;font-size:12.5px;margin-top:2px;">${esc(desc)}</div>` : ''}
        </td>
        <td style="padding:16px 4px;border-bottom:1px solid #eef0f3;text-align:center;color:#374151;">1</td>
        <td style="padding:16px 4px;border-bottom:1px solid #eef0f3;text-align:center;color:#374151;">$${fmtMoney(c.amount * ADVANCE_TOTAL_RATE_JMD_PER_USD)}</td>
        <td style="padding:16px 4px;border-bottom:1px solid #eef0f3;text-align:right;font-weight:700;color:#111827;">$${fmtMoney(c.amount * ADVANCE_TOTAL_RATE_JMD_PER_USD)}</td>
      </tr>`;
  }).join('');

  const contactLine = opts.customerContact && opts.customerContact !== opts.customerName
    ? `<div class="row"><span class="ic">${INVOICE_ICONS.person}</span> Contact: ${esc(opts.customerContact)}</div>`
    : '';

  win.document.write(`
    <html>
      <head>
        <title>Invoice ${esc(opts.trackingNumber)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, Arial, sans-serif; color: #1f2937; padding: 36px; margin: 0; }
          .sheet { max-width: 760px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 14px; padding: 36px 40px; }
          .header { display: flex; align-items: flex-start; justify-content: space-between; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand img { width: 52px; height: 52px; object-fit: contain; }
          .brand .name { font-size: 20px; font-weight: 800; color: #111827; }
          .inv-label { text-align: right; color: #374151; font-weight: 800; font-size: 13px; letter-spacing: 0.5px; }
          .inv-number { text-align: right; font-size: 22px; font-weight: 800; color: #111827; margin-top: 2px; }
          .meta { margin-top: 12px; }
          .meta-row { display: flex; justify-content: flex-end; gap: 18px; font-size: 12.5px; color: #374151; margin-top: 4px; }
          .meta-row b { font-weight: 700; margin-right: 6px; }
          hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
          .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
          .panel-title { display: flex; align-items: center; gap: 6px; color: #374151; font-weight: 700; font-size: 13px; margin-bottom: 8px; }
          .cust-name { font-weight: 800; color: #111827; font-size: 15px; margin-bottom: 6px; }
          .row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #374151; margin-top: 5px; }
          .ic { display: inline-flex; width: 14px; flex-shrink: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 26px; }
          thead th { text-align: left; font-size: 11.5px; font-weight: 700; color: #fff; padding: 10px 4px; background: #374151; }
          thead th:nth-child(2), thead th:nth-child(3) { text-align: center; }
          thead th:last-child { text-align: right; }
          thead tr th:first-child { border-radius: 8px 0 0 8px; }
          thead tr th:last-child { border-radius: 0 8px 8px 0; }
          .bottom { margin-top: 26px; }
          .totals-box { background: #f3f4f6; border-radius: 12px; padding: 18px 20px; }
          .totals-row { display: flex; justify-content: space-between; font-size: 13.5px; color: #374151; }
          .totals-hr { border-top: 1px solid #d7deea; margin: 12px 0; }
          .totals-total { display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 15px; color: #111827; }
          .totals-total .amt-wrap { display: flex; flex-direction: column; align-items: flex-end; }
          .totals-total .amt { color: #111827; font-size: 24px; }
          .totals-total .amt-usd { color: #6b7280; font-size: 12px; font-weight: 600; margin-top: 2px; }
          .footer { text-align: center; color: #9ca3af; font-size: 12.5px; margin-top: 32px; padding-top: 18px; border-top: 1px solid #e5e7eb; }
          @media print { body { padding: 0; } .sheet { border: none; } }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div class="brand">
              <img src="/logo-print.png" alt="${esc(COMPANY_INFO.name)}" />
              <div class="name">${esc(COMPANY_INFO.name)}</div>
            </div>
            <div>
              <div class="inv-label">INVOICE</div>
              <div class="inv-number">${esc(generateInvoiceNumber(opts.trackingNumber))}</div>
              ${opts.batchNumber ? `<div class="meta-row"><b>Batch:</b> ${esc(opts.batchNumber)}</div>` : ''}
              <div class="meta-row"><b>Issue Date:</b> ${formatLongDate(issueDate)}</div>
              <div class="meta-row"><b>Due Date:</b> ${formatLongDate(dueDate)}</div>
              <div class="meta-row"><b>Payment Terms:</b> Due on Receipt</div>
            </div>
          </div>

          <hr />

          <div class="two-col">
            <div>
              <div class="panel-title">${INVOICE_ICONS.building} From</div>
              <div class="cust-name">${esc(COMPANY_INFO.name)}</div>
              <div class="row">${INVOICE_ICONS.pin} ${esc(COMPANY_INFO.address)}</div>
              <div class="row">${INVOICE_ICONS.phone} ${esc(COMPANY_INFO.phone)}</div>
              <div class="row">${INVOICE_ICONS.mail} ${esc(COMPANY_INFO.email)}</div>
              <div class="row">${INVOICE_ICONS.globe} ${esc(COMPANY_INFO.website)}</div>
            </div>
            <div>
              <div class="panel-title">${INVOICE_ICONS.person} Bill To</div>
              <div class="cust-name">${esc(opts.customerName)}</div>
              ${contactLine}
              <div class="row">${INVOICE_ICONS.mail} ${esc(opts.customerEmail)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr><th>Item Description</th><th>Quantity</th><th>Unit Price (JMD)</th><th>Amount (JMD)</th></tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>

          <div class="bottom">
            <div class="totals-box">
              <div class="totals-row"><span>Subtotal</span><span>$${fmtMoney(opts.totalJMD)}</span></div>
              <div class="totals-hr"></div>
              <div class="totals-total">
                <span>Total (JMD)</span>
                <span class="amt-wrap">
                  <span class="amt">$${fmtMoney(opts.totalJMD)}</span>
                  <span class="amt-usd">$${fmtMoney(opts.totalUSD)} USD</span>
                </span>
              </div>
            </div>
          </div>

          <div class="footer">Thank you for your business!</div>
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

export function printBatchInvoice(opts: { batchNumber: string; rows: { customerName: string; items: number; charges: number; discount: number; total: number }[] }) {
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return;
  const rows = opts.rows.map(r => `<tr><td style="padding:6px 8px;">${r.customerName}</td><td style="padding:6px 8px;text-align:center;">${r.items}</td><td style="padding:6px 8px;text-align:right;">$${fmtMoney(r.charges)}</td><td style="padding:6px 8px;text-align:right;">$${fmtMoney(r.discount)}</td><td style="padding:6px 8px;text-align:right;">$${fmtMoney(r.total)}</td></tr>`).join('');
  const totalItems = opts.rows.reduce((s, r) => s + r.items, 0);
  const totalCharges = opts.rows.reduce((s, r) => s + r.total, 0);
  win.document.write(`
    <html>
      <head>
        <title>Batch Invoice ${opts.batchNumber}</title>
        <style>
          body { font-family: -apple-system, Arial, sans-serif; padding: 32px; color: #1f2937; }
          h1 { font-size: 20px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; border-bottom: 2px solid #1f2937; padding: 6px 8px; font-size: 13px; }
          td { border-bottom: 1px solid #e5e7eb; font-size: 13px; }
          .total-row td { font-weight: 700; border-top: 2px solid #1f2937; border-bottom: none; }
        </style>
      </head>
      <body>
        <h1>RXL Logistics — Batch Invoice: ${opts.batchNumber}</h1>
        <table>
          <thead><tr><th>Customer</th><th style="text-align:center;">Items</th><th style="text-align:right;">Charges</th><th style="text-align:right;">Discount</th><th style="text-align:right;">Total</th></tr></thead>
          <tbody>
            ${rows}
            <tr class="total-row"><td>Total</td><td style="text-align:center;">${totalItems}</td><td></td><td></td><td style="text-align:right;">$${fmtMoney(totalCharges)}</td></tr>
          </tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

export interface LoadingGuideRow {
  description: string;
  height: number;
  width: number;
  length: number;
  pieces: number;
  cubes: number;
}

// Modern, minimalist replacement for the old boxy paper Loading Guide — same core
// fields (Drop Off Date / DR# / DEST / Consignee / Description / measurement table)
// but rendered with light hairlines, generous whitespace and a single accent color
// instead of a dense black grid, then opened in a print dialog (Save as PDF).
export function printLoadingGuide(opts: {
  drNumber: string;
  dropOffDate: string;
  destination: string;
  dropOffBy: string;
  consignee: string;
  description: string;
  items: LoadingGuideRow[];
  totalCubes: number;
  totalPieces: number;
}) {
  const win = window.open('', '_blank', 'width=800,height=1000');
  if (!win) return;

  const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Build the Date from the Y/M/D components rather than `new Date(isoString)` —
  // that parses as UTC midnight, which toLocaleDateString then rolls back a day in
  // any negative-UTC-offset timezone (Jamaica is UTC-5).
  const dropOffDate = opts.dropOffDate
    ? (() => { const [y, m, d] = opts.dropOffDate.slice(0, 10).split('-').map(Number); return formatLongDate(new Date(y, m - 1, d)); })()
    : '—';

  const rows = opts.items.map(i => `
    <tr>
      <td class="desc">${esc(i.description || '—')}</td>
      <td class="num">${i.pieces || 1}</td>
      <td class="num">${i.height || 0}</td>
      <td class="num">${i.width || 0}</td>
      <td class="num">${i.length || 0}</td>
      <td class="num cubes">${i.cubes || 0}</td>
    </tr>`).join('');

  win.document.write(`
    <html>
      <head>
        <title>Loading Guide ${esc(opts.drNumber)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, Arial, sans-serif; color: #000; padding: 36px; margin: 0; }
          .sheet { max-width: 720px; margin: 0 auto; }
          .header { display: flex; align-items: flex-start; justify-content: space-between; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand img { width: 46px; height: 46px; object-fit: contain; }
          .brand .name { font-size: 18px; font-weight: 800; color: #000; }
          .brand .tag { font-size: 11.5px; color: #000; margin-top: 1px; }
          .doc-label { text-align: right; color: #2563eb; font-weight: 800; font-size: 12px; letter-spacing: 1px; }
          .doc-number { text-align: right; font-size: 24px; font-weight: 800; color: #000; margin-top: 2px; }
          hr { border: none; border-top: 1px solid #e5e7eb; margin: 22px 0; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
          .meta-box { background: #f9fafb; border-radius: 10px; padding: 12px 14px; }
          .meta-box .label { font-size: 10.5px; font-weight: 700; color: #000; letter-spacing: 0.5px; text-transform: uppercase; }
          .meta-box .value { font-size: 14px; font-weight: 700; color: #000; margin-top: 3px; }
          .info-grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 18px; }
          .info-row .label { font-size: 10.5px; font-weight: 700; color: #000; letter-spacing: 0.5px; text-transform: uppercase; }
          .info-row .value { font-size: 13.5px; color: #000; margin-top: 2px; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin-top: 26px; }
          thead th { text-align: left; font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; padding: 0 4px 8px; border-bottom: 2px solid #2563eb; }
          thead th.num { text-align: right; }
          tbody td { padding: 10px 4px; border-bottom: 1px solid #eef0f3; font-size: 13px; color: #000; }
          tbody td.desc { font-weight: 600; color: #000; }
          tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
          tbody td.cubes { font-weight: 700; color: #000; }
          .totals { display: flex; justify-content: flex-end; gap: 12px; margin-top: 18px; }
          .totals-box { background: #eff6ff; border-radius: 12px; padding: 14px 22px; display: flex; align-items: center; gap: 14px; }
          .totals-box .t-label { font-size: 11.5px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; }
          .totals-box .t-value { font-size: 22px; font-weight: 800; color: #000; }
          .footer { text-align: center; color: #000; font-size: 11.5px; margin-top: 36px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div class="brand">
              <img src="/logo-print.png" alt="${esc(COMPANY_INFO.name)}" />
              <div>
                <div class="name">${esc(COMPANY_INFO.name)}</div>
                <div class="tag">${esc(COMPANY_INFO.address)}</div>
              </div>
            </div>
            <div>
              <div class="doc-label">LOADING GUIDE</div>
              <div class="doc-number">${esc(opts.drNumber)}</div>
            </div>
          </div>

          <hr />

          <div class="meta-grid">
            <div class="meta-box">
              <div class="label">Drop Off Date</div>
              <div class="value">${dropOffDate}</div>
            </div>
            <div class="meta-box">
              <div class="label">DR#</div>
              <div class="value">${esc(opts.drNumber)}</div>
            </div>
            <div class="meta-box">
              <div class="label">Destination</div>
              <div class="value">${esc(opts.destination)}</div>
            </div>
            <div class="meta-box">
              <div class="label">Drop Off By</div>
              <div class="value">${esc(opts.dropOffBy)}</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-row">
              <div class="label">Consignee</div>
              <div class="value">${esc(opts.consignee)}</div>
            </div>
            ${opts.description ? `
            <div class="info-row">
              <div class="label">Description</div>
              <div class="value">${esc(opts.description)}</div>
            </div>` : ''}
          </div>

          <table>
            <thead>
              <tr><th>Description</th><th class="num">PC</th><th class="num">Height</th><th class="num">Width</th><th class="num">Length</th><th class="num">Cubes</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-box">
              <span class="t-label">Total PC</span>
              <span class="t-value">${opts.totalPieces}</span>
            </div>
            <div class="totals-box">
              <span class="t-label">Total Cubes</span>
              <span class="t-value">${opts.totalCubes}</span>
            </div>
          </div>

          <div class="footer">${esc(COMPANY_INFO.name)} &middot; ${esc(COMPANY_INFO.phone)} &middot; ${esc(COMPANY_INFO.website)}</div>
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

export function copyTableToClipboard(headers: string[], rows: string[][]) {
  const text = [headers, ...rows].map(r => r.join('\t')).join('\n');
  navigator.clipboard?.writeText(text);
}

export function downloadCsv(headers: string[], rows: string[][], filename: string) {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
