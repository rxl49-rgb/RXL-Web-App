import { useState, useEffect, useMemo, Fragment } from 'react';
import { Plus, Minus, X, FileText, Save } from 'lucide-react';
import PrinterIcon from '../../components/icons/PrinterIcon';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { fmtMoney } from '../../lib/freight';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

interface BolRow {
  id: string;
  manifestId: string;
  documentNumber: string;
  dockReceiptNumber: string;
  shipper: string;
  consignee: string;
  notifyingParty: string;
  blDescription: string;
  numberOfPackages: string;
  measurementCft: string;
  weightLbs: string;
  weightKgs: string;
  charges: string;
  createdAt: string;
}

interface ManifestRow {
  id: string;
  groupLabel: string;
  billOfLading: string;
  masterBillOfLading: string;
  reportedDateKgn: string | null;
  reportedDateMby: string | null;
  containerNumber: string;
  vessel: string;
  portOfLading: string;
  status: 'PENDING' | 'RECEIVED';
  createdAt: string;
  // A manifest can hold multiple Bill of Lading records.
  billsOfLading: BolRow[];
}

const EMPTY_FORM = {
  groupLabel: '', billOfLading: '', masterBillOfLading: '', reportedDateKgn: '', reportedDateMby: '',
  containerNumber: '', vessel: '', portOfLading: '', status: 'PENDING' as 'PENDING' | 'RECEIVED',
};

function toDateInput(v: string | null) { return v ? v.slice(0, 10) : ''; }

const DEFAULT_SHIPPER = 'KXL LOGISTICS\n8005 NW 80TH STREET\nMIAMI, FL 33166\nUSA';

const EMPTY_BL_FORM = {
  documentNumber: '', dockReceiptNumber: '', shipper: DEFAULT_SHIPPER, consignee: '', notifyingParty: '',
  blDescription: '', numberOfPackages: '', measurementCft: '', weightLbs: '', weightKgs: '', charges: '',
};

