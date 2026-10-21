const INTERVALS = {
  '1m': { y: '1m', range: '5d' },
  '5m': { y: '5m', range: '1mo' },
  '15m': { y: '15m', range: '1mo' },
  '1h': { y: '60m', range: '6mo' },
  '4h': { y: '60m', range: '6mo', aggregate: 4 },
  '1d': { y: '1d', range: '2y' },
  '1w': { y: '1wk', range: '5y' },
};
function aggregateBars(bars, n){
  if(!n) return bars;
  const out=[];
  for(let i=0;i<bars.length;i+=n){
    const s=bars.slice(i,i+n); if(!s.length) continue;
    out.push({time:s[0].time,open:s[0].open,high:Math.max(...s.map(x=>x.high)),low:Math.min(...s.map(x=>x.low)),close:s[s.length-1].close,volume:s.reduce((a,x)=>a+(x.volume||0),0),adjclose:s[s.length-1].adjclose});
  }
  return out;
}
export default async function handler(req,res){
  const symbol=String(req.query.symbol||'AAPL').toUpperCase().replace(/[^A-Z0-9.\-^=]/g,'').slice(0,24);
  const interval=String(req.query.interval||'15m'); const cfg=INTERVALS[interval]||INTERVALS['15m'];
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${cfg.y}&range=${cfg.range}&includePrePost=true&events=div%2Csplits`;
  try{
    const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}}); if(!r.ok) throw new Error(`Yahoo returned ${r.status}`);
    const j=await r.json(); const result=j?.chart?.result?.[0]; if(!result) throw new Error(j?.chart?.error?.description||'Symbol not found');
    const q=result.indicators?.quote?.[0]||{},a=result.indicators?.adjclose?.[0]?.adjclose||[];
    let bars=(result.timestamp||[]).map((t,i)=>({time:t,open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:q.volume?.[i]||0,adjclose:a[i]??q.close?.[i]})).filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite));
    bars=aggregateBars(bars,cfg.aggregate);
    const m=result.meta||{}; res.setHeader('Cache-Control','s-maxage=5, stale-while-revalidate=10');
    res.status(200).json({symbol,interval,bars,meta:{currency:m.currency||'USD',exchange:m.exchangeName||'',fullExchangeName:m.fullExchangeName||'',instrumentType:m.instrumentType||'',timezone:m.exchangeTimezoneName||'America/New_York',regularMarketPrice:m.regularMarketPrice,previousClose:m.chartPreviousClose??m.previousClose,regularMarketTime:m.regularMarketTime,dataGranularity:interval,gmtoffset:m.gmtoffset,marketState:m.marketState||''}});
  }catch(e){res.status(502).json({error:e.message||'Market data unavailable'})}
}
