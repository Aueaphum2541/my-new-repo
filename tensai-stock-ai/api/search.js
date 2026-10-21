const POPULAR = [
  ['AAPL','Apple Inc.','NASDAQ'],['MSFT','Microsoft Corporation','NASDAQ'],['NVDA','NVIDIA Corporation','NASDAQ'],
  ['AMZN','Amazon.com, Inc.','NASDAQ'],['GOOGL','Alphabet Inc.','NASDAQ'],['META','Meta Platforms, Inc.','NASDAQ'],
  ['TSLA','Tesla, Inc.','NASDAQ'],['AMD','Advanced Micro Devices, Inc.','NASDAQ'],['PLTR','Palantir Technologies Inc.','NASDAQ'],
  ['JPM','JPMorgan Chase & Co.','NYSE'],['BRK-B','Berkshire Hathaway Inc.','NYSE'],['LLY','Eli Lilly and Company','NYSE']
];

export default async function handler(req, res) {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (!q) return res.status(200).json({ results: POPULAR.map(([symbol,name,exchange]) => ({symbol,name,exchange})) });
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`Yahoo returned ${r.status}`);
    const j = await r.json();
    const results = (j.quotes || [])
      .filter(x => ['EQUITY','ETF'].includes(x.quoteType) && ['NYQ','NMS','NGM','NCM','ASE','PCX','BTS'].includes(x.exchange))
      .slice(0, 10)
      .map(x => ({ symbol: x.symbol, name: x.longname || x.shortname || x.symbol, exchange: x.exchDisp || x.exchange, type: x.quoteType }));
    res.status(200).json({ results: results.length ? results : POPULAR.filter(x => (x[0]+' '+x[1]).toLowerCase().includes(q.toLowerCase())).map(([symbol,name,exchange])=>({symbol,name,exchange})) });
  } catch (e) {
    const results = POPULAR.filter(x => (x[0]+' '+x[1]).toLowerCase().includes(q.toLowerCase())).map(([symbol,name,exchange])=>({symbol,name,exchange}));
    res.status(200).json({ results, warning: 'Search fallback active' });
  }
}
