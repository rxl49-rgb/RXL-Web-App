import { Router, Request, Response } from 'express';

const router = Router();

// Live address autocomplete for the Trucking pickup/delivery fields, proxied
// through the backend so requests share one consistent server-side contract
// with the rest of the app.
//
// Backed by OpenStreetMap's Nominatim /search endpoint — the same free,
// no-API-key service already used for geocoding in lib/trucking.ts — instead
// of Google Places, which would require a billing-enabled Google Cloud
// account. Nominatim's public instance is meant for light, non-commercial use
// (an informal ~1 req/sec rate limit), which is why the frontend debounces
// requests until the user pauses typing and only queries once 3+ characters
// have been entered.
router.get('/autocomplete', async (req: Request, res: Response) => {
  const input = typeof req.query.input === 'string' ? req.query.input.trim() : '';
  if (!input || input.length < 3) return res.json({ predictions: [] });

  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    countrycodes: 'us',
    q: input,
  });

  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'User-Agent': 'RXL-Logistics-QuoteTool/1.0',
        Accept: 'application/json',
      },
    });
    if (!r.ok) {
      return res.status(502).json({ error: 'Address lookup temporarily unavailable.', predictions: [] });
    }
    const data = (await r.json()) as any[];
    const predictions = (data || []).map((p: any) => ({
      description: formatAddress(p),
      placeId: String(p.place_id),
    }));
    res.json({ predictions });
  } catch (err) {
    console.error('[places] autocomplete request failed:', err);
    res.status(502).json({ error: 'Address lookup temporarily unavailable.', predictions: [] });
  }
});

// Nominatim's display_name is a verbose, comma-separated full address (often
// including county and repeating the country) — reshape it into a cleaner,
// Google-style "street, city, state zip" line for the dropdown.
function formatAddress(p: any): string {
  const a = p.address || {};
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const city = a.city || a.town || a.village || a.hamlet || a.county || '';
  const state = a.state || '';
  const zip = a.postcode || '';
  const parts = [street, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean);
  return parts.length ? parts.join(', ') : (p.display_name as string);
}

export default router;
