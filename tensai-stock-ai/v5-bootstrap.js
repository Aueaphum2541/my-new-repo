(()=>{
'use strict';
const VERSION='5.4.0';
window.__TensaiVersion=VERSION;
function brand(){
  document.title='Tensai AI Market Command Center V5';
  const h=document.querySelector('h1');
  if(h)h.innerHTML='Tensai AI Market Command Center <span>V5</span>';
  const sub=document.getElementById('subtitle');
  if(sub)sub.textContent=document.documentElement.lang==='en'?'Market command center: action, risk, regime and evidence in one screen':'ศูนย์บัญชาการตลาด: สรุปสิ่งที่ควรทำ ความเสี่ยง ภาวะตลาด และหลักฐานในหน้าจอเดียว';
  let badge=document.getElementById('v5LiveBadge');
  if(!badge){
    badge=document.createElement('span');badge.id='v5LiveBadge';badge.textContent='V5.4 FUNCTIONAL';
    badge.style.cssText='display:inline-flex;align-items:center;margin-left:8px;padding:3px 7px;border-radius:999px;border:1px solid var(--line);font-size:9px;font-weight:800;letter-spacing:.08em;color:var(--green);background:var(--panel2)';
    document.querySelector('.brand h1')?.after(badge);
  }else badge.textContent='V5.4 FUNCTIONAL';
}
function load(src,attr){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[${attr}]`);
    if(existing){
      if(existing.dataset.loaded==='1')return resolve(existing);
      existing.addEventListener('load',()=>resolve(existing),{once:true});
      existing.addEventListener('error',reject,{once:true});
      setTimeout(()=>resolve(existing),700);return;
    }
    const s=document.createElement('script');s.src=src;s.setAttribute(attr,'1');
    s.onload=()=>{s.dataset.loaded='1';resolve(s)};s.onerror=reject;document.head.appendChild(s);
  });
}
function activateV5(){
  brand();const btn=document.querySelector('[data-tab="v5"]'),page=document.getElementById('tab-v5');
  if(!btn||!page)return false;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tabpage').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');page.classList.add('active');page.style.display='block';window.__tensaiCharts?.forEach(c=>c.render?.());return true;
}
async function boot(){
  brand();
  try{
    await load(`/v5-patch.js?v=${VERSION}`,'data-tensai-v5');
    await load(`/v5-advanced.js?v=${VERSION}`,'data-tensai-v5-advanced');
    await load(`/v5-hotfix.js?v=${VERSION}`,'data-tensai-v5-hotfix');
    await load(`/v5-functional.js?v=${VERSION}`,'data-tensai-v5-functional');
  }catch(e){console.error('Tensai V5 bootstrap load failed',e)}
  let n=0;const t=setInterval(()=>{n++;if(activateV5()||n>100)clearInterval(t)},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
