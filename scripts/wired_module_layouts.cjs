'use strict';

const layouts=Object.create(null);
const refs=(prefix,from,count)=>Array.from({length:count},(_,i)=>prefix+(from+i));
const note=(m,y,...lines)=>m.d.noteLines(34,y,lines,17);
function stub(m,t,dir,len=40){
 if(t.n==='GND'){m.ground(t,t.x+dir*len,t.y+18);return;}
 m.end(t,dir,len);
}
function differential({u,c,r,t,j,can=false,notes}){
 return (m,b)=>{
  const {p,chip,plug,part,join,wire,ground,spine,end,label,dot}=m;
  const wide=b.w>1250, xs=wide?[330,400,1550]:[250,255,b.w-148], [cx,cw,jx]=xs;
  const yy=176,gap=41, chipPins=chip(u,cx,yy-90,cw,can?[1,4,3,2]:[1,4,2,3],can?[7,6,8,5]:[6,7,8,5],gap);
  const a=chipPins[can?7:6],bb=chipPins[can?6:7],tx=j?jx-24:jx-22, termX=wide?1100:b.w-282;
  for(const signal of [a,bb]){
   join(signal,p(signal.n,tx,signal.y));label(p(signal.n,tx-55,signal.y),'end');
   dot(termX,signal.y);
  }
  part(t,termX,yy,termX,yy+gap,{caption:false});
  m.d.text(termX,yy-35,t+' · 120Ω / DNP',15,'value','text-anchor="middle"');
  if(j){
   const conn=plug(j,jx,yy-52,120,'L',undefined,gap);
   if(conn[1].n!==a.n||conn[2].n!==bb.n)throw Error('diff port '+j);
   ground(conn[3],tx-20,conn[3].y+24);label(p('GND',tx-20,conn[3].y+24),'end',14,-12,0);
  }
  const [line1,line2]=can?[1,4]:[4,1];
  end(chipPins[line1],-1,105);end(chipPins[line2],-1,105);
  if(can){
   const v=chipPins[3],g=chipPins[2], x=66,y=342;
   wire(v.n,[v.x,v.y],[x-24,v.y]);label(p(v.n,x-24,v.y));dot(x,v.y);
   part(c,x,v.y,x,y);join(g,p('GND',x,y),[g.x-24,g.y],[g.x-24,y]);ground(p('GND',x,y));
   const rs=chipPins[8],rx=rs.x+45, ry=342;
   join(rs,p(rs.n,rx,rs.y));label(p(rs.n,rx,rs.y),'start',15,8,0);
   part(r,rx,rs.y,rx,ry);ground(p('GND',rx,ry));
  }else{
   const de=chipPins[2],x=148,y=342;
   spine(de.n,x,[chipPins[2],chipPins[3]]);dot(x,chipPins[3].y);label(p(de.n,x,de.y),'end',16,-7,-7);
   part(r,x,chipPins[3].y,x,y,{caption:'left'});ground(p('GND',x,y));
   const v=chipPins[8], g=chipPins[5], px=termX,py=342;
   join(v,p(v.n,px,v.y));label(p(v.n,px-28,v.y),'end');
   part(c,px,v.y,px,py);ground(p('GND',px,py));
   ground(g,g.x+24,g.y+23);
  }
  if(b.h<460)note(m,b.h-14,notes[0]);
  else note(m,b.h-62,...notes);
 };
}
layouts.can=differential({u:'U2',c:'C201',r:'R201',t:'R202',j:'J201',can:true,
 notes:['共用 CAN H/L；J201 是外部短支线。120Ω 只在物理端点装配；PD6 不接。']});
layouts['p4-can']=differential({u:'U702',c:'C711',r:'R711',t:'R712',can:true,
 notes:['CAN_H / CAN_L 与 F4 区、J201 同网；双主控不各自增加终端。']});
layouts.bms=differential({u:'U3',c:'C211',r:'R211',t:'R212',j:'J211',
 notes:['J211 只接 A、B 和参考地。端接、偏置、隔离和 ESD 按 BMS 与线缆定型。']});
layouts.ultrasonic=differential({u:'U4',c:'C501',r:'R513',t:'R514',
 notes:['A/B 接传感器区 J510–J514，五口共用一条总线。','DE 默认低；总线偏置、终端和线缆防护待核。']});
