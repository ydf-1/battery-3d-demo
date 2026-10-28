import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=path.resolve(import.meta.dirname,'..');
const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE_PATH,headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:800},reducedMotion:'no-preference',offline:true});
page.setDefaultTimeout(60000);
const errors=[],network=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
try {
  await page.goto(pathToFileURL(path.join(root,'release/户用储能电池柜-离线.html')).href);
  await page.waitForFunction(()=>window.batteryExplorer?.snapshot().ready);
  await page.evaluate(()=>{
    window.motionTrace=[];window.traceStage='initial';
    function record(){
      const s=window.batteryExplorer.snapshot();
      window.motionTrace.push({stage:window.traceStage,outer:s.parts.filter(p=>p.phase==='outside').map(p=>p.progress),shell:s.parts.find(p=>p.id==='enclosure').progress,inner:Math.max(...s.parts.filter(p=>p.phase==='inside').map(p=>p.progress))});
      window.traceFrame=requestAnimationFrame(record);
    }record();
  });
  const settle=()=>page.waitForFunction(()=>{const s=window.batteryExplorer.snapshot();return s.displayedExplosion===s.explosion&&s.parts.every(p=>p.progress===p.target);});
  async function step(stage,selector){await page.evaluate(stage=>window.traceStage=stage,stage);await page.locator(selector).click();await settle();}
  await step('overview-assemble','#assemble');
  await step('restore-overview','#overview');
  await step('local-open','[data-part="p3"]');
  await step('assemble','#assemble');
  await step('explode','#explode');
  await step('overview','#overview');
  const trace=await page.evaluate(()=>{cancelAnimationFrame(window.traceFrame);return window.motionTrace;});
  assert(trace.filter(s=>s.stage==='overview-assemble').every(s=>s.shell===0),'总览转组装时已装好的机壳不应先向外弹出');
  checks.push('总览转组装只关闭前面板，机柜外壳保持装配位置');
  for(const stage of ['local-open','explode']){
    const moving=trace.filter(s=>s.stage===stage&&s.inner>.001);
    assert(moving.length>0,stage+' must include actual intermediate frames');
    assert(moving.every(s=>s.outer.every(p=>p>=.994)),stage+' moves interior before the exterior clears');
    checks.push(stage+'：内部开始运动前，外部壳件已移开');
  }
  for(const stage of ['assemble','overview']){
    assert(trace.filter(s=>s.stage===stage&&s.shell<.99).every(s=>s.inner<.002),stage+' closes shell before interior returns');
    checks.push(stage+'：内部归位后外壳才归位');
  }
  const final=await page.evaluate(()=>window.batteryExplorer.snapshot());
  assert(final.overview);assert.equal(final.parts.find(p=>p.id==='enclosure').progress,0);
  await page.waitForTimeout(1000);
  const before=await page.evaluate(()=>window.batteryExplorer.snapshot().renderedFrames);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.batteryExplorer.snapshot().renderedFrames),before);
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  checks.push('正常动画结束后停止重绘，浏览器离线且无脚本错误');
  await fs.writeFile(path.join(root,'docs/储能柜动画验收.json'),JSON.stringify({result:'passed',reducedMotion:false,checks,sampledFrames:trace.length,errors,network},null,2));
  console.log(JSON.stringify({result:'passed',checks,sampledFrames:trace.length}));
} finally {await browser.close();}
