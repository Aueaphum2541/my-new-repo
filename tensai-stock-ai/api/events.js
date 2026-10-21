async function getDate(date){
  const u=`https://api.nasdaq.com/api/calendar/economicevents?date=${date}`;
  try{
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept':'application/json, text/plain, */*','Accept-Language':'en-US,en;q=0.9','Origin':'https://www.nasdaq.com','Referer':'https://www.nasdaq.com/'}});
    if(!r.ok)return[];const j=await r.json();const rows=j?.data?.rows||j?.data?.data?.rows||[];return rows.map(x=>({date,time:x.time||x.eventTime||'',country:x.country||'',event:x.eventName||x.event||x.name||'',actual:x.actual||'',consensus:x.consensus||x.forecast||'',previous:x.previous||''}));
  }catch{return[]}
}
export default async function handler(req,res){
  const d=new Date(),dates=[];for(let i=0;i<3;i++){const x=new Date(d.getTime()+i*86400000);dates.push(x.toISOString().slice(0,10))}
  const all=[];for(const dt of dates)all.push(...await getDate(dt));
  const key=/FOMC|Federal Reserve|Fed |CPI|Consumer Price|PCE|GDP|Nonfarm|Payroll|Unemployment|Jobs|Retail Sales|ISM|PMI/i;
  const important=all.filter(x=>key.test(x.event)).slice(0,20);
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=1800');res.status(200).json({events:important,source:'Nasdaq economic calendar',dates});
}
