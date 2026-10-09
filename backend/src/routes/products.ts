import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const PRODUCT_IMAGE_DIR = path.join(UPLOAD_ROOT, 'products');
const PRODUCT_VIDEO_DIR = path.join(UPLOAD_ROOT, 'products', 'videos');
fs.mkdirSync(PRODUCT_IMAGE_DIR, { recursive: true });
fs.mkdirSync(PRODUCT_VIDEO_DIR, { recursive: true });

const IMAGE_MIMES = ['image/gif', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];

// Product photo + product video are uploaded together via .fields(), so destination/filter
// have to branch on which field the file came in on.
const productMediaFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  if (file.fieldname === 'video') {
    const ok = VIDEO_MIMES.includes(file.mimetype);
    return cb(ok ? null : new Error('Video must be .mp4, .mov or .webm') as any, ok);
  }
  const ok = IMAGE_MIMES.includes(file.mimetype);
  cb(ok ? null : new Error('Photo must be .gif, .jpg, .jpeg, .png or .webp') as any, ok);
};

const uploadProductMedia = multer({
  storage: multer.diskStorage({
    destination: (_req, file, cb) => cb(null, file.fieldname === 'video' ? PRODUCT_VIDEO_DIR : PRODUCT_IMAGE_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: productMediaFilter,
});
const productMediaFields = uploadProductMedia.fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 8 }, { name: 'video', maxCount: 1 }]);

// Product photos are stored as a JSON-stringified array on `images`. Older products
// created before multi-photo support may only have the single `image` field set — fall
// back to treating that as a one-item array.
function parseProductImages(images: string | null, image: string | null): string[] {
  if (images) {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to legacy fallback
    }
  }
  return image ? [image] : [];
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `category-${Date.now()}`;
}

// Public: list products (storefront — active only)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, search, location, page = '1', limit = '12' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { active: true };
    if (category) where.category = { slug: category };
    if (search) where.name = { contains: search };
    if (location) where.location = location;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list ALL products (active + inactive), paginated + searchable + category filter —
