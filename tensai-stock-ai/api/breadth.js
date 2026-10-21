const SYMBOLS=['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','AMD','JPM','BAC','GS','XOM','CVX','LLY','UNH','JNJ','WMT','COST','HD','CAT','BA','NFLX','CRM'];
function emaLast(a,p){if(a.length<p)return null;let v=a.slice(0,p).reduce((x,y)=>x+y,0)/p,k=2/(p+1);for(let i=p;i<a.length;i++)v=a[i]*k+v*(1-k);return v}
async function one(symbol){
  const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y&includePrePost=false`;
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});if(!r.ok)throw new Error(String(r.status));
  const j=await r.json(),z=j?.chart?.result?.[0],q=z?.indicators?.quote?.[0]||{},ts=z?.timestamp||[];
  const bars=ts.map((t,i)=>({t,c:q.close?.[i],h:q.high?.[i],l:q.low?.[i]})).filter(x=>[x.c,x.h,x.l].every(Number.isFinite));
  if(bars.length<25)throw new Error('insufficient');
  const c=bars.map(x=>x.c),last=c.at(-1),prev=c.at(-2),e20=emaLast(c,20),e50=emaLast(c,50),e200=emaLast(c,200),prior20=bars.slice(-21,-1);
  const h20=Math.max(...prior20.map(x=>x.h)),l20=Math.min(...prior20.map(x=>x.l));
  return{symbol,price:last,change:(last/prev-1)*100,above20:e20!=null?last>e20:null,above50:e50!=null?last>e50:null,above200:e200!=null?last>e200:null,newHigh20:last>h20,newLow20:last<l20};
}
export default async function handler(req,res){
  try{
    const settled=await Promise.allSettled(SYMBOLS.map(one));
    const rows=settled.filter(x=>x.status==='fulfilled').map(x=>x.value),n=rows.length;
    const count=k=>rows.filter(x=>x[k]===true).length,adv=rows.filter(x=>x.change>0).length,dec=rows.filter(x=>x.change<0).length,flat=n-adv-dec;
    const pct=k=>n?Math.round(count(k)/n*100):0;
    const leaders=[...rows].sort((a,b)=>b.change-a.change).slice(0,5),laggards=[...rows].sort((a,b)=>a.change-b.change).slice(0,5);
    res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=300');
    res.status(200).json({universe:'Representative liquid US basket',coverage:n,total:SYMBOLS.length,advance:adv,decline:dec,flat,advanceDeclineRatio:dec?adv/dec:adv,aboveEMA20:pct('above20'),aboveEMA50:pct('above50'),aboveEMA200:pct('above200'),newHigh20:count('newHigh20'),newLow20:count('newLow20'),averageChange:n?rows.reduce((a,x)=>a+x.change,0)/n:0,leaders,laggards,updatedAt:Date.now()});
  }catch(e){res.status(502).json({error:e.message||'Breadth unavailable'})}
}
