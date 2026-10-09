import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Package, ArrowLeft, Star, CheckCircle, Shield, Truck, ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import api from '../lib/api';
import { useCart } from '../context/CartContext';

// Product photos are stored as a JSON-stringified array on `images`. Older products may
// only have the single legacy `image` field set — fall back to treating that as a
// one-item array.
function parseProductImages(images: string | null | undefined, image: string | null | undefined): string[] {
  if (images) {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fall through
    }
  }
  return image ? [image] : [];
}

// Imported product descriptions (e.g. from the shopfnds.com feed) arrive as plain text
// with newlines at the source's original paragraph/list/table-row boundaries. This
// turns that into structured markup: short "Label:" lines become subheadings, "•"
// lines and "Key — Value" spec-table rows become bullet lists, everything else stays
// as a paragraph — instead of one dense wall of text.
type DescBlock =
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'paragraph'; text: string };

function parseDescriptionBlocks(description: string): DescBlock[] {
  const lines = description.split('\n').map(l => l.trim()).filter(Boolean);
  const keyValuePattern = /^([^—]{2,40}) — (.+)$/;

  const blocks: DescBlock[] = [];
  for (const line of lines) {
    let item: string | null = null;
    if (line.startsWith('•')) item = line.replace(/^•\s*/, '');
    else {
      const kv = line.match(keyValuePattern);
      if (kv) item = `${kv[1].trim()} — ${kv[2].trim()}`;
    }
    if (item != null) {
      const last = blocks[blocks.length - 1];
      if (last?.type === 'list') last.items.push(item);
      else blocks.push({ type: 'list', items: [item] });
    } else {
      blocks.push({ type: 'paragraph', text: line });
    }
  }

  // A short paragraph immediately preceding a list (or ending in ':') is a section
  // heading, not body copy — e.g. a lone "Key Features" line right before its bullets.
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type !== 'paragraph') continue;
    const short = b.text.length <= 50;
    const endsWithColon = /:$/.test(b.text);
    const endsWithSentencePunct = /[.!?)]$/.test(b.text);
    const nextIsList = blocks[i + 1]?.type === 'list';
    if (short && (endsWithColon || (nextIsList && !endsWithSentencePunct))) {
      blocks[i] = { type: 'heading', text: b.text.replace(/:$/, '') };
    }
  }

  return blocks;
}

