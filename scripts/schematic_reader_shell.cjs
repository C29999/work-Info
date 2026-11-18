// Reader chrome only: the circuit SVG and electrical records remain unchanged.
module.exports=function(doc,{data,E}){
 const sidebar=doc.querySelector('.sidebar'),toc=doc.querySelector('.toc'),main=doc.querySelector('.document-main');
 doc.title='无人船整板原理图 · 大图阅读器';
 doc.body.className='schematic-page reader-page';
 doc.querySelectorAll('head style,head link[rel="stylesheet"],.mobile-nav-toggle,.page-heading,.footer-line,.next-page').forEach(e=>e.remove());
 const notes=doc.createElement('dialog');notes.id='notes-dialog';notes.className='dialog notes-dialog';
 notes.innerHTML='<div class="dialog-heading"><h2>拓扑与设计依据</h2><button id="close-notes" aria-label="关闭资料">关闭</button></div>';
 for(const id of ['interconnect','p4-progress','reference-docs']){const e=doc.getElementById(id);if(e)notes.append(e);}
 doc.body.append(notes);
 sidebar.replaceChildren();
 sidebar.innerHTML='<div class="reader-side-head"><strong>图纸目录</strong><span>01 / 01</span></div><div class="nav-search"><input id="module-search" type="search" placeholder="查找模块 / MCU" aria-label="筛选模块目录"></div>';
 sidebar.append(toc);
 sidebar.insertAdjacentHTML('beforeend',`<p id="no-matches" hidden>没有匹配的模块</p><div class="reader-side-foot">一整张图 · 100 + 88 引脚<br><span>${E(data.revision)}</span></div>`);
 const opts=doc.getElementById('section').innerHTML;
 const drawing=doc.getElementById('view');
 const schematic=doc.getElementById('schematic');
 schematic.replaceChildren();
 schematic.innerHTML=`<div class="sheet-app"><div class="bar" role="toolbar" aria-label="原理图阅读工具"><div class="tool-group"><button id="minus" aria-label="缩小" title="缩小">−</button><label class="zoom-field"><input id="zoom-input" type="number" value="75" min="3" max="400" step="5" aria-label="缩放百分比"><span>%</span></label><span id="zoom" class="sr-only"></span><button id="plus" aria-label="放大" title="放大">＋</button></div><div class="tool-group"><button id="readable" title="以75%阅读当前区域">清晰阅读</button><button id="fit">整张</button></div><label class="locate-label">定位 <select id="section" aria-label="定位并高亮模块">${opts}<optgroup label="ESP32 烧录"><option value="flash-p4">P4 烧录 / 恢复</option><option value="flash-c5">C5 烧录预留（当前 NC）</option></optgroup></select></label><div class="tool-group quick-jumps"><button data-focus="mcu">STM32</button><button data-focus="p4-module">P4C5</button><button id="flash-btn" class="accent-button">ESP 烧录</button></div><button id="clear" title="清除网络与区域高亮">清除高亮</button></div><div class="hint" aria-live="polite"><span id="focus-dot"></span><strong id="focus-status">P4C5 · 清晰阅读</strong><span id="focus-note">定位后闪烁三次，保留边框</span><button id="replay-focus" title="再次闪烁当前定位">再闪一次</button></div></div>`;
 schematic.querySelector('.sheet-app').append(drawing);
 main.replaceChildren(schematic);
 const sheet=doc.getElementById('sheet'),overlay=doc.createElementNS('http://www.w3.org/2000/svg','svg');
 overlay.id='locate-overlay';overlay.setAttribute('viewBox',`0 0 ${data.sheets[0].width} ${data.sheets[0].height}`);overlay.setAttribute('aria-hidden','true');sheet.append(overlay);
 const header=doc.createElement('header');header.className='reader-header';
 header.innerHTML='<div class="reader-identity"><button id="sidebar-toggle" aria-controls="document-nav" aria-expanded="true" title="收起 / 展开目录">☰</button><div><h1>无人船整板原理图</h1><span>大图阅读器 <b>1 / 1</b></span></div></div><div class="reader-actions"><a href="无人船统一主板方案.html" class="back-link">返回 PCB 方案</a><button id="source-btn">依据</button><details id="export-menu"><summary>导出 ▾</summary><div class="export-popover"><button id="svg-download">整张 SVG</button><button id="bom">整板 BOM</button><button id="netlist">连接表 JSON</button><button id="print">打印整张 / 存为 PDF</button></div></details><button id="fullscreen" title="浏览器全屏" aria-pressed="false">⛶ 全屏</button></div>';
 doc.body.prepend(header);
 const footer=doc.createElement('footer');footer.className='reader-status';footer.innerHTML='<span id="status" role="status">点击网络追踪</span><span>拖动平移 · Ctrl + 滚轮缩放 · 双击网络看端点</span>';doc.body.append(footer);
 const flash=doc.createElement('dialog');flash.id='flash-dialog';flash.className='dialog flash-dialog';flash.innerHTML=require('./schematic_flashing_guide.cjs')();doc.body.append(flash);
 toc.insertAdjacentHTML('afterbegin','<a class="flash-shortcut" href="?module=flash-p4#schematic" data-module="flash-p4">◉ P4 烧录 / 恢复</a><a class="flash-shortcut" href="?module=flash-c5#schematic" data-module="flash-c5">◉ C5 烧录预留 · NC</a>');
 toc.insertAdjacentHTML('afterbegin','<a href="DCDC电源原理图.html">三路 DC/DC 电源图</a><a href="电池电压采样原理图.html">电池电压采样大图</a>');
 for(const a of toc.querySelectorAll('[data-section]:not([data-section="schematic"])'))a.dataset.notes=a.dataset.section;
 for(const a of toc.querySelectorAll('[data-module]')){const id=a.dataset.module;const domain=id.startsWith('s-')?id.slice(2):data.panels.find(p=>p.id===id)?.domain;a.dataset.color=domain||'p4';}
};
