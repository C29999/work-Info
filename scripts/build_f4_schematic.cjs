const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../design');
const pinData=JSON.parse(fs.readFileSync(path.join(root,'STM32F407引脚配置数据.json'),'utf8'));
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
 component(ref,title,opts.footprint||(opts.virtual?'跨页端口，无物理封装':'连接器待选'),Object.fromEntries(names.map((n,i)=>[i+1,{name:opts.pinNames?.[i]||n.label||n,net:typeof n==='string'?n:n.net}])),opts.note||'连接器针序为本项目定义，未承诺与外部成品模块兼容',opts.virtual?'page-port':'physical');
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
put(`<svg id="sheet" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3600 2546" role="img" aria-label="无人船统一主板 STM32F407VET6 主控与接口原理图 Rev F"><style>.panel{fill:#fff;stroke:#bdcbd7;stroke-width:2}.chip{fill:#f2f7fd;stroke:#2c536f;stroke-width:2.2}.connector{fill:#f6fafc;stroke:#2c536f;stroke-width:2}.port{fill:#fff8ed;stroke:#a87932;stroke-width:2;stroke-dasharray:7 4}.wire,.symbol{stroke:#286756;stroke-width:2;fill:none}.symbol{fill:#fff}.junction{fill:#286756}.heading{fill:#164e78;font-weight:700}.muted{fill:#586d7e}.ref{fill:#153a57;font-weight:700}.pin,.value{fill:#244b60}.net{fill:#176b78;cursor:pointer}.net.selected{fill:#a13617;paint-order:stroke;stroke:#ffdf72;stroke-width:8;stroke-linejoin:round}.wire.selected{stroke:#e27225;stroke-width:4}.net:focus{outline:none;paint-order:stroke;stroke:#ffd775;stroke-width:8}text{font-family:'Microsoft YaHei','Segoe UI',sans-serif;fill:#183448}.net,.pin,.value{font-family:Consolas,'Microsoft YaHei',monospace}.nc{fill:#9aa8b4}</style><rect width="3600" height="2546" fill="#fff"/><rect x="18" y="18" width="3564" height="2510" rx="5" fill="none" stroke="#9db3c5" stroke-width="2"/>`);
text(48,77,'无人船统一主板 · STM32F4 主控与接口原理图',40,'heading');
text(48,119,'STM32F407VET6 · LQFP100 · 经典 CAN · 五路驱动 PWM + 两路舵机 + LED PWM · 6S BMS RS485 · AIS UART5',22,'muted');
text(3550,75,'Rev F / 2026-11-18',27,'heading','text-anchor="end"');text(3550,116,'01 · 主控页 / 方案评审稿',22,'muted','text-anchor="end"');

// 01: all six VDD pins, two independent VCAP capacitors, analog and backup supplies.
panel('power',40,160,1040,570,'01  F4 供电与去耦','本页输入为稳压 +3V3；6S 输入保护 / DC-DC 在电源页设计。');
component('PWR1','电源页端口','跨页端口，无物理封装',{'1':{name:'+3V3',net:'+3V3'},'2':{name:'GND',net:'GND'}},'电源页提供稳定3.3V','page-port');
put('<rect x="70" y="253" width="970" height="46" rx="4" class="port"/>');text(84,283,'PWR1 · 电源页端口',18,'ref');line(470,276,510,276,'+3V3');net(520,282,'+3V3');line(760,276,800,276,'GND');net(810,282,'GND');
[11,19,28,50,75,100].forEach((p,i)=>cap(92+i*160,340,'C'+(101+i),'100nF','+3V3','GND','分别靠近U1.'+p+'；有效电容量与耐压按数据手册'));
text(70,465,'C101–C106：六个 VDD 各自就近 100nF；C107 为公共储能。',18,'muted');
cap(92,500,'C107','4.7µF','+3V3');cap(310,500,'C108','2.2µF','VCAP1','GND','DS8626 Rev12 p84 表16：2.2µF，ESR<2Ω；料号/有效容量待定');cap(530,500,'C109','2.2µF','VCAP2','GND','DS8626 Rev12 p84 表16：2.2µF，ESR<2Ω；料号/有效容量待定');
cap(750,500,'C110','1µF','VDDA');cap(930,500,'C111','100nF','VDDA');
text(70,654,'VCAP1 / 2 各自去耦到 GND，不互连，不作外部电源。',18,'muted');
text(70,688,'VBAT→+3V3（无后备电池）；VREF+→VDDA；所有 VSS / VSSA→GND。',18,'muted');

