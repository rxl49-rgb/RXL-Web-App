// Custom "view batch" file icon — replaces lucide-react's <FileText /> on the Batches
// page's "View batch" action with the uploaded blue artwork. Drop-in replacement: same
// className-based sizing works the same way it did on the lucide icon.
export default function FileBlueIcon({ className }: { className?: string }) {
  return <img src="/file-icon-blue-v2.png" alt="View batch" className={`${className || ''} object-contain inline-block`} draggable={false} />;
}
