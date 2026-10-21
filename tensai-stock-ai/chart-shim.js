(()=>{
'use strict';
const charts=[];window.__tensaiCharts=charts;
const dpr=()=>Math.max(1,Math.min(2,window.devicePixelRatio||1));
const num=v=>Number.isFinite(+v)?+v:null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const merge=(a,b)=>({...a,...b,layout:{...(a?.layout||{}),...(b?.layout||{})},grid:{...(a?.grid||{}),...(b?.grid||{})},timeScale:{...(a?.timeScale||{}),...(b?.timeScale||{})},rightPriceScale:{...(a?.rightPriceScale||{}),...(b?.rightPriceScale||{})}});
const fmt=v=>{if(!Number.isFinite(v))return'';const av=Math.abs(v);return av>=1000?v.toLocaleString(undefined,{maximumFractionDigits:0}):v.toLocaleString(undefined,{maximumFractionDigits:av<10?3:2})};
const timeLabel=t=>{try{const d=new Date(Number(t)*1000);return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});}catch{return''}};
function uniqueSorted(data){const m=new Map();for(const x of (data||[])){if(x&&Number.isFinite(+x.time))m.set(+x.time,x)}return [...m.values()].sort((a,b)=>+a.time-+b.time)}
function allTimes(chart){const ts=[];for(const s of chart.series)for(const p of s.data)if(Number.isFinite(+p.time))ts.push(+p.time);return [...new Set(ts)].sort((a,b)=>a-b)}
function countFor(chart,n){return Math.max(12,Math.min(n,Math.round(n/(chart.view.zoom||1))))}
function normalizeView(chart,n){const count=countFor(chart,n),maxStart=Math.max(0,n-count);if(chart.view.start==null)chart.view.start=maxStart;chart.view.start=clamp(chart.view.start,0,maxStart);return{count,maxStart,start:chart.view.start}}
function syncFrom(source){for(const c of charts){if(c===source)continue;c.view.zoom=source.view.zoom;c.view.start=source.view.start;schedule(c)}}
function createChart(el,opts={}){
  if(!el)throw new Error('Chart container missing');
  el.innerHTML='';
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-label','Tensai interactive market chart');
  canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;user-select:none;cursor:grab;';
  el.appendChild(canvas);
  const ctx=canvas.getContext('2d');
  const chart={el,canvas,ctx,options:opts,series:[],raf:0,view:{zoom:1,start:null},
    addCandlestickSeries:o=>addSeries(chart,'candles',o),
    addLineSeries:o=>addSeries(chart,'line',o),
    addHistogramSeries:o=>addSeries(chart,'hist',o),
    applyOptions(o){chart.options=merge(chart.options,o||{});schedule(chart)},
    timeScale(){return{fitContent(){chart.view={zoom:1,start:null};schedule(chart)}}},
    render(){draw(chart)}
  };
  charts.push(chart);enableInteraction(chart);
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
function enableInteraction(chart){
 const c=chart.canvas;let dragging=false,lastX=0,pinch=0;
 const applyZoom=(factor,clientX)=>{
   const times=allTimes(chart),n=times.length;if(n<2)return;
   const old=normalizeView(chart,n),rect=c.getBoundingClientRect(),rx=clamp((clientX-rect.left)/Math.max(1,rect.width),0,1),anchor=old.start+rx*Math.max(1,old.count-1);
   chart.view.zoom=clamp(chart.view.zoom*factor,1,24);
   const newCount=countFor(chart,n),maxStart=Math.max(0,n-newCount);
   chart.view.start=clamp(anchor-rx*Math.max(1,newCount-1),0,maxStart);
   schedule(chart);syncFrom(chart);
 };
 const panPx=dx=>{
   const times=allTimes(chart),n=times.length;if(n<2)return;const v=normalizeView(chart,n),barsPerPx=v.count/Math.max(1,chart.el.clientWidth-74);
   chart.view.start=clamp(chart.view.start-dx*barsPerPx,0,v.maxStart);schedule(chart);syncFrom(chart);
 };
 c.addEventListener('wheel',e=>{e.preventDefault();if(e.shiftKey){panPx(-e.deltaY*.7);return}applyZoom(e.deltaY<0?1.18:1/1.18,e.clientX)},{passive:false});
 c.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;dragging=true;lastX=e.clientX;c.setPointerCapture?.(e.pointerId);c.style.cursor='grabbing'});
 c.addEventListener('pointermove',e=>{if(!dragging||e.pointerType==='touch')return;const dx=e.clientX-lastX;lastX=e.clientX;panPx(dx)});
 c.addEventListener('pointerup',()=>{dragging=false;c.style.cursor='grab'});c.addEventListener('pointercancel',()=>{dragging=false;c.style.cursor='grab'});
 c.addEventListener('dblclick',()=>{chart.view={zoom:1,start:null};schedule(chart);syncFrom(chart)});
 c.addEventListener('touchstart',e=>{if(e.touches.length===1){dragging=true;lastX=e.touches[0].clientX}else if(e.touches.length===2){pinch=Math.abs(e.touches[0].clientX-e.touches[1].clientX)}},{passive:true});
 c.addEventListener('touchmove',e=>{if(e.touches.length===1&&dragging){const x=e.touches[0].clientX,dx=x-lastX;lastX=x;panPx(dx)}else if(e.touches.length===2){e.preventDefault();const d=Math.abs(e.touches[0].clientX-e.touches[1].clientX),mid=(e.touches[0].clientX+e.touches[1].clientX)/2;if(pinch>0&&d>0)applyZoom(clamp(d/pinch,.75,1.35),mid);pinch=d}},{passive:false});
 c.addEventListener('touchend',()=>{dragging=false;pinch=0},{passive:true});
 c.title='Mouse wheel / pinch: zoom · drag: move · Shift+wheel: pan · double-click: reset';
}
function draw(chart){
  const {el,canvas,ctx}=chart;if(!ctx)return;
  const W=Math.floor(el.clientWidth||0),H=Math.floor(el.clientHeight||0);if(W<40||H<40){setTimeout(()=>schedule(chart),120);return}
  const R=dpr();if(canvas.width!==Math.floor(W*R)||canvas.height!==Math.floor(H*R)){canvas.width=Math.floor(W*R);canvas.height=Math.floor(H*R)}ctx.setTransform(R,0,0,R,0,0);
  const bg=chart.options?.layout?.background?.color||getComputedStyle(document.documentElement).getPropertyValue('--chart').trim()||'#081422',text=chart.options?.layout?.textColor||getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()||'#8ea0b7',grid=chart.options?.grid?.horzLines?.color||getComputedStyle(document.documentElement).getPropertyValue('--line').trim()||'#203149';
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);const pad={l:10,r:64,t:12,b:25},pw=W-pad.l-pad.r,ph=H-pad.t-pad.b;
  const fullTimes=allTimes(chart);if(!fullTimes.length){ctx.fillStyle=text;ctx.font='12px system-ui';ctx.fillText(document.documentElement.lang==='th'?'กำลังรอข้อมูลตลาด…':'Waiting for market data…',18,28);return}
  const v=normalizeView(chart,fullTimes.length),start=Math.round(v.start),times=fullTimes.slice(start,start+v.count),visible=new Set(times),all=[];
  for(const s of chart.series){for(const p of s.data){if(!visible.has(+p.time))continue;if(s.type==='candles'){all.push(num(p.low),num(p.high))}else all.push(num(p.value));if(s.type==='hist')all.push(0)}for(const p of s.priceLines)all.push(num(p.price))}
  const ys=all.filter(Number.isFinite);if(!ys.length)return;let ymin=Math.min(...ys),ymax=Math.max(...ys);if(!(ymax>ymin))ymax=ymin+1;const extra=(ymax-ymin)*.07;ymin-=extra;ymax+=extra;
  const y=x=>pad.t+(ymax-x)/(ymax-ymin)*ph,idx=new Map(times.map((t,i)=>[t,i])),x=t=>pad.l+(times.length===1?pw/2:idx.get(+t)/(times.length-1)*pw);
  ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.globalAlpha=.7;ctx.font='10px system-ui';ctx.fillStyle=text;ctx.textAlign='left';ctx.textBaseline='middle';for(let i=0;i<=4;i++){const yy=pad.t+ph*i/4;ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(W-pad.r,yy);ctx.stroke();ctx.fillText(fmt(ymax-(ymax-ymin)*i/4),W-pad.r+7,yy)}ctx.globalAlpha=1;
  for(const s of chart.series){const data=s.data.filter(p=>visible.has(+p.time));if(!data.length)continue;
    if(s.type==='candles'){const bw=Math.max(2,Math.min(18,pw/Math.max(times.length,1)*.62));for(const p of data){const xx=x(p.time),yo=y(+p.open),yc=y(+p.close),yh=y(+p.high),yl=y(+p.low),up=+p.close>=+p.open,col=up?(s.options.upColor||'#24c88b'):(s.options.downColor||'#ff6274');ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xx,yh);ctx.lineTo(xx,yl);ctx.stroke();ctx.fillRect(xx-bw/2,Math.min(yo,yc),bw,Math.max(1.5,Math.abs(yc-yo)))}}
    else if(s.type==='line'){ctx.strokeStyle=s.options.color||'#4f8cff';ctx.lineWidth=s.options.lineWidth||1.5;ctx.setLineDash(s.options.lineStyle===2?[4,4]:[]);ctx.beginPath();let begun=false;for(const p of data){if(!Number.isFinite(+p.value))continue;const xx=x(p.time),yy=y(+p.value);if(!begun){ctx.moveTo(xx,yy);begun=true}else ctx.lineTo(xx,yy)}if(begun)ctx.stroke();ctx.setLineDash([])}
    else if(s.type==='hist'){const zero=y(0),bw=Math.max(1,Math.min(15,pw/Math.max(times.length,1)*.6));for(const p of data){const yy=y(+p.value),xx=x(p.time);ctx.fillStyle=p.color||s.options.color||(+p.value>=0?'#24c88b':'#ff6274');ctx.fillRect(xx-bw/2,Math.min(zero,yy),bw,Math.max(1,Math.abs(zero-yy)))}}
  }
  for(const s of chart.series)for(const p of s.priceLines){if(!Number.isFinite(+p.price))continue;const yy=y(+p.price);if(yy<pad.t-10||yy>H-pad.b+10)continue;ctx.strokeStyle=p.color||'#8ea0b7';ctx.lineWidth=p.lineWidth||1;ctx.setLineDash(p.lineStyle===0?[]:[5,4]);ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(W-pad.r,yy);ctx.stroke();ctx.setLineDash([]);if(p.title){ctx.fillStyle=p.color||text;ctx.font='9px system-ui';ctx.textAlign='left';ctx.fillText(String(p.title),pad.l+4,Math.max(8,yy-6))}}
  ctx.fillStyle=text;ctx.font='10px system-ui';ctx.textAlign='center';ctx.textBaseline='top';const marks=[0,Math.floor((times.length-1)/2),times.length-1];for(const i of marks){const t=times[i];if(t!=null)ctx.fillText(timeLabel(t),x(t),H-pad.b+7)}
  ctx.textAlign='left';ctx.fillStyle=text;ctx.globalAlpha=.72;ctx.font='9px system-ui';ctx.fillText(document.documentElement.lang==='th'?'เลื่อนเมาส์: ซูม · ลาก: ขยับ · ดับเบิลคลิก: รีเซ็ต':'Wheel: zoom · Drag: pan · Double-click: reset',pad.l+4,H-8);ctx.globalAlpha=1;
}
window.__TensaiNativeLightweightCharts=window.LightweightCharts||null;window.LightweightCharts={CrosshairMode:{Normal:0},createChart};window.__TensaiChartEngine='canvas-interactive-v2';
window.addEventListener('resize',()=>charts.forEach(schedule));document.addEventListener('click',e=>{if(e.target?.closest?.('.tab'))setTimeout(()=>charts.forEach(schedule),50)});document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>charts.forEach(schedule),50)});
})();
