// Custom "edit" icon — replaces lucide-react's <Pencil /> everywhere in the admin
// screens with the uploaded pencil artwork. Drop-in replacement: same className-based
// sizing (e.g. "w-3.5 h-3.5") works the same way it did on the lucide icon.
export default function PencilIcon({ className }: { className?: string }) {
  return <img src="/pencil-icon.png" alt="Edit" className={`${className || ''} object-contain inline-block`} draggable={false} />;
}
