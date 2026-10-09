import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plane, Ship, Truck, ArrowRight, Box, Boxes, ClipboardCheck, CheckCircle2, ScanLine, ChevronLeft, ChevronRight, PackageCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import { STATUS_LABEL, STATUS_STYLE } from '../lib/freight';
import { ModalShipment, ShipmentItemRow } from '../components/shipment/ShipmentItemsModal';

interface Advertisement {
  id: string;
  title?: string | null;
  message?: string | null;
  imageUrl?: string | null;
}

// Dark-mode complements for the shared (light-only) STATUS_STYLE badge colors.
const STATUS_STYLE_DARK: Record<string, string> = {
  PROCESSING: 'dark:bg-orange-500/15 dark:text-orange-300',
  IN_TRANSIT: 'dark:bg-blue-500/15 dark:text-blue-300',
  AT_PORT_JAMAICA: 'dark:bg-orange-500/15 dark:text-orange-300',
  OUT_FOR_DELIVERY: 'dark:bg-green-500/15 dark:text-green-300',
  DELIVERED: 'dark:bg-green-500/15 dark:text-green-300',
};

interface HomeShipment extends ModalShipment {
  weight: number | null;
  createdAt: string;
  items: ShipmentItemRow[];
}

// Fixed light-mode hero banner — single RXL Shop promo, 2200x600.
const LIGHT_HERO_BANNERS = ['/banner-fnds-shop.png', '/banner-services-provided-v2.png', '/banner-ship-air-light.png', '/banner-ship-barrels-v2.png'];
const DARK_HERO_BANNERS = ['/banner-fnds-shop-dark.png', '/banner-ship-air-dark-v2.png'];

interface ServiceBlock {
  heading: string;
  body?: string;
  items?: string[];
}

interface ServiceInfo {
  id: string;
  icon: typeof Ship;
  title: string;
  subtitle?: string;
  intro: string;
  sectionLabel?: string;
  blocks: ServiceBlock[];
  trackLabel?: string;
  trackSteps?: string[];
  tags?: string;
  tagline?: string;
  availableStructureLabel?: string;
  availableStructure?: string;
}

