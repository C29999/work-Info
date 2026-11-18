
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../design');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function diagram(file, prefix, crop) {
  let svg = read(file).match(/<svg\b[\s\S]*?<\/svg>/)[0];
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  for (const id of ids) {
    svg = svg.replaceAll('id="' + id + '"', 'id="' + prefix + id + '"')
      .replaceAll('url(#' + id + ')', 'url(#' + prefix + id + ')');
  }
  svg = svg.replace(/aria-labelledby="([^"]+)"/g, (_, s) => 'aria-labelledby="' + s.split(/\s+/).map(x => prefix + x).join(' ') + '"');
  if (crop) {
    svg = svg.replace('viewBox="0 0 1600 1500"', 'viewBox="0 100 1600 1325"');
    svg = svg.replace(/<text\b[^>]*\by="([\d.]+)"[^>]*>[\s\S]*?<\/text>/g,
      (text, y) => Number(y) < 100 || Number(y) > 1425 ? '' : text);
  } else {
    svg = svg.replace(/<text\b[^>]*\bdata-edit\b[^>]*>/g, tag =>
      tag.replace(/\sdata-edit(?:="[^"]*")?/, '').replace(/\stabindex="[^"]*"/, '')
        .replace(/\srole="button"/, '').replace(/\saria-label="[^"]*"/, ''));
  }
  return svg;
}
const board = diagram('无人船统一控制板可编辑版.html', 'board-', false);
let f4 = diagram('STM32F407引脚配置图.html', 'f4-', true);
let p4 = diagram('ESP32P4C5引脚配置图.html', 'p4-', true);
const configs = {
 f4: JSON.parse(read('STM32F407引脚配置数据.json')),
 p4: JSON.parse(read('ESP32P4C5引脚配置数据.json'))
};
const {buildDefinition} = require('./pin_definitions.cjs');
const definitions = {f4:buildDefinition(configs.f4,'f4'),p4:buildDefinition(configs.p4,'p4')};
function alignGroups(svg,key) {
  return svg.replace('role="img"','role="group"').replace(/<g class="pin-hit"[^>]*>/g, tag => {
    const pin = Number(tag.match(/data-pin="(\d+)"/)[1]);
    const entry = configs[key].definitionPins.find(p => p.pin === pin);
    return tag.replace(/data-group="[^"]*"/,'data-group="'+entry.group+'"').replace('role="button"','role="button" aria-pressed="false"');
  });
}
f4 = alignGroups(f4,'f4');
p4 = alignGroups(p4,'p4');
function pageInteractions() {
  const data = JSON.parse(document.getElementById('mcu-data').textContent);
  const select = document.getElementById('pin-filter');
  const dialog = document.getElementById('diagram-dialog');
  const viewport = document.getElementById('enlarged-view');
  const modalReadout = document.getElementById('modal-readout');
  let zoom = 1, activeSource = null;
  const selected = {f4:null,p4:null};

  function pinText(key, number) {
    return data[key].definitionPins.find(p => p.pin === Number(number))?.detail || '';
  }
  function pick(key, number) {
    const entry = data[key].definitionPins.find(p => p.pin === Number(number));
    if (!entry) return;
    selected[key] = Number(number);
    // One MCU key plus one physical pin number identifies every view, including the modal.
    document.querySelectorAll('[data-mcu="'+key+'"]').forEach(container => {
      container.querySelectorAll('.pin-hit').forEach(p => {
        const exact = p.dataset.pin === String(number);
        p.classList.toggle('selected', exact);
        p.classList.toggle('peer', !exact && entry.group !== 'unassigned' && p.dataset.group === entry.group);
        p.setAttribute('aria-pressed',String(exact));
      });
    });
    document.querySelectorAll('[data-readout="'+key+'"]').forEach(el => { el.textContent = pinText(key,number); });
    document.getElementById(key+'-definition-note').textContent = entry.note;
    if (dialog.open && activeSource?.dataset.mcu === key) {
      modalReadout.textContent = pinText(key, number)+'。'+entry.note;
    }
  }
  function bindPins(container, key) {
    container.addEventListener('click', e => {
      const pin = e.target.closest('.pin-hit');
      if (pin) pick(key, pin.dataset.pin);
    });
    container.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const pin = e.target.closest('.pin-hit');
      if (pin) { e.preventDefault(); pick(key, pin.dataset.pin); }
    });
  }
  document.querySelectorAll('[data-mcu]').forEach(el => bindPins(el, el.dataset.mcu));
  select.addEventListener('change', () => {
    document.querySelectorAll('.pin-hit').forEach(p => p.classList.toggle('dimmed', select.value === 'can' && p.dataset.group !== 'can'));
  });
  document.querySelectorAll('[data-locate]').forEach(button => button.addEventListener('click', () => {
    const target = document.querySelector('[data-diagram="'+button.dataset.locate+'"]');
    const number = selected[target.dataset.mcu];
    const pin = number && target.querySelector('[data-pin="'+number+'"]');
    (pin || target).scrollIntoView({behavior:'smooth',block:'center'});
    if (pin) pin.focus({preventScroll:true});
  }));
  function zoomTo(value) {
    const minimum = Math.min(.4, Math.max(.1, (viewport.clientWidth - 30) / 1300));
    zoom = Math.max(minimum, Math.min(2.5, value));
    const svg = viewport.querySelector('svg');
    if (svg) svg.style.width = Math.round(1300 * zoom) + 'px';
    document.getElementById('zoom-value').textContent = Math.round(zoom * 100) + '%';
  }
  document.querySelectorAll('[data-enlarge]').forEach(button => button.addEventListener('click', () => {
    activeSource = document.querySelector('[data-diagram="' + button.dataset.enlarge + '"]');
    const clone = activeSource.querySelector('svg').cloneNode(true);
    // Modal copies must not collide with any inline SVG.
    const renamed = new Map();
    clone.querySelectorAll('[id]').forEach(el => { const old = el.id; el.id = 'zoom-' + old; renamed.set(old, el.id); });
    [clone, ...clone.querySelectorAll('*')].forEach(el => {
      for (const attr of [...el.attributes]) {
        let value = attr.value;
        for (const [old, id] of renamed) value = value.replaceAll('url(#' + old + ')', 'url(#' + id + ')');
        if (attr.name === 'aria-labelledby') value = value.split(/\s+/).map(x => renamed.get(x) || x).join(' ');
        if (value !== attr.value) el.setAttribute(attr.name, value);
      }
    });
    const holder = document.createElement('div');
    holder.className = 'zoom-canvas';
    const key = activeSource.dataset.mcu;
    if (key) holder.dataset.mcu = key;
    holder.append(clone);
    viewport.replaceChildren(holder);
    if (key) bindPins(holder, key);
    document.getElementById('dialog-title').textContent = activeSource.dataset.title;
    modalReadout.textContent = key ? document.getElementById(key + '-readout').textContent : 'PCB 布局示意';
    dialog.showModal();
    if (key && selected[key] !== null) pick(key,selected[key]);
    document.body.classList.add('diagram-open');
    zoomTo(Math.min(1, (viewport.clientWidth - 30) / 1300));
    viewport.scrollLeft = viewport.scrollTop = 0;
  }));
  document.getElementById('zoom-in').addEventListener('click', () => zoomTo(zoom + .2));
  document.getElementById('zoom-out').addEventListener('click', () => zoomTo(zoom - .2));
  document.getElementById('zoom-fit').addEventListener('click', () => zoomTo((viewport.clientWidth - 30) / 1300));
  document.getElementById('dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('diagram-open');
    viewport.replaceChildren();
    activeSource = null;
  });
}
const styles = [
 ':root{--side:190px}.sidebar{padding:25px 12px}.brand{font-size:16px;padding:0 8px 20px}.brand small{font-size:10px}.document-main{max-width:none;padding:22px 26px 30px}.page-heading{margin-bottom:18px}.page-heading h1{font-size:25px}.section-card{margin-bottom:18px;border-radius:10px}.section-head{padding:14px 18px;align-items:center}.section-head h2{font-size:17px}.section-head .num{display:inline;color:#91a2b6;margin-right:8px;letter-spacing:0;font-weight:400}.section-actions{gap:8px}.button{cursor:pointer;padding:6px 10px}',
 '.board-drawing{max-width:740px;margin:0 auto;padding:0 14px 8px}svg{font-family:"Microsoft YaHei","Segoe UI",sans-serif}.board-drawing svg,.mcu-drawing svg{display:block;width:100%;height:auto}.pin-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:0;padding:0 14px 12px}.pin-card{border-radius:8px}.pin-card-head{padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px}.pin-card-head h3{font-size:15px;margin:0}.pin-card-head small{display:block;font-size:11px;color:#7d8ba0;font-weight:400}.mcu-drawing{padding:4px}.pin-readout{padding:9px 12px;min-height:42px;font-size:12px;line-height:1.7;background:#f8faff;border-top:1px solid #e2eaf4;color:#27558a}.pin-hit{cursor:pointer;outline:none}.pin-hit:hover .hit-area,.pin-hit:focus-visible .hit-area{fill:#d5e9ff}.pin-hit.selected .hit-area{fill:#ffdc7380}.pin-hit.peer .hit-area{fill:#badfff65}.pin-hit.dimmed{opacity:.18}.pin-hit.selected{opacity:1}.pin-filter{display:flex;align-items:center;gap:8px;font-size:12px;color:#667b93}.pin-filter select{border:1px solid #d3deeb;border-radius:6px;padding:5px 8px;background:#fff;color:#32567b}.pin-note{font-size:11px;color:#8190a3;line-height:1.6;padding:0 18px 12px;margin:0}.nav-foot{padding:20px 12px 0}.diagram-open{overflow:hidden}',
 '#diagram-dialog{width:96vw;max-width:1900px;height:94dvh;max-height:1100px;border:1px solid #cdd9e9;border-radius:10px;padding:0;color:#18314b;background:#fff}#diagram-dialog[open]{display:flex;flex-direction:column}#diagram-dialog::backdrop{background:#0a2249aa}.dialog-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #dae4f0}.dialog-toolbar h2{font-size:16px;margin:0}.zoom-tools{display:flex;align-items:center;gap:8px}#zoom-value{min-width:42px;text-align:center;font-size:12px;color:#6c7d93}#enlarged-view{overflow:auto;flex:1;min-height:0;background:#f2f6fa;padding:14px}.zoom-canvas{width:max-content;min-width:100%}.zoom-canvas svg{height:auto;display:block;margin:auto;background:white}#modal-readout{flex:none;margin:0;min-height:42px;padding:9px 16px;border-top:1px solid #dce6f1;font-size:12px;background:white}',
 '@media(max-width:1150px){:root{--side:170px}.sidebar{padding:22px 8px}.brand{font-size:14px}.brand-mark{display:none}.document-main{padding:20px 18px 28px}.pin-grid{gap:8px;padding:0 8px 10px}.pin-card-head{padding:8px}.pin-card-head h3{font-size:13px}}@media(max-width:760px){:root{--side:0px}.sidebar{width:235px}.document-main{padding:65px 10px 22px}.pin-grid{grid-template-columns:1fr}.section-head{flex-direction:row;align-items:center;flex-wrap:wrap;padding:12px}.page-heading h1{font-size:23px}.pin-card-head h3{font-size:15px}.brand-mark{display:grid}.board-drawing{padding:0 4px 6px}#diagram-dialog{width:98vw;height:96dvh}.dialog-toolbar{padding:9px}.zoom-tools{gap:5px}}@media print{.section-actions,.pin-filter,.pin-card-head button{display:none}.board-drawing{max-width:600px}.pin-grid{grid-template-columns:1fr 1fr}.pin-readout{display:none}.pin-note{color:#555}}'
, '.definition-drawing{padding:4px}.definition-drawing svg{display:block;width:100%;height:auto}.definition-card .pin-readout{border-bottom:1px solid #e2eaf4;border-top:0;min-height:55px}.definition-note{font-size:12px;line-height:1.65;margin:0;padding:10px 14px;color:#6f8196;min-height:55px}.pin-hit.selected .hit-area{fill:#ffe09b;stroke:#d99a29;stroke-width:2}.pin-hit.peer .hit-area{fill:#deebff}.pin-hit:focus-visible .hit-area{stroke:#1769e0;stroke-width:3}.pin-hit.dimmed.selected .hit-area{fill:#ffe09b}.pin-card-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.pin-legend{font-size:11px;color:#6e7d90}.pin-legend i{display:inline-block;width:9px;height:9px;margin:0 4px 0 10px;border-radius:2px}.pin-legend .exact{background:#efbe54}.pin-legend .related{background:#b7d1f9}'
].join('\n');
const html = [
 '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>无人船统一主板 · PCB 与双 MCU 引脚</title><link rel="stylesheet" href="硬件设计导航.css"><style>' + styles + '</style></head><body>',
 '<button class="mobile-nav-toggle" aria-controls="document-nav" aria-expanded="false">☰ 目录</button>',
 '<aside class="sidebar" id="document-nav"><a class="brand" href="无人船统一主板方案.html"><span class="brand-mark">▤</span><span>无人船统一主板<br><small>硬件设计</small></span></a><nav class="doc-nav" aria-label="设计文档"><a class="active" aria-current="page" href="无人船统一主板方案.html"><b>01</b> PCB 方案设计</a><a href="原理图设计.html"><b>02</b> 原理图设计</a></nav><div class="nav-label">本页</div><nav class="toc" aria-label="本页目录"><a href="#pcb-plan" data-section="pcb-plan">PCB 方案图</a><a href="#mcu-comparison" data-section="mcu-comparison">双 MCU 引脚</a><a href="#pin-definitions" data-section="pin-definitions">引脚定义图</a></nav><div class="nav-foot">Rev F · 2026.11.18</div></aside>',
 '<main class="document-main"><header class="page-heading"><h1>PCB 方案设计</h1></header>',
 '<section class="section-card" id="pcb-plan"><div class="section-head"><h2><span class="num">01</span> PCB 方案图</h2><div class="section-actions"><a class="button" href="无人船统一控制板可编辑版.html">编辑标注</a><button class="button" data-enlarge="board">放大方案图</button></div></div><div class="board-drawing" data-diagram="board" data-title="PCB 方案图">' + board + '</div></section>',
 '<section class="section-card" id="mcu-comparison"><div class="section-head"><h2><span class="num">02</span> 双 MCU 引脚</h2><label class="pin-filter" for="pin-filter">显示 <select id="pin-filter"><option value="all">全部引脚</option><option value="can">双 MCU CAN</option></select></label></div><div class="pin-grid">',
 '<article class="pin-card" id="pin-configuration"><div class="pin-card-head"><h3>STM32F407VET6<small>LQFP100 · 芯片脚号</small></h3><div class="pin-card-actions"><button class="button" data-locate="f4-def">定义 ↓</button><button class="button" data-enlarge="f4">放大</button></div></div><div class="mcu-drawing" data-diagram="f4" data-mcu="f4" data-title="STM32F407VET6 · 100 脚">' + f4 + '</div><div class="pin-readout" id="f4-readout" data-readout="f4" aria-live="polite">点击引脚：查看脚号、GPIO 与连接功能</div></article>',
 '<article class="pin-card" id="esp32-pin-configuration"><div class="pin-card-head"><h3>ESP32-P4C5<small>88 脚核心板 · 模块焊盘号</small></h3><div class="pin-card-actions"><button class="button" data-locate="p4-def">定义 ↓</button><button class="button" data-enlarge="p4">放大</button></div></div><div class="mcu-drawing" data-diagram="p4" data-mcu="p4" data-title="ESP32-P4C5 · 88 脚核心板">' + p4 + '</div><div class="pin-readout" id="p4-readout" data-readout="p4" aria-live="polite">点击引脚：查看脚号、GPIO 与连接功能</div></article></div>',
 '<p class="pin-note">IMU 使用成品模块，PB6 / PB7 接 I²C；PE0 / PE1 / PE2 已释放。F4 为 29 连接 + 1 预留；原五路 PWM 合并 J401 七针口，PA6 / PA7 新增两路舵机。逻辑 +5V 与舵机 +5V_SERVO 各自稳压、共地。ESP 按 P4C5 资料标注，实物 P4C3 待核对。USB + CSI + DVP 需 I²C 控制扩展器；P4 无空闲 GPIO，并行性能待实测。LED 由 STM32 控制；水下 RS485 用于控制 / 遥测，视频链路另定。</p></section>',

 '<section class="section-card" id="pin-definitions"><div class="section-head"><h2><span class="num">03</span> 引脚定义图</h2><span class="pin-legend">上下图同步 · <i class="exact"></i>当前引脚<i class="related"></i>同组接口</span></div><div class="pin-grid">',
 ...['f4','p4'].map(key => '<article class="pin-card definition-card"><div class="pin-card-head"><h3>'+(key==='f4'?'STM32F407 · 引脚定义':'ESP32-P4 · 引脚定义')+'</h3><div class="pin-card-actions"><button class="button" data-locate="'+key+'">上图 ↑</button><button class="button" data-enlarge="'+key+'-def">放大</button></div></div><div class="pin-readout" data-readout="'+key+'" aria-live="polite">点击定义项，与上方 MCU 同步高亮</div><div class="definition-drawing" data-diagram="'+key+'-def" data-mcu="'+key+'" data-title="'+(key==='f4'?'STM32F407':'ESP32-P4')+' · 引脚定义">'+definitions[key].svg+'</div><p class="definition-note" id="'+key+'-definition-note">点选查看连接说明。脚号与 GPIO 名称分别标注。</p></article>'),
 '</div></section></main>',
 '<dialog id="diagram-dialog" aria-labelledby="dialog-title"><div class="dialog-toolbar"><h2 id="dialog-title"></h2><div class="zoom-tools"><button class="button" id="zoom-out" aria-label="缩小">−</button><span id="zoom-value">100%</span><button class="button" id="zoom-in" aria-label="放大">＋</button><button class="button" id="zoom-fit">适合宽度</button><button class="button" id="dialog-close">关闭</button></div></div><div id="enlarged-view"></div><p id="modal-readout" aria-live="polite"></p></dialog>',
 '<script type="application/json" id="mcu-data">' + JSON.stringify(configs).replace(/</g, '\\u003c') + '</script>',
 '<script src="硬件设计导航.js"></script><script>(' + pageInteractions.toString() + ')();</script></body></html>'
].join('\n');
fs.writeFileSync(path.join(root, '无人船统一主板方案.html'), html, 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) throw new Error('Duplicate IDs: ' + duplicates.join(','));
if ((html.match(/<iframe\b/g) || []).length) throw new Error('Unexpected iframe');
for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
 if (!script[1].includes('application/json') && !script[1].includes('src=')) new Function(script[2]);
}
console.log(JSON.stringify({main:'无人船统一主板方案.html',svg:(html.match(/<svg\b/g)||[]).length,iframe:0,f4pins:(f4.match(/class="pin-hit"/g)||[]).length,p4pads:(p4.match(/class="pin-hit"/g)||[]).length,duplicateIDs:duplicates}));
