(()=>{
'use strict';
const charts=[];
const dpr=()=>Math.max(1,Math.min(2,window.devicePixelRatio||1));
const num=v=>Number.isFinite(+v)?+v:null;
const merge=(a,b)=>({...a,...b,layout:{...(a?.layout||{}),...(b?.layout||{})},grid:{...(a?.grid||{}),...(b?.grid||{})},timeScale:{...(a?.timeScale||{}),...(b?.timeScale||{})},rightPriceScale:{...(a?.rightPriceScale||{}),...(b?.rightPriceScale||{})}});
const fmt=v=>{if(!Number.isFinite(v))return'';const av=Math.abs(v);return av>=1000?v.toLocaleString(undefined,{maximumFractionDigits:0}):v.toLocaleString(undefined,{maximumFractionDigits:av<10?3:2})};
const timeLabel=t=>{try{const d=new Date(Number(t)*1000);return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});}catch{return''}};
function uniqueSorted(data){const m=new Map();for(const x of (data||[])){if(x&&Number.isFinite(+x.time))m.set(+x.time,x)}return [...m.values()].sort((a,b)=>+a.time-+b.time)}
function createChart(el,opts={}){
  if(!el)throw new Error('Chart container missing');
  el.innerHTML='';
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-label','Tensai market chart');
  canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;user-select:none;';
  el.appendChild(canvas);
  const ctx=canvas.getContext('2d');
  const chart={el,canvas,ctx,options:opts,series:[],raf:0,
    addCandlestickSeries:o=>addSeries(chart,'candles',o),
    addLineSeries:o=>addSeries(chart,'line',o),
    addHistogramSeries:o=>addSeries(chart,'hist',o),
    applyOptions(o){chart.options=merge(chart.options,o||{});schedule(chart)},
    timeScale(){return{fitContent(){schedule(chart)}}},
    render(){draw(chart)}
  };
  charts.push(chart);
  if(window.ResizeObserver){chart.ro=new ResizeObserver(()=>schedule(chart));chart.ro.observe(el)}
  schedule(chart);
  return chart;
}
function addSeries(chart,type,options={}){
  const s={type,options,data:[],priceLines:[],
    setData(d){s.data=uniqueSorted(d);schedule(chart)},
    applyOptions(o){s.options={...s.options,...(o||{})};schedule(chart)},
    createPriceLine(o){const p={...(o||{})};s.priceLines.push(p);schedule(chart);return p},
    removePriceLine(p){s.priceLines=s.priceLines.filter(x=>x!==p);schedule(chart)}
  };
  chart.series.push(s);return s;
}
function schedule(chart){cancelAnimationFrame(chart.raf);chart.raf=requestAnimationFrame(()=>draw(chart))}
function draw(chart){
  const {el,canvas,ctx}=chart; if(!ctx)return;
  const W=Math.floor(el.clientWidth||0),H=Math.floor(el.clientHeight||0);
  if(W<40||H<40){setTimeout(()=>schedule(chart),120);return}
  const R=dpr(); if(canvas.width!==Math.floor(W*R)||canvas.height!==Math.floor(H*R)){canvas.width=Math.floor(W*R);canvas.height=Math.floor(H*R)}
  ctx.setTransform(R,0,0,R,0,0);
  const bg=chart.options?.layout?.background?.color||getComputedStyle(document.documentElement).getPropertyValue('--chart').trim()||'#081422';
  const text=chart.options?.layout?.textColor||getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()||'#8ea0b7';
  const grid=chart.options?.grid?.horzLines?.color||getComputedStyle(document.documentElement).getPropertyValue('--line').trim()||'#203149';
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  const pad={l:10,r:64,t:12,b:25}, pw=W-pad.l-pad.r, ph=H-pad.t-pad.b;
  const all=[];const ts=[];
  for(const s of chart.series){for(const p of s.data){ts.push(+p.time);if(s.type==='candles'){all.push(num(p.low),num(p.high))}else all.push(num(p.value))}for(const p of s.priceLines)all.push(num(p.price))}
  const ys=all.filter(Number.isFinite);const times=[...new Set(ts.filter(Number.isFinite))].sort((a,b)=>a-b);
  if(!ys.length||!times.length){ctx.fillStyle=text;ctx.font='12px system-ui';ctx.fillText('Waiting for market data…',18,28);return}
  let ymin=Math.min(...ys),ymax=Math.max(...ys);if(!(ymax>ymin)){ymax=ymin+1}
  const extra=(ymax-ymin)*.07;ymin-=extra;ymax+=extra;
  const y=v=>pad.t+(ymax-v)/(ymax-ymin)*ph;
  const idx=new Map(times.map((t,i)=>[t,i])); const x=t=>pad.l+(times.length===1?pw/2:idx.get(+t)/(times.length-1)*pw);
  ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.globalAlpha=.7;ctx.font='10px system-ui';ctx.fillStyle=text;ctx.textAlign='left';ctx.textBaseline='middle';
  for(let i=0;i<=4;i++){const yy=pad.t+ph*i/4;ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(W-pad.r,yy);ctx.stroke();const v=ymax-(ymax-ymin)*i/4;ctx.fillText(fmt(v),W-pad.r+7,yy)}
  ctx.globalAlpha=1;
  for(const s of chart.series){
    if(!s.data.length)continue;
    if(s.type==='candles'){
      const bw=Math.max(2,Math.min(9,pw/Math.max(times.length,1)*.62));
      for(const p of s.data){const xx=x(p.time),yo=y(+p.open),yc=y(+p.close),yh=y(+p.high),yl=y(+p.low),up=+p.close>=+p.open,c=up?(s.options.upColor||'#24c88b'):(s.options.downColor||'#ff6274');ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xx,yh);ctx.lineTo(xx,yl);ctx.stroke();const top=Math.min(yo,yc),hh=Math.max(1.5,Math.abs(yc-yo));ctx.fillRect(xx-bw/2,top,bw,hh)}
    }else if(s.type==='line'){
      ctx.strokeStyle=s.options.color||'#4f8cff';ctx.lineWidth=s.options.lineWidth||1.5;ctx.setLineDash(s.options.lineStyle===2?[4,4]:[]);ctx.beginPath();let started=false;for(const p of s.data){if(!Number.isFinite(+p.value))continue;const xx=x(p.time),yy=y(+p.value);if(!started){ctx.moveTo(xx,yy);started=true}else ctx.lineTo(xx,yy)}if(started)ctx.stroke();ctx.setLineDash([])
    }else if(s.type==='hist'){
      const zero=y(0),bw=Math.max(1,Math.min(8,pw/Math.max(times.length,1)*.6));for(const p of s.data){const yy=y(+p.value),xx=x(p.time);ctx.fillStyle=p.color||s.options.color||(+p.value>=0?'#24c88b':'#ff6274');ctx.fillRect(xx-bw/2,Math.min(zero,yy),bw,Math.max(1,Math.abs(zero-yy)))}
    }
  }
  for(const s of chart.series){for(const p of s.priceLines){if(!Number.isFinite(+p.price))continue;const yy=y(+p.price);ctx.strokeStyle=p.color||'#8ea0b7';ctx.lineWidth=p.lineWidth||1;ctx.setLineDash(p.lineStyle===0?[]:[5,4]);ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(W-pad.r,yy);ctx.stroke();ctx.setLineDash([]);if(p.title){ctx.fillStyle=p.color||text;ctx.font='9px system-ui';ctx.fillText(String(p.title),pad.l+4,Math.max(8,yy-6))}}}
  ctx.fillStyle=text;ctx.font='10px system-ui';ctx.textAlign='center';ctx.textBaseline='top';const marks=[0,Math.floor((times.length-1)/2),times.length-1];for(const i of marks){const t=times[i];if(t!=null)ctx.fillText(timeLabel(t),x(t),H-pad.b+7)}
}
window.__TensaiNativeLightweightCharts=window.LightweightCharts||null;
window.LightweightCharts={CrosshairMode:{Normal:0},createChart};
window.__TensaiChartEngine='canvas-shim-v1';
window.addEventListener('resize',()=>charts.forEach(schedule));
document.addEventListener('click',e=>{if(e.target?.closest?.('.tab'))setTimeout(()=>charts.forEach(schedule),40)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>charts.forEach(schedule),50)});
})();
