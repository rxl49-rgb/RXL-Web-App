import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { CreditCard, Lock, Truck, CheckCircle, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import CargoVanIcon from '../components/icons/CargoVanIcon';

const TRUCK_ICONS: Record<string, any> = {
  HEAVY_DUTY: Truck,
  CARGO_VAN: CargoVanIcon,
};

export default function TruckingCheckout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const quote = (location.state as any)?.quote;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<any>(null);

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    notes: '',
    cardName: '', cardNumber: '', expiry: '', cvv: '',
    paymentMethod: 'card',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  if (!quote) {
    navigate('/quote');
    return null;
  }

  const Icon = TRUCK_ICONS[quote.truckType] || Truck;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const detailParts = [
        quote.truckTypeLabel + ' pickup & delivery — ' + quote.miles + ' mi',
        'Pickup: ' + quote.pickupAddress + ' → Delivery: ' + quote.deliveryAddress,
      ];
      if (quote.pallets > 0) detailParts.push(quote.pallets + ' pallet(s)');
      if (quote.boxes > 0) detailParts.push(quote.boxes + ' box(es)');
      if (form.phone) detailParts.push('Contact: ' + form.phone);
      if (form.notes) detailParts.push('Notes: ' + form.notes);

      const { data } = await api.post('/quotes', {
        type: 'TRUCKING',
        origin: quote.pickupAddress,
        destination: quote.deliveryAddress,
        weight: 0,
        description: detailParts.join(' — '),
        price: quote.price,
        status: 'booked',
      });
      setConfirmed(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to complete booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, id, type = 'text', ...props }: any) => (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">{label}</label>
      <input id={id} type={type} {...props} className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
    </div>
  );

  if (confirmed) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-2xl p-8">
          <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-3" />
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1.5">Booking Confirmed</h1>
          <p className="text-sm text-gray-700 dark:text-white/80 font-medium mb-5">
            Reference #{confirmed.id.slice(-8).toUpperCase()} — our team will contact you shortly to schedule pickup.
          </p>
          <div className="bg-white dark:bg-white/[0.06] border rounded-xl p-5 text-left text-sm space-y-1.5 mb-6">
            <div><span className="text-gray-600 dark:text-white/55 font-semibold">Vehicle:</span> {quote.truckTypeLabel}</div>
            <div><span className="text-gray-600 dark:text-white/55 font-semibold">Pickup:</span> {quote.pickupAddress}</div>
            <div><span className="text-gray-600 dark:text-white/55 font-semibold">Delivery:</span> {quote.deliveryAddress}</div>
            {quote.pallets > 0 && <div><span className="text-gray-600 dark:text-white/55 font-semibold">Pallets:</span> {quote.pallets}</div>}
            {quote.boxes > 0 && <div><span className="text-gray-600 dark:text-white/55 font-semibold">Boxes:</span> {quote.boxes}</div>}
            <div><span className="text-gray-600 dark:text-white/55 font-semibold">Total Paid:</span> ${quote.price.toFixed(2)}</div>
          </div>
          <div className="flex gap-3 justify-center">
            <Link to="/dashboard" className="px-5 py-3 bg-brand-800 hover:bg-brand-700 text-white text-sm font-bold rounded-xl transition-colors">Go to Dashboard</Link>
            <Link to="/" className="px-5 py-3 border rounded-xl text-sm font-bold text-gray-800 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Back to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Checkout — Trucking Booking</h1>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact */}
            <div className="bg-white dark:bg-white/[0.06] rounded-2xl border p-6 shadow-sm dark-depth">
              <h2 className="font-bold text-gray-900 dark:text-white mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" id="name" value={form.name} onChange={set('name')} required placeholder="John Doe" />
                <Field label="Email" id="email" type="email" value={form.email} onChange={set('email')} required placeholder="john@example.com" />
                <Field label="Phone" id="phone" type="tel" value={form.phone} onChange={set('phone')} required placeholder="(555) 123-4567" />
              </div>
              <div className="mt-4">
                <label htmlFor="notes" className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Pickup / Delivery Notes (optional)</label>
                <textarea id="notes" value={form.notes} onChange={set('notes')} rows={2} placeholder="Gate code, loading dock, best time to arrive..."
                  className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white dark:bg-white/[0.06] rounded-2xl border p-6 shadow-sm dark-depth">
              <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-500" /> Payment
              </h2>
              <div className="flex gap-3 mb-5">
                {[['card', 'Credit / Debit Card'], ['paypal', 'PayPal'], ['wire', 'Wire Transfer']].map(([v, l]) => (
                  <label key={v} className={`flex-1 flex items-center justify-center gap-1.5 border rounded-xl py-2.5 cursor-pointer text-sm font-medium transition-colors ${form.paymentMethod === v ? 'border-brand-700 bg-brand-50 text-brand-700' : 'text-gray-600 dark:text-white/60 hover:bg-gray-50'}`}>
                    <input type="radio" name="paymentMethod" value={v} checked={form.paymentMethod === v} onChange={set('paymentMethod') as any} className="sr-only" />{l}
                  </label>
                ))}
              </div>
              {form.paymentMethod === 'card' && (
                <div className="space-y-4">
                  <Field label="Name on Card" id="cardName" value={form.cardName} onChange={set('cardName')} placeholder="John Doe" />
                  <Field label="Card Number" id="cardNumber" value={form.cardNumber} onChange={set('cardNumber')} placeholder="4242 4242 4242 4242" maxLength={19} />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Expiry Date" id="expiry" value={form.expiry} onChange={set('expiry')} placeholder="MM/YY" maxLength={5} />
                    <Field label="CVV" id="cvv" value={form.cvv} onChange={set('cvv')} placeholder="123" maxLength={4} />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-white/30 flex items-center gap-1"><Lock className="w-3 h-3" />Your card info is encrypted and secure</p>
                </div>
              )}
              {form.paymentMethod === 'paypal' && <div className="text-center py-5 text-sm text-gray-500 dark:text-white/50 bg-gray-50 dark:bg-white/5 rounded-xl">You'll be redirected to PayPal after confirming your booking.</div>}
              {form.paymentMethod === 'wire' && <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-sm text-gray-600 dark:text-white/60"><p className="font-medium mb-1">Wire Transfer Instructions</p><p>Bank: First National Bank &middot; Account: 1234567890 &middot; Routing: 021000021</p></div>}
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="bg-white dark:bg-white/[0.06] border rounded-2xl p-6 shadow-sm dark-depth sticky top-20">
              <h2 className="font-bold text-gray-900 dark:text-white mb-4">Booking Summary</h2>
              <div className="flex items-center gap-3 mb-5 pb-5 border-b">
                <div className="w-11 h-11 bg-brand-50 dark:bg-brand-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-brand-700 dark:text-accent-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{quote.truckTypeLabel}</p>
                  <p className="text-xs text-gray-500 dark:text-white/50">{quote.miles} mi &middot; {quote.transitDays ?? 1} day(s) to schedule</p>
                </div>
              </div>
              <div className="space-y-2.5 text-sm mb-5">
                <div className="flex gap-2"><MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /><div><span className="text-gray-600 dark:text-white/55 font-semibold block">Pickup</span>{quote.pickupAddress}</div></div>
                <div className="flex gap-2"><MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /><div><span className="text-gray-600 dark:text-white/55 font-semibold block">Delivery</span>{quote.deliveryAddress}</div></div>
              </div>
              <div className="border-t pt-4 space-y-1.5 text-sm mb-5">
                {(quote.pallets > 0 || quote.boxes > 0) && (
                  <>
                    <div className="flex justify-between text-gray-600 dark:text-white/60"><span>Distance-based rate</span><span>${quote.distancePrice.toFixed(2)}</span></div>
                    {quote.pallets > 0 && <div className="flex justify-between text-gray-600 dark:text-white/60"><span>Pallets ({quote.pallets} &times; $10)</span><span>${quote.palletCharge.toFixed(2)}</span></div>}
                    {quote.boxes > 0 && <div className="flex justify-between text-gray-600 dark:text-white/60"><span>Boxes ({quote.boxes} &times; $5)</span><span>${quote.boxCharge.toFixed(2)}</span></div>}
                  </>
                )}
                <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base pt-1.5 border-t"><span>Total</span><span>${quote.price.toFixed(2)}</span></div>
              </div>

              {error && <div className="text-red-600 text-xs bg-red-50 rounded-lg p-3 mb-4">{error}</div>}

              <button type="submit" disabled={loading}
                className="w-full bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5" />
                {loading ? 'Processing...' : 'Pay & Confirm · $' + quote.price.toFixed(2)}
              </button>
              <p className="text-center text-xs text-gray-400 dark:text-white/30 mt-3 flex items-center justify-center gap-1"><Lock className="w-3 h-3" />Secured by SSL encryption</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