layouts.tether=differential({u:'U601',c:'C611',r:'R601',t:'R602',j:'J602',
 notes:['非隔离候选。长缆共模、浪涌、漏电、屏蔽与接地待核。','端接按物理拓扑选择；发完等待 UART TC 后释放 DE。']});

layouts['power-input-6s']=(m)=>{
 const {p,plug,part,join,rail,ground,label,dot,probe}=m;
 const j=plug('J901',60,124,220,'R',[1,2],45), y=j[1].y, g=340;
 const [f0,f1]=part('F901',540,y,930,y,{caption:'above'}),[d0,d1]=part('D901',1100,y,1510,y,{caption:'above'});
 join(j[1],f0);label(p(f0.n,366,y));join(f1,d0);label(p(f1.n,959,y),'start',16,0,20);
 const out=rail(d1.n,y,d1.x,1880,2320,2820,3350);label(out(3350),'end');
 const bottom=rail('GND',g,330,1880,2090,2320);
 part('D902',1880,y,1880,g,{reverse:true});
 part('C901',2320,y,2320,g);
 const tp=probe('TP901',2820,130);join(tp,out(2820));
 join(j[2],bottom(330),[330,j[2].y]);ground(bottom(2090));label(bottom(2108),'start',17,0,23);
 note(m,410,'电池输入先过 F901 和 D901；D902 与 C901 从保护后母线接地。该母线同时供两路 5 V 与电池采样。','保险、反接器件、TVS 钳位、输入浪涌与热损耗均待核；推进、灯和泵的功率另走外部驱动。');
};

layouts['power-ports']=(m)=>{
 const paths=[['P901', 'TP904'],['P902',null],['P903',null]];
 paths.forEach(([r,tp],i)=>{
  const x=38+555*i, j=m.plug(r,x+300,176,210,'L',undefined,46);
  m.end(j[1],-1,248);m.ground(j[2],x+233,330);
  m.label(m.p('GND',x+233,330),'end',15,-9,0);
  if(tp){const t=m.probe(tp,x+148,165);m.join(t,m.p(t.n,t.x,j[1].y));m.dot(t.x,j[1].y);}
 });
 const t5=m.probe('TP906',610,379),tg=m.probe('TP905',240,379);
 m.end(t5,1,165); m.ground(tg,290,425);
 note(m,475,'+5V 给逻辑与 U902；+5V_SERVO 只接舵机，不得并联或互相反灌。','J401 为五路 PWM 口；J407/J408 是舵机口。负载及接头电流配额待验证。');
};

layouts.power=(m)=>{
 const pwr=m.plug('PWR1',35,104,162,'R',undefined,32), q=227,y=156,g=308;
 const supply=m.rail('+3V3',y,q,276,391,506,621,736,851,968);
 m.join(pwr[1],supply(q));m.label(supply(342));
 const ground=m.rail('GND',g,q,276,391,506,621,736,851,968);
 m.join(pwr[2],ground(q),[q,pwr[2].y]);m.ground(ground(968));m.label(ground(958),'end',15,0,23);
 refs('C',101,7).forEach((r,i)=>m.part(r,276+115*i+(i===6?2:0),y,276+115*i+(i===6?2:0),g,{size:14}));
 const vc=[['C108',116],['C109',360],['C110',600],['C111',825]],top=391,bot=478;
 const va=m.rail('VDDA',top,561,600,825);m.label(va(561));
 const bg=m.rail('GND',bot,116,360,600,825);m.ground(bg(825));
 vc.forEach(([r,x],i)=>{
  const [a]=m.part(r,x,top,x,bot);if(i<2)m.label(a,'middle');
 });
 note(m,535,'六个 VDD 各自就近 100nF；VCAP1、VCAP2 分开，不作外部电源。','VBAT 接 +3V3，VREF+ 接 VDDA，VSS/VSSA 接 GND。');
};

