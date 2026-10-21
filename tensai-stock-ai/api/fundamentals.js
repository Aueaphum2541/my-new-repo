const H={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept':'application/json, text/plain, */*','Accept-Language':'en-US,en;q=0.9','Origin':'https://www.nasdaq.com','Referer':'https://www.nasdaq.com/'};
function parseNum(v){if(v==null)return null;let s=String(v).trim();if(!s||/N\/A|--|nbsp/i.test(s))return null;let neg=false;if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1)}const percent=s.includes('%');s=s.replace(/[$,%\s,]/g,'');let mul=1;if(/T$/i.test(s)){mul=1e12;s=s.slice(0,-1)}else if(/B$/i.test(s)){mul=1e9;s=s.slice(0,-1)}else if(/M$/i.test(s)){mul=1e6;s=s.slice(0,-1)}const n=parseFloat(s);if(!Number.isFinite(n))return null;return (neg?-n:n)*mul*(percent?.01:1)}
function tableRow(table,re){return (table?.rows||[]).find(r=>re.test(String(r.value1||r.label||'')))||null}
function vals(row){if(!row)return[];return Object.keys(row).filter(k=>/^value\d+$/.test(k)&&k!=='value1').sort((a,b)=>+a.slice(5)-+b.slice(5)).map(k=>parseNum(row[k])).filter(x=>x!=null)}
function getSummary(s,...names){for(const n of names){if(s?.[n]?.value!=null)return s[n].value}return null}
function toUnixDate(v){if(!v||/N\/A|--/i.test(String(v)))return null;const t=Date.parse(v);return Number.isFinite(t)?Math.floor(t/1000):null}
async function getJson(url){const r=await fetch(url,{headers:H});if(!r.ok)throw new Error(`Nasdaq returned ${r.status}`);return r.json()}
export default async function handler(req,res){
 const symbol=String(req.query.symbol||'AAPL').toUpperCase().replace(/[^A-Z0-9.\-]/g,'').slice(0,20);
 try{
  const [sj,fj,ij]=await Promise.all([
   getJson(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/summary?assetclass=stocks`),
   getJson(`https://api.nasdaq.com/api/company/${encodeURIComponent(symbol)}/financials?frequency=1`),
   getJson(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info?assetclass=stocks`).catch(()=>({}))
  ]);
  const s=sj?.data?.summaryData||{},d=fj?.data||{},income=d.incomeStatementTable||{},balance=d.balanceSheetTable||{},cash=d.cashFlowTable||{};
  const revenue=vals(tableRow(income,/^total revenue$|revenue/i)),net=vals(tableRow(income,/^net income$|net income available/i)),eps=vals(tableRow(income,/diluted.*earnings per share|diluted eps|earnings per share/i));
  const cfo=vals(tableRow(cash,/net cash.*operating|operating activities/i)),capex=vals(tableRow(cash,/capital expenditures|capital expenditure/i));
  const equity=vals(tableRow(balance,/total.*stockholders.*equity|total.*shareholders.*equity|total equity/i));
  const debt=vals(tableRow(balance,/total debt|long.term debt/i)),liab=vals(tableRow(balance,/total liabilities/i));
  const rev0=revenue[0]??null,rev1=revenue[1]??null,net0=net[0]??null,eps0=eps[0]??null,eps1=eps[1]??null,cfo0=cfo[0]??null,capex0=capex[0]??null,eq0=equity[0]??null,debt0=debt[0]??liab[0]??null;
  const revenueGrowth=rev0!=null&&rev1?rev0/rev1-1:null,earningsGrowth=eps0!=null&&eps1?eps0/eps1-1:null,profitMargins=rev0&&net0!=null?net0/rev0:null,debtToEquity=eq0&&debt0!=null?debt0/eq0*100:null;
  // Nasdaq annual financial statement values are displayed in millions for standard operating companies.
  const freeCashflow=cfo0!=null?(cfo0-(capex0||0))*1e6:null;
  const marketCap=parseNum(getSummary(s,'MarketCap','Market Cap')),trailingPE=parseNum(getSummary(s,'PERatio','P/E Ratio','PE Ratio'));
  const dividendYield=parseNum(getSummary(s,'Yield','Dividend Yield')),annualDividend=parseNum(getSummary(s,'AnnualizedDividend','Annualized Dividend'));
  const earningsPerShare=parseNum(getSummary(s,'EarningsPerShare','Earnings Per Share'))??eps0;
  const name=ij?.data?.companyName||symbol;
  res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=3600');
  res.status(200).json({symbol,name,source:'Nasdaq public summary + annual financials',asOf:income?.headers?.value2||income?.asOf||null,marketCap,trailingPE,forwardPE:null,priceToBook:null,profitMargins,revenueGrowth,earningsGrowth,debtToEquity,freeCashflow,targetMeanPrice:null,recommendationKey:null,earningsDate:toUnixDate(getSummary(s,'EarningsDate','Earnings Date')),exDividendDate:toUnixDate(getSummary(s,'ExDividendDate','Ex-Dividend Date')),dividendYield,beta:null,eps:earningsPerShare,annualDividend});
 }catch(e){res.status(200).json({symbol,error:e.message,source:'fundamentals unavailable'})}
}