// "Services Provided" — the four core RXL Logistics services, shown as icon tiles on the
// homepage Features section. Clicking a tile opens a modal with the full service breakdown.
const SERVICES: ServiceInfo[] = [
  {
    id: 'sea-freight',
    icon: Ship,
    title: 'Sea Freight Service',
    subtitle: 'Florida → Montego Bay, Jamaica',
    intro: 'Reliable weekly sea freight service from Florida directly to Montego Bay, Jamaica, designed to provide dependable transportation, professional cargo handling, and complete shipment visibility.',
    blocks: [
      { heading: 'Weekly Departures', body: 'Consistent weekly shipping schedules provide customers with a reliable option for moving packages, consolidated cargo, pallets, and commercial freight to Jamaica.' },
      { heading: 'Professional Packing & Cargo Care', body: 'Shipments are properly received, handled, consolidated, packaged, and prepared for sea transportation, helping protect cargo throughout its journey.' },
      { heading: 'Reliable Transportation', body: 'Our service is structured around dependable weekly movement and careful handling from warehouse receipt through arrival and collection in Montego Bay.' },
      { heading: 'Complete Shipment Visibility', body: 'Customers have access to our end-user website and mobile app, providing shipment information and status updates throughout the shipping process.' },
    ],
    trackLabel: 'Track Every Step',
    trackSteps: ['Warehouse Received', 'Processed', 'Packed', 'Ready to Ship', 'In Transit', 'Arrived in Jamaica', 'Ready for Collection', 'Collected'],
    tags: 'Florida Receiving • Weekly Sea Freight • Montego Bay Collection • Complete Visibility',
    tagline: 'Reliable Shipping. Every Step of the Way.',
  },
  {
    id: 'air-freight',
    icon: Plane,
    title: 'Expedited Air Freight Service',
    subtitle: 'Florida → Jamaica',
    intro: 'Fast and dependable expedited air freight service designed for customers who need their shipments delivered quickly and reliably.',
    blocks: [
      { heading: 'Multiple Flights Every Week', body: 'Frequent air freight departures throughout the week provide faster movement and greater flexibility for time-sensitive shipments.' },
      { heading: 'Expedited Processing', body: 'Priority receiving, scanning, processing, and preparation help move your shipment from our Florida warehouse to Jamaica as quickly as possible.' },
      { heading: 'Reliable Delivery', body: 'From warehouse receipt to arrival and final delivery or collection, shipments are carefully handled to provide a dependable end-to-end service.' },
      { heading: 'Complete Shipment Visibility', body: 'Our customer website and mobile app provide shipment updates throughout the entire process.' },
    ],
    trackLabel: 'Track Every Step',
    trackSteps: ['Warehouse Received', 'Processed', 'Ready for Flight', 'In Transit', 'Arrived in Jamaica', 'Cleared', 'Out for Delivery / Ready for Collection', 'Delivered'],
    tags: 'Florida Receiving • Multiple Weekly Flights • Expedited Processing • Jamaica Delivery • Complete Visibility',
    tagline: 'When You Need It Faster, Ship by Air.',
  },
  {
    id: 'consolidation',
    icon: Boxes,
    title: 'Consolidation Service',
    intro: 'A complete warehouse and shipment-preparation solution designed for businesses, freight forwarders, online retailers, and logistics partners that need reliable receiving, processing, consolidation, and shipment management.',
    sectionLabel: 'Service Options',
    blocks: [
      { heading: 'Warehouse Receiving', body: 'Receive packages, cartons, freight, and merchandise at our warehouse with organized intake and shipment identification.' },
      { heading: 'Scanning & Verification', body: 'Scan incoming shipments, verify labels and shipment details, record quantities, and digitally register received cargo.' },
      { heading: 'Data Processing', body: 'Process shipment information, customer details, package descriptions, quantities, dimensions, weights, tracking numbers, and supporting documentation.' },
      { heading: 'Packaging & Consolidation', body: 'Combine multiple shipments, repack merchandise, remove unnecessary packaging, and prepare consolidated cargo for transportation.' },
      { heading: 'Palletizing', body: 'Organize and secure cartons or freight onto pallets, including wrapping, labeling, and preparation for pickup, export, or container loading.' },
      {
        heading: 'Website Platform Access',
        body: 'Provide authorized access to the online platform for shipment management, including:',
        items: ['Warehouse receiving records', 'Shipment and package information', 'Scanned shipment details', 'Customer/account management', 'Package status updates', 'Consolidation requests', 'Documentation and reporting', 'Shipment history'],
      },
    ],
    availableStructureLabel: 'Available Service Structure',
    availableStructure: 'Services can be offered individually or combined into a Full-Service Consolidation Package, allowing clients to outsource the complete process from warehouse receiving through final shipment preparation.',
  },
  {
    id: 'pickup-delivery',
    icon: Truck,
    title: 'Pickup & Delivery Services',
    intro: 'Flexible transportation solutions for individuals, businesses, freight forwarders, and logistics partners throughout Florida.',
    sectionLabel: 'Service Options',
    blocks: [
      { heading: 'Local Pickup', body: 'Pickup of packages, cartons, pallets, and commercial freight from businesses, warehouses, retailers, and distribution centers.' },
      { heading: 'Warehouse-to-Warehouse Transfer', body: 'Scheduled or on-demand transportation of cargo between warehouses and distribution facilities.' },
      { heading: 'Port & Freight Terminal Pickup', body: 'Pickup and transfer of eligible cargo from freight terminals, cargo facilities, and ports to your designated warehouse or facility.' },
      { heading: 'Business Delivery', body: 'Direct delivery of packages, pallets, and freight to commercial locations throughout Florida.' },
      { heading: 'Residential Delivery', body: 'Delivery of eligible packages and freight directly to residential addresses.' },
      { heading: 'Pallet & Bulk Freight Transport', body: 'Transportation for palletized cargo, multiple cartons, oversized shipments, and consolidated freight.' },
      { heading: 'Scheduled Route Service', body: 'Recurring pickup and delivery routes for businesses requiring regular transportation between designated Florida locations.' },
      { heading: 'On-Demand Service', body: 'Pickup and delivery arranged as needed for urgent or occasional transportation requirements.' },
    ],
    availableStructureLabel: 'Available Service Structure',
    availableStructure: 'Services can be booked individually or combined with Warehouse Receiving, Scanning, Data Processing, Packaging, Consolidation, Palletizing, and Platform Access for a complete logistics solution.',
  },
];