layouts['p4-supply']=(m)=>{
 const p=m.p,z=160,g=354,xx=[85,245,405,565];
 const v=m.rail('+3V3',z,52,...xx,750);m.label(v(52));m.ground(m.rail('GND',g,...xx,750,920,1090)(85));m.label(p('GND',1070,g),'end',16,0,21);
 refs('C',701,4).forEach((r,i)=>m.part(r,xx[i],z,xx[i],g));
 m.part('R701',750,z,750,260);const en=m.rail('P4_EN',260,750,920,1090,1160);m.label(en(1160),'end');
 m.part('C705',920,260,920,g);m.part('SW701',1090,260,1090,g,{value:false,caption:'left'});
 note(m,438,'SW701 拉低 P4_EN，复位 P4 核心板及相机 I²C mux。','上电斜率、储能与 RC 取值待实测。');
};

layouts['p4-recovery']=(m)=>{
 const p=m.p,v=m.rail('+3V3',146,60,125,420);m.label(v(60));
 m.part('R721',125,146,125,258);m.part('R722',420,146,420,258);
 const boot=m.rail('P4_BOOT',258,125,242,301);m.label(boot(301),'end');m.label(p('P4_STRAP36',420,258),'start',16,11,4);
 m.part('SW702',242,258,242,352,{value:false});m.ground(p('GND',242,352));
 const x=[180,430,680];
 ['TP701','TP702','TP703'].forEach((r,i)=>m.end(m.probe(r,x[i],451),1,112));
 const j=m.plug('P_USB_DEBUG',932,155,235,'L',undefined,42);
 Object.values(j).forEach(t=>stub(m,t,-1,170));m.label(j[3],'end',15,-100,-6);
 note(m,570,'TP701/702 是下载恢复测试点；TP703 为复位。','USB Serial/JTAG 是逻辑预留，和 USB-HS 摄像头分开。');
};

layouts.pump=(m)=>{
 const {p,part,plug,end,join,rail,label,ground}=m;
 const j=plug('J603',1300,168,240,'L',undefined,58);
 const [a,b]=part('R621',380,j[1].y,730,j[1].y);
 end(a,-1,290);const sig=rail(b.n,b.y,b.x,940,j[1].x);label(sig(1100),'middle');
 part('R622',940,b.y,940,408);const g=rail('GND',408,940,1150,1200);
 join(j[2],g(1200),[1200,j[2].y]);ground(g(1150));label(g(1180),'start',16,0,23);
 note(m,482,'J603 只输出 3.3 V 控制及参考地；泵、灯、电机的功率走外部驱动板。','外部驱动板需要校核有效态、默认关断、过流和失联保护。');
};

layouts.pwm=(m)=>{
 const j=m.plug('J401',525,82,146,'L',undefined,30);
 m.end(j[1],-1,140);m.end(j[2],-1,140);
 for(let i=1;i<=5;i++){
  const q=j[i+2],[a]=m.part('R40'+i,186,q.y,j[i+2].x,q.y,{size:15,caption:'above'});m.end(a,-1,143);m.label(q,'end',14,-6,-8);
 }
 const led=m.plug('J406',920,79,110,'L',undefined,37),[a]=m.part('R406',781,led[1].y,led[1].x,led[1].y,{value:false,caption:'above'});
 m.end(a,-1,99);m.label(led[1],'end',14,-6,14);m.ground(led[2],led[2].x-45,led[2].y+20);
 m.d.text(751,234,'R406：100Ω',15,'value');
 note(m,363,'J401 的五路 PWM 及 J406 的 LED PWM 均为逻辑控制；禁止 5 V 反灌。');
};

layouts.servo=(m)=>{
 for(let i=1;i<=2;i++){
  const x=34+(i-1)*670, g=378;
  const q=m.plug('J40'+(6+i),x+496,108,130,'L',undefined,55);
  const [a,b]=m.part('R40'+(6+i),x+112,q[3].y,x+312,q[3].y,{caption:'above'});
  m.end(a,-1,99);m.join(b,q[3]);m.label(q[3],'end',15,-9,-8);
  const xx=x+356,cx=x+80;
  m.dot(xx,b.y);m.part(i===1?'R409':'R410',xx,b.y,xx,g,{caption:'left'});
  m.part('C40'+(6+i),cx,q[1].y,cx,235,{caption:'right',size:15});
  m.ground(m.p('GND',cx,235));
  const v=m.rail('+5V_SERVO',q[1].y,x+15,cx,q[1].x);m.label(v(x+15));
  const gn=m.rail('GND',g,xx,x+427);
  m.join(q[2],gn(x+427),[x+427,q[2].y]);m.ground(gn(xx));m.label(gn(x+427),'end',15,0,22);
 }
 note(m,467,'两路共用 TIM3 周期；3.3 V 信号电平、堵转峰值和舵机电源回流待验证。');
};