// 02: clock, reset, boot, SWD, analog rail link.
panel('system',40,750,1040,580,'02  时钟 / 复位 / 启动 / SWD','SWD 承担首次下载与断点；CAN 承担运行诊断，不增加 UART 调试口。');
rh(75,865,'R101','0Ω','+3V3','VDDA',370,'模拟电源支路；磁珠替代需结合噪声与压降设计');
cap(110,940,'C112','100nF','+3V3','GND','靠近VBAT pin6');
rv(310,940,'R102','10k','+3V3','NRST');cap(485,940,'C113','100nF','NRST');
rv(680,940,'R103','10k','BOOT0','GND');rv(880,940,'R104','10k','BOOT1','GND');
conn(700,1090,'J101','SWD / VTref',['+3V3','SWDIO','SWCLK','GND','NRST'],{width:165,step:25,note:'项目自定义1x5针序；+3V3是目标参考电压，不给目标板反向供电'});
// crystal, load capacitors are expressly unfrozen.
component('Y101','8MHz 候选','2端晶体，封装待选',{'1':{name:'1',net:'HSE_IN'},'2':{name:'2',net:'HSE_OUT'}},'频率候选；晶体料号/CL/ESR及负阻验证未定');
net(75,1120,'HSE_IN');line(75,1134,235,1134,'HSE_IN');line(235,1118,235,1150);put('<rect x="247" y="1117" width="42" height="34" class="symbol"/>');line(301,1118,301,1150);line(301,1134,500,1134,'HSE_OUT');net(500,1120,'HSE_OUT','end');text(265,1100,'Y101 · 8MHz 候选',17,'value','text-anchor="middle"');
cap(110,1190,'C114','CL待定','HSE_IN');cap(360,1190,'C115','CL待定','HSE_OUT');
text(575,865,'BOOT0：测试夹具可临时拉高到 +3V3',18,'muted');
testpoint(595,907,'TP101','BOOT0');testpoint(965,907,'TP102','NRST');
text(575,1062,'NRST 经 SWD/测试点可外部拉低复位。',18,'muted');

// 03: the complete voltage-sense circuit lives in its own board region.
panel('analog',40,1350,1040,550,'03  电池 ADC / GPS / 声纳业务口','PC0采集保护后母线的单路电压；完整分压与断电开关见电池采样区。');
conn(80,1480,'P_BAT_ADC','电池采样跨区口',[{label:'ADC',net:'BAT_ADC'},{label:'GND',net:'GND'}],{virtual:true,width:205,step:32,note:'PC0 / pin15 / ADC1_IN10；来自电池采样区R304输出，MCU与电池共地；仅粗略SOC，不测电流或容量'});
noteLines(375,1510,['3S / 4S / 6S 配置不可自动猜测；', '放电曲线未标定前只显示电压。', '电源启停与过压瞬态待台架核对。'],18);
conn(80,1740,'J301','GPS / 水面',['GPS_TX','GPS_RX','GND'],{width:165,step:26});
conn(590,1740,'J302','声纳候选 TTL',['SONAR_TX','SONAR_RX','GND'],{width:190,step:26,note:'仅3V3 UART逻辑接口，供电未接；若模块为RS232/RS485需另增收发器'});

