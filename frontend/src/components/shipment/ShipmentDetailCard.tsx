import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plane, Ship, Truck, Clock, Plus, Upload, Package, AlertTriangle, X, ExternalLink, Check } from 'lucide-react';
import PrinterIcon from '../icons/PrinterIcon';
import DeleteIcon from '../icons/DeleteIcon';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { STATUS_OPTIONS, STATUS_LABEL, STATUS_STYLE, printInvoice, customerInvoiceFields, parseExpenses, ADVANCE_TOTAL_RATE_JMD_PER_USD, roundToHundred } from '../../lib/freight';

const STATUS_STEPS = STATUS_OPTIONS.map(s => s.value);
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatHeaderDate(dateStr: string): string {
  const d = new Date(dateStr);
  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const pastDays = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
  const week = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
  return `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()} WK${week}`;
}

interface ShipmentItemRow {
  id: string;
  courier: string;
  trackingNumber?: string | null;
  description?: string | null;
}

interface ShipmentDetailData {
  id: string;
  trackingNumber: string;
  type: string;
  status: string;
  origin: string;
  destination: string;
  totalUSD: number;
  totalJMD: number;
  amountPaid: number;
  itemCount: number;
  createdAt: string;
  items: ShipmentItemRow[];
  customerInvoiceUrls: string | null;
  freightCharge: number;
  dutyFee: number;
  discountPercent: number;
  gct: number;
  expenses: string | null;
  batch: { batchNumber: string } | null;
  issueStatus?: string | null;
  courierInfo?: string | null;
}

function parseCustomerInvoiceUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
}
// Uploaded filenames aren't preserved server-side (files are stored under a generated
// name), so invoices are labeled by position — "Invoice 1", "Invoice 2", etc.
function invoiceExt(url: string): string {
  const m = url.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toUpperCase() : 'FILE';
}

interface Props {
  id: string;
  // Shows a close (×) button in the header — used when this card is rendered inline
  // inside an expandable panel (e.g. the Shipments list) rather than as its own page.
  onClose?: () => void;
  // Shows a "View Full Page" link in the header, pointing at the standalone
  // /shipment/:id page — used in the same inline context as onClose.
  showOpenLink?: boolean;
}

