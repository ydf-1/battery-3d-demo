import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=path.resolve(import.meta.dirname,'..');
const screenshots=path.join(root,'docs/screenshots');await fs.mkdir(screenshots,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE_PATH,headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,offline:true,reducedMotion:'reduce'});
const page=await context.newPage(),errors=[],network=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^(https?|wss?):/i.test(r.url()))network.push(r.url());});
page.setDefaultTimeout(60000);
const frame=()=>page.frames().find(f=>f!==page.mainFrame());
async function ready(){await page.waitForFunction(()=>document.querySelector('#viewer').contentWindow?.batteryExplorer?.snapshot().ready);await page.waitForTimeout(300);}
async function shot(name){await frame().waitForFunction(()=>!document.querySelector('#toast').classList.contains('show'));await page.screenshot({path:path.join(screenshots,name+'.png'),fullPage:true});}
try{
 await page.goto(pathToFileURL(path.join(root,'release/3D电池模型-成品.html')).href);await ready();
 for(const [i,name] of ['两轮车','电动工具','储能柜'].entries()){
  await page.locator(`[data-model="${i}"]`).click();await ready();
  assert.equal(await frame().locator('#part-list .plastic-row').count(),4);
  assert.equal(await frame().locator('.reference-note').textContent(),'示意图，仅供参考');
  assert.equal(await frame().locator('.topbar').isVisible(),false);
  const expected=[65,10,null][i],s=await frame().evaluate(()=>window.batteryExplorer.snapshot());if(expected)assert.equal(s.cellGeometry.count,expected);
  await frame().waitForFunction(()=>{const s=window.batteryExplorer.snapshot();return s.parts.every(p=>Math.abs(p.progress-p.target)<.0001)});
  await page.waitForTimeout(800);
  const framesBefore=await frame().evaluate(()=>window.batteryExplorer.snapshot().renderedFrames);
  await page.waitForTimeout(500);
  assert.equal(await frame().evaluate(()=>window.batteryExplorer.snapshot().renderedFrames),framesBefore,'静止模型不应持续重绘');
  await shot('成品-'+name);
  await page.locator('#gallery-help').click();assert(await frame().locator('#guide').isVisible());await frame().locator('#close-guide').click();
  await frame().locator('#explode').click();await shot('成品-'+name+'-完整拆解');
  checks.push(name+'切换、真实WebGL渲染、部件清单、独立操作指南、完整拆解');
 }
 await page.setViewportSize({width:390,height:844});
 for(const i of [0,1,2]){
  await page.locator(`[data-model="${i}"]`).click();await ready();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  assert.equal(await frame().evaluate(()=>document.documentElement.scrollWidth),390);
  await shot('成品-手机-'+['两轮车','电动工具','储能柜'][i]);
 }
 checks.push('三套移动视口切换、父子页面无水平溢出');
 await page.setViewportSize({width:1366,height:768});
 for(const i of [0,1,2]){
  await page.locator('[data-model="'+i+'"]').click();await ready();
  const controls=await frame().locator('#explode').boundingBox();
  assert(controls.y+controls.height<768,'笔记本视口主操作应在首屏');
 }
 checks.push('1366×768笔记本首屏主操作可见；三模型静止后停止WebGL重绘');
 await page.setViewportSize({width:1440,height:1000});await page.locator('[data-model="0"]').focus();await page.keyboard.press('ArrowRight');await ready();assert.equal(await page.locator('[data-model="1"]').getAttribute('aria-selected'),'true');checks.push('键盘切换');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);checks.push('整合单文件零外部网络请求、无浏览器错误');
 await fs.writeFile(path.join(root,'docs/成品入口验收.json'),JSON.stringify({result:'passed',checks,errors,network},null,2));console.log(JSON.stringify({result:'passed',checks},null,2));
}catch(e){console.error(e);console.error({errors,network});process.exitCode=1;}finally{await browser.close();}
