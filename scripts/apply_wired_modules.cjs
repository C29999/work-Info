'use strict';
const layouts=require('./wired_module_layouts.cjs');
const make=require('./wired_module_draw.cjs');

// Replace only the drawing under the existing panel header. The original
// generator still owns the connection table, descriptions and panel positions.
module.exports=function redraw(svg,panels,components,height){
 const starts=panels.map(p=>svg.indexOf(`<g id="${p.id}">`));
 const footer=svg.indexOf(`<text x="48" y="${height-71}"`,starts.at(-1));
 const sections=panels.map((p,i)=>{
  const start=starts[i],stop=starts[i+1]??footer;
  if(start<0||stop<=start)throw Error('Missing panel boundary: '+p.id);
  if(!layouts[p.id])return svg.slice(start,stop);
  const close=svg.indexOf('</g>',start);
  if(close<0||close>=stop)throw Error('Missing header close: '+p.id);
  const m=make(p,'',components.filter(c=>c.area===p.title));
  layouts[p.id](m,p);
  return svg.slice(start,close+4)+`\n<g data-wired-module="${p.id}" transform="translate(${p.x} ${p.y})">\n${m.finish()}\n</g>\n`;
 });
 return svg.slice(0,starts[0])+sections.join('')+svg.slice(footer);
};