// The "SHOP NOW" button is baked into the FNDS Shop banner artwork itself, so a
// real link is overlaid on top of it at the button's approximate position within
// the image (as a % of the banner's own box, so it stays aligned at any screen
// size — the carousel pane keeps the banner's native aspect ratio, so there's no
// letterboxing/cropping to throw the percentages off). The light and dark artwork
// were designed separately and place their flat button slightly differently
// (measured directly from the PNGs: light button sits at ~5.4-19.9% x / 76.9-88.5%
// y; dark button sits at ~2.8-20.7% x / 77.3-89.3% y, further left and taller) —
// so each gets its own anchor, tuned with margin so our overlay fully covers it.
const HERO_BANNER_HOTSPOTS: Record<string, { to: string; label: string; style: CSSProperties }> = {
  '/banner-fnds-shop.png': { to: '/store', label: 'Shop Now — FNDS Shop', style: { left: '4%', top: '75%' } },
  '/banner-fnds-shop-dark.png': { to: '/store', label: 'Shop Now — FNDS Shop', style: { left: '1.5%', top: '75%' } },
};

export default function Home() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<HomeShipment[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [slide, setSlide] = useState(0);
  const heroScrollRef = useRef<HTMLDivElement>(null);
  const heroSlideCount = theme === 'dark' ? DARK_HERO_BANNERS.length : LIGHT_HERO_BANNERS.length;
  const slideCount = heroSlideCount + ads.length;

  useEffect(() => {
    if (!user) { setLoadingShipments(false); return; }
    api.get('/shipments/mine')
      .then(r => setShipments(r.data))
      .finally(() => setLoadingShipments(false));
  }, [user]);

  useEffect(() => {
    api.get('/advertisements/active').then(r => setAds(r.data)).catch(() => {});
  }, []);

  const scrollToSlide = useCallback((i: number) => {
    const el = heroScrollRef.current;
    if (!el) return;
    const next = ((i % slideCount) + slideCount) % slideCount;
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    setSlide(next);
  }, [slideCount]);

  // Autoplay the carousel when there's more than one slide (branded hero + active ads).
  useEffect(() => {
    if (slideCount <= 1) return;
    const timer = setInterval(() => scrollToSlide(slide + 1), 6000);
    return () => clearInterval(timer);
  }, [slide, slideCount, scrollToSlide]);

  // Keep `slide` in sync when the user drags/scrolls the banner manually.
  const handleHeroScroll = () => {
    const el = heroScrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };

  // Services Provided — which service's detail modal (if any) is currently open.
  const [openService, setOpenService] = useState<string | null>(null);

  const stats = useMemo(() => ({
    total: shipments.length,
    inTransit: shipments.filter(s => s.status === 'IN_TRANSIT').length,
    readyForPickup: shipments.filter(s => s.status === 'OUT_FOR_DELIVERY').length,
    delivered: shipments.filter(s => s.status === 'DELIVERED').length,
  }), [shipments]);

  const statCards = [
    { label: 'Total Shipments', value: stats.total, icon: Box, color: 'bg-sky-500' },
    { label: 'In Transit', value: stats.inTransit, icon: Truck, color: 'bg-green-500' },
    { label: 'Ready for Pickup', value: stats.readyForPickup, icon: ClipboardCheck, color: 'bg-orange-500' },
    { label: 'Delivered', value: stats.delivered, icon: CheckCircle2, color: 'bg-purple-500' },
  ];

  const recentShipments = useMemo(
    () => [...shipments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [shipments]
  );

  // Newly scanned-in shipments that haven't been assigned to a batch yet. `shipments`
  // is already sorted newest-first (API returns createdAt desc), so slicing after the
  // filter naturally surfaces the most recently scanned ones.
  const pendingShipments = useMemo(
    () => shipments.filter(s => !s.batch).slice(0, 3),
    [shipments]
  );

  return (
    <div>
      {/* Hero banner — scrollable carousel: slide 1 is the branded photo (image only, no text
          overlay), slides after it are active ads. Contained + rounded (not full-bleed) so it
          reads as a compact card on the page, floating above the background with a soft
          Apple-style elevation shadow. Pane is fixed at a 2200x600 aspect ratio. */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="relative overflow-hidden rounded-3xl bg-[var(--rxl-page-bg,#ffffff)] dark:bg-[var(--rxl-menubar-bg,#000000)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-14px_rgba(0,0,0,0.16)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_8px_-2px_rgba(0,0,0,0.5),0_24px_48px_-16px_rgba(0,0,0,0.7)] group">
          <div
            ref={heroScrollRef}
            onScroll={handleHeroScroll}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth aspect-[2173/724]"
          >
            {/* Slide 1(+) — dark mode shows the single branded night-scene photo; light mode
                shows the RXL Shop promo banner instead. Image fills the pane edge-to-edge. */}
            {(theme === 'dark' ? DARK_HERO_BANNERS : LIGHT_HERO_BANNERS).map(src => {
              const hotspot = HERO_BANNER_HOTSPOTS[src];
              return (
                <div key={src} className="relative w-full h-full flex-shrink-0 snap-start">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  {hotspot && (
                    <Link
                      to={hotspot.to}
                      aria-label={hotspot.label}
                      style={hotspot.style}
                      className="shop-now-btn absolute inline-flex items-center whitespace-nowrap gap-1 sm:gap-1.5 md:gap-2
                        rounded-lg sm:rounded-xl md:rounded-2xl font-extrabold uppercase tracking-wide !text-white
                        text-[10px] sm:text-sm md:text-base lg:text-lg
                        px-3.5 py-2.5 sm:px-6 sm:py-3 md:px-8 md:py-4 lg:px-11 lg:py-5
                        outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-800"
                    >
                      Shop Now
                      <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6" strokeWidth={3} />
                    </Link>
                  )}
                </div>
              );
            })}

            {/* Ad slides — pulled live from the admin Advertisement screen (ACTIVE only). Image
                only — no overlaying text. */}
            {ads.map(ad => (
              <div key={ad.id} className="relative w-full h-full flex-shrink-0 snap-start bg-[var(--rxl-page-bg,#ffffff)] dark:bg-[var(--rxl-menubar-bg,#000000)] flex items-center justify-center p-3 sm:p-4">
                {ad.imageUrl ? (
                  <img src={ad.imageUrl} alt={ad.title || ''} className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_2px_4px_rgba(0,0,0,0.06),0_24px_48px_-16px_rgba(0,0,0,0.4)] ring-1 ring-black/5 dark:ring-white/10" />
                ) : (
                  <div className="absolute inset-3 sm:inset-4 rounded-2xl bg-gradient-to-br from-brand-900 to-black shadow-[0_2px_4px_rgba(0,0,0,0.06),0_24px_48px_-16px_rgba(0,0,0,0.4)] ring-1 ring-white/10" />
                )}
              </div>
            ))}
          </div>

          {slideCount > 1 && (
            <>
              <button
                onClick={() => scrollToSlide(slide - 1)}
                aria-label="Previous slide"
                className="hidden group-hover:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollToSlide(slide + 1)}
                aria-label="Next slide"
                className="hidden group-hover:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white items-center justify-center transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                {Array.from({ length: slideCount }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToSlide(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Recently Scanned — Pending Shipments — logged-in customers only */}
      {user && !loadingShipments && pendingShipments.length > 0 && (
        <section className="pt-5 pb-10 bg-white dark:bg-white/[0.03]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 mb-5">
              <ScanLine className="w-5 h-5 text-brand-700 dark:text-accent-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recently Scanned — Pending Shipments</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingShipments.map(s => {
                const TypeIcon = s.type === 'SEA' ? Ship : Plane;
                return (
                  <button key={s.id} onClick={() => navigate(`/shipment/${s.id}`)} className="panel-glass rounded-2xl p-4 text-left hover:shadow-md transition-shadow flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-brand-800 flex items-center justify-center flex-shrink-0">
                      <PackageCheck className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{s.trackingNumber}</p>
                      <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5 flex items-center gap-1.5">
                        <TypeIcon className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">Florida, USA → Montego Bay, JA</span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Shipment Overview — logged-in customers only */}
      {user && (
        <section className="pt-5 pb-14 bg-white dark:bg-white/[0.03]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Your Shipment Overview</h2>
              <Link to="/shipment" className="text-sm text-brand-700 dark:text-accent-400 font-medium flex items-center gap-1 flex-shrink-0">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {statCards.map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="panel-glass rounded-2xl p-4 flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{loadingShipments ? '—' : value}</p>
                    <p className="text-xs text-gray-400 dark:text-white/40 mt-1.5 truncate">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent shipments */}
            <div className="panel-glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/10 text-left text-gray-400 dark:text-white/40">
                      <th className="px-6 py-3.5 font-medium">Shipment</th>
                      <th className="px-6 py-3.5 font-medium">Route</th>
                      <th className="px-6 py-3.5 font-medium">Status</th>
                      <th className="px-6 py-3.5 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingShipments ? (
                      <tr><td colSpan={4} className="text-center py-14 text-gray-400 dark:text-white/30">Loading…</td></tr>
                    ) : recentShipments.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-14 text-gray-400 dark:text-white/30">No shipments on your account yet.</td></tr>
                    ) : recentShipments.map(s => {
                      const TypeIcon = s.type === 'SEA' ? Ship : Plane;
                      return (
                      <tr key={s.id} onClick={() => navigate(`/shipment/${s.id}`)} className="cursor-pointer border-b border-gray-100 dark:border-white/5 last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.type === 'SEA' ? 'bg-teal-50 dark:bg-teal-500/10' : 'bg-blue-50 dark:bg-blue-500/10'}`}>
                              <TypeIcon className={`w-4 h-4 ${s.type === 'SEA' ? 'text-teal-600 dark:text-teal-400' : 'text-blue-600 dark:text-blue-400'}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white truncate">{s.batch?.batchNumber || s.trackingNumber}</p>
                              <p className="text-xs text-gray-400 dark:text-white/30">{s.itemCount} item{s.itemCount === 1 ? '' : 's'} · {s.type}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-white/60 whitespace-nowrap">Florida, USA → Montego Bay, JA</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[s.status] || 'bg-gray-100 text-gray-600'} ${STATUS_STYLE_DARK[s.status] || 'dark:bg-white/10 dark:text-white/60'}`}>
                            {STATUS_LABEL[s.status] || s.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white font-semibold whitespace-nowrap">${s.totalUSD.toFixed(2)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      <section className="pt-6 pb-20 bg-white dark:bg-white/[0.03]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">Shipping Solutions</h2>
            <p className="text-gray-500 dark:text-white/50 max-w-xl mx-auto">Choose the right freight option for your cargo — from urgent air shipments to cost-effective ocean freight.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Plane, title: 'Air Freight', desc: 'Fastest delivery worldwide. Tiered per-lb pricing. Ideal for urgent, high-value cargo.', badge: 'Fastest', color: 'blue' },
              { icon: Ship, title: 'Sea Freight', desc: 'Cost-effective ocean shipping priced by cubic feet. Great for bulk and heavy cargo.', badge: 'Most Popular', color: 'teal' },
              { icon: Truck, title: 'Ground Freight', desc: 'Reliable road transport for domestic and regional shipments.', badge: 'Economical', color: 'orange' },
            ].map(({ icon: Icon, title, desc, badge, color }) => (
              <div key={title} className="panel-glass rounded-2xl p-7 group">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${color === 'blue' ? 'bg-blue-500' : color === 'teal' ? 'bg-teal-500' : 'bg-orange-500'}`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">{title}</h3>
                  <span className="text-xs bg-brand-100 dark:bg-white/10 text-brand-700 dark:text-white/70 px-2 py-0.5 rounded-full font-medium">{badge}</span>
                </div>
                <p className="text-gray-500 dark:text-white/50 text-sm leading-relaxed mb-4">{desc}</p>
                <div className="flex items-center justify-end">
                  <Link to="/quote" className="text-brand-700 dark:text-accent-400 text-sm font-medium hover:text-accent-500 group-hover:text-accent-500 transition-colors flex items-center gap-1">
                    Get quote <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-stretch">
            <div className="flex flex-col">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">Services Provided</h2>
              <div className="grid grid-cols-2 gap-4 flex-1">
                {SERVICES.map(svc => (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => setOpenService(svc.id)}
                    className="rounded-2xl border border-gray-200 dark:border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-14px_rgba(0,0,0,0.16)] dark-depth bg-white dark:bg-white/[0.04] flex flex-col items-center justify-center gap-3 p-6 text-center hover:-translate-y-0.5 hover:shadow-lg transition-all"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-brand-800 flex items-center justify-center flex-shrink-0">
                      <svc.icon className="w-7 h-7 text-white" strokeWidth={1.75} />
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{svc.title}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="panel-glass dark:bg-white/[0.06] rounded-3xl p-8 text-gray-900 dark:text-white flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Get a Quick Quote</h3>
              <p className="text-gray-500 dark:text-white/60 text-sm mb-6">Instant pricing for your shipment</p>
              <div className="space-y-3">
                {[['Air Freight (10 lbs, tier rate)', '$30.00'], ['Sea Freight (24×18×12 in)', '$15.75'], ['Air Freight (100 lbs, tier rate)', '$215.00']].map(([route, price]) => (
                  <div key={route} className="flex justify-between items-center bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-white/70">{route}</span>
                    <span className="font-bold text-accent-500 dark:text-accent-400">{price}</span>
                  </div>
                ))}
              </div>
              <Link to="/quote" className="mt-6 w-full block text-center bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-semibold py-3 rounded-xl transition-colors">
                Calculate Your Rate
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white dark:bg-white/[0.03] border-t border-gray-100 dark:border-white/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">Ready to Ship?</h2>
          <p className="text-gray-500 dark:text-white/50 text-lg mb-8">Get a free quote in seconds or track your existing shipment.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/quote" className="bg-brand-800 hover:bg-brand-700 hover:shadow-glow-blue transition-shadow text-white font-bold px-8 py-3.5 rounded-xl transition-colors">
              Get a Free Quote
            </Link>
            <Link to="/register" className="border-2 border-gray-200 dark:border-white/20 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 font-bold px-8 py-3.5 rounded-xl transition-colors">
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* Services Provided — detail modal */}
      {openService && (() => {
        const svc = SERVICES.find(s => s.id === openService);
        if (!svc) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 dark:bg-black/70" onClick={() => setOpenService(null)} />
            <div className="relative panel-glass rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-start justify-between p-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-800 flex items-center justify-center flex-shrink-0">
                    <svc.icon className="w-6 h-6 text-white" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{svc.title}</h3>
                    {svc.subtitle && <p className="text-sm text-brand-700 dark:text-accent-400 font-medium">{svc.subtitle}</p>}
                  </div>
                </div>
                <button onClick={() => setOpenService(null)} className="p-1.5 rounded-lg text-gray-400 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex-shrink-0" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 pb-6 space-y-5">
                <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed">{svc.intro}</p>

                {svc.sectionLabel && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">{svc.sectionLabel}</p>
                )}

                <div className="space-y-4">
                  {svc.blocks.map(block => (
                    <div key={block.heading}>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{block.heading}</h4>
                      {block.body && <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed">{block.body}</p>}
                      {block.items && (
                        <ul className="mt-1.5 space-y-1">
                          {block.items.map(item => (
                            <li key={item} className="text-sm text-gray-600 dark:text-white/60 flex items-start gap-2">
                              <span className="w-1 h-1 rounded-full bg-brand-700 dark:bg-accent-400 mt-2 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                {svc.trackSteps && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{svc.trackLabel}</h4>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {svc.trackSteps.map((step, i) => (
                        <span key={step} className="flex items-center gap-1.5">
                          <span className="text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white/70 px-2.5 py-1 rounded-full">{step}</span>
                          {i < svc.trackSteps!.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 dark:text-white/20 flex-shrink-0" />}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {svc.availableStructure && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{svc.availableStructureLabel}</h4>
                    <p className="text-sm text-gray-600 dark:text-white/60 leading-relaxed">{svc.availableStructure}</p>
                  </div>
                )}

                {(svc.tags || svc.tagline) && (
                  <div className="pt-4 border-t border-gray-100 dark:border-white/10 text-center">
                    {svc.tags && <p className="text-xs text-gray-400 dark:text-white/40 mb-1">{svc.tags}</p>}
                    {svc.tagline && <p className="text-sm font-semibold text-brand-700 dark:text-accent-400">{svc.tagline}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