// used by the admin Store management screen so deactivated items are still visible/editable.
router.get('/admin/all', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { category, search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {};
    if (category) where.category = { slug: category };
    if (search) where.OR = [{ name: { contains: search } }, { sku: { contains: search } }];

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: categories
router.get('/meta/categories', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({ include: { _count: { select: { products: true } } } });
  res.json(categories);
});

// Admin: create a new category (e.g. from the "Add product" form when none of the existing
// categories fit). Slug is derived from the name and de-duped if it collides.
router.post('/meta/categories', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required' });
    let slug = slugify(name);
    let attempt = 0;
    while (await prisma.category.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${slugify(name)}-${attempt}`;
    }
    const category = await prisma.category.create({ data: { name: name.trim(), slug } });
    res.status(201).json(category);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'A category with that name already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: rename a category. Slug is re-derived from the new name (de-duped if it
// collides with a different category).
router.put('/meta/categories/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required' });
    let slug = slugify(name);
    let attempt = 0;
    while (true) {
      const existing = await prisma.category.findUnique({ where: { slug } });
      if (!existing || existing.id === req.params.id) break;
      attempt += 1;
      slug = `${slugify(name)}-${attempt}`;
    }
    const category = await prisma.category.update({ where: { id: req.params.id }, data: { name: name.trim(), slug } });
    res.json(category);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'A category with that name already exists' });
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Category not found' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete a category. Blocked while any products still reference it — reassign
// or delete those products first.
router.delete('/meta/categories/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.product.count({ where: { categoryId: req.params.id } });
    if (count > 0) return res.status(409).json({ error: `Can't delete — ${count} product${count === 1 ? '' : 's'} still use this category` });
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Category not found' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Strips HTML tags and decodes the handful of entities Shopify product descriptions
// commonly contain, collapsing whitespace so the result is a plain-text description.
function stripHtml(html: string): string {
  return html
    // Table cells become "Label — Value" so spec tables stay readable as lines
    // (tolerates a <p> wrapper directly inside the cell, which is how most
    // imported spec tables are marked up).
    .replace(/(?:<\/p>)?\s*<\/td>\s*<td[^>]*>\s*(?:<p[^>]*>)?/gi, ' — ')
    // Block-level boundaries become line breaks so paragraphs/list items/rows don't
    // all run together into one wall of text once tags are stripped.
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

// Admin: import every product from shopfnds.com's public storefront JSON feed
// (products.json — the standard Shopify endpoint) into our own Product/Category
// tables. Re-running this is safe: products are upserted by a `fnds-<handle>` SKU,
// so previously-imported items get their price/stock/images refreshed instead of
// duplicated. Shopify's `compare_at_price` (the crossed-out "was" price) maps to our
// `price`, and the current selling price maps to our `discountPrice` when it's lower.
router.post('/import/shopfnds', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const results = { created: 0, updated: 0, skipped: 0, total: 0 };
  const categoryCache = new Map<string, string>();

  async function resolveCategoryId(rawName: string): Promise<string> {
    const name = (rawName || '').trim() || 'General';
    const cached = categoryCache.get(name);
    if (cached) return cached;
    let category = await prisma.category.findUnique({ where: { name } });
    if (!category) {
      let slug = slugify(name);
      let attempt = 0;
      while (await prisma.category.findUnique({ where: { slug } })) {
        attempt += 1;
        slug = `${slugify(name)}-${attempt}`;
      }
      category = await prisma.category.create({ data: { name, slug } });
    }
    categoryCache.set(name, category.id);
    return category.id;
  }

  try {
    let page = 1;
    while (page <= 20) { // safety cap — 20 pages * 250 = up to 5,000 products
      const url = `https://shopfnds.com/products.json?limit=250&page=${page}`;
      let apiRes: globalThis.Response;
      try {
        apiRes = await fetch(url, { headers: { Accept: 'application/json' } });
      } catch {
        return res.status(502).json({ error: 'Could not reach shopfnds.com' });
      }
      if (!apiRes.ok) break;
      const data: any = await apiRes.json();
      const items: any[] = Array.isArray(data.products) ? data.products : [];
      if (items.length === 0) break;
      results.total += items.length;

      for (const item of items) {
        const variant = (item.variants || [])[0];
        const shopPrice = variant ? parseFloat(variant.price) : NaN;
        if (!variant || Number.isNaN(shopPrice)) {
          results.skipped += 1;
          continue;
        }
        const shopCompareAt = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;
        const onSale = shopCompareAt != null && !Number.isNaN(shopCompareAt) && shopCompareAt > shopPrice;
        const price = onSale ? (shopCompareAt as number) : shopPrice;
        const discountPrice = onSale ? shopPrice : null;

        const images: string[] = (item.images || []).map((im: any) => im.src).filter(Boolean);
        const categoryId = await resolveCategoryId(item.product_type);
        const sku = `fnds-${item.handle || item.id}`;
        const stock = (item.variants || []).some((v: any) => v.available) ? 25 : 0;

        const data_ = {
          name: item.title || 'Untitled product',
          description: stripHtml(item.body_html || '') || item.title || '',
          price,
          discountPrice,
          image: images[0] || null,
          images: images.length ? JSON.stringify(images) : null,
          condition: 'NEW',
          location: 'Florida, USA',
          categoryId,
          stock,
        };

        const existing = await prisma.product.findUnique({ where: { sku } });
        if (existing) {
          await prisma.product.update({ where: { id: existing.id }, data: data_ });
          results.updated += 1;
        } else {
          await prisma.product.create({ data: { ...data_, sku } });
          results.created += 1;
        }
      }

      if (items.length < 250) break; // last page
      page += 1;
    }

    res.json(results);
  } catch (err) {
    console.error('shopfnds import failed', err);
    res.status(500).json({ error: 'Import failed partway through — see server logs' });
  }
});

// Public: single product
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { category: true },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create product
router.post('/', authenticate, requireAdmin, productMediaFields, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, price, discountPrice, categoryId, stock, sku, weight, condition, location } = req.body;
    if (!name || !price || !categoryId) {
      return res.status(400).json({ error: 'Name, price and category are required' });
    }
    const files = req.files as { image?: Express.Multer.File[]; images?: Express.Multer.File[]; video?: Express.Multer.File[] } | undefined;
    // Multiple product photos may be uploaded under the `images` field (plus a legacy
    // single `image` field, still accepted for backward compatibility) — the first
    // uploaded photo becomes the cover image shown in listings/cart/etc.
    const uploadedImageUrls = [
      ...(files?.image?.[0] ? [`/uploads/products/${files.image[0].filename}`] : []),
      ...((files?.images || []).map(f => `/uploads/products/${f.filename}`)),
    ];
    const videoUrl = files?.video?.[0] ? `/uploads/products/videos/${files.video[0].filename}` : undefined;
    const product = await prisma.product.create({
      data: {
        name,
        description: description || '',
        price: parseFloat(price),
        discountPrice: discountPrice ? parseFloat(discountPrice) : undefined,
        image: uploadedImageUrls[0],
        images: uploadedImageUrls.length > 0 ? JSON.stringify(uploadedImageUrls) : undefined,
        videoUrl,
        condition: condition === 'USED' ? 'USED' : 'NEW',
        location: location === 'Montego Bay, Jamaica' ? 'Montego Bay, Jamaica' : 'Florida, USA',
        categoryId,
        stock: stock ? parseInt(stock) : 0,
        sku: sku && sku.trim() ? sku.trim() : `SKU-${Date.now()}`,
        weight: weight ? parseFloat(weight) : undefined,
      },
      include: { category: true },
    });
    res.status(201).json(product);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'That SKU is already in use' });
    res.status(400).json({ error: err.message || 'Failed to create product' });
  }
});

