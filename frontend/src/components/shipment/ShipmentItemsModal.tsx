import { useRef, useState } from 'react';
import { X, Plane, Ship, Truck, Clock, Plus, Upload } from 'lucide-react';
import PrinterIcon from '../icons/PrinterIcon';
import DeleteIcon from '../icons/DeleteIcon';
import { useAuth } from '../../context/AuthContext';
import { STATUS_OPTIONS, STATUS_LABEL, STATUS_STYLE } from '../../lib/freight';

const STATUS_STYLE_DARK: Record<string, string> = {
  RECEIVED_FLORIDA: 'dark:bg-cyan-500/15 dark:text-cyan-300',
  IN_TRANSIT: 'dark:bg-blue-500/15 dark:text-blue-300',
  AT_PORT_JAMAICA: 'dark:bg-orange-500/15 dark:text-orange-300',
  PROCESSING: 'dark:bg-white/10 dark:text-white/70',
  OUT_FOR_DELIVERY: 'dark:bg-purple-500/15 dark:text-purple-300',
  DELIVERED: 'dark:bg-green-500/15 dark:text-green-300',
};

const STATUS_STEPS = STATUS_OPTIONS.map(s => s.value);
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatHeaderDate(dateStr: string): string {
  const d = new Date(dateStr);
  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const pastDays = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
  const week = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
  return `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()} WK${week}`;
}

export interface ShipmentItemRow {
  id: string;
  courier: string;
  trackingNumber?: string | null;
  description?: string | null;
}

export interface ModalShipment {
  id: string;
  trackingNumber: string;
  type: string;
  status: string;
  origin: string;
  destination: string;
  totalUSD: number;
  amountPaid?: number;
  itemCount: number;
  createdAt: string;
  items?: ShipmentItemRow[];
  issueStatus?: string | null;
  batch?: { batchNumber: string } | null;
}

