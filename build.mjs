import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { assertOfflineHTML } from './offline-check.mjs';
import { createGallery } from './gallery.mjs';
import { execFileSync } from 'node:child_process';
const site = import.meta.dirname;
// Preserve the user's pre-existing legacy build. Release files and the combined
// viewer are still rebuilt from current sources. A clean clone builds all files.
let preserveLegacy = false;
try {
  preserveLegacy = !!execFileSync('git', ['-c', `safe.directory=${site.replaceAll('\\','/')}`, 'status', '--porcelain', '--', 'dist/index.html'], { cwd:site, encoding:'utf8' }).trim();
} catch { /* Source archives without Git build normally. */ }
const license = fs.readFileSync(path.join(site,'THREE-LICENSE.txt'),'utf8');
const targets = [
  { name:'两轮车电池包', directory: 'dist', styles: ['dist/style.css'], outputs: ['dist/index.html','release/两轮车电池包-离线.html'] },
  { name:'电动工具电池包', directory: 'models/power-tool/dist', styles: ['models/power-tool/dist/style.css'], outputs: ['models/power-tool/dist/index.html','release/电动工具电池包-离线.html'] },
  { name:'户用储能柜', directory: 'models/home-storage', styles: ['dist/style.css', 'models/home-storage/style.css'], outputs: ['models/home-storage/index.html', 'release/户用储能电池柜-离线.html'] },
];
const viewers=[];
for (const target of targets) {
  const result = await build({entryPoints:[path.join(site,target.directory,'app.js')],bundle:true,write:false,format:'iife',target:'es2020',minify:true,legalComments:'inline'});
  const script = result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
  const css = [...target.styles,'shared/presentation.css'].map(file=>fs.readFileSync(path.join(site,file),'utf8')).join('\n');
  const template = fs.readFileSync(path.join(site,target.directory,'index.template.html'),'utf8');
  const content = template.replace('<head>',()=>`<head>\n<!-- Three.js license\n${license}\n-->`).replace('/*__STYLES__*/',()=>css).replace('/*__APP__*/',()=>script);
  const html = content.replaceAll('\r\n','\n');
  assertOfflineHTML(html);
  viewers.push({name:target.name,html});
  for (const output of target.outputs) {
    if (output === 'dist/index.html' && preserveLegacy) {
      console.log('Preserved local dist/index.html; current viewer built in release/.'); continue;
    }
    const filename = path.join(site,output);
    // Do not rewrite a pre-existing generated file when its bytes already match.
    if(fs.existsSync(filename) && fs.readFileSync(filename,'utf8') === html) {
      console.log(`Unchanged ${output}`); continue;
    }
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    fs.writeFileSync(filename,html);
    console.log(`Built ${output}: self-contained, with no network dependencies.`);
  }
}
const gallery=createGallery(viewers);
assertOfflineHTML(gallery);
fs.writeFileSync(path.join(site,'release/3D电池模型-成品.html'),gallery);
console.log('Built release/3D电池模型-成品.html: three embedded offline viewers.');
