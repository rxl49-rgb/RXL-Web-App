import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
}

export default function ComingSoon({ title, description, icon: Icon }: Props) {
  return (
    <div>
      <div className="bg-white border-b px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>
      <div className="p-6">
        <div className="panel-glass rounded-2xl py-20 flex flex-col items-center text-center px-6">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-5">
            <Icon className="w-7 h-7 text-brand-700" />
          </div>
          <h2 className="font-bold text-gray-900 mb-2">{title} is coming soon</h2>
          <p className="text-gray-400 text-sm max-w-sm">{description}</p>
        </div>
      </div>
    </div>
  );
}
