import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  sku: string;
  stock?: number;
  location?: string;
}

interface CartContextType {
  items: CartItem[];
  open: boolean;
  setOpen: (v: boolean) => void;
  addItem: (product: Omit<CartItem, 'id' | 'quantity'>, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType>({} as CartContextType);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);

  // Quantity can never exceed the product's stock — when stock is unknown (undefined)
  // no cap is applied.
  const addItem = (product: Omit<CartItem, 'id' | 'quantity'>, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.productId);
      if (existing) {
        const cap = product.stock ?? existing.stock;
        const nextQty = cap != null ? Math.min(existing.quantity + qty, cap) : existing.quantity + qty;
        return prev.map(i => i.productId === product.productId ? { ...i, quantity: nextQty, stock: product.stock ?? i.stock } : i);
      }
      const cap = product.stock;
      const initialQty = cap != null ? Math.min(qty, cap) : qty;
      return [...prev, { ...product, id: crypto.randomUUID(), quantity: initialQty }];
    });
    setOpen(true);
  };

  const removeItem = (productId: string) => setItems(prev => prev.filter(i => i.productId !== productId));

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) return removeItem(productId);
    setItems(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const capped = i.stock != null ? Math.min(qty, i.stock) : qty;
      return { ...i, quantity: capped };
    }));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, open, setOpen, addItem, removeItem, updateQty, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
