import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Search, Filter, Package, Star, ChevronRight, LucideIcon,
  WashingMachine, Shirt, SprayCan, Sparkles,
  Truck, ShieldCheck, RotateCcw, Headphones,
} from 'lucide-react';
import api from '../lib/api';
import { useCart } from '../context/CartContext';

interface Product {
  id: string; name: string; description: string; price: number; discountPrice?: number | null;
  image?: string; videoUrl?: string | null; condition?: string; location?: string; stock: number; sku: string; weight?: number;
  category: { name: string; slug: string };
}

// The price a customer actually pays — the discount price when one's set and lower than list price.
function effectivePrice(p: Product): number {
  return p.discountPrice != null && p.discountPrice < p.price ? p.discountPrice : p.price;
}

interface Category { id: string; name: string; slug: string; _count: { products: number } }

const PROMO_CARDS: { slug: string; title: string; subtitle: string; icon: LucideIcon; bg: string }[] = [
  { slug: '', title: 'New Arrivals', subtitle: 'Discover the latest products for you.', icon: Sparkles, bg: 'bg-violet-50 dark:bg-violet-500/10' },
  { slug: 'appliances', title: 'Appliance Deals', subtitle: 'Upgrade your home with the best brands.', icon: WashingMachine, bg: 'bg-sky-50 dark:bg-sky-500/10' },
  { slug: 'apparel', title: 'Style for Less', subtitle: 'Top clothing picks at great prices.', icon: Shirt, bg: 'bg-rose-50 dark:bg-rose-500/10' },
  { slug: 'toiletries', title: 'Daily Essentials', subtitle: 'Toiletries and more delivered to you.', icon: SprayCan, bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
];

function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem({ productId: product.id, name: product.name, price: effectivePrice(product), image: product.image, sku: product.sku, stock: product.stock, location: product.location });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="panel-glass rounded-2xl hover:shadow-md transition-all duration-200 overflow-hidden group flex flex-col">
      <Link to={`/store/${product.id}`} className="block">
        <div className="h-48 bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center relative overflow-hidden">
          {product.image
            ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            : <Package className="w-16 h-16 text-brand-300" />}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span className="text-xs bg-white/90 text-brand-700 px-2 py-0.5 rounded-full font-medium border border-brand-100">
              {product.category.name}
            </span>
            {product.condition === 'USED' ? (
              <span className="text-xs bg-amber-500/90 text-white px-2 py-0.5 rounded-full font-medium">Used</span>
            ) : (
              <span className="text-xs bg-emerald-500/90 text-white px-2 py-0.5 rounded-full font-medium">New</span>
            )}
          </div>
          {product.stock < 10 && product.stock > 0 && (
            <div className="absolute top-3 right-3">
              <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium">Low Stock</span>
            </div>
          )}
        </div>
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <Link to={`/store/${product.id}`}>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 leading-snug hover:text-brand-700 transition-colors line-clamp-2 flex items-center gap-1.5">
            <span className="line-clamp-2">{product.name}</span>
            <span className="flex-shrink-0" title={product.location || 'Florida, USA'}>{product.location === 'Montego Bay, Jamaica' ? '🇯🇲' : '🇺🇸'}</span>
          </h3>
        </Link>
        <p className="text-gray-400 dark:text-white/30 text-xs mb-3 line-clamp-2 flex-1">{product.description}</p>
        <div className="flex items-center gap-0.5 mb-3">
          {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />)}
          <span className="text-xs text-gray-400 dark:text-white/30 ml-1">(24)</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-auto">
          {product.discountPrice != null && product.discountPrice < product.price ? (
            <div className="flex items-baseline gap-1 min-w-0">
              <span className="text-base font-bold text-green-600 dark:text-green-400 whitespace-nowrap">${product.discountPrice.toFixed(2)}</span>
              <span className="text-[11px] text-gray-400 dark:text-white/30 line-through whitespace-nowrap">${product.price.toFixed(2)}</span>
            </div>
          ) : (
            <span className="text-base font-bold text-brand-900 whitespace-nowrap">${product.price.toFixed(2)}</span>
          )}
          <button
            onClick={handleAdd}
            disabled={product.stock === 0}
            className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 transition-colors ${product.stock === 0 ? 'bg-gray-100 text-gray-400 dark:text-white/30 cursor-not-allowed' : added ? 'bg-green-500 text-white' : 'bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white'}`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {product.stock === 0 ? 'Out of Stock' : added ? 'Added!' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Compact card used in the "Popular Picks" horizontal scroller — same data, smaller footprint.
function PopularCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  return (
    <Link to={`/store/${product.id}`} className="w-40 sm:w-44 flex-shrink-0 snap-start group">
      <div className="h-32 sm:h-36 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-white/10">
        {product.image
          ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          : <Package className="w-10 h-10 text-brand-300" />}
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-white mt-2 leading-snug group-hover:text-brand-700 transition-colors flex items-center gap-1.5">
        <span className="line-clamp-2">{product.name}</span>
        <span className="flex-shrink-0" title={product.location || 'Florida, USA'}>{product.location === 'Montego Bay, Jamaica' ? '🇯🇲' : '🇺🇸'}</span>
      </p>
      <div className="flex items-center justify-between mt-1">
        {product.discountPrice != null && product.discountPrice < product.price ? (
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-green-600 dark:text-green-400">${product.discountPrice.toFixed(2)}</span>
            <span className="text-[10px] text-gray-400 dark:text-white/30 line-through">${product.price.toFixed(2)}</span>
          </div>
        ) : (
          <span className="text-sm font-bold text-gray-900 dark:text-white">${product.price.toFixed(2)}</span>
        )}
        <button
          onClick={e => { e.preventDefault(); if (product.stock === 0) return; addItem({ productId: product.id, name: product.name, price: effectivePrice(product), image: product.image, sku: product.sku, stock: product.stock, location: product.location }); }}
          disabled={product.stock === 0}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${product.stock === 0 ? 'bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-white/20 cursor-not-allowed' : 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-500/20'}`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
        </button>
      </div>
    </Link>
  );
}