// The full shipment detail card — header, status/progress, courier & tracking list,
// purchase-invoice upload, totals, and Print Invoice. Used both as the body of the
// standalone Shipment Details page and inline inside the Shipments list's expandable
// preview panel, so it's entirely self-contained: it fetches its own data and manages
// its own upload state given just a shipment id.
export default function ShipmentDetailCard({ id, onClose, showOpenLink }: Props) {
  const { user } = useAuth();
  const [shipment, setShipment] = useState<ShipmentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Courier logos are managed on the admin Couriers screen — fetched once and looked up
  // by uppercased name wherever a courier badge is shown on this card.
  const [courierLogos, setCourierLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    api.get('/couriers').then(r => {
      const map: Record<string, string> = {};
      (r.data as { name: string; logoUrl: string | null }[]).forEach(c => { if (c.logoUrl) map[c.name.toUpperCase()] = c.logoUrl; });
      setCourierLogos(map);
    }).catch(() => { /* logos just won't render if this fails */ });
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    api.get(`/shipments/${id}`)
      .then(r => setShipment(r.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load shipment'))
      .finally(() => setLoading(false));
  }, [id]);

  const uploadedInvoices = parseCustomerInvoiceUrls(shipment?.customerInvoiceUrls);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...files]);
    setUploaded(false);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadInvoices = async () => {
    if (!shipment || pendingFiles.length === 0) return;
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      pendingFiles.forEach(f => fd.append('files', f));
      const { data } = await api.post(`/shipments/${shipment.id}/customer-invoice`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShipment(data);
      setPendingFiles([]);
      setUploaded(true);
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAllInvoices = async () => {
    setPendingFiles([]);
    setUploaded(false);
    setUploadError('');
    if (!shipment || uploadedInvoices.length === 0) return;
    try {
      const { data } = await api.delete(`/shipments/${shipment.id}/customer-invoice`);
      setShipment(data);
    } catch {
      setUploadError('Failed to remove invoices');
    }
  };

  // Same itemized invoice template used on the admin website's customer invoice — built from
  // the shipment's real charges (Freight, Duty Fee, Discount, expenses, GCT) rather than a
  // simplified print-out.
  const handlePrint = () => {
    if (!shipment) return;
    const discountAmt = roundToHundred((shipment.dutyFee || 0) * (shipment.discountPercent || 0) / 100);
    const expenses = parseExpenses(shipment.expenses);
    const charges: { label: string; amount: number }[] = [
      { label: 'Freight', amount: (shipment.freightCharge || 0) / ADVANCE_TOTAL_RATE_JMD_PER_USD },
      { label: 'Duty Fee', amount: (shipment.dutyFee || 0) / ADVANCE_TOTAL_RATE_JMD_PER_USD },
      ...(discountAmt > 0 ? [{ label: 'Discount', amount: -(discountAmt / ADVANCE_TOTAL_RATE_JMD_PER_USD) }] : []),
      ...expenses.map(e => ({ label: e.label || 'Expense', amount: e.amount })),
      { label: 'GCT', amount: (shipment.gct || 0) / ADVANCE_TOTAL_RATE_JMD_PER_USD },
    ];
    printInvoice({
      batchNumber: shipment.batch?.batchNumber,
      trackingNumber: shipment.trackingNumber,
      ...customerInvoiceFields(user ? { name: user.name, email: user.email, phone: user.phone, address: user.address } : null),
      charges,
      totalUSD: shipment.totalUSD,
      totalJMD: shipment.totalJMD,
      amountPaid: shipment.amountPaid,
    });
  };

  const TypeIcon = shipment?.type === 'SEA' ? Ship : Plane;
  const hasIssue = !!shipment?.issueStatus && shipment.issueStatus !== 'No issue';
  const stepIndex = shipment ? Math.max(0, STATUS_STEPS.indexOf(shipment.status)) : 0;

  if (loading) return <div className="panel-glass rounded-2xl text-center py-16 text-gray-400 dark:text-white/30">Loading…</div>;
  if (error || !shipment) return (
    <div className="panel-glass rounded-2xl text-center py-16">
      <Package className="w-14 h-14 text-gray-200 dark:text-white/10 mx-auto mb-4" />
      <p className="text-gray-500 dark:text-white/50">{error || 'Shipment not found.'}</p>
    </div>
  );

  return (
    <div className="panel-glass rounded-2xl">
      <div className="flex items-start justify-between gap-3 p-6 pb-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <span className={`w-11 h-11 rounded-xl bg-brand-800 flex items-center justify-center flex-shrink-0 ${hasIssue ? 'shadow-glow-red animate-pulse' : ''}`}>
            <TypeIcon className="w-5 h-5 text-white" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">{shipment.batch?.batchNumber || shipment.trackingNumber}</h2>
              {hasIssue && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
            </div>
            {shipment.batch?.batchNumber && <p className="text-gray-400 dark:text-white/50 text-xs mt-0.5">Tracking #: {shipment.trackingNumber}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showOpenLink && (
            <Link to={`/shipment/${shipment.id}`} className="flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-accent-400 hover:underline whitespace-nowrap">
              View Full Page <ExternalLink className="w-3 h-3" />
            </Link>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 p-1">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {hasIssue && (
        <div className="mx-6 mt-4 flex items-center gap-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm font-medium rounded-xl px-4 py-3 shadow-glow-red">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{shipment.issueStatus} — please check this shipment</span>
        </div>
      )}

      <div className="flex items-center justify-between px-6 pt-4 pb-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-accent-400 px-2.5 py-1 rounded-full">
            {shipment.itemCount} Item{shipment.itemCount === 1 ? '' : 's'}
          </span>
          <span className="text-sm text-gray-600 dark:text-white/60">Shipped By <strong className="text-gray-900 dark:text-white font-semibold">{user?.name || '—'}</strong></span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/40 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
          <Clock className="w-3 h-3" /> {formatHeaderDate(shipment.createdAt)}
        </span>
      </div>

      <div className="px-6 pt-4 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/30 mb-1">Current Status</p>
        <p className="text-base font-bold text-gray-900 dark:text-white mb-4">{STATUS_LABEL[shipment.status] || shipment.status}</p>

        {/* Circular-node timeline — filled/checked nodes for reached steps, connected
            by a blue line up to the current step, gray beyond it. */}
        <div className="flex items-start overflow-x-auto pb-1 -mx-1 px-1 hide-scrollbar">
          {STATUS_STEPS.map((step, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            const reached = i <= stepIndex;
            return (
              <div key={step} className={`flex items-center ${i === STATUS_STEPS.length - 1 ? 'flex-none' : 'flex-1 min-w-[60px]'}`}>
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${reached ? 'bg-brand-800 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-300 dark:text-white/20'} ${current ? 'ring-4 ring-brand-100 dark:ring-brand-500/20' : ''}`}>
                    {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                  </span>
                  <span className={`mt-1.5 text-[9px] leading-tight text-center max-w-[64px] font-medium ${reached ? 'text-gray-700 dark:text-white/70' : 'text-gray-300 dark:text-white/20'}`}>
                    {STATUS_OPTIONS[i].label}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <span className={`h-0.5 flex-1 min-w-[14px] mt-3.5 -mx-0.5 ${i < stepIndex ? 'bg-brand-800' : 'bg-gray-100 dark:bg-white/10'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Route — origin/destination with a dashed line and mode-of-transport icon,
            mirroring the shipping-label look. */}
        <div className="flex items-center gap-2 mt-5">
          <span className="text-xs font-semibold text-gray-700 dark:text-white/70 whitespace-nowrap">Florida, USA</span>
          <div className="flex-1 flex items-center gap-1.5 min-w-[24px]">
            <span className="flex-1 border-t border-dashed border-gray-200 dark:border-white/15" />
            <span className="w-6 h-6 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
              <TypeIcon className="w-3 h-3 text-brand-700 dark:text-accent-400" />
            </span>
            <span className="flex-1 border-t border-dashed border-gray-200 dark:border-white/15" />
          </div>
          <span className="text-xs font-semibold text-gray-700 dark:text-white/70 whitespace-nowrap">Montego Bay, JA</span>
        </div>
      </div>

      <div className="px-6 pb-2 space-y-3">
        {shipment.items.length === 0 ? (
          shipment.courierInfo || shipment.trackingNumber ? (
            <div className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 rounded-lg icon-glass flex items-center justify-center flex-shrink-0 overflow-hidden p-1.5">
                {(() => {
                  const logo = shipment.courierInfo ? courierLogos[shipment.courierInfo.toUpperCase()] : undefined;
                  return logo ? (
                    <img src={logo} alt={shipment.courierInfo || ''} className="w-full h-full object-contain" />
                  ) : (
                    <Truck className="w-5 h-5 text-brand-700 dark:text-accent-400" />
                  );
                })()}
              </div>
              <p className="text-gray-800 dark:text-white/80">
                {shipment.courierInfo && <span className="font-bold">({shipment.courierInfo})</span>}{shipment.courierInfo ? ' ' : ''}
                {shipment.trackingNumber}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-white/30 py-2">No tracking numbers on file for this shipment yet.</p>
          )
        ) : shipment.items.map(item => {
          const logo = courierLogos[item.courier.toUpperCase()];
          return (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 rounded-lg icon-glass flex items-center justify-center flex-shrink-0 overflow-hidden p-1.5">
                {logo ? (
                  <img src={logo} alt={item.courier} className="w-full h-full object-contain" />
                ) : (
                  <Truck className="w-5 h-5 text-brand-700 dark:text-accent-400" />
                )}
              </div>
              <p className="text-gray-800 dark:text-white/80">
                <span className="font-bold">({item.courier})</span>{' '}
                {item.trackingNumber || item.description || '—'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Invoice upload */}
      <div className="px-6 pt-3 pb-1">
        <input ref={fileInputRef} type="file" multiple hidden accept="image/*,application/pdf" onChange={handleFilesSelected} />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-white/80 text-xs font-semibold px-3.5 py-2 rounded-xl"
          >
            <Plus className="w-3.5 h-3.5 text-brand-700 dark:text-accent-400" /> Add purchase Invoice(s) to be uploaded
          </button>
          <button
            onClick={handleUploadInvoices}
            disabled={pendingFiles.length === 0 || uploading}
            className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue disabled:opacity-40 disabled:shadow-none transition-shadow text-white text-xs font-semibold px-3.5 py-2 rounded-xl"
          >
            <Upload className="w-3.5 h-3.5" /> {uploading ? 'Uploading…' : 'Upload Invoice(s)'}
          </button>
          <button
            onClick={handleRemoveAllInvoices}
            disabled={pendingFiles.length === 0 && uploadedInvoices.length === 0}
            className="flex items-center gap-1.5 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-xs font-semibold px-3.5 py-2 rounded-xl"
          >
            <DeleteIcon className="w-3.5 h-3.5" /> Remove All Invoice(s)
          </button>
        </div>
        {pendingFiles.length > 0 && (
          <ul className="mt-2.5 space-y-1">
            {pendingFiles.map((f, i) => (
              <li key={i} className="text-xs text-gray-500 dark:text-white/40 truncate">📎 {f.name} <span className="text-gray-400 dark:text-white/30">(not yet uploaded)</span></li>
            ))}
          </ul>
        )}
        {uploadedInvoices.length > 0 && (
          <ul className="mt-2.5 space-y-1">
            {uploadedInvoices.map((url, i) => (
              <li key={i} className="text-xs">
                <a href={url} target="_blank" rel="noreferrer" className="text-green-600 dark:text-green-400 hover:underline truncate">
                  📎 Invoice {i + 1} ({invoiceExt(url)})
                </a>
              </li>
            ))}
          </ul>
        )}
        {uploadError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{uploadError}</p>}
        {uploaded && <p className="text-xs text-green-600 dark:text-green-400 mt-2">Invoice(s) uploaded.</p>}
      </div>

      <div className="flex items-center justify-between px-6 py-4 mt-2 border-t border-gray-100 dark:border-white/10">
        <p className="text-sm text-gray-600 dark:text-white/60">
          Total Charges: <strong className="text-gray-900 dark:text-white">${shipment.totalUSD.toFixed(2)}</strong>
          {' | '}Amount Paid: <strong className="text-gray-900 dark:text-white">${shipment.amountPaid.toFixed(2)}</strong>
        </p>
        <button onClick={handlePrint} className="flex items-center gap-1.5 text-brand-700 dark:text-accent-400 text-sm font-medium hover:text-accent-500 transition-colors flex-shrink-0">
          <PrinterIcon className="w-4 h-4" /> Print Invoice
        </button>
      </div>
    </div>
  );
}