function FormattedDescription({ description }: { description: string }) {
  const blocks = parseDescriptionBlocks(description);
  return (
    <div className="space-y-2.5 mb-6">
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          return <h3 key={i} className="text-sm font-semibold text-gray-900 dark:text-white pt-1.5">{block.text}</h3>;
        }
        if (block.type === 'list') {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1 text-gray-600 dark:text-white/60 text-sm leading-relaxed">
              {block.items.map((item, j) => <li key={j}>{item}</li>)}
            </ul>
          );
        }
        return <p key={i} className="text-gray-600 dark:text-white/60 text-sm leading-relaxed">{block.text}</p>;
      })}
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [mediaTab, setMediaTab] = useState<'photo' | 'video'>('photo');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    setActiveImageIndex(0);
    api.get(`/products/${id}`).then(r => setProduct(r.data)).finally(() => setLoading(false));
  }, [id]);

  const hasDiscount = product?.discountPrice != null && product.discountPrice < product.price;
  const effectivePrice = hasDiscount ? product.discountPrice : product?.price;
  const galleryImages = parseProductImages(product?.images, product?.image);

  // Escape closes the zoomed lightbox; left/right arrow keys switch photos while it's open.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      else if (e.key === 'ArrowLeft') setActiveImageIndex(i => (i - 1 + galleryImages.length) % galleryImages.length);
      else if (e.key === 'ArrowRight') setActiveImageIndex(i => (i + 1) % galleryImages.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, galleryImages.length]);

  const handleAdd = () => {
    addItem({ productId: product.id, name: product.name, price: effectivePrice, image: product.image, sku: product.sku, stock: product.stock, location: product.location }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) return <div className="flex justify-center py-32"><div className="w-8 h-8 border-4 border-brand-700 border-t-transparent rounded-full animate-spin" /></div>;
  if (!product) return <div className="text-center py-32 text-gray-500 dark:text-white/50">Product not found</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link to="/store" className="flex items-center gap-2 text-gray-500 dark:text-white/50 hover:text-brand-700 text-sm mb-7 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Store
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Photo / Video */}
        <div>
          <div className="relative group bg-gradient-to-br from-brand-50 to-brand-100 rounded-2xl h-80 md:h-96 flex items-center justify-center overflow-hidden">
            {mediaTab === 'video' && product.videoUrl ? (
              <video src={product.videoUrl} controls className="w-full h-full object-cover" />
            ) : galleryImages.length > 0 ? (
              <>
                <button onClick={() => setLightboxOpen(true)} className="w-full h-full cursor-zoom-in" aria-label="Zoom photo">
                  <img src={galleryImages[activeImageIndex] || galleryImages[0]} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </button>
                <span className="pointer-events-none absolute bottom-3 right-3 w-8 h-8 rounded-full icon-glass bg-white/70 dark:bg-black/40 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-4 h-4 text-gray-700 dark:text-white/80" />
                </span>
                {mediaTab === 'photo' && galleryImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setActiveImageIndex(i => (i - 1 + galleryImages.length) % galleryImages.length)}
                      aria-label="Previous photo"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full icon-glass bg-white/50 dark:bg-black/30 backdrop-blur-md flex items-center justify-center text-gray-700 dark:text-white/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/70 dark:hover:bg-black/50"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setActiveImageIndex(i => (i + 1) % galleryImages.length)}
                      aria-label="Next photo"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full icon-glass bg-white/50 dark:bg-black/30 backdrop-blur-md flex items-center justify-center text-gray-700 dark:text-white/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/70 dark:hover:bg-black/50"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <span className="pointer-events-none absolute bottom-3 left-3 text-[11px] font-medium px-2 py-1 rounded-full icon-glass bg-white/50 dark:bg-black/30 backdrop-blur-md text-gray-700 dark:text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                      {activeImageIndex + 1} / {galleryImages.length}
                    </span>
                  </>
                )}
              </>
            ) : (
              <Package className="w-28 h-28 text-brand-300" />
            )}
          </div>

          {mediaTab === 'photo' && galleryImages.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {galleryImages.map((url, i) => (
                <button key={url + i} onClick={() => setActiveImageIndex(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${i === activeImageIndex ? 'border-brand-700' : 'border-transparent hover:border-gray-300 dark:hover:border-white/20'}`}>
                  <img src={url} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {product.videoUrl && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => setMediaTab('photo')} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${mediaTab === 'photo' ? 'bg-brand-800 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60'}`}>Photo</button>
              <button onClick={() => setMediaTab('video')} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${mediaTab === 'video' ? 'bg-brand-800 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60'}`}>Video</button>
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-brand-50 text-brand-700 px-3 py-1 rounded-full font-medium border border-brand-100">{product.category.name}</span>
            {product.condition === 'USED' ? <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">Used</span> : <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">New</span>}
            <span className="text-xs bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60 px-3 py-1 rounded-full font-medium">
              {product.location === 'Montego Bay, Jamaica' ? '🇯🇲' : '🇺🇸'} {product.location || 'Florida, USA'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-3 mb-2">{product.name}</h1>
          <div className="flex items-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
            <span className="text-sm text-gray-400 dark:text-white/30 ml-1">(24 reviews)</span>
          </div>
          {hasDiscount ? (
            <div className="flex items-baseline gap-3 mb-2">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">${product.discountPrice.toFixed(2)}</p>
              <p className="text-lg text-gray-400 dark:text-white/30 line-through">${product.price.toFixed(2)}</p>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                {Math.round((1 - product.discountPrice / product.price) * 100)}% OFF
              </span>
            </div>
          ) : (
            <p className="text-3xl font-bold text-brand-900 mb-2">${product.price.toFixed(2)}</p>
          )}
          <p className={`text-sm font-medium mb-5 ${product.stock > 10 ? 'text-green-600' : product.stock > 0 ? 'text-orange-500' : 'text-red-500'}`}>
            {product.stock > 10 ? '✓ In Stock' : product.stock > 0 ? `Only ${product.stock} left` : 'Out of Stock'}
          </p>

          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Description</h2>
          <FormattedDescription description={product.description} />

          {product.weight && <p className="text-sm text-gray-400 dark:text-white/30 mb-5">Weight: {product.weight} kg · SKU: {product.sku}</p>}

          {/* Qty + Add */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border rounded-xl">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-2 text-gray-500 dark:text-white/50 hover:text-gray-700 dark:text-white/70">−</button>
              <span className="px-4 py-2 font-medium text-gray-900 dark:text-white border-x">{qty}</span>
              <button onClick={() => setQty(q => Math.min(product.stock, q + 1))} disabled={qty >= product.stock} className="px-3 py-2 text-gray-500 dark:text-white/50 hover:text-gray-700 dark:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed">+</button>
            </div>
            <button
              onClick={handleAdd}
              disabled={product.stock === 0}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors ${product.stock === 0 ? 'bg-gray-100 text-gray-400 dark:text-white/30' : added ? 'bg-green-500 text-white' : 'bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white'}`}
            >
              <ShoppingCart className="w-5 h-5" />
              {product.stock === 0 ? 'Out of Stock' : added ? 'Added to Cart!' : 'Add to Cart'}
            </button>
          </div>

          {/* Guarantees */}
          <div className="space-y-2 border-t pt-5">
            {[
              { icon: Shield, text: 'Secure checkout & payment protection' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
                <Icon className="w-4 h-4 text-brand-500" />{text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zoomed photo lightbox */}
      {lightboxOpen && galleryImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center px-4 py-8"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full icon-glass bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <img
            src={galleryImages[activeImageIndex] || galleryImages[0]}
            alt={product.name}
            onClick={e => e.stopPropagation()}
            className="max-w-full max-h-[85vh] object-contain rounded-xl cursor-default"
          />

          {galleryImages.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setActiveImageIndex(i => (i - 1 + galleryImages.length) % galleryImages.length); }}
                aria-label="Previous photo"
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full icon-glass bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setActiveImageIndex(i => (i + 1) % galleryImages.length); }}
                aria-label="Next photo"
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full icon-glass bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium px-2.5 py-1 rounded-full icon-glass bg-white/10 backdrop-blur-md text-white">
                {activeImageIndex + 1} / {galleryImages.length}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
