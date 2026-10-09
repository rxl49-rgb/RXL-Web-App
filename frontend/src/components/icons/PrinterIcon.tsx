// Custom "print" icon — replaces lucide-react's <Printer /> everywhere in the app with
// the uploaded printer artwork. Drop-in replacement: same className-based sizing works
// the same way it did on the lucide icon.
export default function PrinterIcon({ className }: { className?: string }) {
  return <img src="/printer-icon-v2.png" alt="Print" className={`${className || ''} object-contain inline-block`} draggable={false} />;
}
