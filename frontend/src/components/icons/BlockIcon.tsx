// Custom "block customer" icon — replaces lucide-react's <Ban /> on the Customers page's
// Block/Unblock action with the uploaded artwork. Drop-in replacement: same className-based
// sizing works the same way it did on the lucide icon.
export default function BlockIcon({ className }: { className?: string }) {
  return <img src="/block-icon-v2.png" alt="Block" className={`${className || ''} object-contain inline-block`} draggable={false} />;
}
