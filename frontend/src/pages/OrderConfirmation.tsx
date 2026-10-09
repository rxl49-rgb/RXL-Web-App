import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight } from 'lucide-react';
import api from '../lib/api';

export default function OrderConfirmation() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => { api.get(`/orders/${id}`).then(r => setOrder(r.data)); }, [id]);

  if (!order) return <div className="flex justify-center py-32"><div className="w-8 h-8 border-4 border-brand-700 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-10 h-10 text-green-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Order Confirmed!</h1>
      <p className="text-gray-500 dark:text-white/50 mb-1">Thank you for your purchase.</p>
      <p className="text-sm text-gray-400 dark:text-white/30 mb-8">Order #{order.id.slice(-8).toUpperCase()}</p>

      <div className="bg-white dark:bg-white/[0.06] rounded-2xl border p-6 shadow-sm dark-depth text-left mb-6">
        <h2 className="font-bold text-gray-900 dark:text-white mb-4">Order Details</h2>
        <div className="space-y-3 mb-5">
          {order.items.map((item: any) => (
            <div key={item.id} className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-300" />
                <span className="text-gray-700 dark:text-white/70">{item.product.name} × {item.quantity}</span>
              </div>
              <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-white/60"><span>Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-gray-600 dark:text-white/60"><span>Shipping</span><span>{order.shipping === 0 ? 'FREE' : `$${order.shipping.toFixed(2)}`}</span></div>
          <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base pt-2 border-t"><span>Total</span><span>${order.total.toFixed(2)}</span></div>
        </div>
        <div className="mt-5 bg-gray-50 dark:bg-white/5 rounded-xl p-3 text-sm">
          <p className="text-gray-500 dark:text-white/50 text-xs mb-1">Shipping to</p>
          <p className="text-gray-700 dark:text-white/70 font-medium">{order.shippingAddress}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/dashboard" className="flex items-center justify-center gap-2 bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-semibold px-6 py-3 rounded-xl transition-colors">
          View Orders <ArrowRight className="w-4 h-4" />
        </Link>
        <Link to="/store" className="flex items-center justify-center gap-2 border text-gray-700 dark:text-white/70 hover:bg-gray-50 font-semibold px-6 py-3 rounded-xl transition-colors">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