export default function AdminManifest() {
  const { confirmDelete } = useDeleteGuard();
  const [manifests, setManifests] = useState<ManifestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [blPanelOpen, setBlPanelOpen] = useState(false);
  const [blManifestId, setBlManifestId] = useState<string | null>(null);
  const [blManifestRow, setBlManifestRow] = useState<ManifestRow | null>(null);
  // null = adding a new Bill of Lading; otherwise the id of the one being edited.
  const [blEditingId, setBlEditingId] = useState<string | null>(null);
  const [blForm, setBlForm] = useState(EMPTY_BL_FORM);
  const [blSaving, setBlSaving] = useState(false);
  const [blError, setBlError] = useState('');

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    api.get('/manifests', { params: { page, limit, search: search || undefined } })
      .then(r => { setManifests(r.data.manifests); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(() => showToast('Failed to load manifests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, limit]);

  const grouped = useMemo(() => {
    const map = new Map<string, ManifestRow[]>();
    for (const m of manifests) {
      if (!map.has(m.groupLabel)) map.set(m.groupLabel, []);
      map.get(m.groupLabel)!.push(m);
    }
    return Array.from(map.entries());
  }, [manifests]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setPanelOpen(true);
  };

  const openEdit = (m: ManifestRow) => {
    setEditingId(m.id);
    setForm({
      groupLabel: m.groupLabel, billOfLading: m.billOfLading, masterBillOfLading: m.masterBillOfLading || '',
      reportedDateKgn: toDateInput(m.reportedDateKgn), reportedDateMby: toDateInput(m.reportedDateMby),
      containerNumber: m.containerNumber, vessel: m.vessel, portOfLading: m.portOfLading, status: m.status,
    });
    setFormError('');
    setPanelOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await api.put(`/manifests/${editingId}`, form);
        showToast('Manifest updated');
      } else {
        await api.post('/manifests', form);
        showToast('Manifest added');
      }
      setPanelOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save manifest');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: ManifestRow) => {
    if (!(await confirmDelete(`Remove manifest ${m.groupLabel} (${m.billOfLading})?`))) return;
    try {
      await api.delete(`/manifests/${m.id}`);
      showToast('Manifest removed');
      load();
    } catch {
      showToast('Failed to remove manifest');
    }
  };

  // Expands upward above the manifest list, smooth CSS transition, no navigation.
  // Opens ready to add a new Bill of Lading — the manifest's existing ones (if any)
  // are listed above the form, each individually editable/deletable.
  const openBlPanel = (m: ManifestRow) => {
    setBlManifestId(m.id);
    setBlManifestRow(m);
    setBlEditingId(null);
    setBlForm(EMPTY_BL_FORM);
    setBlError('');
    setBlPanelOpen(true);
  };

  const closeBlPanel = () => {
    setBlPanelOpen(false);
    setTimeout(() => {
      setBlManifestId(null);
      setBlManifestRow(null);
      setBlEditingId(null);
    }, 300);
  };

  // Loads an existing Bill of Lading into the form for editing.
  const openBlEdit = (bol: BolRow) => {
    setBlEditingId(bol.id);
    setBlForm({
      documentNumber: bol.documentNumber || '',
      dockReceiptNumber: bol.dockReceiptNumber || '',
      shipper: bol.shipper || DEFAULT_SHIPPER,
      consignee: bol.consignee || '',
      notifyingParty: bol.notifyingParty || '',
      blDescription: bol.blDescription || '',
      numberOfPackages: bol.numberOfPackages || '',
      measurementCft: bol.measurementCft || '',
      weightLbs: bol.weightLbs || '',
      weightKgs: bol.weightKgs || '',
      charges: bol.charges || '',
    });
    setBlError('');
  };

  // Clears the form back to "add a new one" without closing the panel.
  const resetBlForm = () => {
    setBlEditingId(null);
    setBlForm(EMPTY_BL_FORM);
    setBlError('');
  };

  // Charges auto-calculates from Measurement (CFT) x $2.50 — still a plain editable
  // field afterward if the amount needs manual adjustment.
  const CFT_RATE = 2.5;
  const handleMeasurementCftChange = (v: string) => {
    const cft = parseFloat(v) || 0;
    setBlForm(f => ({ ...f, measurementCft: v, charges: (cft * CFT_RATE).toFixed(2) }));
  };

  const handleSaveBl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blManifestId) return;
    setBlSaving(true);
    setBlError('');
    try {
      if (blEditingId) {
        await api.put(`/manifests/bols/${blEditingId}`, blForm);
        showToast('Bill of Lading updated');
      } else {
        await api.post(`/manifests/${blManifestId}/bols`, blForm);
        showToast('Bill of Lading added');
      }
      const { data: bols } = await api.get(`/manifests/${blManifestId}/bols`);
      setBlManifestRow(prev => (prev ? { ...prev, billsOfLading: bols } : prev));
      resetBlForm();
      load();
    } catch (err: any) {
      setBlError(err?.response?.data?.error || 'Failed to save Bill of Lading');
    } finally {
      setBlSaving(false);
    }
  };

  const handleDeleteBol = async (bol: BolRow) => {
    if (!(await confirmDelete(`Remove Bill of Lading ${bol.documentNumber || bol.id}?`))) return;
    try {
      await api.delete(`/manifests/bols/${bol.id}`);
      showToast('Bill of Lading removed');
      setBlManifestRow(prev => (prev ? { ...prev, billsOfLading: prev.billsOfLading.filter(b => b.id !== bol.id) } : prev));
      if (blEditingId === bol.id) resetBlForm();
      load();
    } catch {
      showToast('Failed to remove Bill of Lading');
    }
  };

  const handlePrintBl = (m: ManifestRow, form: typeof EMPTY_BL_FORM) => {
    const win = window.open('', '_blank', 'width=1000,height=1000');
    if (!win) return;

    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const nl2br = (v: any) => esc(v).replace(/\n/g, '<br/>');

    const charges = parseFloat(form.charges || '0') || 0;
    const pcs = form.numberOfPackages ? `${esc(form.numberOfPackages)} Pcs` : '';
    const marksParts = [form.dockReceiptNumber ? `DR# ${esc(form.dockReceiptNumber)}` : '', pcs].filter(Boolean);
    const marks = marksParts.length ? marksParts.join(' / ') : '—';
    const reportedDate = [
      toDateInput(m.reportedDateKgn) ? `KGN ${toDateInput(m.reportedDateKgn)}` : '',
      toDateInput(m.reportedDateMby) ? `MBY ${toDateInput(m.reportedDateMby)}` : '',
    ].filter(Boolean).join(' / ');

    const today = new Date();
    const printDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    win.document.write(`
      <html>
        <head>
        <title>Bill of Lading ${esc(m.billOfLading)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, Arial, sans-serif; color: #111827; padding: 32px; margin: 0; }
          .sheet { max-width: 980px; margin: 0 auto; }
          .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 2px solid #111827; margin-bottom: 20px; }
          .header img { height: 56px; width: 56px; object-fit: contain; }
          .header h1 { font-size: 22px; font-weight: 800; letter-spacing: 1px; margin: 0; }
          .top-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px; align-items: stretch; }
          .box { border: 1px solid #111827; border-radius: 4px; overflow: hidden; }
          .box-section { padding: 10px 14px; border-bottom: 1px solid #111827; }
          .box-section:last-child { border-bottom: none; }
          .box-label { font-size: 11px; font-weight: 800; letter-spacing: 0.4px; margin-bottom: 4px; }
          .box-value { font-size: 12px; line-height: 1.5; }
          .kv-row { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 14px; border-bottom: 1px solid #111827; gap: 10px; }
          .kv-row:last-child { border-bottom: none; }
          .kv-label { font-size: 11px; font-weight: 800; }
          .kv-value { font-size: 12px; text-align: right; }
          .notice-head { background: #374151; color: #fff; font-size: 12px; font-weight: 800; letter-spacing: 0.5px; text-align: center; padding: 8px; }
          .notice-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #111827; }
          .notice-row:last-child { border-bottom: none; }
          .notice-row div { padding: 10px 12px; font-size: 11px; font-weight: 800; }
          .notice-row div:last-child { font-weight: 400; border-left: 1px solid #111827; }
          table.main { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          table.main th { background: #374151; color: #fff; text-align: left; font-size: 11px; font-weight: 800; letter-spacing: 0.4px; padding: 10px 12px; border: 1px solid #111827; }
          table.main td { border: 1px solid #111827; border-top: none; font-size: 12px; padding: 12px; vertical-align: top; height: 180px; }
          .bottom { display: grid; grid-template-columns: 1fr 1.4fr; gap: 20px; }
          table.charges { width: 100%; border-collapse: collapse; border: 1px solid #111827; height: fit-content; }
          table.charges th { background: #374151; color: #fff; text-align: left; font-size: 11px; font-weight: 800; padding: 8px 12px; }
          table.charges td { padding: 10px 12px; font-size: 13px; border-top: 1px solid #111827; }
          table.charges tr.total td { background: #f3f4f6; font-weight: 800; }
          .legal { font-size: 10.5px; line-height: 1.6; color: #374151; }
          .legal .date { margin-top: 14px; font-size: 11px; font-weight: 700; color: #111827; }
          @media print { body { padding: 0; } }
        </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <img src="/logo-print.png" alt="RXL Logistics" />
              <h1>BILL OF LADING</h1>
            </div>

            <div class="top-grid">
              <div class="box">
                <div class="box-section">
                  <div class="box-label">SHIPPER / EXPORTER</div>
                  <div class="box-value">${nl2br(form.shipper) || '—'}</div>
                </div>
                <div class="box-section">
                  <div class="box-label">CONSIGNEE</div>
                  <div class="box-value">${nl2br(form.consignee) || '—'}</div>
                </div>
                <div class="box-section">
                  <div class="box-label">NOTIFYING PARTY</div>
                  <div class="box-value">${nl2br(form.notifyingParty) || '—'}</div>
                </div>
              </div>

              <div class="box">
                <div class="kv-row"><span class="kv-label">DOCUMENT NUMBER</span><span class="kv-value">${esc(form.documentNumber) || '—'}</span></div>
                <div class="kv-row"><span class="kv-label">MASTER BILL OF LADING</span><span class="kv-value">${esc(m.masterBillOfLading) || '—'}</span></div>
                <div class="kv-row"><span class="kv-label">VOYAGER</span><span class="kv-value">${esc(m.vessel) || '—'}</span></div>
                <div class="kv-row"><span class="kv-label">PORT OF LADING</span><span class="kv-value">${esc(m.portOfLading) || '—'}</span></div>
              </div>

              <div class="box">
                <div class="notice-head">ARRIVAL NOTICE</div>
                <div class="notice-row"><div>REPORTED DATE</div><div>${reportedDate}</div></div>
                <div class="notice-row"><div>NATIONALITY</div><div></div></div>
                <div class="notice-row"><div>BERTH</div><div></div></div>
              </div>
            </div>

            <table class="main">
              <colgroup>
                <col style="width:26%;" />
                <col style="width:42%;" />
                <col style="width:16%;" />
                <col style="width:16%;" />
              </colgroup>
              <thead>
                <tr>
                  <th>DR# &amp; PC Count</th>
                  <th>Description of Packages and Goods</th>
                  <th>Gross Weight</th>
                  <th>Measurement</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${marks}</td>
                  <td>${nl2br(form.blDescription) || '—'}</td>
                  <td>${esc(form.weightLbs) || '—'} LBS / ${esc(form.weightKgs) || '—'} KGS</td>
                  <td>${esc(form.measurementCft) || '—'} CFT</td>
                </tr>
              </tbody>
            </table>

            <div class="bottom">
              <table class="charges">
                <thead><tr><th>Description</th><th style="text-align:right;">Amount</th></tr></thead>
                <tbody>
                  <tr><td>Freight Charge</td><td style="text-align:right;">$${fmtMoney(charges)}</td></tr>
                  <tr class="total"><td>TOTAL USD</td><td style="text-align:right;">$${fmtMoney(charges)}</td></tr>
                </tbody>
              </table>
              <div class="legal">
                These Commodities Licensed By US Law For Ultimate Destination : Jamaica
                RECEIVED the goods of the containers, vans, trailers, pallet units or other packages said to contain goods herein mentioned in apparent good order and condition, except as otherwise indicated, to be transported, delivered or transshipped as provided herein. All of the provisions written, printed or stamped on either side hereof are part of this bill of lading contract.
                IN WITNESS WHEREOF the Master or agent of said vessel has signed three (3) bills of lading, all of the same tenor and date, one of which became accomplished the others to stand void.
                <div class="date">DATE: ${printDate} (day/month/year)</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const handlePrint = (m: ManifestRow) => {
    const win = window.open('', '_blank', 'width=1000,height=900');
    if (!win) return;

    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const nl2br = (v: any) => esc(v).replace(/\n/g, '<br/>');

    const infoBox = (label: string, value: string) => `
      <div class="info-box">
        <div class="info-label">${label}</div>
        <div class="info-value">${value}</div>
      </div>`;

    const num = (v: string) => parseFloat(v || '0') || 0;
    const bols = m.billsOfLading || [];
    const totalPcs = bols.reduce((s, b) => s + num(b.numberOfPackages), 0);
    const totalLbs = bols.reduce((s, b) => s + num(b.weightLbs), 0);
    const totalKgs = bols.reduce((s, b) => s + num(b.weightKgs), 0);
    const totalCft = bols.reduce((s, b) => s + num(b.measurementCft), 0);
    const totalCharges = bols.reduce((s, b) => s + num(b.charges), 0);

    const bolRows = bols.length > 0 ? bols.map(b => `
                <tr>
                  <td>${esc(m.billOfLading) || '—'}</td>
                  <td>${esc(b.dockReceiptNumber) || '—'}</td>
                  <td>${nl2br(b.shipper) || '—'}</td>
                  <td>${nl2br(b.consignee) || '—'}</td>
                  <td>
                    ${nl2br(b.blDescription) || '—'}
                    <div class="pcs-total">Total ${b.numberOfPackages ? `${esc(b.numberOfPackages)} Pcs` : '—'}</div>
                  </td>
                  <td>
                    <div class="measure-line"><span>LBS</span><b>${esc(b.weightLbs) || '—'}</b></div>
                    <div class="measure-line"><span>KGS</span><b>${esc(b.weightKgs) || '—'}</b></div>
                    <div class="measure-line"><span>CFT</span><b>${esc(b.measurementCft) || '—'}</b></div>
                  </td>
                  <td class="charges-cell">$${fmtMoney(num(b.charges))}</td>
                </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:24px;">No Bills of Lading added yet.</td></tr>`;

    win.document.write(`
      <html>
        <head>
        <title>Cargo Manifest ${esc(m.groupLabel)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, Arial, sans-serif; color: #111827; padding: 32px; margin: 0; }
          .sheet { border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px 40px; max-width: 1150px; margin: 0 auto; }
          .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
          .header h1 { font-size: 34px; margin: 0 0 6px 0; letter-spacing: 0.5px; }
          .header h1 .cargo { font-weight: 800; color: #111827; }
          .header h1 .manifest { font-weight: 800; color: #9ca3af; margin-left: 6px; }
          .header .underline { width: 46px; height: 4px; background: #111827; border-radius: 2px; }
          .header img { height: 92px; width: 92px; object-fit: contain; }
          .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 26px; }
          .info-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; background: #fafafa; }
          .info-label { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: #6b7280; text-transform: uppercase; }
          .info-value { font-size: 15px; font-weight: 700; color: #111827; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; }
          thead tr { background: #f3f4f6; }
          th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: #374151; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
          td { padding: 14px 12px; font-size: 13px; color: #1f2937; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          tbody tr:last-child td { border-bottom: 1px solid #e5e7eb; }
          .measure-line { display: flex; justify-content: space-between; gap: 10px; font-weight: 600; margin-bottom: 3px; }
          .measure-line b { font-weight: 800; }
          .pcs-total { font-weight: 800; margin-top: 6px; }
          .charges-cell { font-weight: 800; font-size: 15px; }
          tfoot td { background: #f9fafb; font-weight: 800; border-bottom: none; border-top: 2px solid #e5e7eb; }
          @page { size: landscape; }
          @media print { body { padding: 0; } .sheet { border: none; } }
        </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div>
                <h1><span class="cargo">CARGO</span><span class="manifest">MANIFEST</span></h1>
                <div class="underline"></div>
              </div>
              <img src="/logo-print.png" alt="RXL Logistics" />
            </div>

            <div class="info-grid">
              ${infoBox('Bill of Lading #', esc(m.billOfLading) || '—')}
              ${infoBox('Container #', esc(m.containerNumber) || '—')}
              ${infoBox('Master Bill #', esc(m.masterBillOfLading) || '—')}
              ${infoBox('Vessel / Voyage', esc(m.vessel) || '—')}
              ${infoBox('Reported Date', `KGN: ${toDateInput(m.reportedDateKgn) || '—'} &nbsp;/&nbsp; MBY: ${toDateInput(m.reportedDateMby) || '—'}`)}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Bill of Lading #</th>
                  <th>Dock Receipt #</th>
                  <th>Shipper</th>
                  <th>Consignee</th>
                  <th>Description</th>
                  <th>Measurement &amp; Weight</th>
                  <th>Charges</th>
                </tr>
              </thead>
              <tbody>
                ${bolRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4">TOTAL</td>
                  <td>${totalPcs || '—'} Pcs</td>
                  <td>
                    <div class="measure-line"><span>LBS</span><b>${totalLbs || '—'}</b></div>
                    <div class="measure-line"><span>KGS</span><b>${totalKgs || '—'}</b></div>
                    <div class="measure-line"><span>CFT</span><b>${totalCft || '—'}</b></div>
                  </td>
                  <td class="charges-cell">$${fmtMoney(totalCharges)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const startEntry = total === 0 ? 0 : (page - 1) * limit + 1;
  const endEntry = Math.min(page * limit, total);

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manifest <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">Management</span></h1>
        <div className="text-sm text-gray-400 dark:text-white/40">Dashboard <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Manifest Management</span></div>
      </div>

      <div className="p-6 space-y-5">
        <div className="panel-glass rounded-2xl">
          <button onClick={() => setPanelOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">Manifest - Add/Update</h2>
            {panelOpen ? <Minus className="w-4 h-4 text-gray-400 dark:text-white/40" /> : <Plus className="w-4 h-4 text-gray-400 dark:text-white/40" />}
          </button>
          {panelOpen && (
            <form onSubmit={handleSave} className="border-t p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {formError && <div className="col-span-full bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Week *</label>
                <input required value={form.groupLabel} onChange={e => setForm(f => ({ ...f, groupLabel: e.target.value }))} placeholder="e.g. 2026-WEEK30" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Bill of Lading *</label>
                <input required value={form.billOfLading} onChange={e => setForm(f => ({ ...f, billOfLading: e.target.value }))} placeholder="e.g. SMLU9161727A / HBL211716" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Master Bill of Lading</label>
                <input value={form.masterBillOfLading} onChange={e => setForm(f => ({ ...f, masterBillOfLading: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Container Number *</label>
                <input required value={form.containerNumber} onChange={e => setForm(f => ({ ...f, containerNumber: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Reported Date (KGN)</label>
                <input type="date" value={form.reportedDateKgn} onChange={e => setForm(f => ({ ...f, reportedDateKgn: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Reported Date (MBY)</label>
                <input type="date" value={form.reportedDateMby} onChange={e => setForm(f => ({ ...f, reportedDateMby: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Vessel *</label>
                <input required value={form.vessel} onChange={e => setForm(f => ({ ...f, vessel: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Port of Lading *</label>
                <input required value={form.portOfLading} onChange={e => setForm(f => ({ ...f, portOfLading: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-full flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving…' : editingId ? 'Update manifest' : 'Add manifest'}
                </button>
                <button type="button" onClick={() => setPanelOpen(false)} className="text-sm text-gray-500 dark:text-white/50 px-4 py-2">Cancel</button>
              </div>
            </form>
          )}
        </div>

        <div className={`grid transition-all duration-300 ease-in-out ${blPanelOpen ? 'grid-rows-[1fr] opacity-100 mb-4' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            {blManifestRow && (
              <div className="bg-white dark:bg-[#1c1c1c] dark:border dark:border-white/10 rounded-2xl shadow-xl overflow-hidden">
                <div className="flex items-center justify-between bg-brand-800 rounded-t-2xl px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-white" />
                    <h2 className="text-white font-bold tracking-wide">{blManifestRow.groupLabel} — Bills of Lading</h2>
                  </div>
                  <button onClick={closeBlPanel} className="text-white/80 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                </div>

                {blManifestRow.billsOfLading.length > 0 && (
                  <div className="border-b dark:border-white/10 divide-y dark:divide-white/10 max-h-56 overflow-y-auto">
                    {blManifestRow.billsOfLading.map((bol, i) => (
                      <div key={bol.id} className={`flex items-center justify-between px-6 py-3 ${blEditingId === bol.id ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            #{i + 1} {bol.documentNumber ? `— ${bol.documentNumber}` : ''}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-white/50 truncate">
                            {(bol.shipper || '—').split('\n')[0]} · ${fmtMoney(parseFloat(bol.charges || '0') || 0)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button type="button" title="Edit" onClick={() => openBlEdit(bol)} className="w-7 h-7 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                          <button type="button" title="Print" onClick={() => blManifestRow && handlePrintBl(blManifestRow, bol)} className="w-7 h-7 rounded-lg text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors"><PrinterIcon className="w-3.5 h-3.5" /></button>
                          <button type="button" title="Delete" onClick={() => handleDeleteBol(bol)} className="w-7 h-7 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/25 flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSaveBl} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{blEditingId ? 'Edit Bill of Lading' : 'Add Bill of Lading'}</h3>
                    {blEditingId && (
                      <button type="button" onClick={resetBlForm} className="flex items-center gap-1 text-xs font-semibold text-brand-800 dark:text-brand-400 hover:underline">
                        <Plus className="w-3.5 h-3.5" /> Add new instead
                      </button>
                    )}
                  </div>
                  {blError && <div className="mb-4 bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{blError}</div>}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Document Number</label>
                        <div className="relative">
                          <input value={blForm.documentNumber} onChange={e => setBlForm(f => ({ ...f, documentNumber: e.target.value }))} className="w-full border rounded-lg pl-3 pr-9 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 dark:text-white/40"><PencilIcon className="w-3 h-3" /></span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Dock Receipt Number</label>
                        <div className="relative">
                          <input value={blForm.dockReceiptNumber} onChange={e => setBlForm(f => ({ ...f, dockReceiptNumber: e.target.value }))} className="w-full border rounded-lg pl-3 pr-9 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 dark:text-white/40"><PencilIcon className="w-3 h-3" /></span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Shipper</label>
                        <textarea value={blForm.shipper} onChange={e => setBlForm(f => ({ ...f, shipper: e.target.value }))} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Consignee</label>
                        <textarea value={blForm.consignee} onChange={e => setBlForm(f => ({ ...f, consignee: e.target.value }))} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Notifying Party</label>
                        <textarea value={blForm.notifyingParty} onChange={e => setBlForm(f => ({ ...f, notifyingParty: e.target.value }))} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Description</label>
                        <textarea value={blForm.blDescription} onChange={e => setBlForm(f => ({ ...f, blDescription: e.target.value }))} rows={4} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Number of Packages</label>
                        <div className="relative">
                          <input value={blForm.numberOfPackages} onChange={e => setBlForm(f => ({ ...f, numberOfPackages: e.target.value }))} className="w-full border rounded-lg pl-3 pr-9 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 dark:text-white/40"><PencilIcon className="w-3 h-3" /></span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Measurement (CFT)</label>
                        <div className="relative">
                          <input value={blForm.measurementCft} onChange={e => handleMeasurementCftChange(e.target.value)} title="Charges auto-calculates as CFT × $2.50" className="w-full border rounded-lg pl-3 pr-9 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 dark:text-white/40"><PencilIcon className="w-3 h-3" /></span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Weight (LBS)</label>
                        <div className="relative">
                          <input value={blForm.weightLbs} onChange={e => setBlForm(f => ({ ...f, weightLbs: e.target.value }))} className="w-full border rounded-lg pl-3 pr-9 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 dark:text-white/40"><PencilIcon className="w-3 h-3" /></span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Weight (KGS)</label>
                        <div className="relative">
                          <input value={blForm.weightKgs} onChange={e => setBlForm(f => ({ ...f, weightKgs: e.target.value }))} className="w-full border rounded-lg pl-3 pr-9 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 dark:text-white/40"><PencilIcon className="w-3 h-3" /></span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Charges</label>
                        <div className="relative">
                          <input value={blForm.charges} onChange={e => setBlForm(f => ({ ...f, charges: e.target.value }))} className="w-full border rounded-lg pl-3 pr-9 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 dark:text-white/40"><PencilIcon className="w-3 h-3" /></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-6 mt-2 border-t dark:border-white/10">
                    <button type="button" onClick={() => blManifestRow && handlePrintBl(blManifestRow, blForm)} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl bg-gray-700 hover:bg-gray-800 text-white transition-colors mr-auto">
                      <PrinterIcon className="w-4 h-4" /> Print
                    </button>
                    <button type="button" onClick={closeBlPanel} className="px-5 py-2 text-sm font-semibold rounded-xl bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">Close</button>
                    <button type="submit" disabled={blSaving} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl bg-brand-800 hover:bg-brand-700 text-white transition-colors disabled:opacity-50">
                      <Save className="w-4 h-4" /> {blSaving ? 'Saving…' : blEditingId ? 'Update' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        <div className="panel-glass rounded-2xl">
          <div className="flex items-center justify-end px-5 py-4 border-b">
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Manifest
            </button>
          </div>

          <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
              Show
              <select value={limit} onChange={e => { setLimit(parseInt(e.target.value)); setPage(1); }} className="border rounded-lg px-2 py-2 text-sm">
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              entries
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
              Search:
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(); } }} className="border rounded-lg px-3 py-2 text-sm w-56" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap"></th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Week</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Bill of Lading</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Master Bill of Lading</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Reported Date (KGN / MBY)</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Container Number</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Vessel</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Port of Lading</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : grouped.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-16 text-gray-400 dark:text-white/40">No manifests match this search.</td></tr>
                ) : grouped.map(([label, rows]) => (
                  <Fragment key={label}>
                    <tr className="bg-gray-100 dark:bg-white/10">
                      <td colSpan={8} className="px-4 py-2.5 font-semibold text-gray-700 dark:text-white/80 text-xs uppercase tracking-wide">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"><Minus className="w-2.5 h-2.5" /></span>
                          {label} ({rows.length} Manifest{rows.length === 1 ? '' : 's'})
                        </span>
                      </td>
                    </tr>
                    {rows.map(m => (
                      <tr key={m.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 align-top">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="grid grid-cols-2 gap-1.5 w-16">
                            <button title="Edit" onClick={() => openEdit(m)} className="w-7 h-7 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                            <button title="Delete" onClick={() => handleDelete(m)} className="w-7 h-7 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
                            <button title={`Bills of Lading (${m.billsOfLading.length})`} onClick={() => openBlPanel(m)} className="relative w-7 h-7 rounded-lg text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/25 flex items-center justify-center transition-colors">
                              <Plus className="w-3.5 h-3.5" />
                              {m.billsOfLading.length > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-800 text-white text-[10px] font-bold flex items-center justify-center">{m.billsOfLading.length}</span>
                              )}
                            </button>
                            <button title="Print manifest" onClick={() => handlePrint(m)} className="w-7 h-7 rounded-lg text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/25 flex items-center justify-center transition-colors"><FileText className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{m.groupLabel}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{m.billOfLading}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{m.masterBillOfLading || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{toDateInput(m.reportedDateKgn) || '—'} / {toDateInput(m.reportedDateMby) || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{m.containerNumber}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{m.vessel}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{m.portOfLading}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-4 flex-wrap gap-3">
            <div className="text-sm text-gray-400 dark:text-white/40">Showing {startEntry} to {endEntry} of {total} entries</div>
            <div className="flex items-center gap-1.5">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-2 rounded-lg text-sm border dark:border-white/10 bg-white dark:bg-white/5 dark:text-white/60 disabled:opacity-40">Previous</button>
              {Array.from({ length: pages }).slice(0, 5).map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded-lg text-sm ${page === i + 1 ? 'bg-brand-800 text-white' : 'bg-white dark:bg-white/5 border dark:border-white/10 text-gray-600 dark:text-white/60'}`}>{i + 1}</button>
              ))}
              {pages > 5 && <span className="text-gray-400 dark:text-white/40 px-1">…</span>}
              {pages > 5 && <button onClick={() => setPage(pages)} className={`w-8 h-8 rounded-lg text-sm ${page === pages ? 'bg-brand-800 text-white' : 'bg-white dark:bg-white/5 border dark:border-white/10 text-gray-600 dark:text-white/60'}`}>{pages}</button>}
              <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-2 rounded-lg text-sm border dark:border-white/10 bg-white dark:bg-white/5 dark:text-white/60 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
