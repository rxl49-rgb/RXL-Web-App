// Custom "view" icon — replaces lucide-react's <Eye /> on admin "View" buttons with the
// uploaded eye artwork. Drop-in replacement: same className-based sizing works the same
// way it did on the lucide icon.
export default function EyeIcon({ className }: { className?: string }) {
  return <img src="/eye-icon.png" alt="View" className={`${className || ''} object-contain inline-block`} draggable={false} />;
}
