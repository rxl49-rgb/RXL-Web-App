import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plane, Ship, Truck, MapPin, Calculator, CheckCircle, CalendarCheck } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import CargoVanIcon from '../components/icons/CargoVanIcon';

const TYPE_OPTIONS = [
  { value: 'AIR', label: 'Air Freight', icon: Plane },
  { value: 'SEA', label: 'Sea Freight', icon: Ship },
  { value: 'TRUCKING', label: 'Trucking Pickup & Delivery', icon: Truck },
];

const TRUCK_OPTIONS = [
  { value: 'HEAVY_DUTY', label: 'Heavy Duty Truck', icon: Truck },
  { value: 'CARGO_VAN', label: 'Medium Duty Cargo Van', icon: CargoVanIcon },
];

export default function Quote() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ type: 'AIR', weight: '', description: '' });
  const [dimL, setDimL] = useState('');
  const [dimW, setDimW] = useState('');
  const [dimH, setDimH] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [truckType, setTruckType] = useState('HEAVY_DUTY');
  const [pallets, setPallets] = useState('');
  const [boxes, setBoxes] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const isSea = form.type === 'SEA';
  const isTrucking = form.type === 'TRUCKING';
  const dimensions = dimL && dimW && dimH ? `${dimL}x${dimW}x${dimH}` : '';

  const resetResults = () => {
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); resetResults();
    try {
      const payload = isTrucking
        ? {
            type: 'TRUCKING', truckType, pickupAddress, deliveryAddress,
            ...(truckType === 'HEAVY_DUTY' ? {
              pallets: pallets.trim() ? parseInt(pallets, 10) : 0,
              boxes: boxes.trim() ? parseInt(boxes, 10) : 0,
            } : {}),
          }
        : { ...form, dimensions, weight: form.weight ? parseFloat(form.weight) : undefined };
      const { data } = await api.post('/quotes/calculate', payload);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to calculate quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToCheckout = () => {
    if (!result) return;
    navigate('/quote/checkout', { state: { quote: result } });
  };

  const selectedTruck = TRUCK_OPTIONS.find(t => t.value === (result?.truckType || truckType));

  return (
    <div className="min-h-screen bg-white dark:bg-[var(--rxl-menubar-bg,#000000)]">
      <div className="max-w-3xl mx-auto px-4 pt-10 pb-6 text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-1.5 text-gray-900 dark:text-white">Get a Shipping Quote</h1>
        <p className="text-gray-700 dark:text-white/80 text-sm font-medium">Instant pricing for air, sea, and local trucking</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-10">
        <div className="panel-glass rounded-2xl p-7">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">Shipment Type</label>
              <div className="grid grid-cols-3 gap-3">
                {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <label key={value} className={`flex flex-col items-center gap-2 border-2 rounded-xl p-4 cursor-pointer transition-all ${form.type === value ? 'border-brand-700 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-200 dark:border-white/15 hover:border-gray-300 dark:hover:border-white/25'}`}>
                    <input type="radio" name="type" value={value} checked={form.type === value} onChange={e => { set('type')(e); resetResults(); }} className="sr-only" />
                    <Icon className={`w-6 h-6 ${form.type === value ? 'text-brand-700 dark:text-accent-400' : 'text-gray-500 dark:text-white/50'}`} />
                    <span className={`text-xs sm:text-sm font-bold text-center leading-tight ${form.type === value ? 'text-brand-800 dark:text-white' : 'text-gray-800 dark:text-white/80'}`}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {isTrucking ? (
              <>
                {/* Pickup / Delivery addresses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">Pickup Address</label>
                    <AddressAutocompleteInput value={pickupAddress} onChange={setPickupAddress} icon={MapPin} required
                      placeholder="e.g. 123 Main St, Miami, FL 33101" />
                    <p className="text-xs text-gray-600 dark:text-white/60 mt-1 font-medium">Any address within the USA — start typing for suggestions</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">Delivery Address</label>
                    <AddressAutocompleteInput value={deliveryAddress} onChange={setDeliveryAddress} icon={MapPin} required
                      placeholder="e.g. 456 Ocean Dr, Orlando, FL 32801" />
                    <p className="text-xs text-gray-600 dark:text-white/60 mt-1 font-medium">Must be within Florida — start typing for suggestions</p>
                  </div>
                </div>

                {/* Truck type selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">Vehicle</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {TRUCK_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <label key={value} className={`flex items-center gap-3 border-2 rounded-xl p-4 cursor-pointer transition-all ${truckType === value ? 'border-brand-700 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-200 dark:border-white/15 hover:border-gray-300 dark:hover:border-white/25'}`}>
                        <input type="radio" name="truckType" value={value} checked={truckType === value} onChange={() => setTruckType(value)} className="sr-only" />
                        <Icon className={`w-8 h-8 flex-shrink-0 ${truckType === value ? 'text-brand-700 dark:text-accent-400' : 'text-gray-500 dark:text-white/50'}`} />
                        <p className={`text-sm font-bold ${truckType === value ? 'text-brand-800 dark:text-white' : 'text-gray-800 dark:text-white/80'}`}>{label}</p>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Pallets / Boxes — Heavy Duty Truck only, each adds a flat handling surcharge */}
                {truckType === 'HEAVY_DUTY' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">Pallets</label>
                      <input type="number" min="0" step="1" inputMode="numeric" value={pallets} onChange={e => setPallets(e.target.value)} placeholder="0"
                        className="w-full border rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">Boxes</label>
                      <input type="number" min="0" step="1" inputMode="numeric" value={boxes} onChange={e => setBoxes(e.target.value)} placeholder="0"
                        className="w-full border rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Weight / Dimensions */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                    Weight (lbs){isSea && <span className="text-gray-500 dark:text-white/50 font-normal"> (optional)</span>}
                  </label>
                  <input type="number" step="0.1" min="0.1" value={form.weight} onChange={set('weight')} required={!isSea} placeholder="e.g. 25"
                    className="w-full border rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  {form.type === 'AIR' && <p className="text-xs text-gray-600 dark:text-white/60 mt-1 font-medium">Billed per lb: $3.00 (1–10), $2.50 (11–30), $2.25 (31–50), $2.15 (51–100), $2.00 (101+)</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                    Dimensions (inches){!isSea && <span className="text-gray-500 dark:text-white/50 font-normal"> (optional)</span>}
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.1" min="0.1" value={dimL} onChange={e => setDimL(e.target.value)} required={isSea} placeholder="L"
                      className="w-full border rounded-xl px-3 py-3 text-sm font-medium text-center text-gray-900 dark:text-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    <span className="text-gray-600 dark:text-white/50 text-sm font-semibold flex-shrink-0">x</span>
                    <input type="number" step="0.1" min="0.1" value={dimW} onChange={e => setDimW(e.target.value)} required={isSea} placeholder="W"
                      className="w-full border rounded-xl px-3 py-3 text-sm font-medium text-center text-gray-900 dark:text-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    <span className="text-gray-600 dark:text-white/50 text-sm font-semibold flex-shrink-0">x</span>
                    <input type="number" step="0.1" min="0.1" value={dimH} onChange={e => setDimH(e.target.value)} required={isSea} placeholder="H"
                      className="w-full border rounded-xl px-3 py-3 text-sm font-medium text-center text-gray-900 dark:text-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  {isSea && <p className="text-xs text-gray-600 dark:text-white/60 mt-1 font-medium">Cubic ft = (L×W×H) ÷ 1728, billed at $5.25/cu ft</p>}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">Description (optional)</label>
              <textarea value={form.description} onChange={set('description')} rows={2} placeholder="e.g. Electronics, fragile..."
                className="w-full border rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            </div>

            {error && <div className="text-red-600 dark:text-red-400 text-sm font-semibold bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow disabled:opacity-60 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
              <Calculator className="w-5 h-5" />
              {loading ? 'Calculating...' : 'Calculate Quote'}
            </button>
          </form>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-6 panel-glass rounded-2xl p-7">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <h2 className="font-extrabold text-gray-900 dark:text-white">Quote Result</h2>
            </div>

            {result.type === 'TRUCKING' ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-brand-50 dark:bg-brand-500/10 rounded-xl p-4 text-center">
                    <p className="text-2xl font-extrabold text-brand-900 dark:text-white">${result.price.toFixed(2)}</p>
                    <p className="text-xs text-gray-700 dark:text-white/70 mt-1 font-semibold">Estimated Price</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-center">
                    <p className="text-lg font-extrabold text-gray-900 dark:text-white">{result.miles} mi</p>
                    <p className="text-xs text-gray-700 dark:text-white/70 mt-1 font-semibold">Distance</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-center flex flex-col items-center justify-center">
                    {selectedTruck && <selectedTruck.icon className="w-6 h-6 text-brand-700 dark:text-accent-400 mb-1" />}
                    <p className="text-xs text-gray-900 dark:text-white font-bold leading-tight">{result.truckTypeLabel}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-center">
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{result.transitDays}</p>
                    <p className="text-xs text-gray-700 dark:text-white/70 mt-1 font-semibold">Day(s) to Schedule</p>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-sm text-gray-800 dark:text-white/85 font-medium mb-5">
                  <div className="grid grid-cols-1 gap-2">
                    <div><span className="text-gray-600 dark:text-white/55 font-semibold">Pickup:</span> {result.origin}</div>
                    <div><span className="text-gray-600 dark:text-white/55 font-semibold">Delivery:</span> {result.destination}</div>
                    {(result.pallets > 0 || result.boxes > 0) && (
                      <>
                        <div><span className="text-gray-600 dark:text-white/55 font-semibold">Distance-based rate:</span> ${result.distancePrice.toFixed(2)}</div>
                        {result.pallets > 0 && <div><span className="text-gray-600 dark:text-white/55 font-semibold">Pallets:</span> {result.pallets} &times; $10 = ${result.palletCharge.toFixed(2)}</div>}
                        {result.boxes > 0 && <div><span className="text-gray-600 dark:text-white/55 font-semibold">Boxes:</span> {result.boxes} &times; $5 = ${result.boxCharge.toFixed(2)}</div>}
                      </>
                    )}
                    <div><span className="text-gray-600 dark:text-white/55 font-semibold">Valid until:</span> {new Date(result.validUntil).toLocaleDateString()}</div>
                  </div>
                </div>
                {result.estimatedDistance && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-4 font-medium">* Distance is an estimate for this route; final mileage is confirmed when booking is scheduled.</p>
                )}
                <p className="text-xs text-gray-600 dark:text-white/50 mb-5 font-medium">* Prices are estimates and may vary based on final pickup/delivery details, access, and wait time.</p>

                {user ? (
                  <button onClick={handleGoToCheckout}
                    className="w-full bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors mb-3">
                    <CalendarCheck className="w-5 h-5" />
                    Book This Delivery
                  </button>
                ) : (
                  <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/15 rounded-xl p-4 mb-4">
                    <p className="text-sm text-gray-800 dark:text-white/85 font-semibold mb-3">Log in or create an account to book this delivery.</p>
                    <div className="flex gap-3">
                      <Link to="/login" className="flex-1 text-center px-4 py-2.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-bold rounded-xl transition-colors">Log In</Link>
                      <Link to="/register" className="flex-1 text-center px-4 py-2.5 border rounded-xl text-sm font-bold text-gray-800 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Create Account</Link>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-brand-50 dark:bg-brand-500/10 rounded-xl p-4 text-center">
                    <p className="text-2xl font-extrabold text-brand-900 dark:text-white">${result.price.toFixed(2)}</p>
                    <p className="text-xs text-gray-700 dark:text-white/70 mt-1 font-semibold">Estimated Price</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-center">
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{result.transitDays}</p>
                    <p className="text-xs text-gray-700 dark:text-white/70 mt-1 font-semibold">Days in Transit</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-center">
                    {result.type === 'SEA' && result.cubicFeet != null ? (
                      <>
                        <p className="text-lg font-extrabold text-gray-900 dark:text-white">{result.cubicFeet} ft³</p>
                        <p className="text-xs text-gray-700 dark:text-white/70 mt-1 font-semibold">Cubic Measurement</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-extrabold text-gray-900 dark:text-white">{result.weight != null ? `${result.weight} lbs` : '—'}</p>
                        <p className="text-xs text-gray-700 dark:text-white/70 mt-1 font-semibold">Chargeable Weight</p>
                      </>
                    )}
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-center">
                    <p className="text-lg font-extrabold text-gray-900 dark:text-white">{result.type}</p>
                    <p className="text-xs text-gray-700 dark:text-white/70 mt-1 font-semibold">Service Type</p>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-sm text-gray-800 dark:text-white/85 font-medium mb-5">
                  <div className="grid grid-cols-2 gap-3">
                    {result.dimensions && <div><span className="text-gray-600 dark:text-white/55 font-semibold">Dimensions:</span> {result.dimensions.replace(/x/gi, ' x ')} in</div>}
                    {result.rateApplied && <div><span className="text-gray-600 dark:text-white/55 font-semibold">Rate applied:</span> {result.rateApplied}</div>}
                    <div><span className="text-gray-600 dark:text-white/55 font-semibold">Valid until:</span> {new Date(result.validUntil).toLocaleDateString()}</div>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-white/50 mb-4 font-medium">* Prices are estimates and may vary based on final cargo details, customs fees, and fuel surcharges.</p>
              </>
            )}

            <div className="flex gap-3">
              <button onClick={() => { resetResults(); }} className="flex-1 text-center px-5 py-3 border rounded-xl text-sm font-bold text-gray-800 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                New Quote
              </button>
            </div>
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[
            { icon: Plane, title: 'Air Freight', points: ['Best for urgent cargo', 'Tiered per-lb pricing', 'Global coverage'] },
            { icon: Ship, title: 'Sea Freight', points: ['Priced by cubic feet', 'Cost-effective for bulk', 'Any cargo size'] },
            { icon: Truck, title: 'Trucking Pickup & Delivery', points: ['Local Florida delivery', 'Priced by distance', 'Heavy duty & cargo van'] },
          ].map(({ icon: Icon, title, points }) => (
            <div key={title} className="bg-white dark:bg-white/[0.06] rounded-2xl border p-5 shadow-sm dark-depth">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-5 h-5 text-brand-700 dark:text-accent-400" />
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h3>
              </div>
              <ul className="space-y-1.5">
                {points.map(p => <li key={p} className="text-xs text-gray-700 dark:text-white/70 font-medium flex items-start gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
