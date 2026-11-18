module.exports=function(){
const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let out=[],area='',components=[],panels=[];
const put=s=>out.push(s);
function text(x,y,s,size=19,cls='',extra=''){put(`<text x="${x}" y="${y}" font-size="${size}" class="${cls}" ${extra}>${E(s)}</text>`);}
function line(x1,y1,x2,y2,net=''){put(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wire"${net?` data-wire="${E(net)}"`:''}/>`);}
function dot(x,y){put(`<circle cx="${x}" cy="${y}" r="4" class="junction"/>`);}
function net(x,y,name,anchor='start',size=18,extra=''){if(name===null)return;put(`<text x="${x}" y="${y}" font-size="${size}" class="net" data-net="${E(name)}" data-area="${E(area)}" tabindex="0" role="button" aria-label="网络 ${E(name)}，${E(area)}" text-anchor="${anchor}" ${extra}>${E(name)}</text>`);}
function gnd(x,y){line(x,y,x,y+10);line(x-13,y+10,x+13,y+10);line(x-8,y+16,x+8,y+16);line(x-3,y+22,x+3,y+22);}
function component(ref,value,footprint,pins,note='',kind='physical'){if(components.some(c=>c.ref===ref))throw Error('Duplicate '+ref);components.push({ref,value,footprint,pins,note,kind,area});}
function panel(id,x,y,w,h,title,subtitle){area=title;panels.push({id,x,y,w,h,title});put(`<g id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" class="panel"/>`);text(x+22,y+38,title,27,'heading');text(x+22,y+69,subtitle,18,'muted');put('</g>');}
function cap(x,y,ref,value,n1,n2='GND',note='候选阻容；封装与耐压待BOM冻结'){
 component(ref,value,'0603候选',{'1':{name:'1',net:n1},'2':{name:'2',net:n2}},note);
 net(x,y-11,n1,'middle',16);line(x,y,x,y+33,n1);line(x-13,y+33,x+13,y+33);line(x-13,y+43,x+13,y+43);line(x,y+43,x,y+74,n2);if(n2==='GND')gnd(x,y+74);else net(x,y+96,n2,'middle',16);
 text(x+21,y+30,ref,16,'ref');text(x+21,y+54,value,16,'value');
}
function rv(x,y,ref,value,n1,n2,note='候选阻值'){
 component(ref,value,'0603候选',{'1':{name:'1',net:n1},'2':{name:'2',net:n2}},note);
 net(x,y-11,n1,'middle',16);line(x,y,x,y+20,n1);put(`<rect x="${x-8}" y="${y+20}" width="16" height="37" class="symbol"/>`);line(x,y+57,x,y+77,n2);if(n2==='GND')gnd(x,y+77);else net(x,y+97,n2,'middle',16);text(x+17,y+30,ref,16,'ref');text(x+17,y+54,value,16,'value');
}
function rh(x,y,ref,value,n1,n2,width=330,note='候选阻值'){
 component(ref,value,'0603候选',{'1':{name:'1',net:n1},'2':{name:'2',net:n2}},note);
 net(x,y-12,n1,'start',17);line(x,y,x+width/2-30,y,n1);put(`<rect x="${x+width/2-30}" y="${y-8}" width="60" height="16" class="symbol"/>`);line(x+width/2+30,y,x+width,y,n2);net(x+width,y-12,n2,'end',17);text(x+width/2,y+30,ref+'  '+value,16,'value','text-anchor="middle"');
}
function conn(x,y,ref,title,names,opts={}){
 const width=opts.width||175,step=opts.step||28,first=opts.compact?47:66,height=first+(names.length-1)*step+(opts.compact?8:14);
 component(ref,title,opts.virtual?'跨页端口，无物理封装':'连接器待选',Object.fromEntries(names.map((n,i)=>[i+1,{name:n.label||n,net:typeof n==='string'?n:n.net}])),opts.note||'连接器针序为本项目定义，未承诺与外部成品模块兼容',opts.virtual?'page-port':'physical');
 put(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" class="${opts.virtual?'port':'connector'}"/>`);
 text(x+10,y+(opts.compact?15:23),ref,opts.compact?13:19,'ref');text(x+10,y+(opts.compact?32:46),title,opts.compact?11:16,'muted');
 names.forEach((entry,i)=>{let n=typeof entry==='string'?entry:entry.net,label=entry.label||String(i+1),yy=y+first+i*step; text(x+12,yy+4,label,opts.compact?13:15,'pin');line(x+width-20,yy,x+width+20,yy,n);dot(x+width-20,yy);if(n)net(x+width+28,yy+4,n,'start',opts.compact?14:17);else text(x+width+28,yy+4,'NC',16,'nc');});
}
function testpoint(x,y,ref,name){
 component(ref,name+'测试点','测试点候选',{'1':{name:'1',net:name}},'测试夹具入口；不加专用串口');
 put(`<circle cx="${x}" cy="${y}" r="7" class="symbol"/>`);line(x,y+7,x,y+26,name);net(x+18,y+6,name,'start',16);text(x-14,y-13,ref,16,'ref');
}
function ic(x,y,w,h,ref,value,left,right,footprint,note='候选器件；外围与布局仍需审查'){
 component(ref,value,footprint,Object.fromEntries([...left,...right].map(p=>[p[0],{name:p[1],net:p[2]}])),note);
 put(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="chip"/>`);text(x+w/2,y+29,ref,22,'ref','text-anchor="middle"');text(x+w/2,y+57,value,20,'heading','text-anchor="middle"');
 const step=(h-100)/Math.max(left.length-1,right.length-1,1);
 left.forEach(([no,n,nn],i)=>{let yy=y+90+i*step;line(x-26,yy,x,yy,nn);text(x+10,yy+5,`${no} ${n}`,17,'pin');if(nn)net(x-35,yy+5,nn,'end',17);else{text(x-35,yy+5,'NC',16,'muted','text-anchor="end"');line(x-32,yy-6,x-20,yy+6);line(x-32,yy+6,x-20,yy-6);}});
 right.forEach(([no,n,nn],i)=>{let yy=y+90+i*step;line(x+w,yy,x+w+26,yy,nn);text(x+w-10,yy+5,`${n} ${no}`,17,'pin','text-anchor="end"');if(nn)net(x+w+35,yy+5,nn,'start',17);else{text(x+w+35,yy+5,'NC',16,'muted');line(x+w+20,yy-6,x+w+32,yy+6);line(x+w+20,yy+6,x+w+32,yy-6);}});
}
function noteLines(x,y,lines,size=18){lines.forEach((s,i)=>text(x,y+i*28,s,size,'muted'));}

return {put,text,line,dot,net,gnd,component,panel,cap,rv,rh,conn,testpoint,ic,noteLines,output:()=>out.join('\n'),components,panels};
};
