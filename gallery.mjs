// Build an offline collection: all three HTML viewers are embedded, not fetched.
export function createGallery(viewers) {
  const embedded = viewers.map(v=>({...v,html:v.html.replace('<body>','<body class="embedded">')}));
  const data = JSON.stringify(embedded).replace(/<\//g,'<\\/');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; frame-src 'self' about:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>电池结构与材料 · 交互展示</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%2356b3ff' d='M4 5h16v16H4zM9 2h6v3H9z'/%3E%3C/svg%3E">
<style>
*{box-sizing:border-box}html,body{margin:0;background:#0b111b;color:#edf3fa;font-family:"Segoe UI","Microsoft YaHei",sans-serif}body{height:100dvh;overflow:hidden}.collection-bar{height:76px;display:flex;align-items:center;gap:24px;padding:0 28px;background:#101722;border-bottom:1px solid #293647}.identity{display:flex;align-items:center;gap:12px;white-space:nowrap}.mark{width:32px;height:32px;color:#69bbff}.identity strong{font-weight:550;letter-spacing:1px;font-size:17px}.identity small{display:block;color:#7e94aa;font-size:10px;letter-spacing:2px;margin-top:4px}nav{display:flex;gap:4px;padding:5px;background:#0a111c;border:1px solid #26374a;border-radius:9px;margin:auto}button{font:inherit;cursor:pointer;border:1px solid transparent;border-radius:6px;color:#a8b8ca;background:transparent;padding:10px 20px;white-space:nowrap;font-size:13px;transition:background .18s,color .18s}button:hover{background:#1c2b3d;color:white}button[aria-selected="true"]{background:#233c55;border-color:#416383;color:#e5f4ff;box-shadow:0 3px 12px #0003}button:focus-visible{outline:2px solid #70c0ff;outline-offset:2px}.collection-note{font-size:11px;color:#92a7bb;white-space:nowrap}.collection-note:before{content:"";display:inline-block;background:#7fcbb6;width:5px;height:5px;border-radius:50%;margin-right:8px}#viewer{display:block;width:100%;height:calc(100dvh - 76px);border:0;background:#0b111b}#switch-status{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:13px;color:#91abc3;pointer-events:none}.ready #switch-status{display:none}
#gallery-help{position:absolute;right:25px;top:21px;padding:7px 10px;border-color:#33495e;color:#a2bed5;font-size:16px;border-radius:50%;width:33px;height:33px;line-height:17px}
@media(max-width:1050px){.identity small,.collection-note{display:none}.collection-bar{gap:14px;padding:0 18px}button{padding:10px 15px}.identity strong{font-size:14px}.mark{width:27px}}
@media(max-width:680px){.collection-bar{height:115px;display:flex;flex-wrap:wrap;gap:10px;padding:13px 12px 10px}.identity{width:100%;justify-content:center;gap:8px}.identity strong{font-size:14px}.mark{width:23px;height:23px}nav{width:100%;padding:4px;gap:1px}button{flex:1;padding:9px 3px;font-size:11px;border-radius:5px}#viewer{height:calc(100dvh - 115px)}}
@media(max-width:680px){#gallery-help{position:absolute;right:14px;top:9px;width:29px;height:29px;padding:5px}}
@media(min-width:681px){.collection-bar{padding-right:76px}}
body.wheeler .collection-bar{height:52px;background:#fff;color:#202936;border-color:#D8DEE6}body.wheeler #viewer{height:calc(100dvh - 52px);background:#E6E9EE}body.wheeler nav{background:#F3F6FA;border-color:#D8DEE6}body.wheeler nav button{color:#526171}body.wheeler nav button[aria-selected="true"]{background:#EAF3FE;color:#1E7BE0;border-color:#C5DAF3}body.wheeler .identity small,body.wheeler .collection-note{display:none}body.wheeler #gallery-help{top:10px;color:#697583;border-color:#D8DEE6}
</style></head><body>
<header class="collection-bar"><div class="identity"><svg class="mark" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true"><path d="m16 2 12 7v14l-12 7-12-7V9zM4 9l12 7 12-7M16 16v14M10 5.5l12 7v7"/></svg><div><strong>电池结构与材料</strong><small>交互展示 · 材料应用</small></div></div><nav role="tablist" aria-label="选择模型">${viewers.map((v,i)=>`<button role="tab" id="model-tab-${i}" data-model="${i}" aria-selected="${i===0}" aria-controls="viewer">${v.name}</button>`).join('')}</nav><span class="collection-note">离线展示</span></header>
<button id="gallery-help" aria-label="操作指南" title="操作指南">?</button>
<p id="switch-status" role="status">正在呈现模型…</p><iframe id="viewer" title="两轮车电池包交互展示" aria-labelledby="model-tab-0"></iframe>
<script>
const viewers=${data};
const frame=document.getElementById('viewer');let selected=-1;
function selectModel(index){if(index===selected)return;selected=index;document.body.classList.toggle('wheeler',index===0);document.body.classList.remove('ready');document.querySelectorAll('[data-model]').forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1});frame.title=viewers[index].name+'交互展示';frame.setAttribute('aria-labelledby','model-tab-'+index);frame.srcdoc=viewers[index].html;}
frame.addEventListener('load',()=>document.body.classList.add('ready'));
document.getElementById('gallery-help').addEventListener('click',()=>frame.contentDocument?.getElementById('help')?.click());
document.querySelectorAll('[data-model]').forEach((button,i)=>{button.addEventListener('click',()=>selectModel(i));button.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=(i+(e.key==='ArrowRight'?1:-1)+viewers.length)%viewers.length;selectModel(next);document.querySelector('[data-model="'+next+'"]').focus();}})});
selectModel(0);
</script></body></html>`;
}
