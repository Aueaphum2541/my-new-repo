function safeSymbol(v){return String(v||'AAPL').toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,20)}
function sessionFromEt(ts){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ts));
 const o={};for(const p of parts)if(p.type!=='literal')o[p.type]=p.value;
 const m=(+o.hour)*60+(+o.minute),wd=o.weekday;
 if(['Sat','Sun'].includes(wd))return'MARKET CLOSED';
 if(m>=240&&m<570)return'PREMARKET';if(m>=570&&m<960)return'REGULAR';if(m>=960&&m<1200)return'AFTER HOURS';return'MARKET CLOSED';
}
async function alpaca(symbol){
 const id=process.env.ALPACA_API_KEY_ID||process.env.APCA_API_KEY_ID,secret=process.env.ALPACA_API_SECRET_KEY||process.env.APCA_API_SECRET_KEY;if(!id||!secret)return null;
 const h={'APCA-API-KEY-ID':id,'APCA-API-SECRET-KEY':secret};
 const [tr,qr]=await Promise.all([
  fetch(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=iex`,{headers:h}),
  fetch(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest?feed=iex`,{headers:h})
 ]);if(!tr.ok)throw new Error(`Alpaca trade ${tr.status}`);const tj=await tr.json(),qj=qr.ok?await qr.json():{};const t=tj.trade||{},q=qj.quote||{};const stamp=Date.parse(t.t||q.t)||Date.now();
 return{provider:'ALPACA IEX',realTime:true,badge:'REAL-TIME',price:t.p??null,size:t.s??null,bid:q.bp??null,ask:q.ap??null,bidSize:q.bs??null,askSize:q.as??null,timestamp:new Date(stamp).toISOString(),session:sessionFromEt(stamp)};
}
async function polygon(symbol){
 const key=process.env.POLYGON_API_KEY||process.env.MASSIVE_API_KEY;if(!key)return null;
 const r=await fetch(`https://api.polygon.io/v2/last/trade/${encodeURIComponent(symbol)}?apiKey=${encodeURIComponent(key)}`);if(!r.ok)throw new Error(`Polygon/Massive ${r.status}`);const j=await r.json(),x=j.results||{};const ns=x.t||x.sip_timestamp||0,stamp=ns>1e15?Math.floor(ns/1e6):Date.now();
 return{provider:process.env.MASSIVE_API_KEY?'MASSIVE/POLYGON':'POLYGON',realTime:true,badge:'REAL-TIME',price:x.p??null,size:x.s??null,bid:null,ask:null,timestamp:new Date(stamp).toISOString(),session:sessionFromEt(stamp)};
}
async function yahoo(symbol){
 const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=true`;
 const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});if(!r.ok)throw new Error(`Yahoo ${r.status}`);const j=await r.json(),z=j?.chart?.result?.[0];if(!z)throw new Error('No Yahoo quote');const ts=z.timestamp||[],q=z.indicators?.quote?.[0]||{},i=ts.length-1;const price=q.close?.[i]??z.meta?.regularMarketPrice??null,stamp=(ts[i]||Math.floor(Date.now()/1000))*1000;
 return{provider:'YAHOO PUBLIC',realTime:false,badge:'PUBLIC / MAY BE DELAYED',price,bid:z.meta?.bid??null,ask:z.meta?.ask??null,timestamp:new Date(stamp).toISOString(),session:sessionFromEt(stamp)};
}
export default async function handler(req,res){const symbol=safeSymbol(req.query.symbol);try{let out=null;try{out=await alpaca(symbol)}catch{}if(!out)try{out=await polygon(symbol)}catch{}if(!out)out=await yahoo(symbol);res.setHeader('Cache-Control',out.realTime?'no-store':'s-maxage=15, stale-while-revalidate=30');res.status(200).json({symbol,...out});}catch(e){res.status(200).json({symbol,error:e.message,provider:'UNAVAILABLE',realTime:false,badge:'FEED UNAVAILABLE',timestamp:new Date().toISOString(),session:sessionFromEt(Date.now())})}}