layouts['battery-sense']=(m)=>{
 const {p,chip,part,wire,join,end,ground,rail,label,spine,probe,dot}=m;
 const y=186,g=440;
 const sw=chip('U301',1780,y-90,410,[2,1,14,4,10,13,7],[3,5,6,8,9,11,12],36);
 const [a,b]=part('R301',252,y,430,y,{caption:'above'}),[a2,b2]=part('R307',550,y,728,y,{caption:'above'});
 end(a,-1,200);join(b,a2);label(p(b.n,492,y),'middle',16,0,-8);
 const div=rail(b2.n,y,b2.x,780,972,sw[2].x);label(div(1055),'end');
 part('R302',780,y,780,g,{caption:'left'});part('C301',972,y,972,g,{caption:'left'});
 ground(rail('GND',g,780,895,972)(895));label(p('GND',908,g),'start',15,0,23);
 const sup=chip('U303',1135,216,330,[3,1],[2],43);
 const v=rail('+3V3',sup[3].y,1030,1090,sup[3].x);label(v(1030));part('C304',1090,sup[3].y,1090,g,{caption:'left',size:14});
 ground(p('GND',1090,g));ground(sup[1],1110,374);
 const en=sw[1], tap=p(en.n,1515,en.y);
 join(sup[2],en,[1515,sup[2].y],[1515,en.y]);part('R306',1515,sup[2].y,1515,g,{caption:'left'});
 dot(1515,sup[2].y);ground(p('GND',1515,g));label(tap,'start',16,8,-7);
 const vv=rail('+3V3',sw[14].y,1565,1600,sw[14].x);label(vv(1565));part('C303',1600,sw[14].y,1600,g,{caption:'right',size:14});ground(p('GND',1600,g));
 const gl=spine('GND',1720,[4,10,13,7].map(n=>sw[n]));ground(gl(sw[7].y),1720,g);
 const gr=spine('GND',2280,[5,6,8,9,11,12].map(n=>sw[n]));ground(gr(sw[12].y),2280,g);
 const [i,o]=part('R303',2395,y,2570,y,{caption:'above'}),[i2,o2]=part('R304',2700,y,2880,y,{caption:'above'});
 join(sw[3],i);label(p(i.n,2313,y));join(o,i2);label(p(o.n,2633,y),'middle',16);
 const adc=rail(o2.n,y,o2.x,3030,3225,3450);label(adc(3450),'end');part('R305',3030,y,3030,g);
 ground(p('GND',3030,g));join(probe('TP301',3225,117),adc(3225));
 note(m,497,'V保护后 ≈ 12.0878 × VADC；25.2 V → 约 2.085 V。BAT_ADC 接 STM32 PC0 / pin15，建议上电等待至少 500 ms。','D902 / F901 是输入保护候选；超量程、TVS 钳位和断电反灌仍需台架核对。');
};

layouts.system=(m)=>{
 const {p,plug,part,join,end,ground,rail,label,probe,dot}=m;
 const swd=plug('J101',825,111,180,'L',[1,2,3,5,4],42);
 const [a,b]=part('R101',117,163,284,163,{caption:'above'});end(a,-1,77);end(b,1,94);
 const supply=rail('+3V3',swd[1].y,418,450,565,swd[1].x);label(supply(418));
 part('C112',450,swd[1].y,450,286,{caption:'left',size:15});ground(p('GND',450,286));
 part('R102',565,swd[1].y,565,swd[5].y,{caption:'left',size:15});
 const reset=rail('NRST',swd[5].y,565,610,724,swd[5].x);label(reset(754),'end');
 part('C113',610,swd[5].y,610,393,{caption:'left'});ground(p('GND',610,393));
 join(probe('TP102',724,366,-1),reset(724));
 end(swd[2],-1,129);end(swd[3],-1,129);ground(swd[4],779,swd[4].y+30);
 const y=417,g=520;
 const [cr0,cr1]=part('Y101',172,y,294,y,{caption:'above'});
 join(cr0,p(cr0.n,45,y));label(p(cr0.n,45,y));dot(120,y);part('C114',120,y,120,g);ground(p('GND',120,g));
 join(cr1,p(cr1.n,454,y));label(p(cr1.n,454,y),'end');dot(335,y);part('C115',335,y,335,g);ground(p('GND',335,g));
 const boot0=probe('TP101',515,416);
 join(boot0,p('BOOT0',540,451),[515,451]);dot(515,451);label(p('BOOT0',485,451));join(p('BOOT0',485,451),p('BOOT0',515,451));
 part('R103',540,451,540,g);ground(p('GND',540,g));
 const [boot1]=part('R104',760,446,760,g);label(boot1,'middle');ground(p('GND',760,g));
 note(m,566,'BOOT0 测试点可临时拉高；SWD 的 +3V3 是参考电压。晶体与负载电容待核。');
};

