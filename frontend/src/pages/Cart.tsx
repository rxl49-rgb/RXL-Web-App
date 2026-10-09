import { Link } from 'react-router-dom';
import { ShoppingBag, Minus, Plus, ArrowRight } from 'lucide-react';
import DeleteIcon from '../components/icons/DeleteIcon';
import { useCart } from '../context/CartContext';

export default function Cart() {
  const { items, updateQty, removeItem, total } = useCart();
  const shipping = total > 200 ? 0 : 15;
  // No sales tax is charged on Store purchases.
  const orderTotal = parseFloat((total + shipping).toFixed(2));

  if (items.length === 0) return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <ShoppingBag className="w-20 h-20 text-gray-200 mx-auto mb-5" />
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Your cart is empty</h2>
      <p className="text-gray-400 dark:text-white/30 mb-7">Looks like you haven't added anything yet.</p>
      <Link to="/store" className="bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-semibold px-7 py-3 rounded-xl transition-colors inline-block">Browse Store</Link>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Shopping Cart</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => (
            <div key={item.id} className="flex gap-4 bg-white dark:bg-white/[0.06] border rounded-2xl p-4 shadow-sm dark-depth">
              <div className="w-20 h-20 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-xl" /> : <ShoppingBag className="w-8 h-8 text-brand-300" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug pr-4">{item.name}</h3>
                  <button onClick={() => removeItem(item.productId)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <DeleteIcon className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-white/30 mb-3">{item.sku}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center border rounded-lg">
                    <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="px-2.5 py-1.5 text-gray-500 dark:text-white/50 hover:text-gray-700 dark:text-white/70"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="px-3 py-1.5 text-sm font-medium border-x">{item.quantity}</span>
                    <button onClick={() => updateQty(item.productId, item.quantity + 1)} disabled={item.stock != null && item.quantity >= item.stock} className="px-2.5 py-1.5 text-gray-500 dark:text-white/50 hover:text-gray-700 dark:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <span className="font-bold text-brand-900">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-white dark:bg-white/[0.06] border rounded-2xl p-6 shadow-sm dark-depth h-fit">
          <h2 className="font-bold text-gray-900 dark:text-white mb-5">Order Summary</h2>
          <div className="space-y-2 text-sm mb-5">
            <div className="flex justify-between text-gray-600 dark:text-white/60"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-600 dark:text-white/60"><span>Shipping</span><span>{shipping === 0 ? <span className="text-green-600 font-medium">FREE</span> : `$${shipping.toFixed(2)}`}</span></div>
            <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base pt-3 border-t"><span>Total</span><span>${orderTotal.toFixed(2)}</span></div>
          </div>
          <Link to="/checkout" className="flex items-center justify-center gap-2 w-full bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-bold py-3 rounded-xl transition-colors">
            Checkout <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/store" className="block text-center text-sm text-gray-500 dark:text-white/50 hover:text-gray-700 dark:text-white/70 mt-3">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
