// Custom "invoice uploaded" file icon — replaces lucide-react's <FileText /> on the
// purchase-invoice indicator buttons. Swaps between the green artwork (an invoice was
// uploaded) and the plain silver artwork (nothing uploaded yet), matching the button's
// previous green/gray color-toggle behavior.
export default function FileIcon({ uploaded, className }: { uploaded: boolean; className?: string }) {
  return (
    <img
      src={uploaded ? '/file-icon-uploaded-v3.png' : '/file-icon-default-v2.png'}
      alt={uploaded ? 'Invoice uploaded' : 'No invoice uploaded'}
      className={`${className || ''} object-contain inline-block`}
      draggable={false}
    />
  );
}
