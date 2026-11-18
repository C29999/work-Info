'use strict';

// Reuse the three groups from the board SVG so the compact view cannot drift.
module.exports=function(doc,{data,style,E}){
  const links=[
    ['power-buck5','逻辑 5 V · U901'],
    ['power-servo5','舵机 5 V · U903'],
    ['power-buck33','主控 3.3 V · U902']
  ];
  const figures=links.map(([id,label])=>{
    const {x,y,w,h}=data.panels.find(p=>p.id===id);
    const drawing=doc.querySelector('#svg-board [data-panel="'+id+'"]').cloneNode(true);
    drawing.querySelectorAll('[data-net]').forEach(el=>{
      for(const key of ['role','tabindex','aria-label'])el.removeAttribute(key);
    });
    return `<section id="${id}" aria-label="${E(label)}"><div class="diagram"><svg viewBox="${x} ${y} ${w} ${h}" role="img" aria-label="${E(label)}">${drawing.outerHTML}</svg></div><a class="detail" href="原理图设计.html?module=${id}#schematic">在整板图中追踪网络 →</a></section>`;
  }).join('\n');
  return `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>三路 DC/DC 电源原理图 · Rev F</title>
<style>
${style}
body{margin:0;background:#eef3f7;color:#183448;font:16px/1.55 "Microsoft YaHei",system-ui,sans-serif}
main{max-width:1240px;margin:auto;padding:24px 16px 54px} h1{font-size:clamp(24px,4vw,36px);margin:.2em 0}
p{margin:6px 0;color:#455c6c} nav{display:flex;gap:8px 12px;flex-wrap:wrap;margin:18px 0 24px}
a{color:#075b78} nav a{background:#fff;border:1px solid #bdcbd7;border-radius:6px;padding:6px 12px;text-decoration:none}
a:hover{text-decoration:underline} section{margin-bottom:28px;scroll-margin-top:12px}
.diagram{overflow:auto;border-radius:7px} svg{display:block;width:100%;min-width:860px}
.net{cursor:inherit} .detail{display:inline-block;margin:6px 2px}
</style>
<main>
<header><p>${E(data.revision)} · 电气评审稿</p><h1>三路 DC/DC 电源原理图</h1>
<p>从左侧输入沿实线看向右侧输出。交叉线只有带圆点才连通。</p>
<nav aria-label="电源图目录">${links.map(([id,label])=>`<a href="#${id}">${E(label)}</a>`).join('')}<a href="原理图设计.html?module=power-input-6s#schematic">电池输入与保护</a></nav></header>
${figures}
</main></html>\n`;
};
