export default async function handler(req, res) {
  let rate = null, source = '';
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/THB=X?interval=5m&range=1d', { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
    if (r.ok) {
      const j = await r.json();
      const result = j?.chart?.result?.[0];
      rate = result?.meta?.regularMarketPrice;
      if (!Number.isFinite(rate)) {
        const arr = result?.indicators?.quote?.[0]?.close || [];
        rate = [...arr].reverse().find(Number.isFinite);
      }
      if (Number.isFinite(rate)) source = 'Yahoo Finance FX';
    }
  } catch {}
  if (!Number.isFinite(rate)) {
    try {
      const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=THB');
      const j = await r.json();
      rate = j?.rates?.THB;
      if (Number.isFinite(rate)) source = 'Frankfurter / ECB reference';
    } catch {}
  }
  if (!Number.isFinite(rate)) rate = 34.0, source = 'Fallback estimate';
  res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=300');
  res.status(200).json({ pair:'USDTHB', rate, source, timestamp: Date.now() });
}
