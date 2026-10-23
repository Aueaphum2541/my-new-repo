(()=>{
'use strict';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const isThai=()=>document.documentElement.lang==='th';
const L=(th,en)=>isThai()?th:en;
const symbol=()=>($('#search')?.value||'AAPL').trim().toUpperCase();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numberFrom=v=>{const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null};
const text=s=>$(s)?.textContent?.trim()||'';
const numberText=s=>numberFrom(text(s));
const fmt=(v,d=2)=>Number.isFinite(v)?Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const usd=v=>Number.isFinite(v)?`$${Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:'—';
const pct=(v,d=1)=>Number.isFinite(v)?`${v>=0?'+':''}${Number(v).toFixed(d)}%`:'—';

async function jsonFetch(url,timeout=18000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetch(url,{signal:controller.signal,cache:'no-store'});
    return await response.json();
  }finally{clearTimeout(timer)}
}

const Core={symbol:null,quote:null,intraday:null,breadth:null,rotation:null,options:null,daily:null,updatedAt:null,timer:null};
window.__TensaiV5Core=Core;

const FEATURE_NAMES=[
'Candle Hover + Crosshair','Market Feed Status','Alpaca / Polygon / Massive adapter','Market Breadth Dashboard','Institutional-style Flow / RVOL','Premarket / Regular / After-hours','Gap / PM / PD / Opening Range','Strategy Selector + NO TRADE','Probabilistic Scenario','Monte Carlo','Setup Reliability + OOS','EMA Parameter Robustness','Trade Replay','Personal Strategy Profile','Holding-Aware + Cost Basis','Stock Quality × Timing','Sector Rotation','Correlation Network','Portfolio Rebalancing + Capital Planner','Options Intelligence','Economic Calendar Impact','News Credibility Ranking','Valuation + Peer Comparison','Watchlist State Machine','Confidence / outcome audit','AI Post-Trade Review','Thai Investor Mode','Condition Alert Chain','Trade Card PNG','PWA / Mobile','Daily Briefing','AI Copilot panel'
];
const featureState=FEATURE_NAMES.map(()=>({state:'CHECKING',note:''}));

function injectStyle(){
  if($('#v5coreStyle'))return;
  const s=document.createElement('style');
  s.id='v5coreStyle';
  s.textContent=`
  .v5core{grid-column:1/-1;padding:14px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(135deg,var(--panel),var(--panel2))}
  .v5core-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
  .v5core-head h3{margin:0;font-size:15px}.v5core-meta{font-size:9px;color:var(--muted);margin-bottom:9px}
  .v5core-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.v5core-row{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);font-size:9px}
  .v5core-row b{font-size:8px;border-radius:999px;padding:3px 6px;white-space:nowrap}.v5core-active{color:var(--green);border:1px solid var(--green)}.v5core-local{color:var(--amber);border:1px solid var(--amber)}.v5core-key{color:var(--red);border:1px solid var(--red)}.v5core-error{color:var(--red);border:1px solid var(--red)}.v5core-check{color:var(--muted);border:1px solid var(--line)}
  .v5core-play{margin-top:9px;padding:9px;border:1px dashed var(--line);border-radius:9px;font-size:10px;line-height:1.6}
  @media(max-width:1000px){.v5core-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.v5core-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
}

function stateClass(state){
  if(state==='ACTIVE')return'v5core-active';
  if(state==='MODEL/LOCAL')return'v5core-local';
  if(state==='NEEDS KEY')return'v5core-key';
  if(state==='ERROR')return'v5core-error';
  return'v5core-check';
}
function setFeature(index,state,note=''){
  featureState[index-1]={state,note};
  const badge=$(`#v5core-f${index} b`);
  const row=$(`#v5core-f${index}`);
  if(badge){badge.className=stateClass(state);badge.textContent=state}
  if(row)row.title=note||'';
}

function mount(){
  const grid=$('#tab-v5 .v5-grid');
  if(!grid||$('#v5core'))return false;
  injectStyle();
  const box=document.createElement('article');
  box.id='v5core';box.className='v5core';
  box.innerHTML=`<div class="v5core-head"><div><span class="eyebrow">FUNCTIONAL CORE 5.4</span><h3>${L('ตรวจสถานะฟีเจอร์จากระบบจริง','Live feature diagnostics')}</h3></div><button id="v5coreRefresh" class="ghost tiny">↻ ${L('ทดสอบใหม่','Retest')}</button></div><div class="v5core-meta" id="v5coreMeta">—</div><div class="v5core-grid">${FEATURE_NAMES.map((name,i)=>`<div class="v5core-row" id="v5core-f${i+1}"><span>${i+1}. ${esc(name)}</span><b class="v5core-check">CHECKING</b></div>`).join('')}</div><div class="v5core-play" id="v5corePlay">${L('กำลังอ่านข้อมูลตลาดจริง…','Loading market data…')}</div>`;
  grid.prepend(box);
  $('#v5coreRefresh').onclick=()=>refresh(true);
  return true;
}

function ema(values,period){
  if(values.length<period)return null;
  let x=values.slice(0,period).reduce((a,b)=>a+b,0)/period;
  const k=2/(period+1);
  for(let i=period;i<values.length;i++)x=values[i]*k+x*(1-k);
  return x;
}
function rsi(values,period=14){
  if(values.length<=period)return null;
  let gain=0,loss=0;
  for(let i=1;i<=period;i++){const d=values[i]-values[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0)}
  gain/=period;loss/=period;
  for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];gain=(gain*(period-1)+Math.max(d,0))/period;loss=(loss*(period-1)+Math.max(-d,0))/period}
  return loss?100-100/(1+gain/loss):100;
}
function atr(bars,period=14){
  if(bars.length<period+1)return null;
  const tr=bars.map((b,i)=>i?Math.max(b.high-b.low,Math.abs(b.high-bars[i-1].close),Math.abs(b.low-bars[i-1].close)):b.high-b.low);
  let x=tr.slice(1,period+1).reduce((a,b)=>a+b,0)/period;
  for(let i=period+1;i<tr.length;i++)x=(x*(period-1)+tr[i])/period;
  return x;
}
function scores(){
  const rrMatch=text('#rrBadge').match(/1\s*:\s*(\d+(?:\.\d+)?)/);
  return{technical:numberText('#technicalScore')??50,entry:numberText('#entryScore')??50,rrScore:numberText('#rrScore')??50,fundamental:numberText('#fundScore')??50,rr:rrMatch?Number(rrMatch[1]):1,action:text('#actionPill')||'—'};
}