export default function Store() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [popular, setPopular] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeLocation, setActiveLocation] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const catalogRef = useRef<HTMLDivElement>(null);
  const popularScrollRef = useRef<HTMLDivElement>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (search) params.set('search', search);
      if (activeCategory) params.set('category', activeCategory);
      if (activeLocation) params.set('location', activeLocation);
      const { data } = await api.get(`/products?${params}`);
      setProducts(data.products);
      setTotalPages(data.pages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { api.get('/products/meta/categories').then(r => setCategories(r.data)); }, []);
  useEffect(() => { api.get('/products?limit=10').then(r => setPopular(r.data.products)); }, []);
  useEffect(() => { fetchProducts(); }, [page, activeCategory, activeLocation]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchProducts(); };

  const scrollToCatalog = () => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const goToCategory = (slug: string) => { setActiveCategory(slug); setPage(1); scrollToCatalog(); };
  const scrollPopular = () => popularScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' });

  const categoryNames = categories.map(c => c.name.toLowerCase()).join(', ');

  return (
    <div className="min-h-screen bg-white dark:bg-[var(--rxl-menubar-bg,#000000)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10 pb-10">
        {/* Hero — slim, full-width banner strip using the product-shelf photo as a
            background (bg-cover crops it to fit the shorter banner height, which is
            fine at this size). Same width as before, much shorter. */}
        <section
          className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10 bg-black bg-cover bg-bottom h-28 sm:h-36 lg:h-40"
          style={{ backgroundImage: "url('/store-hero-bg-v3.jpg')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          <div className="absolute inset-0 flex items-center px-5 sm:px-8">
            <div className="max-w-md text-left">
              <h1 className="text-base sm:text-xl lg:text-2xl font-extrabold text-white leading-tight mb-1 sm:mb-2">
                Everything you need. Delivered with care.
              </h1>
              <p className="hidden sm:block text-white/70 text-xs lg:text-sm mb-2 sm:mb-3 leading-relaxed line-clamp-1">
                Shop {categoryNames || 'electronics, appliances, apparel, footwear and toiletries'} — all in one place.
              </p>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button onClick={scrollToCatalog} className="bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white text-[11px] sm:text-xs font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg">
                  Shop Now
                </button>
                <button onClick={scrollToCatalog} className="hidden sm:inline-block border border-white/30 text-white hover:bg-white/10 transition-colors text-xs font-semibold px-4 py-2 rounded-lg">
                  Explore Categories
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Promo cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {PROMO_CARDS.map(card => {
            const Icon = card.icon;
            return (
              <button
                key={card.slug || 'new'}
                onClick={() => goToCategory(card.slug)}
                className={`text-left rounded-2xl p-5 ${card.bg} hover:shadow-md transition-shadow border border-gray-100 dark:border-white/10`}
              >
                <Icon className="w-7 h-7 text-brand-800 dark:text-brand-300 mb-3" strokeWidth={1.5} />
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{card.title}</h3>
                <p className="text-gray-500 dark:text-white/50 text-xs leading-relaxed">{card.subtitle}</p>
              </button>
            );
          })}
        </section>

        {/* Popular Picks */}
        {popular.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Popular Picks</h2>
              <button onClick={scrollToCatalog} className="flex items-center gap-1 text-sm font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 transition-colors">
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="relative group">
              <div ref={popularScrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth pb-1">
                {popular.map(p => <PopularCard key={p.id} product={p} />)}
              </div>
              <button
                onClick={scrollPopular}
                aria-label="Scroll popular picks"
                className="hidden sm:flex absolute right-0 top-1/3 -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 shadow-md items-center justify-center text-gray-500 dark:text-white/60 hover:text-brand-700 transition-colors opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        {/* Catalog */}
        <section ref={catalogRef} className="scroll-mt-20">
          <div className="flex flex-col sm:flex-row gap-8">
            {/* Sidebar filters */}
            <aside className="w-full sm:w-56 flex-shrink-0">
              <div className="flex items-center gap-1.5 mb-3">
                <Filter className="w-4 h-4 text-gray-400 dark:text-white/40" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h3>
              </div>

              <p className="text-xs text-gray-500 dark:text-white/50 font-medium uppercase tracking-wide mb-2">Category</p>
              <div className="space-y-1">
                <button
                  onClick={() => goToCategory('')}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${activeCategory === '' ? 'bg-brand-800 text-white font-medium' : 'text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                >
                  All Categories
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => goToCategory(c.slug)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${activeCategory === c.slug ? 'bg-brand-800 text-white font-medium' : 'text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className={`text-xs flex-shrink-0 ${activeCategory === c.slug ? 'text-white/70' : 'text-gray-400 dark:text-white/30'}`}>{c._count.products}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-white/10">
                <p className="text-xs text-gray-500 dark:text-white/50 font-medium uppercase tracking-wide mb-2">Location</p>
                <div className="space-y-1">
                  <button
                    onClick={() => { setActiveLocation(''); setPage(1); }}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${activeLocation === '' ? 'bg-brand-800 text-white font-medium' : 'text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                  >
                    All Locations
                  </button>
                  <button
                    onClick={() => { setActiveLocation('Florida, USA'); setPage(1); }}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${activeLocation === 'Florida, USA' ? 'bg-brand-800 text-white font-medium' : 'text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                  >
                    <span>🇺🇸</span> Florida, USA
                  </button>
                  <button
                    onClick={() => { setActiveLocation('Montego Bay, Jamaica'); setPage(1); }}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${activeLocation === 'Montego Bay, Jamaica' ? 'bg-brand-800 text-white font-medium' : 'text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                  >
                    <span>🇯🇲</span> Montego Bay, Jamaica
                  </button>
                </div>
              </div>
            </aside>

            {/* Product grid */}
            <div className="flex-1 min-w-0">
              <form onSubmit={handleSearch} className="relative mb-5 max-w-md">
                <Search className="w-4 h-4 text-gray-400 dark:text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white"
                />
              </form>

              {loading ? (
                <div className="text-center py-20 text-gray-400 dark:text-white/40">Loading products…</div>
              ) : products.length === 0 ? (
                <div className="text-center py-20 text-gray-400 dark:text-white/40">No products match your filters.</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {products.map(p => <ProductCard key={p.id} product={p} />)}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-8">
                      {[...Array(totalPages)].map((_, i) => (
                        <button key={i} onClick={() => setPage(i + 1)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium ${page === i + 1 ? 'bg-brand-800 text-white' : 'bg-white dark:bg-white/[0.06] border dark:border-white/10 text-gray-600 dark:text-white/60 hover:border-brand-400'}`}>
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* Trust badges */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {[
            { icon: Truck, title: 'Fast Delivery', subtitle: 'Straight to your door' },
            { icon: ShieldCheck, title: 'Secure Checkout', subtitle: 'Your payments are protected' },
            { icon: Headphones, title: 'Customer Support', subtitle: "We're here to help" },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-brand-800 dark:text-brand-300" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-gray-500 dark:text-white/50">{item.subtitle}</p>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