// Admin: update product
router.put('/:id', authenticate, requireAdmin, productMediaFields, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, price, discountPrice, categoryId, stock, sku, weight, active, condition, location } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = parseFloat(price);
    if (discountPrice !== undefined) data.discountPrice = discountPrice ? parseFloat(discountPrice) : null;
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (stock !== undefined) data.stock = parseInt(stock);
    if (sku !== undefined && sku.trim()) data.sku = sku.trim();
    if (weight !== undefined) data.weight = weight ? parseFloat(weight) : null;
    if (active !== undefined) data.active = active === 'true' || active === true;
    if (condition !== undefined) data.condition = condition === 'USED' ? 'USED' : 'NEW';
    if (location !== undefined) data.location = location === 'Montego Bay, Jamaica' ? 'Montego Bay, Jamaica' : 'Florida, USA';

    const files = req.files as { image?: Express.Multer.File[]; images?: Express.Multer.File[]; video?: Express.Multer.File[] } | undefined;
    const newImageUrls = [
      ...(files?.image?.[0] ? [`/uploads/products/${files.image[0].filename}`] : []),
      ...((files?.images || []).map(f => `/uploads/products/${f.filename}`)),
    ];
    if (newImageUrls.length > 0) {
      const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
      const images = [...parseProductImages(existing?.images ?? null, existing?.image ?? null), ...newImageUrls];
      data.images = JSON.stringify(images);
      data.image = images[0];
    }
    if (files?.video?.[0]) data.videoUrl = `/uploads/products/videos/${files.video[0].filename}`;

    const product = await prisma.product.update({ where: { id: req.params.id }, data, include: { category: true } });
    res.json(product);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'That SKU is already in use' });
    res.status(400).json({ error: err.message || 'Failed to update product' });
  }
});

// Admin: remove a single uploaded product photo (pass { url } in the body). Recomputes
// the `image` cover field to the next remaining photo (or clears it if none are left).
router.delete('/:id/images', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const { url } = req.body || {};
    let images = parseProductImages(existing.images, existing.image);
    if (url) images = images.filter(u => u !== url);

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { images: images.length > 0 ? JSON.stringify(images) : null, image: images[0] || null },
      include: { category: true },
    });
    res.json(product);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to remove photo' });
  }
});

// Admin: toggle active/inactive (shows/hides the product on the customer store)
router.patch('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    const product = await prisma.product.update({ where: { id: req.params.id }, data: { active: !existing.active }, include: { category: true } });
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete product — always completely removes it, including any historical order-line
// references (OrderItem rows for this product), so it never falls back to a soft deactivate.
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { productId: req.params.id } }),
      prisma.product.delete({ where: { id: req.params.id } }),
    ]);
    res.json({ message: 'Product deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
