(()=>{
'use strict';
function patch(){
 const LC=window.LightweightCharts;if(!LC||!LC.createChart){setTimeout(patch,80);return}
 if(LC.__tensaiPatched)return;LC.__tensaiPatched=true;
 const orig=LC.createChart;
 const charts=[];window.__tensaiCharts=charts;
 LC.createChart=function(el,opts){
   const ch=orig(el,opts);charts.push(ch);
   // Native library already has pan/zoom. Canvas fallback will be handled by interaction layer when its chart object exposes canvas/series.
   return ch;
 };
}
patch();
})();
