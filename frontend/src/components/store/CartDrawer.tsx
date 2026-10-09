import { Link } from 'react-router-dom';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import DeleteIcon from '../icons/DeleteIcon';
import { useCart } from '../../context/CartContext';

export default function CartDrawer() {
  const { items, open, setOpen, updateQty, removeItem, total } = useCart();

  const shipping = total > 200 ? 0 : 15;
  // No sales tax is charged on Store purchases.
  const orderTotal = parseFloat((total + shipping).toFixed(2));

  return (
    <>
      {/* Backdrop */}
      {open && <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setOpen(false)} />}

      {/* Drawer */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-[#151620] shadow-2xl transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-brand-900">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-accent-400" />
            <h2 className="text-white font-semibold">Your Cart ({items.length})</h2>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="w-16 h-16 text-gray-200 dark:text-white/10 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-white/50 font-medium">Your cart is empty</p>
              <p className="text-gray-400 dark:text-white/30 text-sm mt-1">Add items from the store to get started</p>
              <Link to="/store" onClick={() => setOpen(false)}
                className="mt-5 inline-block bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                Browse Store
              </Link>
            </div>
          ) : items.map(item => (
            <div key={item.id} className="flex gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                {item.image
                  ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  : <ShoppingBag className="w-7 h-7 text-gray-300 dark:text-white/20" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                <p className="text-xs text-gray-400 dark:text-white/30 mb-2">{item.sku}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-6 h-6 rounded-full border flex items-center justify-center text-gray-500 dark:text-white/50 hover:border-brand-500 hover:text-brand-500">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.productId, item.quantity + 1)} disabled={item.stock != null && item.quantity >= item.stock} className="w-6 h-6 rounded-full border flex items-center justify-center text-gray-500 dark:text-white/50 hover:border-brand-500 hover:text-brand-500 disabled:opacity-30 disabled:cursor-not-allowed">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-brand-800">${(item.price * item.quantity).toFixed(2)}</span>
                    <button onClick={() => removeItem(item.productId)} className="text-gray-400 dark:text-white/30 hover:text-red-500 transition-colors">
                      <DeleteIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t px-5 py-4 bg-gray-50 dark:bg-white/[0.03] space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-white/60"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-600 dark:text-white/60"><span>Shipping</span><span>{shipping === 0 ? <span className="text-green-600 font-medium">FREE</span> : `$${shipping.toFixed(2)}`}</span></div>
              <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base pt-2 border-t"><span>Total</span><span>${orderTotal.toFixed(2)}</span></div>
            </div>
            <Link to="/checkout" onClick={() => setOpen(false)}
              className="block w-full bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white text-center font-semibold py-3 rounded-xl transition-colors">
              Proceed to Checkout
            </Link>
            <button onClick={() => setOpen(false)} className="block w-full text-center text-sm text-gray-500 dark:text-white/50 hover:text-gray-700 dark:text-white/70 py-1">
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
