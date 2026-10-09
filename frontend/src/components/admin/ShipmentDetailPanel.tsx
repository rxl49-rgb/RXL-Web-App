import { useState, useMemo, useEffect } from 'react';
import { X, Plus, Minus, Ban, CreditCard, HelpCircle, Truck } from 'lucide-react';
import PrinterIcon from '../icons/PrinterIcon';
import api from '../../lib/api';
import { STATUS_OPTIONS, PICKUP_LOCATIONS, ISSUE_OPTIONS, computeCharges, fmtMoney, printInvoice, customerInvoiceFields, customerInvoiceUrls, Expense, parseExpenses, DEFAULT_EXCHANGE_RATE_JMD_PER_USD, DEFAULT_EXCHANGE_RATE_USD_PER_JMD, roundToHundred, GCT_RATE, ADVANCE_TOTAL_RATE_JMD_PER_USD } from '../../lib/freight';

export interface ShipmentDetail {
  id: string;
  trackingNumber: string;
  type: string;
  weight: number | null;
  dimensions: string | null;
  status: string;
  origin?: string | null;
  destination?: string | null;
  pickupLocation: string | null;
  courierInfo: string | null;
  issueStatus: string | null;
  batchDescription: string | null;
  itemPhotoUrl: string | null;
  customerNotes: string | null;
  managerComments: string | null;
  itemCount: number;
  items?: { id: string; courier: string; trackingNumber: string | null; description: string | null }[];
  custInvoiceTotal: number;
  advancePercent: number;
  cubeQty: number;
  cubeAmount: number;
  weightQty: number;
  weightAmount: number;
  freightCharge: number;
  dutyPercent: number;
  dutyFee: number;
  expenses: string | null;
  gct: number;
  discountPercent: number;
  totalUSD: number;
  totalJMD: number;
  amountPaid: number;
  paymentInvoiceUrls: string | null;
  customerInvoiceUrls: string | null;
  user: { name: string; email: string; phone?: string | null; aliasName?: string | null; address?: string | null; city?: string | null; country?: string | null } | null;
  batch: { id: string; batchNumber: string } | null;
}

interface Props {
  shipment: ShipmentDetail;
  mode: 'edit' | 'billing';
  onClose: () => void;
  onSaved: (updated: ShipmentDetail) => void;
  onNext?: () => void;
  hasNext?: boolean;
  onPrevious?: () => void;
  hasPrevious?: boolean;
}

interface FreightRatePreset {
  seaRatePerCubicFt: number;
  airRate1to10: number;
  airRate11to30: number;
  airRate31to50: number;
  airRate51to100: number;
  airRate100plus: number;
}

// Mirrors the tiered AIR schedule in backend/src/lib/freightRates.ts, sourced from the
// admin-editable rates (Pricing Presets) instead of the fallback constants.
function airRatePerLbFromPreset(weightLbs: number, rates: FreightRatePreset): number {
  if (weightLbs <= 10) return rates.airRate1to10;
  if (weightLbs <= 30) return rates.airRate11to30;
  if (weightLbs <= 50) return rates.airRate31to50;
  if (weightLbs <= 100) return rates.airRate51to100;
  return rates.airRate100plus;
}

function parsePaymentUrls(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// itemPhotoUrl stores a JSON-stringified array of photo URLs. Older shipments may still
// have a single raw URL string saved (pre-multi-photo), so fall back to treating that as
// a one-item array.
function parseItemPhotoUrls(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [raw];
  } catch {
    return [raw];
  }
}

