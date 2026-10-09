import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ShipmentDetailCard from '../components/shipment/ShipmentDetailCard';

export default function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-[var(--rxl-menubar-bg,#000000)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-6">
        <button onClick={() => navigate('/shipment')} className="flex items-center gap-2 text-gray-400 dark:text-white/50 hover:text-brand-700 dark:hover:text-white text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Shipments
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shipment Details</h1>
        <p className="text-gray-400 dark:text-white/50 text-sm mt-0.5">Full tracking-number breakdown and invoice details.</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-10">
        {id && <ShipmentDetailCard id={id} />}
      </div>
    </div>
  );
}