export default function ShipmentItemsModal({ shipment, onClose }: { shipment: ModalShipment; onClose: () => void }) {
  const { user } = useAuth();
  const [invoiceFiles, setInvoiceFiles] = useState<string[]>([]);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stepIndex = Math.max(0, STATUS_STEPS.indexOf(shipment.status));
  const progressPct = STATUS_STEPS.length > 1 ? (stepIndex / (STATUS_STEPS.length - 1)) * 100 : 0;
  const TypeIcon = shipment.type === 'SEA' ? Ship : Plane;
  const items = shipment.items || [];
  const amountPaid = shipment.amountPaid ?? 0;

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const names = Array.from(e.target.files || []).map(f => f.name);
    setInvoiceFiles(prev => [...prev, ...names]);
    setUploaded(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=640,height=800');
    if (!w) return;
    const rows = items.map(it => `<div style="margin-bottom:6px;"><strong>(${it.courier})</strong> ${it.trackingNumber || it.description || '—'}</div>`).join('');
    w.document.write(`
      <html>
        <head><title>Invoice — ${shipment.trackingNumber}</title></head>
        <body style="font-family: -apple-system, sans-serif; padding: 32px; color: #111;">
          <h2 style="margin-bottom:4px;">RXL Logistics</h2>
          <p style="color:#666; margin-top:0;">Invoice for ${shipment.trackingNumber}</p>
          <hr />
          <p><strong>Shipped By:</strong> ${user?.name || '—'}</p>
          <p><strong>Route:</strong> Florida, USA &rarr; Montego Bay, JA</p>
          <p><strong>Status:</strong> ${STATUS_LABEL[shipment.status] || shipment.status}</p>
          <h3>Items</h3>
          ${rows || '<p>No tracking numbers on file.</p>'}
          <hr />
          <p><strong>Total Charges:</strong> $${shipment.totalUSD.toFixed(2)}</p>
          <p><strong>Amount Paid:</strong> $${amountPaid.toFixed(2)}</p>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div className="relative panel-glass rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap text-sm">
              <span className="text-brand-700 dark:text-accent-400 font-bold">{shipment.itemCount} Item{shipment.itemCount === 1 ? '' : 's'}</span>
              <span className="text-gray-400 dark:text-white/30">,</span>
              <span className="text-gray-700 dark:text-white/70">Shipped By: <strong className="text-gray-900 dark:text-white">{user?.name || '—'}</strong></span>
            </div>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-1 flex items-center gap-1">
              <TypeIcon className="w-3 h-3" /> {shipment.trackingNumber}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
            <span className="text-[11px] text-gray-400 dark:text-white/30 flex items-center gap-1 whitespace-nowrap">
              <Clock className="w-3 h-3" /> ({formatHeaderDate(shipment.createdAt)}) <strong className="text-gray-600 dark:text-white/60">{STATUS_LABEL[shipment.status] || shipment.status}</strong>
            </span>
          </div>
        </div>

        <div className="px-6 pb-4">
          <p className="text-sm text-gray-700 dark:text-white/70 mb-1">
            Current Status: <span className="font-semibold text-gray-900 dark:text-white">{STATUS_LABEL[shipment.status] || shipment.status}</span>
          </p>
          <div className="h-2.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden mt-2">
            <div className="h-full bg-sky-400 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-2">Florida, USA → Montego Bay, JA</p>
        </div>

        <div className="px-6 pb-2 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-white/30 py-2">No tracking numbers on file for this shipment yet.</p>
          ) : items.map(item => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                <Truck className="w-4 h-4 text-brand-700 dark:text-accent-400" />
              </div>
              <p className="text-gray-800 dark:text-white/80">
                <span className="font-bold">({item.courier})</span>{' '}
                {item.trackingNumber || item.description || '—'}
              </p>
            </div>
          ))}
        </div>

        {/* Invoice upload */}
        <div className="px-6 pt-3 pb-1">
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 transition-colors text-white text-xs font-semibold px-3.5 py-2 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" /> Add purchase Invoice(s) to be uploaded
            </button>
            <button
              onClick={() => setUploaded(true)}
              disabled={invoiceFiles.length === 0}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-40 transition-colors text-white text-xs font-semibold px-3.5 py-2 rounded-xl"
            >
              <Upload className="w-3.5 h-3.5" /> Upload Invoice(s)
            </button>
            <button
              onClick={() => { setInvoiceFiles([]); setUploaded(false); }}
              disabled={invoiceFiles.length === 0}
              className="flex items-center gap-1.5 bg-red-400 hover:bg-red-500 disabled:opacity-40 transition-colors text-white text-xs font-semibold px-3.5 py-2 rounded-xl"
            >
              <DeleteIcon className="w-3.5 h-3.5" /> Remove All Invoice(s)
            </button>
          </div>
          {invoiceFiles.length > 0 && (
            <ul className="mt-2.5 space-y-1">
              {invoiceFiles.map((name, i) => (
                <li key={i} className="text-xs text-gray-500 dark:text-white/40 truncate">📎 {name}</li>
              ))}
            </ul>
          )}
          {uploaded && <p className="text-xs text-green-600 dark:text-green-400 mt-2">Invoice(s) uploaded.</p>}
        </div>

        <div className="flex items-center justify-between px-6 py-4 mt-2 border-t border-gray-100 dark:border-white/10">
          <p className="text-sm text-gray-600 dark:text-white/60">
            Total Charges: <strong className="text-gray-900 dark:text-white">${shipment.totalUSD.toFixed(2)}</strong>
            {' | '}Amount Paid: <strong className="text-gray-900 dark:text-white">${amountPaid.toFixed(2)}</strong>
          </p>
          <button onClick={handlePrint} className="flex items-center gap-1.5 text-brand-700 dark:text-accent-400 text-sm font-medium hover:text-accent-500 transition-colors flex-shrink-0">
            <PrinterIcon className="w-4 h-4" /> Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
