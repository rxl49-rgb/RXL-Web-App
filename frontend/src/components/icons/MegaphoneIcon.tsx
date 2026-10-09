// Custom "notify/megaphone" icon — replaces lucide-react's <Megaphone /> everywhere in
// the app with the uploaded megaphone artwork. Drop-in replacement: same className-based
// sizing works the same way it did on the lucide icon.
export default function MegaphoneIcon({ className }: { className?: string }) {
  return <img src="/megaphone-icon-v2.png" alt="Notify" className={`${className || ''} object-contain inline-block`} draggable={false} />;
}