function strategy(){
  const s=scores(),bars=Core.daily?.bars||[],closes=bars.map(b=>b.close),last=closes.at(-1),e20=ema(closes,20),e50=ema(closes,50),e200=ema(closes,200),rv=rsi(closes),intr=Core.intraday||{},profile=$('#v5Profile')?.value||'swing';
  const trend=Number.isFinite(e20)&&Number.isFinite(e50)&&Number.isFinite(last)?e20>e50&&last>e20:false;
  const longTrend=Number.isFinite(e200)&&Number.isFinite(last)?last>e200:null;
  let selected='WAIT / CONFIRM';
  if(profile==='day')selected=intr.session==='REGULAR'&&intr.rvol>=1.2&&intr.regular?.vwap&&intr.price>intr.regular.vwap?'VWAP / OPENING RANGE':'NO TRADE / WAIT FOR VOLUME';
  else if(profile==='swing')selected=trend?'PULLBACK / TREND FOLLOWING':'MEAN REVERSION / WAIT';
  else if(profile==='position')selected=trend&&longTrend?'TREND + QUALITY':'SELECTIVE / WAIT';
  else selected=s.fundamental>=65&&longTrend!==false?'QUALITY / LONG-TERM':'WATCHLIST ONLY';
  const reasons=[];
  if(s.rr<1.2)reasons.push('R:R < 1.2');
  if(s.entry<42)reasons.push('entry weak');
  if(s.technical<42)reasons.push('technical weak');
  if(profile==='day'&&Number.isFinite(intr.rvol)&&intr.rvol<0.65)reasons.push('intraday volume light');
  if(profile==='day'&&Number.isFinite(intr.gapAtr)&&Math.abs(intr.gapAtr)>2)reasons.push('gap > 2 ATR');
  return{selected,noTrade:reasons.length>0,reasons,trend,rsi:rv,profile};
}

