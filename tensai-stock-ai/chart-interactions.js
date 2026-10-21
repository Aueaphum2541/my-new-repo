(()=>{
'use strict';
const wait=()=>{
 const charts=window.__tensaiCharts;
 if(!charts||!charts.length){setTimeout(wait,100);return}
 charts.forEach(enable);
};
function enable(chart){
 if(chart.__interactive)return;chart.__interactive=true;
 const c=chart.canvas,el=chart.el;
 chart.__view={zoom:1,offset:0};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 let drag=false,lastX=0,touchDist=0;
 function visibleCount(){
   const all=chart.series?.flatMap(s=>s.data||[])||[];
   const n=new Set(all.map(x=>+x.time).filter(Number.isFinite)).size||1;
   return {n,count:Math.max(18,Math.round(n/chart.__view.zoom))};
 }
 function maxOffset(){const {n,count}=visibleCount();return Math.max(0,n-count)}
 function redraw(){chart.__view.offset=clamp(chart.__view.offset,0,maxOffset());chart.render?.()}
 c.addEventListener('wheel',e=>{
   e.preventDefault();
   const prev=chart.__view.zoom;
   const factor=e.deltaY<0?1.18:1/1.18;
   chart.__view.zoom=clamp(prev*factor,1,16);
   const rect=c.getBoundingClientRect(),rx=clamp((e.clientX-rect.left)/Math.max(rect.width,1),0,1);
   const before=visibleCount();
   const prevCount=Math.max(18,Math.round(before.n/prev));
   const newCount=before.count;
   chart.__view.offset=clamp(chart.__view.offset+(prevCount-newCount)*(1-rx),0,maxOffset());
   redraw();
 },{passive:false});
 c.addEventListener('mousedown',e=>{drag=true;lastX=e.clientX;c.style.cursor='grabbing'});
 window.addEventListener('mousemove',e=>{if(!drag)return;const dx=e.clientX-lastX;lastX=e.clientX;const {count}=visibleCount();chart.__view.offset-=dx/Math.max(el.clientWidth,1)*count;redraw()});
 window.addEventListener('mouseup',()=>{drag=false;c.style.cursor='grab'});
 c.addEventListener('dblclick',()=>{chart.__view={zoom:1,offset:0};redraw()});
 c.addEventListener('touchstart',e=>{
   if(e.touches.length===1){drag=true;lastX=e.touches[0].clientX}
   if(e.touches.length===2){touchDist=Math.abs(e.touches[0].clientX-e.touches[1].clientX)}
 },{passive:true});
 c.addEventListener('touchmove',e=>{
   if(e.touches.length===1&&drag){const x=e.touches[0].clientX,dx=x-lastX;lastX=x;const {count}=visibleCount();chart.__view.offset-=dx/Math.max(el.clientWidth,1)*count;redraw()}
   if(e.touches.length===2){e.preventDefault();const d=Math.abs(e.touches[0].clientX-e.touches[1].clientX);if(touchDist>0){chart.__view.zoom=clamp(chart.__view.zoom*(d/touchDist),1,16);touchDist=d;redraw()}}
 },{passive:false});
 c.addEventListener('touchend',()=>{drag=false;touchDist=0},{passive:true});
 c.style.cursor='grab';
 c.title='Scroll / pinch to zoom · drag to move · double-click to reset';
}
wait();
})();
