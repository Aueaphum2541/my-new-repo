const val=x=>x?.raw??x??null;
export default async function handler(req,res){
  const symbol=String(req.query.symbol||'AAPL').toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,20);
  const modules='price,summaryDetail,defaultKeyStatistics,financialData,calendarEvents';
  try{
    const u=`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}}); if(!r.ok) throw new Error(`Yahoo returned ${r.status}`); const j=await r.json(); const x=j?.quoteSummary?.result?.[0]; if(!x) throw new Error('Fundamentals unavailable');
    const p=x.price||{},d=x.summaryDetail||{},k=x.defaultKeyStatistics||{},f=x.financialData||{},c=x.calendarEvents||{};
    const earnings=c.earnings?.earningsDate?.[0]?.raw||null; const dividend=d.exDividendDate?.raw||null;
    res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=1800');
    res.status(200).json({symbol,name:p.longName||p.shortName||symbol,marketCap:val(p.marketCap),trailingPE:val(d.trailingPE),forwardPE:val(k.forwardPE),priceToBook:val(k.priceToBook),profitMargins:val(f.profitMargins),revenueGrowth:val(f.revenueGrowth),earningsGrowth:val(f.earningsGrowth),debtToEquity:val(f.debtToEquity),freeCashflow:val(f.freeCashflow),targetMeanPrice:val(f.targetMeanPrice),recommendationKey:f.recommendationKey||null,earningsDate:earnings,exDividendDate:dividend,dividendYield:val(d.dividendYield),beta:val(k.beta)});
  }catch(e){res.status(200).json({symbol,error:e.message})}
}
