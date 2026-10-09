// Custom "activate customer" green check icon — replaces lucide-react's <Check /> on the
// Customers page's Activate action with the uploaded artwork. Drop-in replacement: same
// className-based sizing works the same way it did on the lucide icon.
export default function CheckIcon({ className }: { className?: string }) {
  return <img src="/check-icon-v2.png" alt="Activate" className={`${className || ''} object-contain inline-block`} draggable={false} />;
}
