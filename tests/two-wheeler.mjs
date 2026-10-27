import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'docs/screenshots');
fs.mkdirSync(out,{recursive:true});

const plastic = [
  ['p1','①','上盖、底座、塑料外壳','BT-CS 阻燃系列（PC/ABS），户外件加耐候'],
  ['p2','②','电芯支架、铝壳内绝缘支架','BT-PC 阻燃、增强系列'],
  ['p3','③','BMS支架','BT-PA66 阻燃增强系列'],
  ['p4','④','放电口、换电连接器座','BT-PA66 阻燃增强系列'],
];
const others = [['shell','铝型材外壳'],['cells','电芯组'],['pcb','BMS电路板'],['busbar','汇流排'],['contacts','金属插片'],['fasteners','金属紧固件']];
const config = [{label:'串并联配置',value:'13S5P'},{label:'标称电压',value:'48.1V'},{label:'容量',value:'25Ah'}];
const report = { result:'running',checks:[],pageErrors:[],consoleErrors:[],networkRequests:[],evidence:{} };
const check = (name, ok, evidence) => { report.checks.push({name,passed:!!ok});if(evidence!==undefined)report.evidence[name]=evidence;if(!ok)console.log('FAILED: '+name+' '+JSON.stringify(evidence)); };
const close = (a,b,tolerance=.002) => Math.abs(a-b)<tolerance;
const browser = await chromium.launch({ executablePath:process.env.CHROME_EXECUTABLE_PATH || undefined,headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce' });
await context.setOffline(true);
context.on('request',r=>{if(/^(https?|wss?):/.test(r.url()))report.networkRequests.push(r.url());});
const page = await context.newPage();
page.on('pageerror',e=>report.pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
page.on('websocket',w=>report.networkRequests.push(w.url()));
const snap=()=>page.evaluate(()=>window.batteryExplorer.snapshot());
const nonplastic=s=>s.materials.filter(m=>m.kind!=='plastic');
const transforms=s=>s.parts.map(p=>({id:p.id,target:p.target,position:p.position}));
const settle=()=>page.waitForFunction(()=>window.batteryExplorer.snapshot().parts.every(p=>Math.abs(p.progress-p.target)<.0001),null,{timeout:30000});
const assemble=async()=>{await page.locator('#assemble').click();await settle();await page.waitForTimeout(180);};
const shot=async name=>{await page.waitForFunction(()=>!document.getElementById('toast').classList.contains('show'));await page.waitForTimeout(180);await page.screenshot({path:path.join(out,'两轮车-'+name+'.png'),fullPage:true});};
const clickPart=async id=>{await page.locator(`[data-part="${id}"]`).click();await settle();await page.waitForTimeout(100);};
const textSafety=async label=>{const text=await page.locator('body').innerText();const forbidden=/(1202\.5|21700|\b65\b|48V|CELL|BATTERY|B[–-]01|认证)/.exec(text);check(`No unapproved visible values: ${label}`,!forbidden,forbidden?.[0]);};
const disclaimer=async label=>{const d=await page.locator('.reference-note').boundingBox(),c=await page.locator('#viewport canvas').boundingBox(),s=await page.locator('.stage').boundingBox();check(`Disclaimer below canvas within stage: ${label}`,!!d&&d.y>=c.y+c.height&&d.y+d.height<=s.y+s.height&&await page.locator('.reference-note').innerText()==='示意图，仅供参考',{disclaimer:d,canvas:c,stage:s});};
try {
  const data=await import(pathToFileURL(path.resolve(import.meta.dirname,'../dist/data.js')).href);
  check('Reference table exactly matches approved text',JSON.stringify(data.PART_DATA.map(p=>[p.id,p.number,p.name,p.recommendation,p.kind]))===JSON.stringify([...plastic.map(([id,number,name,recommendation])=>[id,number,name,recommendation,'plastic']),...others.map(([id,name])=>[id,null,name,null,id==='cells'?'cells':id==='pcb'?'pcb':'metal'])]));
  check('Pack configuration exactly matches approved values',JSON.stringify(data.PACK_CONFIG)===JSON.stringify(config));
  await page.goto(pathToFileURL(path.resolve(import.meta.dirname,'../release/两轮车电池包-离线.html')).href);
  await page.waitForFunction(()=>window.batteryExplorer?.snapshot().ready);
  await settle();
  const initial=await snap(),baselineMaterials=JSON.stringify(nonplastic(initial));
  await shot('初始展开');
  check('Ten selectable component identities are present',Object.keys(initial.meshCounts).length===10&&Object.values(initial.meshCounts).every(n=>n>0),initial.meshCounts);
  const g=initial.cellGeometry;
  check('65 cells use proportional real 21 by 70 mm geometry',g.count===65&&g.cellCount===65&&g.diameterMm===21&&g.lengthMm===70&&close(g.radius*2*g.mmPerSceneUnit,21,.00001)&&close(g.height*g.mmPerSceneUnit,70,.00001)&&close((g.radius*2)/g.height,21/70,.00001),g);
  check('Only plastic surfaces initially highlighted',JSON.stringify(initial.highlightedIds)==='["p1"]'&&nonplastic(initial).every(m=>m.emissive==='000000'),initial.highlightedIds);
  await textSafety('initial');await disclaimer('desktop');
  await assemble();await shot('组装');
  check('Global assembly returns every transform to base', (await snap()).parts.every(p=>p.progress===0&&p.position.every((v,i)=>close(v,p.base[i]))));

  for(const [id,number,name,recommendation] of plastic){
    await assemble();await clickPart(id);
    const s=await snap(),detail=await page.locator('#part-detail').textContent();
    check(`Exact approved plastic detail: ${id}`,detail===number+name+'邦泰推荐'+recommendation,detail);
    check(`Plastic highlight limited to selected identity: ${id}`,JSON.stringify(s.highlightedIds)===JSON.stringify([id]),s.highlightedIds);
    check(`Nonplastic materials unchanged selecting ${id}`,JSON.stringify(nonplastic(s))===baselineMaterials);
    await shot('选中'+number);
    if(id==='p1'){
      const top=s.parts.find(p=>p.id==='topCap'),base=s.parts.find(p=>p.id==='base');
      check('p1 moves top cap upward and base downward together',top.progress===1&&base.progress===1&&top.position[1]>top.base[1]&&base.position[1]<base.base[1],{top,base});
    }
    if(id==='p2'){
      const upper=s.parts.find(p=>p.id==='upperHolder'),lower=s.parts.find(p=>p.id==='lowerHolder');
      check('p2 moves both holders and extracts lower holder 2 units',upper.progress===1&&lower.progress===1&&upper.position[1]>upper.base[1]&&lower.position[1]<lower.base[1]&&close(lower.position[2]-lower.base[2],2),{upper,lower});
    }
    if(id==='p3'){
      const bracket=s.parts.find(p=>p.id==='bmsBracket'),pcb=s.parts.find(p=>p.id==='pcb');
      check('p3 support is independent of PCB',bracket.progress===1&&pcb.progress===0&&pcb.position.every((v,i)=>close(v,pcb.base[i])),{bracket,pcb});
    }
    if(id==='p4'){
      const socket=s.parts.find(p=>p.id==='socket');
      check('p4 socket moves with only plastic highlighted',socket.progress===1&&socket.position[2]>socket.base[2]&&JSON.stringify(s.highlightedIds)==='["p4"]',socket);
      const before=transforms(s);await clickPart('contacts');const after=await snap();
      check('Contact click is name-only without highlight or movement',(await page.locator('#part-detail').textContent())==='金属插片'&&after.highlightedIds.length===0&&JSON.stringify(before)===JSON.stringify(transforms(after)),{detail:await page.locator('#part-detail').textContent(),highlighted:after.highlightedIds});
    }
    await textSafety(id);
    await clickPart('cells');await clickPart(id);
    const restored=await snap();
    check('Repeated click restores after viewing cells: '+id,restored.parts.filter(p=>p.selectionId===id).every(p=>p.target===0&&p.position.every((v,i)=>close(v,p.base[i]))));
  }

  await assemble();
  for(const [id,name] of others){
    const before=await snap();await clickPart(id);const after=await snap();
    check(`Unnumbered detail is exact name: ${id}`,(await page.locator('#part-detail').textContent())===name);
    check(`Unnumbered ${id} cannot move or highlight`,after.highlightedIds.length===0&&JSON.stringify(transforms(before))===JSON.stringify(transforms(after)));
    check(`Unnumbered ${id} preserves nonplastic material`,JSON.stringify(nonplastic(after))===baselineMaterials);
    if(id==='contacts')await shot('金属插片');
  }

  await page.locator('#explode').click();await settle();const full=await snap();await clickPart('p1');await shot('完整拆解');
  check('Global explosion applies progress 1 to all parts',full.parts.every(p=>p.progress===1&&p.target===1),full.parts.map(({id,progress,target})=>({id,progress,target})));
  const socket=full.parts.find(p=>p.id==='socket'),base=full.parts.find(p=>p.id==='base');
  check('Socket follows exploded base plus socket offset',close(socket.position[1]-socket.base[1],base.position[1]-base.base[1]+.16)&&close(socket.position[2]-socket.base[2],base.position[2]-base.base[2]+.92));
  check('Global explosion preserves nonplastic material colors',JSON.stringify(nonplastic(full))===baselineMaterials);
  await page.locator('#explosion').fill('35');await page.locator('#explosion').dispatchEvent('input');await settle();
  check('Slider updates all parts consistently',(await snap()).parts.every(p=>close(p.progress,.35)&&close(p.target,.35)));
  await page.locator('#toggle-labels').click();check('Label visibility toggles off',!await page.locator('#labels').isVisible());
  await page.locator('#toggle-labels').click();check('Label visibility toggles on',await page.locator('#labels').isVisible());
  await page.locator('#auto-rotate').click();check('Autorotate activates',(await snap()).autoRotate);await page.locator('#auto-rotate').click();
  const camera=(await snap()).camera;await page.locator('#zoom-in').click();check('Zoom control changes camera',JSON.stringify(camera)!==JSON.stringify((await snap()).camera));
  await page.getByRole('tab',{name:'示意配置',exact:true}).click();
  const specRows=await page.locator('#pack-specs>div').evaluateAll(rows=>rows.map(r=>({label:r.querySelector('dt').textContent,value:r.querySelector('dd').textContent})));
  check('Visible specifications contain only three approved values',JSON.stringify(specRows)===JSON.stringify(config)&&await page.locator('#specs-panel').textContent()==='示意配置串并联配置13S5P标称电压48.1V容量25Ah',specRows);
  await textSafety('configuration');
  await page.getByRole('tab',{name:'部件清单',exact:true}).click();await page.locator('#help').click();check('Operation guide opens',await page.locator('#guide').isVisible());await page.keyboard.press('Escape');
  await page.locator('.brand').click();await settle();await page.waitForTimeout(800);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(700);
  const mobile=await page.evaluate(()=>({body:document.body.scrollWidth,viewport:innerWidth}));
  check('Mobile 390px has no horizontal overflow',mobile.body===mobile.viewport,mobile);
  check('Mobile help retains accessible name',await page.getByRole('button',{name:'操作指南',exact:true}).count()===1);
  await disclaimer('mobile');await textSafety('mobile');
  await shot('手机布局');
  check('Zero HTTP HTTPS WebSocket requests during offline interactions',report.networkRequests.length===0,report.networkRequests);
  check('No browser errors',report.pageErrors.length===0&&report.consoleErrors.length===0,{page:report.pageErrors,console:report.consoleErrors});
  report.result=report.checks.every(c=>c.passed)?'passed':'failed';
}catch(e){report.result='failed';report.exception=e.stack||String(e);console.error(e);}
finally{fs.writeFileSync(path.join(root,'docs/两轮车验收.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({result:report.result,checks:report.checks.length,failures:report.checks.filter(c=>!c.passed),exception:report.exception,networkRequests:report.networkRequests,pageErrors:report.pageErrors,consoleErrors:report.consoleErrors},null,2));await browser.close();if(report.result!=='passed')process.exitCode=1;}
