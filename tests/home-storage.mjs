// Browser acceptance checks. Supply PLAYWRIGHT_MODULE_PATH when Playwright lives
// in an external test runtime; no browser/testing dependency ships in the HTML.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'docs/screenshots');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
  headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1080 }, deviceScaleFactor: 1, offline: true });
const page = await context.newPage();
const errors = [], requests = [], checks = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', r => { if (/^https?:/i.test(r.url())) requests.push(r.url()); });
page.setDefaultTimeout(60000);
const snapshot = () => page.evaluate(() => window.batteryExplorer.snapshot());
async function settled() {
  await page.waitForFunction(() => {
    const s = window.batteryExplorer.snapshot();
    return s.explosion === s.displayedExplosion && s.parts.every(p => p.progress === p.target);
  }, null, { timeout: 60000 });
}
async function shot(name, fullPage = false) {
  await page.waitForFunction(() => !document.querySelector('#toast').classList.contains('show'));
  await page.screenshot({ path: path.join(output, `储能柜-${name}.png`), fullPage });
}
async function slider(value) {
  await page.locator('#explosion').fill(String(value));
  await settled();
}
const nonPlastic = s => s.materials.filter(m => m.kind !== 'plastic');
const approved = [
  ['p1', '①', '显示面板支架、塑料边框', 'BT-CS 阻燃系列（PC/ABS）、BT-PC 阻燃系列'],
  ['p2', '②', '电芯绝缘定位件、汇流排护罩', 'BT-PA66 阻燃增强系列'],
  ['p3', '③', 'BMS绝缘支架', 'BT-PA66 阻燃增强系列'],
  ['p4', '④', '穿墙连接器绝缘壳体', 'BT-PA66 阻燃增强系列，可按需求配色'],
];
try {
  await page.goto(pathToFileURL(path.join(root, 'release/户用储能电池柜-离线.html')).href);
  await page.waitForFunction(() => window.batteryExplorer?.snapshot().ready);
  await settled();
  const initial = await snapshot();
  assert.equal(initial.cellGeometry.levels, 2);
  assert.equal(initial.cellGeometry.shape, 'prismatic');
  assert.equal(await page.locator('.plastic-row').count(), 4);
  assert.equal(await page.locator('.plain-row .part-number').count(), 0);
  assert.equal(await page.locator('.reference-note').textContent(), '示意图，仅供参考');
  assert(!/\d+(?:\.\d+)?\s*(?:V|Ah|Wh|kWh)\b/.test(await page.locator('body').innerText()));
  await shot('初始展开');
  checks.push('两层方形电芯、四组塑料编号、无整包电压容量、免责声明');

  await page.locator('#assemble').click(); await settled();
  let s = await snapshot();
  assert(s.parts.every(p => p.progress === 0));
  assert(s.parts.every(p => p.position.every((n, i) => Math.abs(n - p.base[i]) < 1e-6)));
  await page.locator('[data-part="cabinet"]').click();
  await shot('组装');
  await slider(20); s = await snapshot();
  assert(s.parts.filter(p => p.phase === 'outside').every(p => p.progress > .5));
  assert(s.parts.filter(p => p.phase === 'inside').every(p => p.progress === 0));
  await slider(36); s = await snapshot();
  assert(s.parts.filter(p => p.phase === 'outside').every(p => p.progress === 1));
  assert(s.parts.filter(p => p.phase === 'inside').every(p => p.progress === 0));
  checks.push('整体拆解前段只移动外部壳件，内部随后展开；组装全部回到原位');

  await page.locator('#explode').click(); await settled();
  s = await snapshot();
  assert(s.parts.filter(p => p.phase === 'inside').every(p => p.progress === 1));
  await shot('完整拆解');
  const metalBaseline = nonPlastic(s);
  for (const [id, number, name, recommendation] of approved) {
    await slider(42);
    await page.locator(`[data-part="${id}"]`).click(); await settled();
    s = await snapshot();
    assert.equal(await page.locator('.detail-title').textContent(), number + name);
    assert.equal(await page.locator('.recommendation-copy').textContent(), recommendation);
    assert.deepEqual(s.highlightedIds, [id]);
    assert(s.parts.filter(p => p.selectionId === id).every(p => p.progress === 1));
    assert.deepEqual(nonPlastic(s), metalBaseline);
    await shot(`选中${number}`);
    await page.locator(`[data-part="${id}"]`).click(); await settled();
    s = await snapshot();
    assert(s.parts.filter(p => p.selectionId === id).every(p => p.progress === 0));
  }
  checks.push('①—④名称和推荐逐字一致、联动拆出、重复点击归位、非塑料材质保持');

  // Selecting a hidden internal plastic part first opens the enclosure.
  await page.locator('#assemble').click(); await settled();
  await page.locator('[data-part="p3"]').click(); await settled();
  s = await snapshot();
  assert(s.parts.filter(p => p.phase === 'outside').every(p => p.progress === 1));
  assert.equal(s.parts.find(p => p.id === 'bmsSupport').progress, 1);
  await page.locator('#assemble').click(); await settled();
  assert((await snapshot()).parts.every(p => p.progress === 0));
  checks.push('组装态选择内部塑料件先开壳，局部拆解后整体组装无残留位移');

  await slider(42);
  for (const id of ['cabinet', 'door', 'display', 'cells', 'busbar', 'pcb', 'contacts', 'wiring']) {
    const positions = (await snapshot()).parts.map(p => p.position);
    await page.locator(`[data-part="${id}"]`).click();
    s = await snapshot();
    assert.equal(s.selected, id); assert.deepEqual(s.highlightedIds, []);
    assert.equal(await page.locator('#part-detail .recommendation, #part-detail .detail-number').count(), 0);
    assert.deepEqual(s.parts.map(p => p.position), positions);
    assert.deepEqual(nonPlastic(s), metalBaseline);
  }
  checks.push('所有未编号部件只显示名称，不单独移动、不高亮、不改色');

  // Use real mouse clicks on visible mesh projections, rather than calling selectPart.
  await page.locator('#toggle-labels').click();
  let points = await page.evaluate(() => window.batteryExplorer.snapshot({ includePickPoints: true }).pickPoints);
  assert(points.p4, '橙色壳体必须有可见拾取点');
  await page.mouse.click(points.p4.x, points.p4.y); await settled();
  assert.equal((await snapshot()).selected, 'p4');
  const contactPositions = (await snapshot()).parts.filter(p => p.selectionId === 'contacts').map(p => p.position);
  points = await page.evaluate(() => window.batteryExplorer.snapshot({ includePickPoints: true }).pickPoints);
  assert(points.contacts, '金属端子必须有独立可见拾取点');
  await page.mouse.click(points.contacts.x, points.contacts.y); await settled();
  s = await snapshot();
  assert.equal(s.selected, 'contacts'); assert.deepEqual(s.highlightedIds, []);
  assert.equal(await page.locator('#part-detail').innerText(), '连接器金属端子');
  assert.deepEqual(s.parts.filter(p => p.selectionId === 'contacts').map(p => p.position), contactPositions);
  await page.locator('#toggle-labels').click(); await shot('金属端子');
  checks.push('实际画布点击区分橙色连接器和金属端子，拆壳不带走导电端子');

  const cameraBefore = (await snapshot()).camera;
  await page.locator('#zoom-in').click();
  assert.notDeepEqual((await snapshot()).camera, cameraBefore);
  await page.locator('#zoom-out').click();
  const view = await page.locator('#viewport').boundingBox();
  const beforeDrag = (await snapshot()).camera;
  await page.mouse.move(view.x + view.width * .3, view.y + view.height * .6);
  await page.mouse.down(); await page.mouse.move(view.x + view.width * .45, view.y + view.height * .62, { steps: 12 }); await page.mouse.up();
  assert.notDeepEqual((await snapshot()).camera, beforeDrag);
  await page.locator('#auto-rotate').click(); assert.equal((await snapshot()).autoRotate, true);
  await page.waitForTimeout(400); assert.notDeepEqual((await snapshot()).camera, beforeDrag);
  await page.locator('#auto-rotate').click(); assert.equal((await snapshot()).autoRotate, false);
  await page.locator('#help').click(); assert(await page.locator('#guide').isVisible());
  await page.locator('#close-guide').click(); assert(!(await page.locator('#guide').isVisible()));
  await page.locator('[data-view="front"]').click(); await page.waitForTimeout(1500);
  await slider(42); await shot('正视图');
  checks.push('旋转拖动、缩放、自动旋转、标注开关、正视图、指南弹窗');

  await page.locator('#reset').click(); await page.waitForTimeout(1500);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#explode').click(); await settled();
  await page.locator('[data-part="p2"]').click(); await settled();
  await page.evaluate(() => window.scrollTo(0, 0));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  for (const selector of ['#explode', '#assemble', '#explosion', '#toggle-labels', '#part-detail']) {
    const b = await page.locator(selector).boundingBox(); assert(b.x >= 0 && b.x + b.width <= 391, selector);
  }
  const primaryControl = await page.locator('#explode').boundingBox();
  assert(primaryControl.y + primaryControl.height < 844, '手机操作按钮应在首屏可见');
  await shot('手机布局', true);
  checks.push('390px 手机宽度布局无横向溢出，控制与材料推荐可访问');
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  checks.push('浏览器离线模式 file:// 直接打开，外部请求 0、脚本与控制台错误 0');
  await fs.writeFile(path.join(root, 'docs/储能柜验收.json'), JSON.stringify({ model: '户用储能电池柜', browser: await browser.version(), viewport: [1600, 1080], mobileViewport: [390, 844], transport: 'file://', offline: true, networkRequests: requests, errors, checks, limitations: ['手机为浏览器视口模拟，未在真实手机上测试', '未在另一台实体电脑上运行'] }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, checks, errors, externalRequests: requests }, null, 2));
} finally { await browser.close(); }
