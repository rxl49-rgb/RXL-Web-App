import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Customer: create order
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { items, shippingAddress, paymentMethod, notes } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'No items provided' });

    const productIds = items.map((i: any) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

    let subtotal = 0;
    const orderItems = items.map((item: any) => {
      const product = products.find(p => p.id === item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      const linePrice = product.price * item.quantity;
      subtotal += linePrice;
      return { productId: item.productId, quantity: item.quantity, price: product.price };
    });

    const shipping = subtotal > 200 ? 0 : 15;
    // No sales tax is charged on Store purchases.
    const tax = 0;
    const total = parseFloat((subtotal + shipping + tax).toFixed(2));

    const order = await prisma.order.create({
      data: {
        userId: req.user!.id,
        subtotal,
        shipping,
        tax,
        total,
        shippingAddress,
        paymentMethod: paymentMethod || 'card',
        notes,
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } }, user: { select: { name: true, email: true } } },
    });

    res.status(201).json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Server error' });
  }
});

// Customer: my orders
router.get('/mine', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.id },
      include: { items: { include: { product: { select: { name: true, image: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Customer: single order
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } }, user: { select: { name: true, email: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(order);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: all orders
router.get('/', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      include: { items: { include: { product: true } }, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update order status
router.patch('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(order);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
