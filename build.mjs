import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { assertOfflineHTML } from './offline-check.mjs';
import { spawnSync } from 'node:child_process';
const site = import.meta.dirname;
const license = fs.readFileSync(path.join(site,'THREE-LICENSE.txt'),'utf8');
const targets = [
  { directory: 'dist', styles: ['dist/style.css'], outputs: ['dist/index.html'] },
  { directory: 'models/home-storage', styles: ['dist/style.css', 'models/home-storage/style.css'], outputs: ['models/home-storage/index.html', 'release/户用储能电池柜-离线.html'] },
];
for (const target of targets) {
  const result = await build({entryPoints:[path.join(site,target.directory,'app.js')],bundle:true,write:false,format:'iife',target:'es2020',minify:true,legalComments:'inline'});
  const script = result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
  const css = target.styles.map(file=>fs.readFileSync(path.join(site,file),'utf8')).join('\n');
  const template = fs.readFileSync(path.join(site,target.directory,'index.template.html'),'utf8');
  const content = template.replace('<head>',()=>`<head>\n<!-- Three.js license\n${license}\n-->`).replace('/*__STYLES__*/',()=>css).replace('/*__APP__*/',()=>script);
  const html = target.directory === 'dist' ? content : content.replaceAll('\r\n','\n');
  assertOfflineHTML(html);
  for (const output of target.outputs) {
    const filename = path.join(site,output);
    // Do not rewrite a pre-existing generated file when its bytes already match.
    if(fs.existsSync(filename) && fs.readFileSync(filename,'utf8') === html) {
      console.log(`Unchanged ${output}`); continue;
    }
    // Protect any locally modified legacy output from a different build result.
    if(output === 'dist/index.html' && fs.existsSync(path.join(site,'.git'))) {
      const check = spawnSync('git',['-c',`safe.directory=${site.replaceAll('\\','/')}`,'diff','HEAD','--quiet','--',output],{cwd:site});
      if(check.status !== 0) throw new Error('保留现有 dist/index.html 未提交改动：新构建内容不同，已停止覆盖。');
    }
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    fs.writeFileSync(filename,html);
    console.log(`Built ${output}: self-contained, with no network dependencies.`);
  }
}
