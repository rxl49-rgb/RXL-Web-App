import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Lock, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isPickup = items.length > 0 && items.some(i => i.location === 'Montego Bay, Jamaica');
  const shipping = isPickup ? 0 : (total > 200 ? 0 : 15);
  // No sales tax is charged on Store purchases.
  const orderTotal = parseFloat((total + shipping).toFixed(2));

  const PICKUP_ADDRESS = 'Shop 6B Portsville Center, Freeport, Montego Bay, Jamaica';
  const PICKUP_PHONE = '+1 876-363-6208';
  const PICKUP_HOURS = 'Closes at 5:00 PM';

  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '',
    address: user?.address || '', city: '', state: '', zip: '', country: 'US',
    cardName: '', cardNumber: '', expiry: '', cvv: '',
    paymentMethod: 'card',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const shippingAddress = isPickup ? `Pickup — ${PICKUP_ADDRESS}` : `${form.address}, ${form.city}, ${form.state} ${form.zip}, ${form.country}`;
      const { data } = await api.post('/orders', {
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        shippingAddress,
        paymentMethod: form.paymentMethod,
      });
      clearCart();
      navigate(`/order/${data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const Field = ({ label, id, type = 'text', ...props }: any) => (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">{label}</label>
      <input id={id} type={type} {...props} className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Checkout</h1>
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
              </div>
            </div>

            {/* Shipping / Pickup */}
            <div className="bg-white dark:bg-white/[0.06] rounded-2xl border p-6 shadow-sm dark-depth">
              {isPickup ? (
                <>
                  <h2 className="font-bold text-gray-900 dark:text-white mb-1">Pickup Only</h2>
                  <p className="text-xs text-gray-500 dark:text-white/50 mb-4">This order includes item(s) already located in Jamaica — no shipping needed. Collect your order at:</p>
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-2 text-sm">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-white/50">Address</p>
                      <p className="text-gray-800 dark:text-white/80 font-medium">🇯🇲 {PICKUP_ADDRESS}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-white/50">Phone</p>
                      <p className="text-gray-800 dark:text-white/80 font-medium">{PICKUP_PHONE}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-white/50">Hours</p>
                      <p className="text-gray-800 dark:text-white/80 font-medium">{PICKUP_HOURS}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-bold text-gray-900 dark:text-white mb-4">Shipping Address</h2>
                  <div className="space-y-4">
                    <Field label="Street Address" id="address" value={form.address} onChange={set('address')} required placeholder="123 Main St" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-1">
                        <Field label="City" id="city" value={form.city} onChange={set('city')} required placeholder="Miami" />
                      </div>
                      <Field label="State / Province" id="state" value={form.state} onChange={set('state')} required placeholder="FL" />
                      <Field label="ZIP / Postal Code" id="zip" value={form.zip} onChange={set('zip')} required placeholder="33101" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-white/70 mb-1">Country</label>
                      <select value={form.country} onChange={set('country')} className="w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                        {[['US','United States'],['CA','Canada'],['JM','Jamaica'],['GB','United Kingdom'],['AU','Australia'],['DE','Germany'],['OTHER','Other']].map(([v,l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Payment */}
            <div className="bg-white dark:bg-white/[0.06] rounded-2xl border p-6 shadow-sm dark-depth">
              <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-500" /> Payment
              </h2>
              <div className="flex gap-3 mb-5">
                {[['card', 'Credit / Debit Card'], ['paypal', 'PayPal'], ['wire', 'Wire Transfer']].map(([v, l]) => (
                  <label key={v} className={`flex-1 flex items-center justify-center gap-1.5 border rounded-xl py-2.5 cursor-pointer text-sm font-medium transition-colors ${form.paymentMethod === v ? 'border-brand-700 bg-brand-50 text-brand-700' : 'text-gray-600 dark:text-white/60 hover:bg-gray-50'}`}>
                    <input type="radio" name="paymentMethod" value={v} checked={form.paymentMethod === v} onChange={set('paymentMethod')} className="sr-only" />{l}
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
              {form.paymentMethod === 'paypal' && <div className="text-center py-5 text-sm text-gray-500 dark:text-white/50 bg-gray-50 dark:bg-white/5 rounded-xl">You'll be redirected to PayPal after placing your order.</div>}
              {form.paymentMethod === 'wire' && <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-sm text-gray-600 dark:text-white/60"><p className="font-medium mb-1">Wire Transfer Instructions</p><p>Bank: First National Bank · Account: 1234567890 · Routing: 021000021</p></div>}
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="bg-white dark:bg-white/[0.06] border rounded-2xl p-6 shadow-sm dark-depth sticky top-20">
              <h2 className="font-bold text-gray-900 dark:text-white mb-4">Order Summary</h2>
              <div className="space-y-3 mb-5">
                {items.map(item => (
                  <div key={item.id} className="flex gap-3 text-sm">
                    <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      {item.image ? <img src={item.image} className="w-full h-full object-cover rounded-lg" /> : <ShoppingBag className="w-5 h-5 text-brand-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 font-medium truncate">{item.name}</p>
                      <p className="text-gray-400 dark:text-white/30 text-xs">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 space-y-1.5 text-sm mb-5">
                <div className="flex justify-between text-gray-600 dark:text-white/60"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-600 dark:text-white/60"><span>{isPickup ? 'Pickup' : 'Shipping'}</span><span>{shipping === 0 ? <span className="text-green-600 font-medium">FREE</span> : `$${shipping.toFixed(2)}`}</span></div>
                <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base pt-2 border-t"><span>Total</span><span>${orderTotal.toFixed(2)}</span></div>
              </div>

              {error && <div className="text-red-600 text-xs bg-red-50 rounded-lg p-3 mb-4">{error}</div>}

              <button type="submit" disabled={loading}
                className="w-full bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5" />
                {loading ? 'Placing Order...' : `Place Order · $${orderTotal.toFixed(2)}`}
              </button>
              <p className="text-center text-xs text-gray-400 dark:text-white/30 mt-3 flex items-center justify-center gap-1"><Lock className="w-3 h-3" />Secured by SSL encryption</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
