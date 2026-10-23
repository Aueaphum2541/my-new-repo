(()=>{
'use strict';
const $=s=>document.querySelector(s);
const th=()=>document.documentElement.lang==='th';
const L=(a,b)=>th()?a:b;
let replay=null;
function candleChart(){
 const charts=window.__tensaiCharts||[];
 const c=charts.find(x=>x?.series?.some(s=>s.type==='candles'||s.kind==='candlestick'));
 if(!c)return null;
 const candle=c.series.find(s=>s.type==='candles'||s.kind==='candlestick');
 return candle?.data?.length?{c,candle}:null;
}
function render(){
 const el=$('#v5aReplay');if(!el||el.dataset.hotfix==='1')return false;
 el.dataset.hotfix='1';
 el.innerHTML=`<div class="v5a-replay"><button class="ghost tiny" id="hfReplayStart">${L('เริ่ม','Start')}</button><button class="ghost tiny" id="hfReplayBack">◀</button><button class="ghost tiny" id="hfReplayNext">▶</button><button class="ghost tiny" id="hfReplayPlay">Play</button><input id="hfReplayRange" type="range" min="5" max="100" value="100"><button class="ghost tiny" id="hfReplayReset">Reset</button></div><div class="v5a-note" id="hfReplayInfo">${L('Replay ซ่อนแท่งอนาคตเพื่อฝึกตัดสินใจโดยไม่เห็นข้อมูลข้างหน้า','Replay hides future bars for decision practice without look-ahead.')}</div>`;
 $('#hfReplayStart').onclick=start;$('#hfReplayBack').onclick=()=>step(-1);$('#hfReplayNext').onclick=()=>step(1);$('#hfReplayPlay').onclick=play;$('#hfReplayReset').onclick=reset;$('#hfReplayRange').oninput=e=>set(+e.target.value);return true;
}
function start(){
 const z=candleChart();if(!z){const i=$('#hfReplayInfo');if(i)i.textContent=L('เปิดแท็บกราฟและรอให้ข้อมูลโหลดก่อนเริ่ม Replay','Open Charts and wait for market data before starting Replay.');return}
 if(replay?.timer)clearInterval(replay.timer);
 const originals=z.c.series.map(s=>({s,data:(s.data||[]).slice()}));
 const candles=originals.find(x=>x.s===z.candle)?.data||[];
 replay={chart:z.c,originals,candles,pct:35,timer:null};set(35);
}
function set(p){
 if(!replay)return;replay.pct=Math.max(5,Math.min(100,p));
 const idx=Math.max(0,Math.min(replay.candles.length-1,Math.floor(replay.candles.length*replay.pct/100)-1)),cut=replay.candles[idx]?.time;if(cut==null)return;
 for(const x of replay.originals)x.s.setData(x.data.filter(d=>+d.time<=+cut));replay.chart.render?.();
 const range=$('#hfReplayRange');if(range)range.value=replay.pct;const info=$('#hfReplayInfo');if(info)info.textContent=`${L('แสดงถึง','Showing through')} ${new Date(+cut*1000).toLocaleString(th()?'th-TH':'en-US')} · ${replay.pct.toFixed(0)}%`;
}
function step(d){if(!replay)start();if(replay)set(replay.pct+d*2)}
function play(){if(!replay)start();if(!replay)return;const b=$('#hfReplayPlay');if(replay.timer){clearInterval(replay.timer);replay.timer=null;if(b)b.textContent='Play';return}replay.timer=setInterval(()=>{if(replay.pct>=100){play();return}set(replay.pct+1)},300);if(b)b.textContent='Pause'}
function reset(){if(!replay)return;if(replay.timer)clearInterval(replay.timer);for(const x of replay.originals)x.s.setData(x.data);replay.chart.render?.();replay=null;const r=$('#hfReplayRange');if(r)r.value=100;const b=$('#hfReplayPlay');if(b)b.textContent='Play';const i=$('#hfReplayInfo');if(i)i.textContent=L('Replay รีเซ็ตแล้ว','Replay reset.')}
function annotateOptions(){const el=$('#v5aOptions');if(!el||el.dataset.sourceNote==='1')return;fetch(`/api/options?symbol=${encodeURIComponent(($('#search')?.value||'AAPL').trim().toUpperCase())}`).then(r=>r.json()).then(j=>{if(!j.source)return;el.dataset.sourceNote='1';const d=document.createElement('div');d.className='v5a-note';d.textContent=`Source: ${j.source}${j.delayed?' · delayed data':''}`;el.appendChild(d)}).catch(()=>{})}
function boot(){let n=0;const t=setInterval(()=>{n++;const ok=render();if(ok)setTimeout(annotateOptions,900);if(ok||n>100)clearInterval(t)},120);document.querySelector('[data-tab="v5"]')?.addEventListener('click',()=>setTimeout(()=>{if(!$('#v5aReplay')?.dataset.hotfix)render();setTimeout(annotateOptions,900)},150));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