layouts.analog=(m)=>{
 const adc=m.plug('P_BAT_ADC',740,105,240,'L',undefined,44);
 const gps=m.plug('J301',740,229,240,'L',undefined,37);
 const sonar=m.plug('J302',740,382,240,'L',undefined,34);
 for(const [pins,last] of [[adc,2],[gps,3],[sonar,3]]){
  for(let i=1;i<last;i++)m.end(pins[i],-1,220);
  m.ground(pins[last],555,pins[last].y+10);
 }
 m.label(m.p('GND',555,211),'end',16,-12,-2);
 m.d.noteLines(35,164,['PC0 / ADC1_IN10：见电池采样区。','串数手动配置，曲线标定前只显示电压。'],16);
 m.d.noteLines(35,413,['GPS / 声纳仅列 UART 逻辑信号。','声纳若是 RS232/RS485，需另选收发器。'],16);
};

layouts['imu-module']=(m)=>{
 const {p,plug,part,join,end,ground,label,rail}=m;
 const j=plug('J601',1425,145,240,'L',undefined,78);
 const paths=[['JP601',4],['JP602',7],['JP603',6]];
 for(const [ref,no] of paths){
  const y=j[no].y,[a,b]=part(ref,440,y,770,y,{caption:'above'});
  end(a,-1,320);
  const out=rail(b.n,y,b.x,...no===4?[895,1105]:[],j[no].x);label(out(1260),'end',17);
  if(no===4){for(const [cap,x] of [['C601',895],['C602',1105]]){
   part(cap,x,y,x,552);ground(p('GND',x,552));
  }}
 }
 [3,5].forEach(no=>ground(j[no],1320,j[no].y+18));label(p('GND',1320,j[3].y+18),'end',15,-12,-2);
 note(m,857,'正常运行闭合 JP601/602/603；USB 单独调试前断开三个跳帽，避免 5 V 与 I²C 反灌。','模块自带 3.3 V 稳压和 I²C 上拉；P1-8 是模块 3.3 V 电源轨，本设计不接。','按 P1 定义接线；D1/D3、电气方向、模块内部型号和 I²C 地址还需核对。');
};

layouts['usb-camera']=(m)=>{
 const {p,chip,plug,part,rail,label,join,ground,end,dot}=m;
 const u=chip('U801',420,112,335,[5,4,2],[1,3],78);
 const j=plug('J802',1475,150,235,'L',undefined,64);
 const sv=rail('+5V',u[5].y,85,163,u[5].x);label(sv(85));
 part('C811',163,u[5].y,163,436);ground(p('GND',163,436));
 const e=rail(u[4].n,u[4].y,116,294,u[4].x);label(e(116));
 part('R811',294,u[4].y,294,436);ground(p('GND',294,436));
 ground(u[2],u[2].x-35,u[2].y+55);label(p('GND',u[2].x-35,u[2].y+55),'end',15,-11,-2);
 const out=rail(u[1].n,u[1].y,u[1].x,960,1130,j[1].x);label(out(1320),'end');
 for(const [r,x] of [['C812',960],['C813',1130]]){
  part(r,x,u[1].y,x,438);ground(p('GND',x,438));
 }
 const f=u[3],dest=p(f.n,894,573);
 join(f,dest,[842,f.y],[842,573]);label(dest,'start',16,12,4);
 part('R812',894,460,894,573);label(p('+3V3',894,460),'middle');
 end(j[2],-1,150);end(j[3],-1,150);ground(j[4],1350,j[4].y+31);
 const s=j[5],sp=p(s.n,1230,s.y);join(s,sp);label(sp);
 part('R813',1230,s.y,1230,596);ground(p('GND',1230,596));
 note(m,678,'D+/D− 是专用 USB-HS 差分线；J802 仅接 USB 摄像头，不接另一台主机。','限流、储能与热插拔待测；R813 默认不装，屏蔽壳接地与 ESD 仍待设计。');
};

