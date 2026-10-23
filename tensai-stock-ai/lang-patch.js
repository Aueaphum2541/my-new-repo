(()=>{
'use strict';
const TH={
 'Decision':'ตัดสินใจ','Charts':'กราฟ','Intelligence':'วิเคราะห์เชิงลึก','Scanner':'สแกนหุ้น','Portfolio':'พอร์ต','Backtest & Journal':'ทดสอบย้อนหลัง & บันทึกเทรด',
 'Analyze':'วิเคราะห์','Refresh':'รีเฟรช','Paper Buy':'จำลองซื้อ','ACTION BOARD':'สรุปการตัดสินใจ','DECISION QUALITY':'คุณภาพการตัดสินใจ','Technical':'เทคนิค','Entry Quality':'คุณภาพจุดเข้า','Risk / Reward':'ความคุ้มความเสี่ยง/ผลตอบแทน','Fundamental':'พื้นฐาน','Signal conflicts':'สัญญาณที่ขัดแย้ง',
 'Multi-Timeframe Consensus':'สรุปหลายกรอบเวลา','Scenario Engine':'แผนตามสถานการณ์','Smart Position Sizing':'คำนวณขนาดการลงทุน','Scale-In / Scale-Out Plan':'แผนทยอยซื้อ / ทยอยขาย','Event & Risk Warning':'เหตุการณ์และคำเตือนความเสี่ยง',
 'Automatic Levels':'ระดับราคาอัตโนมัติ','Patterns & Context':'รูปแบบกราฟและบริบท','Trailing Stop':'จุดเลื่อน Stop','Market Regime':'ภาวะตลาด','Relative Strength':'ความแข็งแรงเทียบตลาด','Fundamental Score':'คะแนนพื้นฐาน','News Impact AI':'ผลกระทบข่าว','Why did price move?':'ทำไมราคาถึงเคลื่อนไหว?','US Market / Sector Heatmap':'Heatmap ตลาดสหรัฐฯ / กลุ่มอุตสาหกรรม',
 'Top Buy Setups':'จังหวะซื้อเด่น','Near Breakout':'ใกล้ Breakout','Oversold Reversal':'Oversold รอกลับตัว','Strong Momentum':'โมเมนตัมแข็งแรง','High Risk Avoid':'ความเสี่ยงสูง ควรหลีกเลี่ยง','Smart Watchlist':'Watchlist อัจฉริยะ','Enable browser alerts':'เปิดแจ้งเตือนเบราว์เซอร์','Add Alert':'เพิ่มการแจ้งเตือน','Scan':'สแกน',
 'Portfolio AI':'AI วิเคราะห์พอร์ต','Portfolio Stress Test':'ทดสอบความเสี่ยงพอร์ต','Concentration & Correlation':'การกระจุกตัวและสหสัมพันธ์','THB Real Return':'ผลตอบแทนจริงเป็นบาท','Strategy Backtest':'ทดสอบกลยุทธ์ย้อนหลัง','Signal Track Record':'ประวัติสัญญาณ','Paper Trading':'ทดลองซื้อขาย','Paper Positions':'สถานะจำลอง','Trade Journal AI':'AI บันทึกการเทรด','Run 2Y':'ทดสอบ 2 ปี',
 'Support':'แนวรับ','Resistance':'แนวต้าน','Entry':'จุดเข้า','Stop':'จุดตัดขาดทุน','Recommended':'แนะนำ','Largest sector':'กลุ่มใหญ่สุด','Holdings':'จำนวนหุ้นที่ถือ','Avg pair correlation':'สหสัมพันธ์เฉลี่ย','Portfolio note':'หมายเหตุพอร์ต','Stock return':'ผลตอบแทนหุ้น','FX return':'ผลจากค่าเงิน','Approx THB return':'ผลตอบแทนโดยประมาณเป็นบาท','USD exposure':'สัดส่วน USD','Value':'มูลค่า','Cash':'เงินสด','Open positions':'สถานะที่เปิด','Closed trades':'ดีลที่ปิดแล้ว','Win rate':'อัตราชนะ','Shares':'จำนวนหุ้น','Close':'ปิดสถานะ',
 'Conservative':'อนุรักษ์นิยม','Balanced':'สมดุล','Aggressive':'เชิงรุก','Breakout':'เบรกแนวต้าน','Pullback':'ย่อตัว','Breakdown':'หลุดแนวรับ','No major conflict':'ยังไม่มีสัญญาณขัดแย้งสำคัญ','Bull Trend':'ขาขึ้น','High Volatility':'ผันผวนสูง','Sideways / Mixed':'แกว่งตัว / ผสม','Risk-Off':'ลดความเสี่ยง','Positive':'บวก','Negative':'ลบ','Neutral':'กลาง','Earnings':'ผลประกอบการ','Regulation':'กฎระเบียบ','Product':'ผลิตภัณฑ์','Analyst':'นักวิเคราะห์','Macro/Company':'มหภาค/บริษัท'
};
const EN=Object.fromEntries(Object.entries(TH).map(([k,v])=>[v,k]));
function walk(node,map){
 if(node.nodeType===3){const raw=node.nodeValue,t=raw.trim();if(map[t])node.nodeValue=raw.replace(t,map[t]);return}
 if(node.nodeType!==1)return;
 if(node.matches('input[placeholder]')){
   const p=node.getAttribute('placeholder')||'';
   if(window.__tensaiLang==='th'&&/^e\.g\./i.test(p))node.setAttribute('placeholder','เช่น แจ้งเมื่อ AAPL กลับมาเป็น BUY setup');
   if(window.__tensaiLang==='en'&&p.startsWith('เช่น '))node.setAttribute('placeholder','e.g. notify me when AAPL becomes a BUY setup');
 }
 [...node.childNodes].forEach(n=>walk(n,map));
}
function applyFullLang(lang){
 window.__tensaiLang=lang==='en'?'en':'th';document.documentElement.lang=window.__tensaiLang;
 walk(document.body,window.__tensaiLang==='th'?TH:EN);
 const btn=document.getElementById('langBtn');if(btn)btn.textContent=window.__tensaiLang==='th'?'EN':'ไทย';
 try{localStorage.setItem('tensai-lang',JSON.stringify(window.__tensaiLang))}catch{}
 window.__tensaiCharts?.forEach(c=>c.render?.());
}
window.__applyTensaiFullLanguage=applyFullLang;
function loadHotfix(){if(document.querySelector('script[data-tensai-v5-hotfix]'))return;const h=document.createElement('script');h.src='/v5-hotfix.js?v=5.1.1';h.dataset.tensaiV5Hotfix='1';document.head.appendChild(h)}
function loadAdvanced(){const old=document.querySelector('script[data-tensai-v5-advanced]');if(old){setTimeout(loadHotfix,80);return}const a=document.createElement('script');a.src='/v5-advanced.js?v=5.1.1';a.dataset.tensaiV5Advanced='1';a.onload=loadHotfix;document.head.appendChild(a)}
function loadV5(){const old=document.querySelector('script[data-tensai-v5]');if(old){setTimeout(loadAdvanced,80);return}const s=document.createElement('script');s.src='/v5-patch.js?v=5.0.2';s.dataset.tensaiV5='1';s.onload=loadAdvanced;document.head.appendChild(s)}
let booted=false;
function boot(){if(booted)return;booted=true;
 setTimeout(()=>{let lang='th';try{lang=JSON.parse(localStorage.getItem('tensai-lang'))||'th'}catch{};applyFullLang(lang)},120);
 const b=document.getElementById('langBtn');if(b)b.addEventListener('click',()=>setTimeout(()=>{let lang='th';try{lang=JSON.parse(localStorage.getItem('tensai-lang'))||'th'}catch{};applyFullLang(lang)},50));
 let busy=false;const obs=new MutationObserver(()=>{if(busy||!window.__tensaiLang)return;busy=true;requestAnimationFrame(()=>{applyFullLang(window.__tensaiLang);busy=false})});setTimeout(()=>obs.observe(document.querySelector('main')||document.body,{childList:true,subtree:true}),600);loadV5();
}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
