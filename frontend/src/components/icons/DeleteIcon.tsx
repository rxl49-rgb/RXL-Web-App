// Custom "delete" icon — replaces lucide-react's Trash2 (and the delete-specific uses of
// Ban / XCircle) with the uploaded red-X artwork. Drop-in replacement: same className-based
// sizing works the same way it did on the lucide icon.
export default function DeleteIcon({ className }: { className?: string }) {
  return <img src="/delete-icon-v2.png" alt="Delete" className={`${className || ''} object-contain inline-block`} draggable={false} />;
}