layouts.sd=(m)=>{
 const {p,plug,part,rail,label,ground,end}=m;
 const j=plug('J801',1430,93,230,'L',['1','2','3','4','5','6','7','8','CD1','CD2'],55);
 const rs={'1':'R803','2':'R804','3':'R806','5':'R805','7':'R801','8':'R802','CD1':'R840'};
 Object.entries(rs).forEach(([no,r])=>{
  const q=j[no],[a]=part(r,680,q.y,q.x,q.y,{caption:'above'});
  end(a,-1,175);label(q,'end',15,-15,-8);
 });
 const y=j[4].y,[a,b]=part('R807',103,y,289,y,{caption:'above'});end(a,-1,64);
 const v=rail('SD_3V3',y,b.x,365,451,j[4].x);label(v(1010),'middle');
 for(const [r,x] of [['C801',365],['C802',451]]){
  part(r,x,y,x,643);ground(p('GND',x,643));
 }
 ground(j[6],1320,j[6].y+25);ground(j.CD2,1320,j.CD2.y+25);label(p('GND',1320,j.CD2.y+25),'end',15,-12,0);
 note(m,715,'所有 SD 信号与供电的 0Ω 链接默认不装；确认 P4 模块电压域后再装。','卡座 CD1/CD2 是检测开关端，插卡时闭合；实际焊盘按卡座料号。CLK 不加上拉。');
};

layouts['sd-pulls']=(m)=>{
 const xs=[110,365,620,875,1130,1385],v=m.rail('SD_3V3',129,53,...xs);
 m.label(v(53));
 refs('R',831,6).forEach((r,i)=>{
  const x=xs[i],[,b]=m.part(r,x,129,x,251);
  m.label(b,'middle',16,0,21);
 });
 ['R837','R838','R839'].forEach((r,i)=>{
  const x=168+575*i,[a,b]=m.part(r,x,359,x+340,359);
  m.end(a,-1,131);m.end(b,1,75);
 });
 note(m,427,'前三条相机电压域隔离链接默认不装；上方卡侧上拉按卡与模块确认。');
};

layouts['external-comms']=(m)=>{
 const {plug,p,part,rail,join,end,label,ground}=m;
 const j1=plug('J604',560,120,215,'L',undefined,45),j2=plug('J606',1425,120,215,'L',undefined,45);
 for(const j of [j1,j2]){end(j[1],-1,230);end(j[2],-1,230);ground(j[3],j[3].x-65,j[3].y+41);}
 const j=plug('J605',1425,393,215,'L',undefined,60);
 const y=j[1].y,[a,b]=part('R611',280,y,545,y,{caption:'above'});
 end(a,-1,186);
 const v=rail('RF_3V3',y,b.x,693,900,j[1].x);label(v(1210),'end');
 for(const [r,x] of [['C621',693],['C622',900]]){
  part(r,x,y,x,652);ground(p('GND',x,652));
 }
 ground(j[2],1185,j[2].y+18);
 for(let i=3;i<=8;i++)end(j[i],-1,332);
 note(m,975,'J604 / J606 是 3.3 V UART 候选，不带外设供电。RS232 / RS485 不可直接接入。','无线模块供电链接默认不装；模块型号、EN 有效态、供电配额和天线净空待定。');
};

