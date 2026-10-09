// Custom "history" icon — replaces lucide-react's <History /> with the uploaded clock
// artwork. Drop-in replacement: same className-based sizing works the same way it did
// on the lucide icon.
export default function HistoryIcon({ className }: { className?: string }) {
  return <img src="/history-icon-v2.png" alt="History" className={`${className || ''} object-contain inline-block`} draggable={false} />;
}