export default function ShipmentDetailPanel({ shipment, mode, onClose, onSaved, onNext, hasNext, onPrevious, hasPrevious }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const [origin, setOrigin] = useState(shipment.origin || 'Miami, FL, USA');
  const [destination, setDestination] = useState(shipment.destination || 'Montego Bay, Jamaica');
  const [pickupLocation, setPickupLocation] = useState(shipment.pickupLocation || '');
  const [courierInfo, setCourierInfo] = useState(shipment.courierInfo || '');
  const [issueStatus, setIssueStatus] = useState(shipment.issueStatus || 'No issue');
  const [issueOptions, setIssueOptions] = useState<string[]>(ISSUE_OPTIONS);

  // Courier logos are managed on the admin Couriers screen — fetched once and looked up
  // by uppercased name wherever a courier badge is shown in this panel.
  const [courierLogos, setCourierLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    api.get('/couriers').then(r => {
      const map: Record<string, string> = {};
      (r.data as { name: string; logoUrl: string | null }[]).forEach(c => { if (c.logoUrl) map[c.name.toUpperCase()] = c.logoUrl; });
      setCourierLogos(map);
    }).catch(() => { /* logos just won't render if this fails */ });
  }, []);

  useEffect(() => {
    api.get('/presets/shipment-issues')
      .then(r => {
        const titles = (r.data.issues as { title: string; active: boolean }[])
          .filter(i => i.active)
          .map(i => i.title);
        if (titles.length > 0) setIssueOptions(titles);
      })
      .catch(() => { /* keep static fallback */ });
  }, []);
  const [batchDescription, setBatchDescription] = useState(shipment.batchDescription || '');
  const [managerComments, setManagerComments] = useState(shipment.managerComments || '');
  const [status, setStatus] = useState(shipment.status);
  const [itemPhotos, setItemPhotos] = useState<File[]>([]);
  const [existingItemPhotoUrls, setExistingItemPhotoUrls] = useState<string[]>(parseItemPhotoUrls(shipment.itemPhotoUrl));
  const [removingPhotoUrl, setRemovingPhotoUrl] = useState<string | null>(null);

  const [custInvoiceTotal, setCustInvoiceTotal] = useState(shipment.custInvoiceTotal || 0);
  const [advancePercent, setAdvancePercent] = useState(shipment.advancePercent || 0);
  const [cubeQty, setCubeQty] = useState(shipment.cubeQty || 0);
  const [cubeAmount, setCubeAmount] = useState(shipment.cubeAmount || 0);
  const [weightQty, setWeightQty] = useState(shipment.weightQty || 0);
  const [weightAmount, setWeightAmount] = useState(shipment.weightAmount || 0);
  // Freight is entered directly in JMD.
  const [freightCharge, setFreightCharge] = useState(shipment.freightCharge || 0);
  // Duty Fee shows the result of Invoice Total (converted to JMD) but stays a plain
  // editable input afterward, so it's fully customizable if it needs manual adjustment.
  const [dutyFee, setDutyFee] = useState(shipment.dutyFee || 0);

  // Duty Fee auto-fills from the Advance Charge result — Invoice Total × the selected
  // Advance % — converted to JMD using the USD->JMD rate, rounded to the nearest 100.
  // Still overridable afterward by typing directly into the field.
  const handleCustInvoiceTotalChange = (v: number) => {
    setCustInvoiceTotal(v);
    setDutyFee(roundToHundred(v * (advancePercent / 100) * jmdPerUsd));
  };
  const handleAdvancePercentChange = (p: number) => {
    setAdvancePercent(p);
    setDutyFee(roundToHundred(custInvoiceTotal * (p / 100) * jmdPerUsd));
  };

  const [expenses, setExpenses] = useState<Expense[]>(parseExpenses(shipment.expenses));
  // GCT toggle always starts OFF, regardless of any previously saved amount. GCT is now
  // tax-inclusive — 16.5% of the final Total JMD (which includes GCT itself) — and is
  // fully derived from Freight + Duty Fee + Fees, see computeCharges(). No longer a
  // separately editable/stored amount.
  const [gctEnabled, setGctEnabled] = useState(false);
  const handleGctToggle = (enabled: boolean) => setGctEnabled(enabled);
  const [discountPercent, setDiscountPercent] = useState(shipment.discountPercent || 0);
  // Discount is only ever subtracted from the Duty Fee line, never the other charges.
  // Duty Fee is JMD, so the discount amount is JMD too — also rounded to the nearest 100.
  const discountAmount = roundToHundred(dutyFee * discountPercent / 100);

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);

  const paymentUrls = parsePaymentUrls(shipment.paymentInvoiceUrls);

  // jmdPerUsd (USD->JMD) and usdPerJmd (JMD->USD) are independent rates, not derived
  // from each other — see Pricing Presets > Exchange Rate.
  const [jmdPerUsd, setJmdPerUsd] = useState(DEFAULT_EXCHANGE_RATE_JMD_PER_USD);
  const [usdPerJmd, setUsdPerJmd] = useState(DEFAULT_EXCHANGE_RATE_USD_PER_JMD);
  useEffect(() => {
    api.get('/currency').then(r => {
      setJmdPerUsd(r.data.jmdPerUsd);
      setUsdPerJmd(r.data.usdPerJmd);
    }).catch(() => { /* keep defaults */ });
  }, []);

  // Sea/Air freight rate presets (Pricing Presets screen) — used to auto-calculate the
  // Cube and Weight advance-charge amounts below from the entered quantities.
  const [freightRates, setFreightRates] = useState<FreightRatePreset | null>(null);
  useEffect(() => {
    api.get('/freight-rates').then(r => setFreightRates(r.data)).catch(() => { /* auto-calc just stays inactive until rates load */ });
  }, []);

  // Cube/Weight amounts auto-calculate (in JMD, converted from the USD rate presets
  // using the live exchange rate) the moment a quantity is entered — no manual Calc
  // step needed. Rounded to the nearest 100 as a calculated result; still a plain
  // editable input afterward for manual adjustment.
  // computeCharges() converts these back to USD internally so the overall totals stay
  // consistent with the rest of the (USD-denominated) charges.
  const handleCubeQtyChange = (q: number) => {
    setCubeQty(q);
    if (freightRates) setCubeAmount(roundToHundred(q * freightRates.seaRatePerCubicFt * jmdPerUsd));
  };
  const handleWeightQtyChange = (q: number) => {
    setWeightQty(q);
    if (freightRates) setWeightAmount(roundToHundred(q * airRatePerLbFromPreset(q, freightRates) * jmdPerUsd));
  };

  const live = useMemo(() => computeCharges({
    custInvoiceTotal, advancePercent, cubeAmount, weightAmount, freightCharge, dutyFee, expenses, gctEnabled, discountPercent,
  }, jmdPerUsd, usdPerJmd), [custInvoiceTotal, advancePercent, cubeAmount, weightAmount, freightCharge, dutyFee, expenses, gctEnabled, discountPercent, jmdPerUsd, usdPerJmd]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put(`/shipments/${shipment.id}`, {
        origin, destination,
        pickupLocation, courierInfo, issueStatus, batchDescription, managerComments, status,
        custInvoiceTotal, advancePercent, cubeQty, cubeAmount, weightQty, weightAmount,
        freightCharge, dutyFee, expenses: JSON.stringify(expenses), gct: live.gct, discountPercent,
      });

      if (itemPhotos.length > 0) {
        const fd = new FormData();
        itemPhotos.forEach(f => fd.append('photos', f));
        const { data: withPhoto } = await api.post(`/shipments/${shipment.id}/item-photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setItemPhotos([]);
        setExistingItemPhotoUrls(parseItemPhotoUrls(withPhoto.itemPhotoUrl));
        onSaved({ ...data, itemPhotoUrl: withPhoto.itemPhotoUrl });
      } else {
        onSaved(data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveItemPhoto = async (url: string) => {
    setRemovingPhotoUrl(url);
    try {
      const { data } = await api.delete(`/shipments/${shipment.id}/item-photo`, { data: { url } });
      setExistingItemPhotoUrls(parseItemPhotoUrls(data.itemPhotoUrl));
    } catch {
      // leave the photo list as-is if the removal failed
    } finally {
      setRemovingPhotoUrl(null);
    }
  };

  const handleSavePayment = async () => {
    setSavingPayment(true);
    try {
      let updated;
      if (paymentFile) {
        const fd = new FormData();
        fd.append('invoice', paymentFile);
        fd.append('amount', String(paymentAmount));
        fd.append('paymentType', paymentType);
        fd.append('referenceNumber', referenceNumber);
        fd.append('comment', paymentComment);
        ({ data: updated } = await api.post(`/shipments/${shipment.id}/payment-invoice`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
      } else {
        ({ data: updated } = await api.patch(`/shipments/${shipment.id}/payment`, { amount: paymentAmount, paymentType, referenceNumber, comment: paymentComment }));
      }
      onSaved(updated);
      setPaymentModalOpen(false);
      setPaymentAmount(0);
      setReferenceNumber('');
      setPaymentComment('');
    } catch {
      setError('Failed to save payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleInvoice = () => {
    // Billing (read-only) mode prints from the shipment's actual saved values — the
    // live editable state (freightCharge/dutyFee/live.gct/etc.) only reflects reality
    // in edit mode; in billing mode GCT's toggle always starts OFF, so live.gct would
    // incorrectly show 0 regardless of what was actually saved. Freight, Duty Fee,
    // Discount, and GCT are JMD amounts converted at the same fixed rate the Total
    // itself uses (ADVANCE_TOTAL_RATE_JMD_PER_USD), so the lines add up to the Total.
    const src = mode === 'billing'
      ? { freightCharge: shipment.freightCharge, dutyFee: shipment.dutyFee, discountPercent: shipment.discountPercent, gct: shipment.gct, expenses: parseExpenses(shipment.expenses) }
      : { freightCharge, dutyFee, discountPercent, gct: live.gct, expenses };
    const discountAmt = roundToHundred(src.dutyFee * src.discountPercent / 100);
    const charges: { label: string; amount: number }[] = [
      { label: 'Freight', amount: src.freightCharge / ADVANCE_TOTAL_RATE_JMD_PER_USD },
      { label: 'Duty Fee', amount: src.dutyFee / ADVANCE_TOTAL_RATE_JMD_PER_USD },
      ...(discountAmt > 0 ? [{ label: 'Discount', amount: -(discountAmt / ADVANCE_TOTAL_RATE_JMD_PER_USD) }] : []),
      ...src.expenses.map(e => ({ label: e.label || 'Expense', amount: e.amount })),
      { label: 'GCT', amount: src.gct / ADVANCE_TOTAL_RATE_JMD_PER_USD },
    ];
    printInvoice({
      batchNumber: shipment.batch?.batchNumber,
      trackingNumber: shipment.trackingNumber,
      ...customerInvoiceFields(shipment.user),
      charges,
      totalUSD: mode === 'billing' ? shipment.totalUSD : live.totalUSD,
      totalJMD: mode === 'billing' ? shipment.totalJMD : live.totalJMD,
      amountPaid: shipment.amountPaid,
    });
  };

  const balance = Math.max(0, shipment.totalUSD - shipment.amountPaid);
  // Persisted (saved) discount amount, shown in the read-only Billing view — mirrors
  // the same "discount only reduces Duty Fee" rule used by the edit-mode calculator.
  const billingDiscountAmount = parseFloat((shipment.dutyFee * shipment.discountPercent / 100).toFixed(2));
  // Grand Total (JMD) — Freight amount + Total Charges, shown on the Shipment Details main screen.
  const grandTotal = shipment.freightCharge + shipment.totalJMD;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl max-w-5xl w-full my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-white/10">
          <h3 className="font-bold text-gray-900 dark:text-white">Shipment Information <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">View/Update</span></h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
        </div>

        {error && <div className="mx-6 mt-4 bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}

        {mode === 'edit' ? (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-700 dark:bg-white/5 dark:border-white/10 dark:text-white/70">
                {shipment.user?.name || 'Unassigned'}
              </div>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-700 dark:bg-white/5 dark:border-white/10 dark:text-white/70">
                {shipment.user?.email || '—'}
              </div>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-gray-50 text-sm text-gray-700 dark:bg-white/5 dark:border-white/10 dark:text-white/70">
                {shipment.user?.phone || '—'}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Route:</label>
                <div className="flex items-center gap-2">
                  <input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Miami, FL, USA"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                  <span className="text-gray-400 dark:text-white/30 text-sm flex-shrink-0">→</span>
                  <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Montego Bay, Jamaica"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Courier & Tracking #:</label>
                <div className="space-y-1.5">
                  {shipment.items && shipment.items.length > 0 ? shipment.items.map(item => {
                    const logo = courierLogos[item.courier.toUpperCase()];
                    return (
                      <div key={item.id} className="flex items-center gap-2.5 border rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-white/5 dark:border-white/10">
                        <div className="w-6 h-6 rounded-md icon-glass flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                          {logo ? <img src={logo} alt={item.courier} className="w-full h-full object-contain" /> : <Truck className="w-3.5 h-3.5 text-brand-700 dark:text-accent-400" />}
                        </div>
                        <span className="text-gray-700 dark:text-white/70 font-medium flex-1 truncate">{item.courier}</span>
                        <span className="text-gray-500 dark:text-white/50 font-mono text-xs flex-shrink-0">{item.trackingNumber || '—'}</span>
                      </div>
                    );
                  }) : (
                    <div className="flex items-center gap-2.5 border rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-white/5 dark:border-white/10">
                      <div className="w-6 h-6 rounded-md icon-glass flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                        {courierInfo && courierLogos[courierInfo.toUpperCase()] ? (
                          <img src={courierLogos[courierInfo.toUpperCase()]} alt={courierInfo} className="w-full h-full object-contain" />
                        ) : (
                          <Truck className="w-3.5 h-3.5 text-brand-700 dark:text-accent-400" />
                        )}
                      </div>
                      <input value={courierInfo} onChange={e => setCourierInfo(e.target.value)} placeholder="Courier name, e.g. FedEx"
                        className="flex-1 min-w-0 bg-transparent text-sm text-gray-700 dark:text-white/70 focus:outline-none" />
                      <span className="text-gray-500 dark:text-white/50 font-mono text-xs flex-shrink-0">{shipment.trackingNumber || '—'}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Pickup Location:</label>
                <select value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                  <option value="">Select One</option>
                  {PICKUP_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <select value={issueStatus} onChange={e => setIssueStatus(e.target.value)}
                  className={`flex-1 border rounded-lg px-3 py-2 text-sm ${issueStatus !== 'No issue' ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300' : 'bg-white dark:bg-white/5 dark:border-white/10 dark:text-white'}`}>
                  {(issueOptions.includes(issueStatus) ? issueOptions : [issueStatus, ...issueOptions]).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <div>
                <textarea value={batchDescription} onChange={e => setBatchDescription(e.target.value)} placeholder="Batch Descriptions" rows={4}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-y bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Item photos</label>
                {existingItemPhotoUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {existingItemPhotoUrls.map(url => (
                      <div key={url} className="relative group">
                        <img src={url} alt="Item" className="w-20 h-20 object-cover rounded-lg border dark:border-white/10" />
                        <button type="button" onClick={() => handleRemoveItemPhoto(url)} disabled={removingPhotoUrl === url}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow hover:bg-red-600 disabled:opacity-50">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {itemPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {itemPhotos.map((f, i) => (
                      <div key={i} className="relative group">
                        <img src={URL.createObjectURL(f)} alt="Pending upload" className="w-20 h-20 object-cover rounded-lg border-2 border-dashed dark:border-white/20" />
                        <button type="button" onClick={() => setItemPhotos(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-500 text-white text-xs flex items-center justify-center shadow hover:bg-gray-600">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input type="file" accept="image/gif,image/jpeg,image/png" multiple onChange={e => {
                  const files = Array.from(e.target.files || []);
                  if (files.length) setItemPhotos(prev => [...prev, ...files]);
                  e.target.value = '';
                }} className="text-xs dark:text-white/60" />
                <p className="text-[11px] text-gray-400 dark:text-white/40 mt-1">New photos upload when you click Save.</p>

                {(() => { const invoiceUrls = customerInvoiceUrls(shipment.customerInvoiceUrls); return invoiceUrls.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/10">
                    <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Invoice</label>
                    <div className="flex flex-wrap gap-2">
                      {invoiceUrls.map(url => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                          <img src={url} alt="Customer invoice" className="w-20 h-20 object-cover rounded-lg border dark:border-white/10 hover:opacity-80 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </div>
                ); })()}
              </div>

              <div className="text-xs text-gray-500 dark:text-white/50">Customer Notes: {shipment.customerNotes || '—'}</div>

              <div>
                <textarea value={managerComments} onChange={e => setManagerComments(e.target.value)} placeholder="Manager Comments.." rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-y bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>

              <div>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Right column — Advance Charge + Discount */}
            <div className="space-y-4">
              <div className="border-2 border-amber-300 dark:border-amber-500/40 rounded-xl p-3 space-y-1.5">
                <h4 className="text-amber-700 dark:text-amber-400 font-semibold text-sm">Advance Charge</h4>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 dark:text-white/50 w-20 flex-shrink-0">Invoice Total</span>
                  <input type="number" value={custInvoiceTotal} onChange={e => handleCustInvoiceTotalChange(parseFloat(e.target.value) || 0)} className="no-spinner flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm text-right bg-amber-50 dark:bg-amber-500/10 dark:border-white/10 dark:text-white" />
                  <select value={advancePercent} onChange={e => handleAdvancePercentChange(parseFloat(e.target.value))} className="border rounded-lg px-1.5 py-1 text-xs w-[4.5rem] flex-shrink-0 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(p => <option key={p} value={p}>{p}%</option>)}
                  </select>
                  <span className="text-[11px] text-gray-400 dark:text-white/40 w-16 flex-shrink-0 text-right">${fmtMoney(live.advanceCharge)}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 dark:text-white/50 w-12 flex-shrink-0">Cube</span>
                  <input type="number" value={cubeQty} onChange={e => handleCubeQtyChange(parseFloat(e.target.value) || 0)} title={freightRates ? `$${freightRates.seaRatePerCubicFt.toFixed(2)}/cube → JMD` : 'Loading rate…'} className="no-spinner w-14 flex-shrink-0 border rounded-lg px-1.5 py-1 text-sm text-right bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                  <input type="number" placeholder="rate" value={cubeAmount} onChange={e => setCubeAmount(parseFloat(e.target.value) || 0)} title="JMD" className="no-spinner flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm text-right bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-white/40 flex-shrink-0">JMD</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 dark:text-white/50 w-12 flex-shrink-0">Weight</span>
                  <input type="number" value={weightQty} onChange={e => handleWeightQtyChange(parseFloat(e.target.value) || 0)} title={freightRates ? `$${airRatePerLbFromPreset(weightQty, freightRates).toFixed(2)}/lb → JMD` : 'Loading rate…'} className="no-spinner w-14 flex-shrink-0 border rounded-lg px-1.5 py-1 text-sm text-right bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                  <input type="number" placeholder="$" value={weightAmount} onChange={e => setWeightAmount(parseFloat(e.target.value) || 0)} title="JMD" className="no-spinner flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm text-right bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-white/40 flex-shrink-0">JMD</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 dark:text-white/50 w-12 flex-shrink-0">Freight</span>
                  <input type="number" value={freightCharge} onChange={e => setFreightCharge(parseFloat(e.target.value) || 0)} title="JMD" className="no-spinner flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm text-right bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-white/40 flex-shrink-0">JMD</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 dark:text-white/50 w-12 flex-shrink-0">Duty Fee</span>
                  <input type="number" value={dutyFee} onChange={e => setDutyFee(parseFloat(e.target.value) || 0)} title="Result of Invoice Total × Advance % — customizable" className="no-spinner flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm text-right bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-white/40 flex-shrink-0">JMD</span>
                </div>

                {expenses.map((exp, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setExpenses(expenses.filter((_, idx) => idx !== i))} className="w-5 h-5 rounded bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 flex items-center justify-center flex-shrink-0"><Minus className="w-3 h-3" /></button>
                    <input value={exp.label} onChange={e => setExpenses(expenses.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} placeholder="Fees" className="flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                    <input
                      type="number"
                      value={exp.baseAmount ?? ''}
                      onChange={e => {
                        const base = parseFloat(e.target.value) || 0;
                        setExpenses(expenses.map((x, idx) => idx === i ? { ...x, baseAmount: base, amount: parseFloat((base * (x.percent ?? 100) / 100).toFixed(2)) } : x));
                      }}
                      placeholder="Amt"
                      title="Fee amount"
                      className="no-spinner w-16 flex-shrink-0 border rounded-lg px-1.5 py-1 text-sm text-right bg-white dark:bg-white/5 dark:border-white/10 dark:text-white"
                    />
                    <span className="w-14 text-right text-[11px] font-semibold text-gray-600 dark:text-white/60 flex-shrink-0" title="Total (Amount × %)">${fmtMoney(exp.amount)}</span>
                    <select
                      value={exp.percent ?? 100}
                      onChange={e => {
                        const p = parseFloat(e.target.value);
                        setExpenses(expenses.map((x, idx) => idx === i ? { ...x, percent: p, amount: parseFloat(((x.baseAmount ?? 0) * p / 100).toFixed(2)) } : x));
                      }}
                      title="% of amount used to calculate the fee total"
                      className="border rounded-lg px-1 py-1 text-xs w-14 flex-shrink-0 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white"
                    >
                      {[0, 10, 25, 50, 75, 100].map(p => <option key={p} value={p}>{p}%</option>)}
                    </select>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setExpenses([...expenses, { label: '', amount: 0, baseAmount: 0, percent: 100 }])} className="w-6 h-6 rounded bg-green-600 hover:bg-green-700 text-white flex items-center justify-center flex-shrink-0"><Plus className="w-3.5 h-3.5" /></button>
                  <span className="text-[11px] text-gray-400 dark:text-white/40">Fees</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 dark:text-white/50 w-12 flex-shrink-0">GCT ({GCT_RATE}%)</span>
                  <span className="flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm text-right bg-gray-50 dark:bg-white/5 dark:border-white/10 dark:text-white/80">${fmtMoney(live.gct)}</span>
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-white/40 flex-shrink-0">JMD</span>
                  <button
                    type="button"
                    onClick={() => handleGctToggle(!gctEnabled)}
                    title={gctEnabled ? 'GCT included — click to exclude' : 'GCT excluded — click to include'}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${gctEnabled ? 'bg-brand-800' : 'bg-gray-300 dark:bg-white/20'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${gctEnabled ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="border dark:border-white/10 rounded-xl p-3 space-y-1.5">
                <h4 className="text-brand-700 dark:text-brand-400 font-semibold text-sm">Discount</h4>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 dark:text-white/50 w-12 flex-shrink-0">%</span>
                  <input type="number" value={discountPercent} onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)} className="no-spinner flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm text-right bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                </div>
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] text-gray-500 dark:text-white/50">Discount Amount</span>
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-white/70">${fmtMoney(discountAmount)} JMD</span>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-white/40 px-1">Applies only to the Duty Fee line.</p>
                <div className="flex items-center justify-between bg-gray-700 text-white rounded-xl px-4 py-4">
                  <span className="text-sm font-semibold">Total JMD</span><span className="text-xl font-bold">{fmtMoney(live.totalJMD)}</span>
                </div>
                <div className="flex items-center justify-between bg-brand-700 text-white rounded-xl px-4 py-4">
                  <span className="text-sm font-semibold">Total USD</span><span className="text-xl font-bold">{fmtMoney(live.totalUSD)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={onClose} className="px-5 py-2.5 text-sm text-gray-500 dark:text-white/60 border dark:border-white/10 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left — read-only summary */}
            <div className="space-y-3">
              {shipment.batch && <div className="text-sm border rounded-lg px-3 py-2 bg-gray-50 dark:bg-white/5 dark:border-white/10 dark:text-white/80">{shipment.batch.batchNumber}</div>}
              <div className="text-sm border rounded-lg px-3 py-2 bg-gray-50 dark:bg-white/5 dark:border-white/10 dark:text-white/80">{shipment.user?.name || 'Unassigned'}</div>
              <div className="text-sm border rounded-lg px-3 py-2 bg-gray-50 dark:bg-white/5 dark:border-white/10 dark:text-white/80">{shipment.user?.email || '—'}</div>
              <div className="text-sm border rounded-lg px-3 py-2 bg-gray-50 dark:bg-white/5 dark:border-white/10 dark:text-white/80">{shipment.user?.phone || '—'}</div>
              <div className="space-y-1.5">
                {shipment.items && shipment.items.length > 0 ? shipment.items.map(item => {
                  const logo = courierLogos[item.courier.toUpperCase()];
                  return (
                    <div key={item.id} className="flex items-center gap-2.5 border rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-white/5 dark:border-white/10">
                      <div className="w-6 h-6 rounded-md icon-glass flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                        {logo ? <img src={logo} alt={item.courier} className="w-full h-full object-contain" /> : <Truck className="w-3.5 h-3.5 text-brand-700 dark:text-accent-400" />}
                      </div>
                      <span className="text-gray-700 dark:text-white/70 font-medium flex-1 truncate">{item.courier}</span>
                      <span className="text-gray-500 dark:text-white/50 font-mono text-xs flex-shrink-0">{item.trackingNumber || '—'}</span>
                    </div>
                  );
                }) : (
                  <div className="flex items-center gap-2.5 border rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-white/5 dark:border-white/10">
                    <div className="w-6 h-6 rounded-md icon-glass flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                      {shipment.courierInfo && courierLogos[shipment.courierInfo.toUpperCase()] ? (
                        <img src={courierLogos[shipment.courierInfo.toUpperCase()]} alt={shipment.courierInfo} className="w-full h-full object-contain" />
                      ) : (
                        <Truck className="w-3.5 h-3.5 text-brand-700 dark:text-accent-400" />
                      )}
                    </div>
                    <span className="text-gray-700 dark:text-white/70 font-medium flex-1 truncate">{shipment.courierInfo || '—'}</span>
                    <span className="text-gray-500 dark:text-white/50 font-mono text-xs flex-shrink-0">{shipment.trackingNumber || '—'}</span>
                  </div>
                )}
              </div>
              {shipment.issueStatus && shipment.issueStatus !== 'No issue' ? (
                <div className="text-sm text-red-600 dark:text-red-400 font-semibold">{shipment.issueStatus}</div>
              ) : (
                <div className="text-sm text-gray-400 dark:text-white/40">No issue</div>
              )}
              <div>
                <textarea value={managerComments} onChange={e => setManagerComments(e.target.value)} placeholder="Manager Comments" rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-y bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>
            </div>

            {/* Right — charges/paid/balance + payment invoices */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-2 border-amber-300 dark:border-amber-500/40 rounded-lg px-3 py-2 text-sm font-medium dark:text-white">
                <span>$ Charges (JMD)</span><span>{fmtMoney(shipment.totalJMD)}</span>
              </div>
              <div className="flex items-center justify-between border dark:border-white/10 rounded-lg px-3 py-2 text-sm dark:text-white">
                <span>$US Charge</span><span>{fmtMoney(shipment.totalUSD)}</span>
              </div>
              <div className="flex items-center justify-between border border-brand-300 dark:border-brand-500/40 rounded-lg px-3 py-2 text-sm text-brand-700 dark:text-brand-400">
                <span>Discount (JMD)</span><span>-{fmtMoney(billingDiscountAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-2 border-green-300 dark:border-green-500/40 rounded-lg px-3 py-2 text-sm font-medium dark:text-white">
                <span>$ Paid (JMD)</span><span>{fmtMoney(shipment.amountPaid * ADVANCE_TOTAL_RATE_JMD_PER_USD)}</span>
              </div>
              <div className="flex items-center justify-between border-2 border-red-300 dark:border-red-500/40 rounded-lg px-3 py-2 text-sm font-medium dark:text-white">
                <span>$ Balance (JMD)</span><span>{fmtMoney(balance * ADVANCE_TOTAL_RATE_JMD_PER_USD)}</span>
              </div>

              <div className="border dark:border-white/10 rounded-lg overflow-hidden">
                <div className="text-xs font-semibold text-gray-500 dark:text-white/50 px-3 py-1.5 border-b dark:border-white/10 bg-gray-50 dark:bg-white/5">Total Calculation (JMD)</div>
                <div className="divide-y dark:divide-white/10">
                  <div className="flex items-center justify-between px-3 py-1.5 text-sm dark:text-white">
                    <span className="text-gray-500 dark:text-white/50">Shipment Pcs</span><span>{shipment.itemCount}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5 text-sm dark:text-white">
                    <span className="text-gray-500 dark:text-white/50">Discount</span><span>-{fmtMoney(billingDiscountAmount)} JMD</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5 text-sm dark:text-white">
                    <span className="text-gray-500 dark:text-white/50">Freight</span><span>{fmtMoney(shipment.freightCharge)} JMD</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5 text-sm font-semibold dark:text-white">
                    <span>Total Charges</span><span>{fmtMoney(shipment.totalJMD)} JMD</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-sm font-bold bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400">
                    <span>Grand Total</span><span>{fmtMoney(grandTotal)} JMD</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[0, 1].map(i => (
                  <div key={i} className="border dark:border-white/10 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 dark:text-white/50 px-2 py-1 border-b dark:border-white/10">Payment Invoice</div>
                    <div className="h-24 flex items-center justify-center">
                      {paymentUrls[i] ? (
                        <img src={paymentUrls[i]} alt="Payment invoice" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <HelpCircle className="w-6 h-6 text-blue-300 dark:text-blue-400/60" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button onClick={onClose} className="flex items-center gap-1.5 px-4 py-2 text-sm border dark:border-white/10 rounded-lg text-gray-600 dark:text-white/60"><Ban className="w-4 h-4" /> Cancel</button>
                <button onClick={() => setPaymentModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white rounded-lg"><CreditCard className="w-4 h-4" /> Add/View Payment</button>
                <button onClick={handleInvoice} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-800 text-white rounded-lg"><PrinterIcon className="w-4 h-4" /> Invoice</button>
              </div>
            </div>
          </div>
        )}

        {(onNext || onPrevious) && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t dark:border-white/10">
            {onPrevious && (
              <button onClick={onPrevious} disabled={!hasPrevious} className="px-4 py-2 text-sm font-semibold border dark:border-white/10 rounded-lg text-gray-600 dark:text-white/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                Previous
              </button>
            )}
            {onNext && (
              <button onClick={onNext} disabled={!hasNext} className="px-4 py-2 text-sm font-semibold bg-brand-800 hover:bg-brand-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Next
              </button>
            )}
          </div>
        )}

        {paymentModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl max-w-sm w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-gray-900 dark:text-white">Payment — {shipment.trackingNumber}</h4>
                <button onClick={() => setPaymentModalOpen(false)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
              </div>
              <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">JMD Amount</label>
              <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} className="no-spinner w-full border rounded-lg px-3 py-2 text-sm mb-3 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Payment Type</label>
              <select value={paymentType} onChange={e => setPaymentType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-3 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                {['Cash', 'Credit Card', 'Bank Transfer', 'Cheque', 'Paid in USD', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Reference #</label>
              <input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="e.g. transaction/authorization number" className="w-full border rounded-lg px-3 py-2 text-sm mb-3 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Comment</label>
              <input value={paymentComment} onChange={e => setPaymentComment(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-3 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Payment invoice image (optional)</label>
              <input type="file" accept="image/gif,image/jpeg,image/png" onChange={e => setPaymentFile(e.target.files?.[0] || null)} className="text-sm mb-4 w-full dark:text-white/60" />
              <button onClick={handleSavePayment} disabled={savingPayment || paymentAmount <= 0} className="w-full bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50">
                {savingPayment ? 'Saving…' : 'Save payment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