// 04: Central symbol follows the user-provided symbol orientation, not footprint view.
panel('mcu',1100,160,1380,1740,'04  U1 · STM32F407VET6 / LQFP100','100 个物理脚完整对应；GPIO/AF 来自 ST 管脚数据，连接为本项目候选。');
// AIS reserves logic signals only; no unverified physical interface or supply is invented.
conn(1140,270,'P_AIS','AIS 电气层待定',[{label:'TX',net:'AIS_TX'},{label:'RX',net:'AIS_RX'}],{virtual:true,compact:true,width:175,step:25,note:'仅MCU侧UART5逻辑跨页端口：PC12/pin80 TX、PD2/pin83 RX，均AF8。AIS型号、方向、波特率、协议及供电待定；TTL/RS232/RS422/RS485物理层未锁，无实物连接器或收发器。'});
noteLines(1500,291,['AIS · UART5：PC12 / 80 TX、PD2 / 83 RX，AF8。','仅逻辑跨页预留；不能直连外部差分线或 RS232 电压。','模块型号、方向、波特率、协议、供电与物理层待确认。'],18);
const routeNets={PB6:'IMU_SCL',PB7:'IMU_SDA',PB10:'DEPTH_SCL',PB11:'DEPTH_SDA',PD8:'USONIC_TX',PD9:'USONIC_RX',PD10:'USONIC_DE',PA9:'GPS_TX',PA10:'GPS_RX',PA13:'SWDIO',PA14:'SWCLK',PE9:'PWM1',PE11:'PWM2',PE13:'PWM3',PE14:'PWM4',PE5:'PWM5',PB8:'LED_PWM',PA6:'SERVO1',PA7:'SERVO2',PA2:'BMS_TX',PA3:'BMS_RX',PD4:'RS485_DE',PC10:'SONAR_TX',PC11:'SONAR_RX',PC12:'AIS_TX',PD2:'AIS_RX',PD0:'CAN_RX',PD1:'CAN_TX',PC0:'BAT_ADC'};
const pinName=p=>p.name.match(/^P[A-I]\d+/)?.[0]||p.name;
function mcuNet(p){const n=pinName(p);return routeNets[n]||({VDD:'+3V3',VSS:'GND',VBAT:'+3V3',VDDA:'VDDA',VSSA:'GND','VREF+':'VDDA',VCAP1:'VCAP1',VCAP2:'VCAP2',VCAP_1:'VCAP1',VCAP_2:'VCAP2',BOOT0:'BOOT0',PB2:'BOOT1',NRST:'NRST',PH0:'HSE_IN',PH1:'HSE_OUT'}[n])||null;}
component('U1','STM32F407VET6','LQFP100',Object.fromEntries(pinData.pins.map(p=>[p.pin,{name:p.name,net:mcuNet(p)}])),'100脚物理编号与AF已核验；未连接GPIO为本版NC，PD6仅预留');
const bx=1435,by=630,bw=710,bh=710,offset=100,pitch=21.25;
put(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" class="chip"/><circle cx="${bx+18}" cy="${by+bh-18}" r="5" fill="#1769e0"/>`);
for(const p of pinData.pins){
 const no=+p.pin,name=pinName(p),nn=mcuNet(p),label=nn||'NC';let x,y;
 put(`<g data-mcu-pin="${no}"><title>${E(`#${no} ${p.name} → ${nn||'NC（未连接）'}`)}</title>`);
 if(no<=25){x=bx+offset+(no-1)*pitch;line(x,by+bh,x,by+bh+24,nn);text(x+5,by+bh-16,name,17,'pin',`transform="rotate(-90 ${x+5} ${by+bh-16})"`);text(x,by+bh+44,no,14,'muted','text-anchor="middle"');if(nn)net(x+5,by+bh+63,nn,'start',17,`transform="rotate(90 ${x+5} ${by+bh+63})"`);else text(x+5,by+bh+63,label,15,'nc',`transform="rotate(90 ${x+5} ${by+bh+63})"`);}
 else if(no<=50){y=by+bh-offset-(no-26)*pitch;line(bx+bw,y,bx+bw+24,y,nn);text(bx+bw-12,y+5,name,17,'pin','text-anchor="end"');text(bx+bw+40,y+4,no,14,'muted','text-anchor="middle"');if(nn)net(bx+bw+62,y+5,nn);else text(bx+bw+62,y+5,label,15,'nc');}
 else if(no<=75){x=bx+bw-offset-(no-51)*pitch;line(x,by,x,by-24,nn);text(x-4,by+16,name,17,'pin',`transform="rotate(90 ${x-4} ${by+16})"`);text(x,by-34,no,14,'muted','text-anchor="middle"');if(nn)net(x+5,by-53,nn,'start',17,`transform="rotate(-90 ${x+5} ${by-53})"`);else text(x+5,by-53,label,15,'nc',`transform="rotate(-90 ${x+5} ${by-53})"`);}
 else {y=by+offset+(no-76)*pitch;line(bx,y,bx-24,y,nn);text(bx+12,y+5,name,17,'pin');text(bx-40,y+4,no,14,'muted','text-anchor="middle"');if(nn)net(bx-62,y+5,nn,'end');else text(bx-62,y+5,label,15,'nc','text-anchor="end"');}
 put('</g>');
}
text(1790,910,'U1',40,'ref','text-anchor="middle"');text(1790,960,'STM32F407VET6',34,'heading','text-anchor="middle"');text(1790,1005,'LQFP100 · 100 脚',26,'muted','text-anchor="middle"');text(1790,1060,'底 1→25  /  右 26→50',22,'muted','text-anchor="middle"');text(1790,1099,'顶 51→75  /  左 76→100',22,'muted','text-anchor="middle"');text(1790,1155,'按用户原理图符号方向',20,'heading','text-anchor="middle"');
noteLines(1140,1640,['29 GPIO 已连接 + PD6 预留 = 30 GPIO 预算；PD6 本版 NC。','PC14/PC15 未接 LSE；PB2 固定 BOOT1 下拉，不计自由扩展。','PWM1–4：TIM1 共周期；PWM5：TIM9；舵机：TIM3；LED：TIM10。','NC 表示本版不接。这里是原理图符号，不是 PCB 封装顶视图。','UART 5/6；AIS 用 UART5；TX/RX 均以 STM32 方向命名。','ESP32-P4、摄像头、SD、UART雷达、线缆通信在 P4 页继续。'],21);

// 05 CAN physical layer and optional end termination. PD6 deliberately not wired to Rs.
panel('can',2500,160,1060,410,'05  STM32 CAN1 · 双 MCU + USB-CAN','PD1 / 82 TX · PD0 / 81 RX · AF9；ESP32-P4模块 经另一收发器接入。');
ic(2720,258,325,220,'U2','SN65HVD230D',[[1,'D','CAN_TX'],[4,'R','CAN_RX'],[3,'VCC','+3V3'],[2,'GND','GND']],[[7,'H','CAN_H'],[6,'L','CAN_L'],[8,'Rs','CAN_RS'],[5,'Vref',null]],'SOIC-8','TI pin functions；高速模式Rs通过0Ω到GND');
cap(2590,425,'C201','100nF','+3V3');rv(3170,425,'R201','0Ω','CAN_RS','GND');
conn(3295,255,'J201','CAN总线',['CAN_H','CAN_L','GND'],{width:100,step:25,note:'1 CAN_H / 2 CAN_L / 3 GND；共用经典CAN总线的外部短支线口，不提供电源；P4侧另接收发器'});
rh(3280,475,'R202','120Ω / DNP','CAN_H','CAN_L',230,'只在物理总线端点装配；全总线恰好两端各一个终端');
text(2730,527,'J201 共用总线 · ESP32-P4模块 / USB-CAN；PD6 NC，终端仅两端。',17,'muted');

// 06 RS485 BMS, product pins verified to ADI and not vendor substituted.
panel('bms',2500,590,1060,430,'06  电池 BMS · USART2 / RS485','U3 为 ADI MAX3485ESA+ 候选；不能当作已核验的 UMW 替代料。');
ic(2730,688,320,230,'U3','MAX3485ESA+',[[1,'RO','BMS_RX'],[2,'/RE','RS485_DE'],[3,'DE','RS485_DE'],[4,'DI','BMS_TX']],[[8,'VCC','+3V3'],[7,'B','BMS_B'],[6,'A','BMS_A'],[5,'GND','GND']],'SOIC-8','3V3半双工；PD4低接收、高发送');
rv(2550,875,'R211','10k','RS485_DE','GND');cap(3150,875,'C211','100nF','+3V3');
conn(3295,685,'J211','BMS485',['BMS_A','BMS_B','GND'],{width:100,step:25});
rh(3280,900,'R212','120Ω / DNP','BMS_A','BMS_B',230,'按BMS端终端及实际线长决定，不能每节点均加');
text(2740,966,'仅通信，不从本口送 6S；A/B 极性以 BMS 手册确认。',17,'muted');
text(2740,994,'外部口 TVS / 偏置 / 隔离待线缆与 BMS 电气规格补齐。',17,'muted');

// 07 five PWM outputs in a single connector; LED retains its own port.
panel('pwm',2500,1040,1060,380,'07  五路 PWM 七针口 + LED','J401：1=5V、2=GND、3～7=PWM1～5；信号3.3V，5V禁止反灌。');
for(let i=1;i<=5;i++) rh(2530,1148+(i-1)*48,'R'+(400+i),'100Ω','PWM'+i,'PWM'+i+'_OUT',270,'串联阻尼候选；按驱动输入及线长核定');
conn(2870,1130,'J401','五路驱动 · 1×7',[{label:'1 VCC',net:'+5V'},{label:'2 GND',net:'GND'},...[1,2,3,4,5].map(i=>({label:(i+2)+' PWM'+i,net:'PWM'+i+'_OUT'}))],{compact:true,width:175,step:27,note:'本项目针序1=逻辑+5V输出/参考，2=GND，3～7=PWM1～5；信号为3.3V。禁止外部5V反灌；连接器配额待预算，不承载电机功率。'});
rh(3200,1160,'R406','100Ω','LED_PWM','LED_PWM_OUT',290,'LED外部驱动控制，非灯功率');
conn(3220,1225,'J406','LED调光',[{label:'1 SIG',net:'LED_PWM_OUT'},{label:'2 GND',net:'GND'}],{compact:true,width:135,step:30,footprint:'1x2待选',pinNames:['SIG','GND'],note:'控制信号3V3；非功率输出'});
text(2530,1400,'接口电流、启动/失联安全脉宽与驱动板 EN/FAULT 联锁待确认。',17,'muted');

// 08 IMU/depth and five connectors on ONE independent ultrasonic RS485 bus.
panel('sensors',2500,1440,1060,980,'08  传感器端口 / 五个 RS485 超声波','IMU 与深度用 I²C；超声波共一条独立 A/B 总线，模块供电待定。');
conn(2530,1535,'P_IMU','IMU 模块跨页口',['IMU_SCL','IMU_SDA','GND'],{virtual:true,width:160,step:25,note:'整板接口页J601连接模块P1：7 SCL / 6 SDA / 4受控5V / 3与5 GND；不再假定裸芯片INT/DRDY/RSTN'});
conn(3100,1535,'J501','深度 I²C',['+3V3','GND','DEPTH_SCL','DEPTH_SDA'],{width:150,step:25});
text(3100,1720,'深度供电按 3V3 候选；不匹配则改接口。',16,'muted');
text(2530,1810,'I2C1 上拉在 IMU 模块；',17,'muted');text(2530,1838,'I2C2 上拉按模块核定。',17,'muted');
rh(3100,1760,'R501','4.7k*','+3V3','DEPTH_SCL',280,'可选上拉；存在模块上拉时按并联总值决定DNP');
rh(3100,1815,'R502','4.7k*','+3V3','DEPTH_SDA',280,'可选上拉；根据电容与速率校核上升时间');
for(let i=0;i<5;i++){
 const x=2530+(i%3)*335,y=1880+Math.floor(i/3)*220;
 conn(x,y,'J'+(510+i),'超声波'+(i+1),['USONIC_A','USONIC_B','GND'],{width:130,step:25,note:'五口并接同一总线，不是五路UART；仅A/B/参考地，模块另供电且电压未定；针序需匹配模块'});
}
noteLines(2530,2280,[
 'J510–J514 同名网络相连；参考地不是模块供电回流设计。',
 '主干串接 + 短支线，避免五条长星形线；接口位置随线束定版。',
 '五模块须有独立地址且可受控轮询；不能默认是 Modbus。',
 '模块电压/电流、接地/隔离、终端/偏置、保护及线缆待确认。',
 '一次安排一路测距，按手册设置等待时间，避免声学串扰。'
],18);

// 09 separate ultrasonic transceiver; MAX3485 pins verified to ADI p7.
panel('ultrasonic',40,1920,1040,500,'09  超声波 · USART3 / 独立 RS485','PD8 TX / PD9 RX（AF7）；PD10 为方向 GPIO；与 BMS A/B 分开。');
ic(295,2025,340,200,'U4','MAX3485ESA+',[[1,'RO','USONIC_RX'],[2,'/RE','USONIC_DE'],[3,'DE','USONIC_DE'],[4,'DI','USONIC_TX']],[[8,'VCC','+3V3'],[7,'B','USONIC_B'],[6,'A','USONIC_A'],[5,'GND','GND']],'SOIC-8','ADI候选，不代替UMW验证；PD10低接收、高发送，等待USART TC后释放总线');
rv(170,2270,'R513','10k','USONIC_DE','GND','默认关闭驱动、使能接收；不能替代总线偏置');
cap(510,2270,'C501','100nF','+3V3','GND','靠近U4 pin8；此3V3仅供收发器，不代表模块供电');
rh(720,2305,'R514','120Ω / DNP','USONIC_A','USONIC_B',300,'仅主板处于物理总线端点且无重复终端时装；检查模块内置终端');
text(80,2390,'终端仅总线两端；偏置 / ESD / 隔离待补。开路保护不保证终端短接时空闲判定。',17,'muted');

// 10 two servo outputs with a separate 5V rail and common reference ground.
panel('servo',1100,1920,1380,500,'10  两路舵机 · TIM3 CH1 / CH2','PA6 / 31、PA7 / 32 · AF2；VCC、GND、PWM 三针，舵机专用 5V。');
for(let i=1;i<=2;i++){
 const x=1140+(i-1)*680,n='SERVO'+i,outn=n+'_OUT';
 rh(x,2040,'R'+(406+i),'100Ω',n,outn,270,'3.3V PWM串联阻尼候选；核对舵机VIH、线长及周期/脉宽');
 conn(x+20,2090,'J'+(406+i),'舵机 '+i,[{label:'1 VCC',net:'+5V_SERVO'},{label:'2 GND',net:'GND'},{label:'3 PWM',net:outn}],{width:180,step:36,note:'本项目针序VCC/GND/PWM；VCC=舵机专用5V，PWM=3.3V；不承诺兼容所有舵机插头，电流/堵转/温升待定'});
 rv(x+490,2080,'R'+(408+i),'100k',outn,'GND','默认拉低候选；须验证舵机上电及失联安全行为');
 cap(x+490,2250,'C'+(406+i),'100nF / 10V','+5V_SERVO','GND','接口就近高频旁路；不能替代按堵转/瞬态电流计算的储能电容');
}
text(1130,2385,'TIM3 两通道共周期；3.3V 电平与舵机兼容性、堵转峰值和回流路径须确认。',18,'muted');
text(48,2475,'UNIFIED BOAT CONTROL  /  主控与接口  /  所有网络均可点击高亮，双击查看连接位置',21,'heading');
text(3550,2475,'A0 横向 · 3600 × 2546 · 02 / 05',20,'muted','text-anchor="end"');
put('</svg>');
const svg=out.join('\n');
const nets={};for(const c of components)for(const [pin,p]of Object.entries(c.pins)){if(p.net)(nets[p.net]??=[]).push({ref:c.ref,pin,name:p.name,kind:c.kind});}
const data={title:'无人船统一主板 STM32F4 主控与接口原理图',revision:'Rev F / 2026-11-18',status:'方案评审稿，未完成EDA/电气验证',part:'STM32F407VET6',package:'LQFP100',components,nets,panels,pinSource:pinData.source,afSource:pinData.alternate_function_source,supplementalSources:pinData.supplemental_sources};
if(Object.keys(components.find(c=>c.ref==='U1').pins).length!==100)throw Error('Incomplete MCU');
if(Object.keys(components.find(c=>c.ref==='U4').pins).length!==8)throw Error('Incomplete ultrasonic RS485');
const core=components.find(c=>c.ref==='U1');
for(const [p,n] of Object.entries({6:'+3V3',10:'GND',11:'+3V3',19:'+3V3',20:'GND',21:'VDDA',22:'VDDA',27:'GND',28:'+3V3',49:'VCAP1',50:'+3V3',73:'VCAP2',74:'GND',75:'+3V3',99:'GND',100:'+3V3'})){
 if(core.pins[p].net!==n)throw Error('Incorrect U1 power pin '+p);
 if(!nets[n]?.some(e=>e.ref.startsWith('C')))throw Error('Missing decoupling '+n);
}
for(const [n,c,p] of [['VCAP1','C108','49'],['VCAP2','C109','73']])if(nets[n].length!==2||!nets[n].some(e=>e.ref===c)||!nets[n].some(e=>e.ref==='U1'&&e.pin===p))throw Error('Bad independent VCAP '+n);
for(const n of Object.values(routeNets)){if(!nets[n]||nets[n].length<2)throw Error('Unconnected allocated net '+n);}

if(core.pins['80'].net!=='AIS_TX'||core.pins['83'].net!=='AIS_RX')throw Error('AIS UART5 physical pin mismatch');
if(core.pins['95'].net!=='LED_PWM'||!components.some(c=>c.ref==='J406'&&c.pins['1'].net==='LED_PWM_OUT'))throw Error('STM32 PB8 LED must remain connected');
if(core.pins['87'].net!==null)throw Error('PD6 must remain NC');
for(const n of ['AIS_TX','AIS_RX'])if(nets[n].length!==2||!nets[n].some(e=>e.ref==='P_AIS'&&e.kind==='page-port'))throw Error('AIS must remain a logic page port until electrical interface is known');
if(Object.keys(routeNets).length!==29||pinData.routes.length!==30)throw Error('Expected 29 connected GPIO plus PD6 NC');
for(let i=1;i<=5;i++)if(!nets['PWM'+i+'_OUT'])throw Error('Missing drive PWM '+i);
const css=`*{box-sizing:border-box}html,body{height:100%;margin:0}body{display:grid;grid-template-rows:auto auto minmax(0,1fr);background:#e9eef3;color:#183448;font:14px 'Microsoft YaHei','Segoe UI',sans-serif}.bar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:10px 14px;background:#fff;box-shadow:0 1px 8px #18344816;z-index:2}.bar strong{font-size:17px;margin-right:9px}.bar button,.bar a,select{font:inherit;border:1px solid #c1cfdd;background:#fff;color:#154c79;border-radius:6px;padding:7px 10px;text-decoration:none;cursor:pointer}.bar button:hover,.bar a:hover{background:#edf5fc}.bar label{font-size:12px}.hint{padding:8px 14px;background:#fff6e5;color:#765121;font-size:12px;line-height:1.6}.hint a{color:#154c79}#view{overflow:auto;min-height:0;padding:16px;scrollbar-gutter:stable}#sheet{display:block;margin:0 auto;width:3600px;height:auto;background:#fff;box-shadow:0 6px 24px #18344825}.bar .spacer{flex:1}#status{display:inline-block;min-width:100px}.dialog{border:1px solid #acbdcf;border-radius:10px;width:min(640px,92vw);max-height:82vh;overflow:auto;padding:20px}.dialog::backdrop{background:#17354a66}.dialog h2{margin:0 0 10px;color:#164e78}.dialog button{padding:10px;border:1px solid #bdcbd7;border-radius:6px;background:#fff;color:#164e78;cursor:pointer}.dialog ul{padding-left:20px;line-height:1.7}.locations{display:grid;gap:7px;margin:15px 0}.locations button{text-align:left}button:focus-visible,a:focus-visible,select:focus-visible{outline:3px solid #e6aa29;outline-offset:2px}@page{size:1189mm 841mm;margin:0}@media print{html,body{width:1189mm;height:841mm;display:block;overflow:visible;background:#fff}.bar,.hint,dialog{display:none!important}#view{padding:0;overflow:visible}#sheet{width:1189mm!important;height:841mm!important;box-shadow:none}.net.selected{stroke:none}.wire.selected{stroke:#286756;stroke-width:2}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}@media(max-width:600px){.bar{padding:8px;gap:5px}.bar strong{width:100%;font-size:15px}.bar button,.bar a,select{font-size:12px;padding:6px}.hint{font-size:11px}#view{padding:8px}}`;
const js=`const data=JSON.parse(document.getElementById('schematic-data').textContent);const sheet=document.getElementById('sheet'),view=document.getElementById('view');let scale=1;function zoom(v){scale=Math.max(.12,Math.min(2.5,v));sheet.style.width=3600*scale+'px';document.getElementById('zoom').textContent=Math.round(scale*100)+'%'}function fit(){zoom(Math.min((view.clientWidth-32)/3600,(view.clientHeight-32)/2546));view.scrollTo(0,0)}function gotoBox(b){zoom(Math.max(.25,Math.min(1.4,(view.clientWidth-45)/b.w,(view.clientHeight-40)/b.h)));view.scrollTo({left:Math.max(0,(b.x+b.w/2)*scale-view.clientWidth/2+16),top:Math.max(0,(b.y+b.h/2)*scale-view.clientHeight/2+16),behavior:'auto'})}function bounds(e){const r=e.getBoundingClientRect(),s=sheet.getBoundingClientRect();return{x:(r.left-s.left)/scale,y:(r.top-s.top)/scale,w:r.width/scale,h:r.height/scale}}function stepZoom(f){const cx=(view.scrollLeft+view.clientWidth/2)/scale,cy=(view.scrollTop+view.clientHeight/2)/scale;zoom(scale*f);view.scrollTo(cx*scale-view.clientWidth/2,cy*scale-view.clientHeight/2)}document.getElementById('fit').onclick=fit;document.getElementById('plus').onclick=()=>stepZoom(1.25);document.getElementById('minus').onclick=()=>stepZoom(1/1.25);document.getElementById('section').onchange=e=>{const p=data.panels.find(p=>p.id===e.target.value);if(p)gotoBox(p.id==='mcu'?{x:1230,y:420,w:1120,h:1130}:p);else fit()};function highlight(n){document.querySelectorAll('[data-net]').forEach(e=>e.classList.toggle('selected',e.dataset.net===n));document.querySelectorAll('[data-wire]').forEach(e=>e.classList.toggle('selected',e.dataset.wire===n));document.getElementById('status').textContent=n? n+' · '+(data.nets[n]?.length||0)+'端点':'点击网络追踪'}function details(n){highlight(n);document.getElementById('net-name').textContent=n;const list=document.getElementById('locations');list.replaceChildren();document.querySelectorAll('[data-net]').forEach(e=>{if(e.dataset.net!==n)return;const b=document.createElement('button');b.textContent=e.dataset.area+' / X'+Math.round(bounds(e).x)+' Y'+Math.round(bounds(e).y);b.onclick=()=>{document.getElementById('net-dialog').close();const r=bounds(e);gotoBox({x:r.x+r.w/2-300,y:r.y+r.h/2-150,w:600,h:300})};list.append(b)});const pins=document.getElementById('endpoints');pins.textContent=(data.nets[n]||[]).map(e=>e.ref+'.'+e.pin+' '+e.name).join(' · ');document.getElementById('net-dialog').showModal()}sheet.onclick=e=>{if(e.target.dataset.net)highlight(e.target.dataset.net)};sheet.ondblclick=e=>{if(e.target.dataset.net)details(e.target.dataset.net)};sheet.onkeydown=e=>{if(e.target.dataset.net&&(e.key==='Enter'||e.key===' ')){e.preventDefault();details(e.target.dataset.net)}};document.getElementById('clear').onclick=()=>highlight('');document.getElementById('close-net').onclick=()=>document.getElementById('net-dialog').close();document.getElementById('source-btn').onclick=()=>document.getElementById('source-dialog').showModal();document.getElementById('close-source').onclick=()=>document.getElementById('source-dialog').close();document.getElementById('print').onclick=()=>window.print();function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}function csv(rows){return '\\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\\r\\n')}document.getElementById('bom').onclick=()=>download('STM32F4_RevF_BOM.csv',csv([['位号','型号/数值','封装','状态与备注'],...data.components.filter(c=>c.kind==='physical').map(c=>[c.ref,c.value,c.footprint,c.note])]),'text/csv;charset=utf-8');document.getElementById('netlist').onclick=()=>download('STM32F4_RevF_连接表.json',JSON.stringify(data,null,2),'application/json');document.getElementById('svg-download').onclick=()=>{const copy=sheet.cloneNode(true);copy.removeAttribute('style');copy.querySelectorAll('.selected').forEach(e=>e.classList.remove('selected'));download('STM32F4_RevF_原理图.svg',new XMLSerializer().serializeToString(copy),'image/svg+xml')};fit();const initialPanel=data.panels.find(p=>p.id===new URLSearchParams(location.search).get('module'));if(initialPanel){document.getElementById('section').value=initialPanel.id;gotoBox(initialPanel)};`;
new vm.Script(js);
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>无人船统一主板 · STM32F4 原理图 Rev F</title><style>${css}</style></head><body><header class="bar"><strong>STM32F4 原理图 · Rev F</strong><button id="fit">整张</button><label>定位 <select id="section"><option value="">全图</option>${panels.map(p=>`<option value="${p.id}">${E(p.title)}</option>`).join('')}</select></label><button id="minus" aria-label="缩小">−</button><span id="zoom"></span><button id="plus" aria-label="放大">＋</button><button id="clear">清除高亮</button><button id="bom">导出 BOM</button><button id="netlist">导出连接表</button><button id="svg-download">下载 SVG</button><button id="print">打印 / PDF</button><button id="source-btn">依据 / 待确认</button><a href="无人船统一主板方案.html" target="_top">主方案</a><a href="STM32F407引脚配置图.html" target="_top">100脚配置</a></header><div class="hint"><strong id="status">点击网络追踪</strong> · 单击高亮；双击或 Enter 查看连接位置。评审稿：整板电路见大图阅读器；本文件保留F4单页。电池ADC采样链见整板图；R304为候选装配，启用前验证断电和浪涌。</div><main id="view">${svg}</main><dialog id="net-dialog" class="dialog"><h2>网络 <code id="net-name"></code></h2><p id="endpoints"></p><div class="locations" id="locations"></div><button id="close-net">关闭</button></dialog><dialog id="source-dialog" class="dialog"><h2>依据与设计边界</h2><p>脚号/复用已经核对；外围阻容、连接器及整机保护仍为候选。旧 ROV 证据保留在主方案中，本图不冒充旧板实物。</p><ul><li><a href="https://github.com/STMicroelectronics/STM32_open_pin_data/blob/master/mcu/STM32F407V(E-G)Tx.xml" target="_blank" rel="noopener">ST F407V 管脚数据</a>：U1 100脚。</li><li><a href="https://www.st.com/resource/en/application_note/dm00115714-getting-started-with-stm32f4xxxx-mcu-hardware-development-stmicroelectronics.pdf" target="_blank" rel="noopener">ST AN4488 Rev7</a>：p9 供电与去耦已查看；晶振/复位外围数值仍为候选。</li><li><a href="https://www.st.com/resource/en/datasheet/stm32f407vg.pdf" target="_blank" rel="noopener">ST DS8626 Rev12</a>：p55/67核对PD8/PD9/PD10脚号及USART3 AF7；p66/67核对PC12/PD2 UART5 AF8；p84 表16，VCAP各2.2µF、ESR&lt;2Ω；已查看原页。</li><li><a href="https://www.ti.com/lit/ds/symlink/sn65hvd230.pdf" target="_blank" rel="noopener">TI SN65HVD230</a>：U2脚表及Rs高速/斜率模式。</li><li><a href="https://www.analog.com/media/en/technical-documentation/data-sheets/MAX3483-MAX3491.pdf" target="_blank" rel="noopener">ADI MAX3483–MAX3491</a>：U3/U4使用MAX3485八脚半双工脚表；UMW替代料未核验。</li></ul><p>待确认：AIS型号/物理层/方向/波特率/协议/供电、超声波地址/协议/供电、传感器与声纳电平、BMS协议/线缆、ESD及隔离、外部驱动安全输入、晶振CL、ADC过压及断电反灌。整板电源与P4见原理图设计.html；本页为F4独立图。</p><button id="close-source">关闭依据</button></dialog><script id="schematic-data" type="application/json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script><script>${js}</script></body></html>`;
fs.writeFileSync(path.join(root,'无人船_STM32F4_原理图.html'),html);
fs.writeFileSync(path.join(root,'无人船_STM32F4_原理图.svg'),svg);
fs.writeFileSync(path.join(root,'无人船_STM32F4_原理图连接表.json'),JSON.stringify(data,null,2));
console.log(JSON.stringify({components:components.length,physical:components.filter(c=>c.kind==='physical').length,nets:Object.keys(nets).length,mcuPins:100,ultrasonicTransceiverPins:8,svgBytes:svg.length,htmlBytes:html.length}));
