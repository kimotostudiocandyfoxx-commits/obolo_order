const { chromium } = require('playwright');
const fs=require('fs');
const OUT=process.argv[2], day=process.argv[3], at=process.argv[4]||'', N=+(process.argv[5]||60);
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  const url=`http://localhost:3999/kakunin-5798f28713/play?day=${day}&demo=1${at?'&at='+at:''}`;
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000}); await p.waitForTimeout(4000);
  const log=[]; let last='';
  for(let i=0;i<N;i++){
    const txt=(await p.evaluate(()=>document.body.innerText)).replace(/\s+/g,' ').slice(0,300);
    if(txt!==last){ log.push(`[${i}] ${txt}`); last=txt; }
    if(i%8===0) await p.screenshot({path:`${OUT}/d${day}${at}_${String(i).padStart(3,'0')}.png`});
    // prefer visible buttons (choices/actions); skip/back controls excluded
    const btn=await p.$$eval('button',bs=>bs.filter(b=>{const r=b.getBoundingClientRect();const t=b.innerText.trim();return r.width>0&&r.height>0&&t&&!/スキップ|skip|戻る|閉じる|設定|音/.test(t)}).map(b=>b.innerText.trim()));
    if(btn.length){ try{ await p.getByRole('button',{name:btn[0],exact:true}).first().click({timeout:3000}); }catch(e){ await p.mouse.click(195,600);} }
    else await p.mouse.click(195,600);
    await p.waitForTimeout(1200);
  }
  fs.writeFileSync(`${OUT}/d${day}${at}.txt`,log.join('\n')+'\nERRORS:\n'+errs.join('\n'));
  await b.close();
})();
