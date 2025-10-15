export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { q, lat, lon, units = 'metric', lang = 'pt_br' } = req.query || {};
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Server missing OpenWeather API key' });

    const safeUnits = units === 'imperial' ? 'imperial' : 'metric';
    const safeLang = typeof lang === 'string' ? lang : 'pt_br';

    const params = new URLSearchParams({ units: safeUnits, lang: safeLang, appid: apiKey });
    if (q) params.set('q', String(q));
    if (lat && lon) { params.set('lat', String(lat)); params.set('lon', String(lon)); }
    if (!q && !(lat && lon)) return res.status(400).json({ error: 'Missing q or lat/lon' });

    const url = `https://api.openweathermap.org/data/2.5/weather?${params.toString()}`;
    const r = await fetch(url);
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return res.status(r.status).send(txt || 'Upstream error');
    }
    // Cache em edge/CDN (Vercel) para reduzir custo e latência
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    // Mesmo domínio geralmente não precisa de CORS; mantemos estrito
    res.setHeader('Vary', 'Accept-Encoding, Origin');
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Proxy failure' });
  }
}

