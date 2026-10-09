import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Package, Plane, Ship, Truck, CheckCircle, Clock, AlertCircle, MapPin } from 'lucide-react';
import api from '../lib/api';
import { STATUS_OPTIONS, STATUS_LABEL, STATUS_STYLE } from '../lib/freight';

const STATUS_STEPS = STATUS_OPTIONS.map(s => s.value);

// Dark-mode complements for the shared (light-only) STATUS_STYLE badge colors.
const STATUS_STYLE_DARK: Record<string, string> = {
  RECEIVED_FLORIDA: 'dark:bg-cyan-500/15 dark:text-cyan-300',
  IN_TRANSIT: 'dark:bg-blue-500/15 dark:text-blue-300',
  AT_PORT_JAMAICA: 'dark:bg-orange-500/15 dark:text-orange-300',
  PROCESSING: 'dark:bg-orange-500/15 dark:text-orange-300',
  OUT_FOR_DELIVERY: 'dark:bg-green-500/15 dark:text-green-300',
  DELIVERED: 'dark:bg-green-500/15 dark:text-green-300',
};

function StatusBar({ status }: { status: string }) {
  const idx = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center justify-between mb-8">
      {STATUS_STEPS.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${i <= idx ? 'bg-brand-700 border-brand-700' : 'bg-white dark:bg-white/10 border-gray-300 dark:border-white/20'}`}>
              {i < idx ? <CheckCircle className="w-4 h-4 text-white" /> : i === idx ? <Clock className="w-4 h-4 text-white" /> : <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-white/30" />}
            </div>
            <span className={`text-xs mt-1.5 font-medium text-center hidden sm:block ${i <= idx ? 'text-brand-700 dark:text-brand-300' : 'text-gray-400 dark:text-white/30'}`}>{STATUS_LABEL[step]}</span>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className={`h-1 flex-1 mx-1 rounded ${i < idx ? 'bg-brand-700' : 'bg-gray-200 dark:bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Track() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Courier logos are managed on the admin Couriers screen — fetched once and looked up
  // by uppercased name wherever a courier badge is shown on this page.
  const [courierLogos, setCourierLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    api.get('/couriers').then(r => {
      const map: Record<string, string> = {};
      (r.data as { name: string; logoUrl: string | null }[]).forEach(c => { if (c.logoUrl) map[c.name.toUpperCase()] = c.logoUrl; });
      setCourierLogos(map);
    }).catch(() => { /* logos just won't render if this fails */ });
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) { setQuery(q); searchShipment(q); }
  }, []);

  const searchShipment = async (trackNum: string) => {
    if (!trackNum.trim()) return;
    setLoading(true); setError(''); setShipment(null);
    try {
      const { data } = await api.get(`/shipments/track/${encodeURIComponent(trackNum.trim())}`);
      setShipment(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Shipment not found. Please check your tracking number.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); searchShipment(query); };

  const TypeIcon = shipment?.type === 'AIR' ? Plane : shipment?.type === 'SEA' ? Ship : Truck;

  return (
    <div className="min-h-screen bg-white dark:bg-[var(--rxl-menubar-bg,#000000)]">
      {/* Header */}
      <div className="bg-white dark:bg-transparent border-b border-gray-100 dark:border-none shadow-none dark:shadow-none text-gray-900 dark:text-white py-6">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1.5">Track Your Shipment</h1>
          <p className="text-gray-600 dark:text-white/50 text-sm mb-6">Enter your tracking number to get real-time status updates</p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. RXL-2024-AIR-001"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-white/10 border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/15 outline-none focus:ring-2 focus:ring-accent-400 focus:border-accent-400 text-sm"
              />
            </div>
            <button type="submit" disabled={loading}
              className="bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow disabled:opacity-60 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors whitespace-nowrap">
              {loading ? 'Searching...' : 'Track'}
            </button>
          </form>
          <p className="text-gray-500 dark:text-white/40 text-xs mt-3">Try: <button onClick={() => { setQuery('RXL-2024-AIR-001'); searchShipment('RXL-2024-AIR-001'); }} className="underline text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-white/60">RXL-2024-AIR-001</button> or <button onClick={() => { setQuery('RXL-2024-SEA-002'); searchShipment('RXL-2024-SEA-002'); }} className="underline text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-white/60">RXL-2024-SEA-002</button></p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-5 flex items-start gap-3 text-red-700 dark:text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Shipment Not Found</p>
              <p className="text-sm text-red-500 dark:text-red-300/70 mt-1">{error}</p>
            </div>
          </div>
        )}

        {shipment && (
          <div className="space-y-5">
            {/* Summary card */}
            <div className="panel-glass rounded-2xl p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <TypeIcon className="w-5 h-5 text-brand-700 dark:text-brand-300" />
                    <h2 className="font-bold text-gray-900 dark:text-white">{shipment.batch?.batchNumber || shipment.trackingNumber}</h2>
                  </div>
                  {shipment.batch?.batchNumber && (
                    <p className="text-xs text-gray-400 dark:text-white/30 mb-1.5">Tracking #: {shipment.trackingNumber}</p>
                  )}
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[shipment.status] || 'bg-gray-100 text-gray-600'} ${STATUS_STYLE_DARK[shipment.status] || 'dark:bg-white/10 dark:text-white/60'}`}>
                    {STATUS_LABEL[shipment.status] || shipment.status}
                  </span>
                </div>
                <div className="text-right text-sm text-gray-500 dark:text-white/40">
                  <p className="font-medium text-gray-700 dark:text-white/70">{shipment.type} Freight</p>
                  {shipment.weight && <p>{shipment.weight} kg</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                  <p className="text-gray-400 dark:text-white/30 text-xs mb-1">From</p>
                  <p className="font-medium text-gray-900 dark:text-white">Florida, USA</p>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                  <p className="text-gray-400 dark:text-white/30 text-xs mb-1">To</p>
                  <p className="font-medium text-gray-900 dark:text-white">Montego Bay, JA</p>
                </div>
              </div>

              {(shipment.items?.length > 0 || shipment.courierInfo || shipment.trackingNumber) && (
                <div className="mb-5 space-y-2">
                  <p className="text-gray-400 dark:text-white/30 text-xs">Courier & Tracking #</p>
                  {shipment.items?.length > 0 ? shipment.items.map((item: any) => {
                    const logo = courierLogos[item.courier.toUpperCase()];
                    return (
                      <div key={item.id} className="flex items-center gap-3 text-sm bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                        <div className="w-6 h-6 rounded-md icon-glass flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                          {logo ? <img src={logo} alt={item.courier} className="w-full h-full object-contain" /> : <Truck className="w-3.5 h-3.5 text-brand-700 dark:text-accent-400" />}
                        </div>
                        <p className="text-gray-800 dark:text-white/80">
                          <span className="font-bold">({item.courier})</span>{' '}
                          {item.trackingNumber || item.description || '—'}
                        </p>
                      </div>
                    );
                  }) : (
                    <div className="flex items-center gap-3 text-sm bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                      <div className="w-6 h-6 rounded-md icon-glass flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                        {shipment.courierInfo && courierLogos[shipment.courierInfo.toUpperCase()] ? (
                          <img src={courierLogos[shipment.courierInfo.toUpperCase()]} alt={shipment.courierInfo} className="w-full h-full object-contain" />
                        ) : (
                          <Truck className="w-3.5 h-3.5 text-brand-700 dark:text-accent-400" />
                        )}
                      </div>
                      <p className="text-gray-800 dark:text-white/80">
                        {shipment.courierInfo && <span className="font-bold">({shipment.courierInfo})</span>}{shipment.courierInfo ? ' ' : ''}
                        {shipment.trackingNumber}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {shipment.estimatedDelivery && (
                <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-3 text-sm text-blue-700 dark:text-blue-300 mb-5 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Estimated delivery: <strong>{new Date(shipment.estimatedDelivery).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong></span>
                </div>
              )}

              <StatusBar status={shipment.status} />
            </div>

            {/* Timeline */}
            {shipment.events?.length > 0 && (
              <div className="panel-glass rounded-2xl p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-5">Tracking History</h3>
                <div className="space-y-5">
                  {shipment.events.map((event: any, i: number) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${i === 0 ? 'bg-brand-700 ring-4 ring-brand-100 dark:ring-brand-500/20' : 'bg-gray-300 dark:bg-white/20'}`} />
                        {i < shipment.events.length - 1 && <div className="w-px flex-1 bg-gray-200 dark:bg-white/10 mt-1" />}
                      </div>
                      <div className="pb-5 flex-1">
                        <p className={`font-medium text-sm ${i === 0 ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-white/50'}`}>{event.description}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-white/30">
                          <MapPin className="w-3 h-3" />{event.location}
                          <span>·</span>
                          {new Date(event.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!shipment && !error && !loading && (
          <div className="text-center py-16">
            <Package className="w-20 h-20 text-gray-200 dark:text-white/10 mx-auto mb-4" />
            <p className="text-gray-400 dark:text-white/30 text-lg">Enter a tracking number to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
