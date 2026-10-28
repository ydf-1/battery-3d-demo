import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'docs/screenshots');
const project=path.join(root,'models/power-tool');
fs.mkdirSync(out,{recursive:true});
const plastic=[
 ['p1','①','上下壳','BT-CS 阻燃系列（PC/ABS）、BT-ABS 阻燃系列、BT-PC 阻燃系列（镭雕级）'],
 ['p2','②','电芯支架','BT-PC 阻燃、增强系列'],
 ['p3','③','卡扣和滑轨','BT-CS 系列（PC/ABS），滑轨跟上壳一体，同①选料'],
 ['p4','④','端子护罩','BT-PA66 阻燃增强系列']
];
const others=[['cells','电芯组'],['busbar','镍片'],['contacts','金属端子'],['pcb','保护板'],['spring','弹簧'],['leds','电量灯'],['fasteners','金属紧固件']];
const report={result:'running',checks:[],pageErrors:[],consoleErrors:[],networkRequests:[],evidence:{}};
const check=(name,ok,evidence)=>{report.checks.push({name,passed:!!ok});if(evidence!==undefined)report.evidence[name]=evidence;if(!ok)console.log('FAILED '+name,JSON.stringify(evidence));};
const close=(a,b,e=.002)=>Math.abs(a-b)<e;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE_PATH || undefined,headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
await context.setOffline(true);
context.on('request',r=>{if(/^(https?|wss?):/.test(r.url()))report.networkRequests.push(r.url());});
const page=await context.newPage();
page.on('pageerror',e=>report.pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
page.on('websocket',w=>report.networkRequests.push(w.url()));
const snap=()=>page.evaluate(()=>window.batteryExplorer.snapshot());
const settle=async()=>{await page.waitForFunction(()=>window.batteryExplorer.snapshot().parts.every(p=>Math.abs(p.progress-p.target)<.0001),null,{timeout:20000});await page.waitForTimeout(160);};
const part=(s,id)=>s.parts.find(p=>p.id===id);
const transforms=s=>s.parts.map(p=>({id:p.id,position:p.position,target:p.target}));
const nonplastic=s=>s.materials.filter(m=>m.kind!=='plastic');
const clickPart=async id=>{await page.locator(`[data-part="${id}"]`).click();await settle();};
const assemble=async()=>{await page.locator('#assemble').click();await settle();};
const explode=async()=>{await page.locator('#explode').click();await settle();};
const shot=async name=>{await page.waitForFunction(()=>!document.getElementById('toast').classList.contains('show'));await page.waitForTimeout(180);await page.screenshot({path:path.join(out,'电动工具-'+name+'.png'),fullPage:true});};
const disclaimer=async label=>{const d=await page.locator('.reference-note').boundingBox(),c=await page.locator('#viewport canvas').boundingBox(),s=await page.locator('.stage').boundingBox();check('Disclaimer below canvas: '+label,!!d&&d.y>=c.y+c.height&&d.y+d.height<=s.y+s.height&&await page.locator('.reference-note').innerText()==='示意图，仅供参考',{d,c,s});};
try{
 const data=await import(pathToFileURL(path.join(project,'dist/data.js')).href);
 check('Four exact approved plastic entries',equal(data.PART_DATA.filter(p=>p.number).map(p=>[p.id,p.number,p.name,p.recommendation]),plastic));
 check('Other parts have names only',equal(data.PART_DATA.filter(p=>!p.number).map(p=>[p.id,p.name]),others)&&data.PART_DATA.filter(p=>!p.number).every(p=>p.recommendation===null));
 check('No pack configuration',data.PACK_CONFIG.length===0);
 await page.goto(pathToFileURL(path.join(root,'release/电动工具电池包-离线.html')).href);
 await page.waitForFunction(()=>window.batteryExplorer?.snapshot().ready,null,{timeout:30000});await settle();
 const initial=await snap(),baselineMaterials=nonplastic(initial),g=initial.cellGeometry;
 report.evidence.initial=initial;
 check('All component identities represented',Object.values(initial.meshCounts).every(n=>n>0)&&Object.keys(initial.meshCounts).length===11,initial.meshCounts);
 check('Ten equal 18650 cylinders at 18:65 ratio',g?.count===10&&g.cellCount===10&&g.diameterMm===18&&g.lengthMm===65&&close(2*g.radius*g.mmPerSceneUnit,18,.0001)&&close(g.height*g.mmPerSceneUnit,65,.0001),g);
 const rowMap=new Map();for(const [x,y,z] of g.positions){const k=y.toFixed(3);if(!rowMap.has(k))rowMap.set(k,[]);rowMap.get(k).push([x,z]);}
 check('Exactly two rows of five horizontal cells',rowMap.size===2&&[...rowMap.values()].every(row=>row.length===5&&new Set(row.map(p=>p[0].toFixed(3))).size===5)&&new Set(g.positions.map(p=>p[2].toFixed(3))).size===1,[...rowMap]);
 check('Default cell module is clear of lower shell',initial.layerBounds[3].min[1]>initial.layerBounds[4].max[1],initial.layerGaps);
 const visible=await page.locator('body').innerText();
 check('No voltage capacity or old pack values visible',!/(13S5P|48\.1V|25Ah|21700|整包电压|标称电压|容量|DJI|Action4|BMS支架)/i.test(visible));
 check('Only approved plastic entries numbered',await page.locator('#part-list .part-number').count()===4&&await page.locator('#other-parts .part-number').count()===0);
 await disclaimer('desktop');await shot('初始展开');
 await assemble();const assembled=await snap();
 check('All parts return to base on assemble',assembled.parts.every(p=>p.position.every((v,i)=>close(v,p.base[i]))),assembled.parts);
 await shot('组装');
 for(const [id,n,name,rec] of plastic){
  await assemble();await clickPart(id);const selected=await snap();
  check('Exact detail: '+id,(await page.locator('#part-detail').textContent())===n+name+'邦泰推荐'+rec);
  check('Plastic highlights only: '+id,selected.highlightedIds.length>0&&selected.highlightedIds.every(v=>['p1','p2','p3','p4'].includes(v)),selected.highlightedIds);
  check('Nonplastics retain color: '+id,equal(nonplastic(selected),baselineMaterials));
  if(id==='p1'){
   check('Both shells separate for p1',part(selected,'topShell').position[1]>part(assembled,'topShell').position[1]&&part(selected,'bottomShell').position[1]<part(assembled,'bottomShell').position[1]);
   check('Integral rails follow shell translation',selected.rails.length>=2&&selected.rails.every((r,i)=>r.position.every((v,a)=>close(v-assembled.rails[i].position[a],part(selected,'topShell').position[a]-part(assembled,'topShell').position[a]))),selected.rails);
  }
  if(id==='p2')check('Both holders separate; cells stay fixed',!equal(part(selected,'upperHolder').position,part(assembled,'upperHolder').position)&&!equal(part(selected,'lowerHolder').position,part(assembled,'lowerHolder').position)&&equal(part(selected,'cells').position,part(assembled,'cells').position));
  if(id==='p3'){
   check('p3 moves latch without moving shells',!equal(part(selected,'latch').position,part(assembled,'latch').position)&&equal(part(selected,'topShell').position,part(assembled,'topShell').position)&&equal(part(selected,'bottomShell').position,part(assembled,'bottomShell').position));
   check('p3 highlights fixed integral rails',selected.rails.length>=2&&selected.rails.every((r,i)=>r.highlighted&&equal(r.position,assembled.rails[i].position)&&r.highlightIds.includes('p1')&&r.highlightIds.includes('p3')),selected.rails);

  }
  if(id==='p4')check('Terminal cover separates',!equal(part(selected,'terminalCover').position,part(assembled,'terminalCover').position));
  await shot('选中'+n);
  await clickPart(id);const restored=await snap();
  check('Second click restores: '+id,restored.parts.filter(p=>p.selectionId===id).every(p=>p.target===0&&p.position.every((v,i)=>close(v,p.base[i]))));
  await clickPart(id);await clickPart('cells');await clickPart(id);
  check('Repeated click restores after viewing cells: '+id,(await snap()).parts.filter(p=>p.selectionId===id).every(p=>p.target===0&&p.position.every((v,i)=>close(v,p.base[i]))));
 }
 await assemble();await clickPart('p1');await clickPart('cells');await clickPart('p1');
 check('Part toggle survives intervening name-only selection',(await snap()).parts.filter(p=>p.selectionId==='p1').every(p=>p.target===0));
 await explode();const full=await snap();report.evidence.full=full;
 check('Full explosion targets all parts',full.parts.every(p=>p.target===1&&p.progress===1));
 const gaps=full.layerGaps;
 check('Four equal positive exploded layer clearances',gaps.length===4&&gaps.every(v=>v>.5)&&Math.max(...gaps)-Math.min(...gaps)<.04,gaps);
 await shot('完整拆解');
 await clickPart('p3');const latchFromFull=await snap();
 check('Selecting p3 from full view visibly pulls latch',!equal(part(latchFromFull,'latch').position,part(full,'latch').position)&&equal(part(latchFromFull,'topShell').position,part(full,'topShell').position));
 await explode();await clickPart('p4');
 check('Selecting p4 from full view visibly isolates cover',!equal(part(await snap(),'terminalCover').position,part(full,'terminalCover').position));
 await explode();
 for(const [id,name] of others){
  const before=await snap();await clickPart(id);const after=await snap();
  check('Name only detail: '+id,(await page.locator('#part-detail').textContent())===name);
  check('No motion or highlight: '+id,after.highlightedIds.length===0&&equal(transforms(before),transforms(after)));
  check('Metal cells PCB LEDs unchanged: '+id,equal(nonplastic(after),baselineMaterials));
  if(id==='contacts')await shot('金属端子');
 }
 await clickPart('cells');await page.locator('[data-view="front"]').click();await settle();await page.locator('#toggle-labels').click();await shot('正视图');await page.locator('#toggle-labels').click();
 await page.locator('#explosion').fill('50');await page.locator('#explosion').dispatchEvent('input');await settle();
 check('Slider updates all progress',(await snap()).parts.every(p=>close(p.progress,.5)&&close(p.target,.5)));
 await page.locator('#toggle-labels').click();check('Labels hide',!await page.locator('#labels').isVisible());
 await page.locator('#toggle-labels').click();check('Labels return',await page.locator('#labels').isVisible());
 await page.locator('#auto-rotate').click();const rotating=await snap();await page.waitForTimeout(300);const rotated=await snap();
 check('Autorotate rotates camera',rotated.autoRotate&&!equal(rotating.camera,rotated.camera));await page.locator('#auto-rotate').click();
 const cam=(await snap()).camera;await page.locator('#zoom-in').click();check('Zoom changes camera',!equal(cam,(await snap()).camera));
 await page.locator('#viewport').focus();await page.keyboard.press('ArrowRight');check('Keyboard rotation works',!equal(cam,(await snap()).camera));
 await page.locator('#help').click();check('Guide opens',await page.locator('#guide').isVisible());await page.keyboard.press('Escape');
 await page.locator('.brand').click();await settle();
 // Actual raycast click on visible mesh candidates, with DOM labels hidden.
 await explode();await page.locator('#toggle-labels').click();
 for(const id of ['p3','p4','pcb']){
  let found=false;
  // A selection reframes the assembly. Refresh projected mesh candidates after
  // each click instead of reusing coordinates from the previous camera pose.
  for(let attempt=0;attempt<12;attempt++){
   const points=(await snap()).pickPoints[id]||[];
   if(!points.length)break;
   const p=points[attempt%points.length];
   await page.mouse.click(p.x,p.y);await settle();
   if((await snap()).selected===id){found=true;break;}
  }
  check('Canvas picking identifies '+id,found);
 }
 await page.locator('.brand').click();await settle();if(!(await snap()).labels)await page.locator('#toggle-labels').click();
 await page.setViewportSize({width:390,height:844});await settle();await page.waitForTimeout(350);
 const mobile=await page.evaluate(()=>({body:document.body.scrollWidth,width:innerWidth}));check('Mobile has no horizontal overflow',mobile.body===mobile.width,mobile);
 await disclaimer('mobile');await shot('手机布局');
 await clickPart('p3');check('Mobile selection works',(await snap()).selected==='p3');await shot('手机选中③');
 check('Offline has zero HTTP HTTPS WebSocket requests',report.networkRequests.length===0,report.networkRequests);
 check('No browser errors',report.pageErrors.length===0&&report.consoleErrors.length===0,{pageErrors:report.pageErrors,consoleErrors:report.consoleErrors});
 report.result=report.checks.every(c=>c.passed)?'passed':'failed';
}catch(e){report.result='failed';report.exception=e.stack;console.error(e);}
finally{fs.writeFileSync(path.join(root,'docs/电动工具验收.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({result:report.result,checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),exception:report.exception,networkRequests:report.networkRequests,pageErrors:report.pageErrors,consoleErrors:report.consoleErrors},null,2));await browser.close();if(report.result!=='passed')process.exitCode=1;}
