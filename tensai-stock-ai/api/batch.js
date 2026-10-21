async function one(symbol){
  const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo&includePrePost=false`;
  try{const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}}); if(!r.ok) return {symbol,error:r.status}; const j=await r.json(),x=j?.chart?.result?.[0],q=x?.indicators?.quote?.[0],ts=x?.timestamp||[]; if(!x||!q||ts.length<2) return {symbol,error:'no data'}; const closes=q.close||[],vol=q.volume||[]; let i=closes.length-1; while(i>0&&!Number.isFinite(closes[i]))i--; let p=i-1; while(p>=0&&!Number.isFinite(closes[p]))p--; const price=closes[i],prev=closes[p],change=prev?((price-prev)/prev*100):0; return {symbol,price,change,volume:vol[i]||0,exchange:x.meta?.exchangeName||'',name:x.meta?.shortName||symbol};}catch(e){return {symbol,error:e.message}}
}
export default async function handler(req,res){
  const symbols=String(req.query.symbols||'SPY,QQQ').toUpperCase().split(',').map(s=>s.trim().replace(/[^A-Z0-9.\-^]/g,'')).filter(Boolean).slice(0,40);
  const out=[]; for(let i=0;i<symbols.length;i+=8){out.push(...await Promise.all(symbols.slice(i,i+8).map(one)))}
  res.setHeader('Cache-Control','s-maxage=20, stale-while-revalidate=40'); res.status(200).json({quotes:out});
}