layouts.sensors=(m)=>{
 const {p,plug,part,join,end,ground,rail,label,dot}=m;
 const imu=plug('P_IMU',315,107,188,'L',undefined,55);
 end(imu[1],-1,228);end(imu[2],-1,228);ground(imu[3],imu[3].x-52,imu[3].y+26);
 const dep=plug('J501',858,107,170,'L',[1,3,4,2],55);
 const v=rail('+3V3',dep[1].y,555,dep[1].x);label(v(555));
 for(const [r,no] of [['R501',3],['R502',4]]){
  const q=dep[no],[a]=part(r,588,q.y,q.x,q.y,{caption:'above'});join(a,v(555),[555,q.y]);label(q,'end',16,-4,21);
 }
 dot(555,dep[3].y);
 ground(dep[2],dep[2].x-53,dep[2].y+26);
 const ys=[454,494,534],nets=['USONIC_A','USONIC_B','GND'];
 const tees=nets.map((n,i)=>rail(n,ys[i],62,...refs('',0,5).map(k=>65+190*Number(k)+95+24+10*(i+1))));
 for(let i=0;i<3;i++)label(tees[i](62),'start',16,0,-10);
 for(let i=0;i<5;i++){
  const j=plug('J51'+i,65+190*i,615,95,'R',undefined,29);
  for(let n=1;n<=3;n++){
   const q=j[n],x=q.x+10*n;join(q,tees[n-1](x),[x,q.y]);
  }
 }
 note(m,853,'J510–J514 并接同一条 A/B 总线，参考地随线束；外设供电另行确认。','布线宜用主干加短支线，避免长星形支线；地址与协议按实物核对。','深度模块上拉按实际并联电阻核定；IMU 的总线跳帽见 IMU 模块。');
};

layouts['camera-control']=(m)=>{
 const {p,chip,part,join,wire,spine,ground,rail,end,label,dot}=m;
 const e=chip('U802',470,136,335,[14,15,16,1,2,3,8,13],[4,5,6,7,9,10,11,12],48);
 const s=chip('U803',470,655,335,[12,13,3,14,1,2,7],[5,6,9,10,4,8,11],48);
 const v=rail('+3V3',116,135,205,279);label(v(135));
 for(const [top,bottom,x,r] of [[e[14],s[12],205,'R822'],[e[15],s[13],279,'R821']]){
  const lane=spine(top.n,x,[top,bottom]);dot(x,top.y);
  part(r,x,116,x,top.y,{caption:'left',size:15});label(lane(bottom.y),'end',17,-8,-7);
 }
 const power=([supply,gs,c],x,yy)=>{
  const v=rail('+3V3',supply.y,x-38,x,supply.x);label(v(x-38));
  part(c,x,supply.y,x,yy,{caption:'right',size:15});ground(p('GND',x,yy));
  const cc=spine('GND',419,gs);ground(cc(gs.at(-1).y),419,yy);label(p('GND',419,yy),'end',14,-10,17);
 };
 power([e[16],[e[1],e[2],e[3],e[8]],'C821'],349,592);
 power([s[14],[s[1],s[2],s[7]],'C822'],349,1104);
 end(s[3],-1,88);
 for(const no of [4,5,6,7])end(e[no],1,435);
 const gx=[1060,1200,1340,1480],gg=rail('GND',624,...gx);
 [[9,'R851'],[10,'R852'],[11,'R853'],[12,'R854']].forEach(([no,r],i)=>{
  const t=e[no],x=gx[3-i],corner=p(t.n,x,t.y);
  join(t,corner);label(corner,'end',15);
  part(r,x,t.y,x,624,{caption:'right',size:15});
 });
 ground(gg(1480));
 const pull=[1060,1210,1360,1510],pv=rail('+3V3',676,1002,...pull);label(pv(1002));
 [[5,'R823'],[6,'R824'],[9,'R825'],[10,'R826']].forEach(([no,r],i)=>{
  const t=s[no],x=pull[i],tip=p(t.n,x+80,t.y);
  part(r,x,676,x,t.y,{size:14,caption:'right'});
  join(t,tip);dot(x,t.y);label(tip,'end',15,0,22);
 });
 const intr=spine('+3V3',1004,[s[4],s[8]]);
 label(intr(s[4].y),'start',16,13,4);
 note(m,1195,'U802：控制 RESET / PWDN；P4–P7 有 100k 下拉。U803：CSI 和 DVP 的 SCCB 各自分支。','两芯片共用 CAM_SCL/SDA；U803 /RESET 接 P4_EN。','这些上拉按 3.3 V 候选。相机电平、极性和上电时序必须按实际型号确认。');
};

module.exports=layouts;
