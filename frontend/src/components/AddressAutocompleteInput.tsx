import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';

interface Prediction {
  description: string;
  placeId: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

// Debounced address typeahead backed by live OpenStreetMap (Nominatim) data,
// proxied through our own backend (GET /api/places/autocomplete) — a free
// service that needs no API key or billing account.
function randomToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function AddressAutocompleteInput({ value, onChange, placeholder, required, icon: Icon }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const sessionToken = useRef(randomToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleInput = (v: string) => {
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 3) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/places/autocomplete', {
          params: { input: v, sessiontoken: sessionToken.current },
        });
        setPredictions(data.predictions || []);
        setOpen((data.predictions || []).length > 0);
      } catch {
        setPredictions([]);
        setOpen(false);
      }
    }, 300);
  };

  const select = (p: Prediction) => {
    onChange(p.description);
    setPredictions([]);
    setOpen(false);
    // Start a fresh session after a completed selection (Google bills
    // autocomplete + a following details/geocode lookup per session).
    sessionToken.current = randomToken();
  };

  return (
    <div className="relative" ref={wrapRef}>
      {Icon && <Icon className="w-4 h-4 text-gray-400 dark:text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />}
      <input
        type="text"
        value={value}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className={`w-full border rounded-xl ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-3 text-sm font-medium text-gray-900 dark:text-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-500`}
      />
      {open && predictions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1.5 bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/15 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {predictions.map(p => (
            <li key={p.placeId}>
              <button
                type="button"
                onClick={() => select(p)}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-800 dark:text-white/85 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
              >
                {p.description}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
