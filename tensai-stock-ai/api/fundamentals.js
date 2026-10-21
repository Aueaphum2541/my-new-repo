let tickerCache=null;
const SEC_HEADERS={'User-Agent':'TensaiMarket/4.0 educational-market-dashboard','Accept':'application/json'};
const NASDAQ_HEADERS={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept':'application/json, text/plain, */*','Accept-Language':'en-US,en;q=0.9','Origin':'https://www.nasdaq.com','Referer':'https://www.nasdaq.com/'};
function num(v){if(v==null)return null;if(typeof v==='number')return Number.isFinite(v)?v:null;const s=String(v).replace(/[$,%\s,]/g,'');if(!s||s==='N/A'||s==='--')return null;let m=1,x=s;if(/T$/i.test(x)){m=1e12;x=x.slice(0,-1)}else if(/B$/i.test(x)){m=1e9;x=x.slice(0,-1)}else if(/M$/i.test(x)){m=1e6;x=x.slice(0,-1)}const n=parseFloat(x);return Number.isFinite(n)?n*m:null}
async function cikFor(symbol){if(!tickerCache){const r=await fetch('https://www.sec.gov/files/company_tickers.json',{headers:SEC_HEADERS});if(!r.ok)throw new Error(`SEC ticker map ${r.status}`);tickerCache=await r.json()}for(const k in tickerCache){const x=tickerCache[k];if(String(x.ticker).toUpperCase()===symbol)return String(x.cik_str).padStart(10,'0')}return null}
function unitEntries(facts,cands,unit,annual=false){for(const tag of cands){const f=facts?.['us-gaap']?.[tag]||facts?.dei?.[tag];if(!f?.units)continue;let a=f.units[unit]||Object.values(f.units)[0]||[];a=a.filter(x=>Number.isFinite(x.val));if(annual)a=a.filter(x=>x.form==='10-K'&&(x.fp==='FY'||!x.fp));if(a.length)return a}return[]}
function annualSeries(facts,cands,unit='USD'){const a=unitEntries(facts,cands,unit,true);const byEnd=new Map();for(const x of a){if(!x.end)continue;const prev=byEnd.get(x.end);if(!prev||String(x.filed||'')>String(prev.filed||''))byEnd.set(x.end,x)}return [...byEnd.values()].sort((a,b)=>String(b.end).localeCompare(String(a.end))).slice(0,4)}
function latestInstant(facts,cands,unit='USD'){const a=unitEntries(facts,cands,unit,false).filter(x=>x.form==='10-K'||x.form==='10-Q');a.sort((x,y)=>String(y.end||'').localeCompare(String(x.end||''))||String(y.filed||'').localeCompare(String(x.filed||'')));return a[0]?.val??null}
async function marketPrice(symbol){try{const r=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});const j=await r.json();const x=j?.chart?.result?.[0];return x?.meta?.regularMarketPrice??null}catch{return null}}
async function nasdaqSummary(symbol){try{const r=await fetch(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/summary?assetclass=stocks`,{headers:NASDAQ_HEADERS});if(!r.ok)return{};const j=await r.json(),s=j?.data?.summaryData||{};const get=(...names)=>{for(const n of names){if(s[n]?.value!=null)return s[n].value}return null};return{marketCap:num(get('MarketCap','Market Cap')),trailingPE:num(get('PERatio','P/E Ratio','PE Ratio')),exDividendDate:get('ExDividendDate','Ex-Dividend Date'),earningsDate:get('EarningsDate','Earnings Date'),annualDividend:num(get('AnnualizedDividend','Annualized Dividend'))}}catch{return{}}}
function toUnixDate(v){if(!v||v==='N/A'||v==='--')return null;const t=Date.parse(v);return Number.isFinite(t)?Math.floor(t/1000):null}
export default async function handler(req,res){
 const symbol=String(req.query.symbol||'AAPL').toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,20);
 try{
  const [cik,nq,price]=await Promise.all([cikFor(symbol),nasdaqSummary(symbol),marketPrice(symbol)]);if(!cik)throw new Error('SEC CIK not found');
  const r=await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,{headers:SEC_HEADERS});if(!r.ok)throw new Error(`SEC company facts ${r.status}`);const j=await r.json(),facts=j.facts||{};
  const rev=annualSeries(facts,['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet']);
  const ni=annualSeries(facts,['NetIncomeLoss','ProfitLoss']);
  const eps=annualSeries(facts,['EarningsPerShareDiluted','EarningsPerShareBasicAndDiluted'],'USD/shares');
  const cfo=annualSeries(facts,['NetCashProvidedByUsedInOperatingActivities']);
  const capex=annualSeries(facts,['PaymentsToAcquirePropertyPlantAndEquipment','PaymentsForProceedsFromOtherPropertyPlantAndEquipment']);
  const equity=latestInstant(facts,['StockholdersEquity','StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']);
  const debtCurrent=latestInstant(facts,['LongTermDebtAndFinanceLeaseObligationsCurrent','LongTermDebtCurrent','ShortTermBorrowings']);
  const debtLong=latestInstant(facts,['LongTermDebtAndFinanceLeaseObligationsNoncurrent','LongTermDebtNoncurrent','LongTermDebt']);
  const liabilities=latestInstant(facts,['Liabilities']);
  const shares=latestInstant(facts,['EntityCommonStockSharesOutstanding','CommonStockSharesOutstanding'],'shares');
  const rev0=rev[0]?.val??null,rev1=rev[1]?.val??null,ni0=ni[0]?.val??null,eps0=eps[0]?.val??null,eps1=eps[1]?.val??null,cfo0=cfo[0]?.val??null,capex0=capex[0]?.val??null;
  const revenueGrowth=rev0!=null&&rev1?rev0/rev1-1:null,earningsGrowth=eps0!=null&&eps1?eps0/eps1-1:null,profitMargins=rev0&&ni0!=null?ni0/rev0:null,freeCashflow=cfo0!=null?(cfo0-(capex0||0)):null;
  let debtToEquity=null,debtProxy=false;const debt=(debtCurrent||0)+(debtLong||0);if(equity){if(debt>0)debtToEquity=debt/equity*100;else if(liabilities!=null){debtToEquity=liabilities/equity*100;debtProxy=true}}
  const marketCap=nq.marketCap??(shares&&price?shares*price:null);const trailingPE=nq.trailingPE??(price&&eps0&&eps0>0?price/eps0:null);
  res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=3600');
  res.status(200).json({symbol,name:j.entityName||symbol,source:'SEC XBRL + Nasdaq summary',asOf:rev[0]?.end||null,marketCap,trailingPE,forwardPE:null,priceToBook:null,profitMargins,revenueGrowth,earningsGrowth,debtToEquity,debtProxy,freeCashflow,targetMeanPrice:null,recommendationKey:null,earningsDate:toUnixDate(nq.earningsDate),exDividendDate:toUnixDate(nq.exDividendDate),dividendYield:null,beta:null,eps:eps0,annualDividend:nq.annualDividend});
 }catch(e){res.status(200).json({symbol,error:e.message,source:'fundamentals unavailable'})}
}
