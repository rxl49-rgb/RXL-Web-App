import { forwardRef } from 'react';

/**
 * A precise, modern cargo/delivery van glyph.
 *
 * lucide-react's built-in "Caravan" icon renders as a travel trailer/RV, not
 * a delivery van, so this is a hand-drawn replacement matching lucide's own
 * stroke style (24x24 viewBox, currentColor stroke, round caps/joins) — it
 * drops in anywhere a lucide icon is used (same props, same sizing via
 * className) but actually reads as a boxy cargo van with a sloped windshield.
 */
const CargoVanIcon = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M3 17V8a1 1 0 0 1 1-1h9.5a1 1 0 0 1 .8.4l3.2 4.2a1 1 0 0 1 .2.6V17" />
      <path d="M3 17h17" />
      <path d="M13.5 7.3V13h5" />
      <circle cx="7.5" cy="17" r="2" />
      <circle cx="16.5" cy="17" r="2" />
    </svg>
  )
);
CargoVanIcon.displayName = 'CargoVanIcon';

export default CargoVanIcon;
