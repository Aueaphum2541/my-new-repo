const MAP={XLK:'Technology',XLF:'Financials',XLE:'Energy',XLV:'Health Care',XLY:'Consumer Discretionary',XLP:'Consumer Staples',XLI:'Industrials',XLB:'Materials',XLU:'Utilities',XLRE:'Real Estate',XLC:'Communication'};
async function series(symbol){
  const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo&includePrePost=false`;
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});if(!r.ok)throw new Error(`${symbol}:${r.status}`);
  const j=await r.json(),z=j?.chart?.result?.[0],q=z?.indicators?.quote?.[0]||{},c=(q.close||[]).filter(Number.isFinite);if(c.length<22)throw new Error(`${symbol}:insufficient`);return c;
}
const ret=(c,n)=>c.length>n?(c.at(-1)/c.at(-(n+1))-1)*100:null;
export default async function handler(req,res){
  try{
    const syms=['SPY',...Object.keys(MAP)],settled=await Promise.allSettled(syms.map(async s=>[s,await series(s)])),ok=Object.fromEntries(settled.filter(x=>x.status==='fulfilled').map(x=>x.value));
    if(!ok.SPY)throw new Error('SPY unavailable');
    const spy={d1:ret(ok.SPY,1),d5:ret(ok.SPY,5),d21:ret(ok.SPY,21)};
    const sectors=Object.entries(MAP).filter(([s])=>ok[s]).map(([symbol,name])=>{const c=ok[symbol],r={d1:ret(c,1),d5:ret(c,5),d21:ret(c,21)};return{symbol,name,...r,rel1:r.d1-spy.d1,rel5:r.d5-spy.d5,rel21:r.d21-spy.d21,rotationScore:(r.d1-spy.d1)*.2+(r.d5-spy.d5)*.3+(r.d21-spy.d21)*.5}}).sort((a,b)=>b.rotationScore-a.rotationScore);
    res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=600');res.status(200).json({benchmark:'SPY',spy,sectors,updatedAt:Date.now()});
  }catch(e){res.status(502).json({error:e.message||'Rotation unavailable'})}
}
