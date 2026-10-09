// Custom "mail/envelope" icon — replaces lucide-react's <Mail /> everywhere in the app
// with the uploaded envelope artwork. Drop-in replacement: same className-based sizing
// works the same way it did on the lucide icon.
export default function MailIcon({ className }: { className?: string }) {
  return <img src="/envelope-icon-v2.png" alt="Email" className={`${className || ''} object-contain inline-block`} draggable={false} />;
}
