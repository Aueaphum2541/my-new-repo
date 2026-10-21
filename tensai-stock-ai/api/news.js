export default async function handler(req,res){
  const symbol=String(req.query.symbol||'AAPL').toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,20);
  try{
    const u=`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=1&newsCount=12&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}}); if(!r.ok) throw new Error(`Yahoo returned ${r.status}`); const j=await r.json();
    const news=(j.news||[]).slice(0,10).map(x=>({title:x.title||'',publisher:x.publisher||'',link:x.link||'',published:x.providerPublishTime||0,type:x.type||'STORY'}));
    res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=120'); res.status(200).json({symbol,news});
  }catch(e){res.status(200).json({symbol,news:[],error:e.message})}
}