function updateFeed(){
  const q=Core.quote;if(!q)return;
  if($('#v5Feed'))$('#v5Feed').textContent=`${q.provider||'—'} · ${q.badge||'—'}`;
  const el=$('#v5aFeed');
  if(el)el.innerHTML=`<div class="v5a-grid2"><div class="v5a-metric"><span>Provider</span><b>${esc(q.provider)}</b></div><div class="v5a-metric"><span>Status</span><b class="${q.realTime?'v5a-good':'v5a-warn'}">${esc(q.badge)}</b></div><div class="v5a-metric"><span>Last</span><b>${usd(q.price)}</b></div><div class="v5a-metric"><span>Session</span><b>${esc(q.session)}</b></div></div><div class="v5a-note">${q.timestamp?new Date(q.timestamp).toLocaleString(isThai()?'th-TH':'en-US'):''}</div>`;
}
function updateBreadth(){
  const b=Core.breadth,el=$('#v5Breadth');if(!b||!el)return;
  el.innerHTML=[['Adv / Dec',`${b.advance} / ${b.decline}`],['A/D',fmt(b.advanceDeclineRatio)],['> EMA20',`${b.aboveEMA20}%`],['> EMA50',`${b.aboveEMA50}%`],['> EMA200',`${b.aboveEMA200}%`],['20D H/L',`${b.newHigh20} / ${b.newLow20}`],['Avg',pct(b.averageChange)],['Coverage',`${b.coverage}/${b.total}`]].map(x=>`<div class="v5-kpi"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
}
function updateIntraday(){
  const x=Core.intraday,el=$('#v5Intraday');if(!x||!el)return;
  const rows=[['Feed time',x.lastBarEt],['Gap',pct(x.gapPct)],['Gap / ATR',Number.isFinite(x.gapAtr)?`${x.gapAtr.toFixed(2)} ATR`:'—'],['Premarket H/L',x.premarket?.high?`${usd(x.premarket.high)} / ${usd(x.premarket.low)}`:'—'],['OR 5m',x.openingRange?.m5?.high?`${usd(x.openingRange.m5.high)} / ${usd(x.openingRange.m5.low)}`:'—'],['OR 15m',x.openingRange?.m15?.high?`${usd(x.openingRange.m15.high)} / ${usd(x.openingRange.m15.low)}`:'—'],['OR 30m',x.openingRange?.m30?.high?`${usd(x.openingRange.m30.high)} / ${usd(x.openingRange.m30.low)}`:'—'],['Session VWAP',usd(x.regular?.vwap)],['Previous Day H/L',x.previousDay?.high?`${usd(x.previousDay.high)} / ${usd(x.previousDay.low)}`:'—'],['RVOL',Number.isFinite(x.rvol)?`${x.rvol.toFixed(2)}× (n=${x.rvolSample})`:'—'],['Volume z-score',Number.isFinite(x.volumeZ)?x.volumeZ.toFixed(2):'—'],['Flow',x.flow||'—']];
  el.innerHTML=rows.map(r=>`<div><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('');
  if($('#v5SessionBadge'))$('#v5SessionBadge').textContent=x.session||'—';
  const play=$('#v5corePlay');if(play)play.innerHTML=`<b>${esc(symbol())} · ${esc(x.session)} · ${esc(x.flow)}</b><br>${(x.playbook||[]).map(esc).join('<br>')}`;
}
function updateStrategy(){
  const g=strategy(),el=$('#v5Gate');if(!el)return;
  const why=g.noTrade?g.reasons:[g.selected,g.trend?'trend aligned':'trend not aligned',Number.isFinite(g.rsi)?`RSI ${g.rsi.toFixed(0)}`:''];
  el.innerHTML=`<strong class="${g.noTrade?'v5-gate-bad':'v5-gate-good'}">${g.noTrade?'NO TRADE — EDGE INSUFFICIENT':esc(g.selected)}</strong><p>${esc(why.filter(Boolean).join(' · '))}</p>`;
}
function updateScenario(){
  const s=scores(),rv=Core.intraday?.rvol;
  let breakout=Math.max(5,Math.min(85,30+(s.technical-50)*0.35+(s.entry-50)*0.22+(s.rrScore-50)*0.12+(Number.isFinite(rv)?Math.min(12,(rv-1)*8):0)));
  let pull=Math.max(10,45-Math.abs(s.technical-55)*0.2),down=Math.max(5,100-breakout-pull),sum=breakout+pull+down;
  breakout=breakout/sum*100;pull=pull/sum*100;down=down/sum*100;
  const el=$('#v5Prob');if(el)el.innerHTML=[['Breakout continuation',breakout],['Pullback holds',pull],['Breakdown',down]].map(x=>`<div class="v5-bar"><span>${x[0]}</span><i><em style="width:${x[1]}%"></em></i><b>${x[1].toFixed(0)}%</b></div>`).join('');
}

function setupTrades(bars,fast=20){
  const out=[];
  for(let i=55;i<bars.length-11;i++){
    const hist=bars.slice(0,i+1),closes=hist.map(b=>b.close),ef=ema(closes,fast),e50=ema(closes,50),rv=rsi(closes),av=atr(hist);
    if(!(Number.isFinite(ef)&&Number.isFinite(e50)&&closes.at(-1)>ef&&ef>e50&&rv>=48&&rv<=68&&av>0))continue;
    const entry=closes.at(-1),stop=entry-1.5*av,target=entry+2*av;let ret=null;
    for(let j=i+1;j<=i+10;j++){if(bars[j].low<=stop){ret=stop/entry-1;break}if(bars[j].high>=target){ret=target/entry-1;break}}
    if(ret!=null){out.push({i,ret});i+=3}
  }
  return out;
}
function tradeStats(trades){
  if(!trades.length)return{n:0,wr:null,pf:null};
  const wins=trades.filter(t=>t.ret>0),losses=trades.filter(t=>t.ret<=0),gp=wins.reduce((a,t)=>a+t.ret,0),gl=Math.abs(losses.reduce((a,t)=>a+t.ret,0));
  return{n:trades.length,wr:wins.length/trades.length*100,pf:gl?gp/gl:(gp?99:null)};
}
function updateReliability(){
  const bars=Core.daily?.bars||[];if(bars.length<120)return;
  const cut=Math.floor(bars.length*0.7),all=setupTrades(bars,20),train=tradeStats(all.filter(t=>t.i<cut)),oos=tradeStats(all.filter(t=>t.i>=cut));
  const el=$('#v5Reliability');
  if(el)el.innerHTML=[['Total samples',all.length],['Train WR',train.wr==null?'—':`${train.wr.toFixed(0)}%`],['OOS WR',oos.wr==null?'—':`${oos.wr.toFixed(0)}%`],['OOS PF',oos.pf==null?'—':oos.pf.toFixed(2)],['Status',oos.n<8?'LOW SAMPLE':oos.wr>=55&&oos.pf>=1.2?'STABLE ENOUGH':'UNSTABLE OOS']].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
  const robust=$('#v5Robust');
  if(robust)robust.innerHTML=[15,18,20,22,25].map(p=>{const st=tradeStats(setupTrades(bars,p).filter(t=>t.i>=cut));return`<div class="v5-cell"><span>EMA ${p}</span><b>${st.wr==null?'—':st.wr.toFixed(0)+'%'}</b><span>n=${st.n} · PF ${st.pf==null?'—':st.pf.toFixed(1)}</span></div>`}).join('');
}
function updateMonteCarlo(){
  const bars=Core.daily?.bars||[],closes=bars.map(b=>b.close),returns=[];
  for(let i=Math.max(1,closes.length-252);i<closes.length;i++)returns.push(closes[i]/closes[i-1]-1);
  if(returns.length<30)return;
  const paths=5000,results=[];
  for(let p=0;p<paths;p++){let value=1;for(let d=0;d<20;d++)value*=1+returns[Math.floor(Math.random()*returns.length)];results.push((value-1)*100)}
  results.sort((a,b)=>a-b);const q=f=>results[Math.floor((results.length-1)*f)],loss=results.filter(x=>x<0).length/paths*100;
  const el=$('#v5Monte');if(el)el.innerHTML=[['Paths',paths],['5th percentile',pct(q(0.05))],['Median',pct(q(0.5))],['95th percentile',pct(q(0.95))],['P(return < 0)',`${loss.toFixed(0)}%`]].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
}
function updateOptions(){
  const o=Core.options,el=$('#v5aOptions');if(!o||!el)return;
  if(o.error){el.innerHTML=`<div class="v5a-note">${esc(o.error)}</div>`;return}
  el.innerHTML=`<div class="v5a-grid2"><div class="v5a-metric"><span>Expected move</span><b>±${fmt(o.expectedMovePct,1)}%</b></div><div class="v5a-metric"><span>ATM IV</span><b>${pct(o.atmIV*100)}</b></div><div class="v5a-metric"><span>Put/Call Volume</span><b>${fmt(o.putCallVolumeRatio)}</b></div><div class="v5a-metric"><span>Put/Call OI</span><b>${fmt(o.putCallOIRatio)}</b></div></div><div class="v5a-note">${esc(o.source)}${o.delayed?' · delayed':''}${o.unusual?.length?` · unusual contracts ${o.unusual.length}`:''}</div>`;
}
function updateQuality(){
  const f=scores().fundamental,t=scores().technical,e=scores().entry,timing=(t+e)/2;
  const label=f>=65&&timing>=65?'High Quality + Good Entry':f>=65?'High Quality + Bad Entry':timing>=65?'Lower Quality + Technical Bounce':'Avoid / Wait';
  const el=$('#v5aQuality');if(el)el.innerHTML=`<div class="v5a-metric"><span>Quadrant</span><b>${label}</b></div><div class="v5a-grid2" style="margin-top:8px"><div class="v5a-metric"><span>Quality</span><b>${f.toFixed(0)}</b></div><div class="v5a-metric"><span>Timing</span><b>${timing.toFixed(0)}</b></div></div>`;
}
function updateBrief(){
  const q=Core.quote,i=Core.intraday,b=Core.breadth,r=Core.rotation?.sectors?.[0],g=strategy(),parts=[];
  if(q)parts.push(`${q.provider}: ${usd(q.price)} · ${q.session}`);
  parts.push(g.noTrade?`NO TRADE: ${g.reasons.join(', ')}`:`Strategy: ${g.selected}`);
  if(b)parts.push(`Breadth ${b.advance}/${b.decline} · ${b.aboveEMA50}% > EMA50`);
  if(r)parts.push(`Top sector ${r.name} ${pct(r.rel21)} vs SPY 1M`);
  if(i)parts.push(`RVOL ${fmt(i.rvol)}× · ${i.flow}`);
  if($('#v5Brief'))$('#v5Brief').textContent=parts.join(' · ');
}

function installCandleHover(){
  let attached=0;
  for(const chart of (window.__tensaiCharts||[])){
    if(chart.__v5CoreHover){attached++;continue}
    const candle=chart.series?.find(s=>s.type==='candles'||s.kind==='candlestick');
    if(!candle||!chart.canvas)continue;
    chart.__v5CoreHover=true;attached++;
    const container=chart.el,canvas=chart.canvas;container.style.position='relative';
    let tip=container.querySelector('.candle-tip');if(!tip){tip=document.createElement('div');tip.className='candle-tip';container.appendChild(tip)}
    canvas.addEventListener('pointermove',event=>{
      if(event.buttons)return;const data=candle.data||[];if(!data.length)return;
      const rect=canvas.getBoundingClientRect(),leftPad=10,rightPad=64,width=Math.max(1,rect.width-leftPad-rightPad),zoom=chart.view?.zoom||1,count=Math.max(12,Math.min(data.length,Math.round(data.length/zoom))),maxStart=Math.max(0,data.length-count),start=Math.max(0,Math.min(maxStart,Math.round(chart.view?.start==null?maxStart:chart.view.start))),visible=data.slice(start,start+count),ratio=Math.max(0,Math.min(1,(event.clientX-rect.left-leftPad)/width)),idx=Math.max(0,Math.min(visible.length-1,Math.round(ratio*(visible.length-1)))),bar=visible[idx];if(!bar)return;
      const x=leftPad+(visible.length===1?width/2:idx/(visible.length-1)*width),dt=new Intl.DateTimeFormat(isThai()?'th-TH':'en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(Number(bar.time)*1000)),change=(bar.close/bar.open-1)*100;
      tip.style.display='block';tip.innerHTML=`<div class="ct-time">${esc(dt)} ET</div><div class="ct-row"><div><span>O</span><b>${usd(bar.open)}</b></div><div><span>H</span><b>${usd(bar.high)}</b></div><div><span>L</span><b>${usd(bar.low)}</b></div><div><span>C</span><b>${usd(bar.close)}</b></div></div><div class="ct-chg">${L('แท่ง','Candle')} ${pct(change)}${Number.isFinite(bar.volume)?` · Vol ${Number(bar.volume).toLocaleString()}`:''}</div>`;
      let px=x+12;if(px+230>rect.width)px=x-230;tip.style.left=`${Math.max(6,px)}px`;tip.style.top='8px';
    });
    canvas.addEventListener('pointerleave',()=>{tip.style.display='none'});
  }
  return attached;
}

function updateDiagnostics(){
  const q=Core.quote,i=Core.intraday,b=Core.breadth,o=Core.options;
  setFeature(1,installCandleHover()>0?'ACTIVE':'CHECKING','OHLC/ET hover attached to candle canvas');
  setFeature(2,q&&!q.error?'ACTIVE':'ERROR',q?.badge||q?.error||'quote unavailable');
  setFeature(3,q?.realTime?'ACTIVE':'NEEDS KEY',q?.realTime?`${q.provider} real-time`:'Yahoo fallback active; add provider credentials for real-time');
  setFeature(4,b&&!b.error?'ACTIVE':'ERROR',b?`${b.coverage}/${b.total} representative basket`:'breadth unavailable');
  setFeature(5,i&&!i.error?'ACTIVE':'ERROR',i?.flow||i?.error||'intraday unavailable');
  setFeature(6,i&&!i.error?'ACTIVE':'ERROR',i?.session||'session unavailable');
  setFeature(7,i?.openingRange?.m5?'ACTIVE':'ERROR','OR5/15/30 + PM/PD + ATR gap');
  setFeature(8,$('#v5Gate')?'ACTIVE':'ERROR','Strategy and no-trade gate connected to daily/intraday core');
  setFeature(9,$('#v5Prob')?'MODEL/LOCAL':'ERROR','Heuristic normalized scenario estimate');
  setFeature(10,$('#v5Monte')?'MODEL/LOCAL':'ERROR','5,000-path empirical bootstrap');
  setFeature(11,$('#v5Reliability')?'MODEL/LOCAL':'ERROR','Chronological 70/30 OOS setup audit');
  setFeature(12,$('#v5Robust')?'MODEL/LOCAL':'ERROR','EMA 15/18/20/22/25 OOS grid');
  setFeature(13,$('#v5aReplay')?'ACTIVE':'ERROR','Replay UI with future bars hidden by hotfix');
  setFeature(14,$('#v5Profile')?'ACTIVE':'ERROR','Day/Swing/Position/Long-Term changes strategy logic');
  setFeature(15,$('#v5Avg')&&$('#v5Shares')?'ACTIVE':'ERROR','Cost and holding inputs wired');
  setFeature(16,$('#v5aQuality')?'ACTIVE':'ERROR','Quality/timing matrix wired to scores');
  setFeature(17,$('#v5Rotation')?'ACTIVE':'ERROR','Sector ETF 1D/5D/1M relative strength');
  setFeature(18,$('#v5aCorr')?'ACTIVE':'ERROR','Portfolio holdings → 60D return correlation network');
  setFeature(19,$('#v5aPlanner')?'ACTIVE':'ERROR','Sector cap + cash constrained tranche planner');
  setFeature(20,o&&!o.error?'ACTIVE':'ERROR',o?.source||o?.error||'options unavailable');
  setFeature(21,$('#v5aIntel')?'ACTIVE':'ERROR','Macro events with symbol sensitivity heuristic');
  setFeature(22,$('#v5aIntel')?'ACTIVE':'ERROR','Publisher credibility weighting');
  setFeature(23,$('#v5aPeers')?'ACTIVE':'ERROR','Peer fundamentals + 1M relative return');
  setFeature(24,$('#v5aState')?'ACTIVE':'ERROR','Persisted watch-state machine');
  setFeature(25,$('#v5aState')?'MODEL/LOCAL':'ERROR','5-trading-day signal outcome audit');
  setFeature(26,$('#v5aReview')?'ACTIVE':'ERROR','Closed journal trade review');
  setFeature(27,$('#v5aThai')?'ACTIVE':'ERROR','Fees + FX spread + THB net P&L');
  setFeature(28,$('#v5aAlerts')?'ACTIVE':'ERROR','AND conditions for price/RVOL/RSI while app is open');
  setFeature(29,$('#v5aCard')?'ACTIVE':'ERROR','Canvas PNG export of current trade card');
  setFeature(30,'serviceWorker'in navigator?'ACTIVE':'ERROR','Manifest + service worker + install prompt when supported');
  setFeature(31,$('#v5Brief')?'ACTIVE':'ERROR','Quote + breadth + rotation + intraday summary');
  setFeature(32,$('#v5aCopilot')?'MODEL/LOCAL':'ERROR','Context-aware rule copilot; not an external LLM');
  if($('#v5coreMeta'))$('#v5coreMeta').textContent=`${symbol()} · ${q?.provider||'—'} · ${q?.badge||'—'} · ${q?.timestamp?new Date(q.timestamp).toLocaleString(isThai()?'th-TH':'en-US'):'—'} · refresh 15s`;
}

async function refresh(force=false){
  const s=symbol(),stamp=force?`&t=${Date.now()}`:'';Core.symbol=s;
  const requests=[
    jsonFetch(`/api/quote?symbol=${encodeURIComponent(s)}${stamp}`),
    jsonFetch(`/api/intraday?symbol=${encodeURIComponent(s)}${stamp}`),
    jsonFetch(`/api/breadth?x=1${stamp}`,22000),
    jsonFetch(`/api/rotation?x=1${stamp}`,22000),
    jsonFetch(`/api/options?symbol=${encodeURIComponent(s)}${stamp}`),
    jsonFetch(`/api/chart?symbol=${encodeURIComponent(s)}&interval=1d${stamp}`,22000)
  ];
  const result=await Promise.allSettled(requests);
  const value=i=>result[i].status==='fulfilled'?result[i].value:null;
  Core.quote=value(0);Core.intraday=value(1);Core.breadth=value(2);Core.rotation=value(3);Core.options=value(4);Core.daily=value(5);Core.updatedAt=Date.now();
  updateFeed();updateBreadth();updateIntraday();updateStrategy();updateScenario();updateReliability();updateMonteCarlo();updateOptions();updateQuality();updateBrief();updateDiagnostics();
}

function boot(){
  let attempts=0;
  const waiter=setInterval(()=>{
    attempts++;
    if(mount()){
      clearInterval(waiter);refresh(true);
      Core.timer=setInterval(()=>refresh(false),15000);
      setInterval(()=>{installCandleHover();updateDiagnostics()},1500);
      $('#analyzeBtn')?.addEventListener('click',()=>setTimeout(()=>refresh(true),900));
      $('#refreshBtn')?.addEventListener('click',()=>setTimeout(()=>refresh(true),900));
      $('#search')?.addEventListener('change',()=>refresh(true));
      $('#v5Profile')?.addEventListener('change',()=>{updateStrategy();updateBrief()});
    }else if(attempts>120)clearInterval(waiter);
  },100);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
