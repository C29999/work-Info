// Module pad numbers from the supplied OSPTEK 88-pad manual, not bare-chip pins.
module.exports=function(d,p4){
 const {panel,ic,cap,rv,rh,conn,testpoint,noteLines,text,line,net,component,put}=d;
 const route={0:'DVP_D0',1:'DVP_D1',2:'USB_OC_N',3:'USB_VBUS_EN',4:'DVP_D2',5:'RF_EN',7:'RF_CS',8:'RF_MOSI',9:'RF_SCK',10:'RF_MISO',11:'RF_IRQ',12:'LIDAR_TX',13:'LIDAR_RX',20:'P4_CAN_TX',21:'P4_CAN_RX',22:'CAM_SDA',23:'CAM_SCL',24:'USB_DBG_DM',25:'USB_DBG_DP',26:'EXT_TX',27:'EXT_RX',28:'TETHER_TX',29:'TETHER_RX',30:'TETHER_DE',31:'PUMP_EN',32:'DVP_D3',33:'DVP_D4',39:'SD_D0',40:'SD_D1',41:'SD_D2',42:'SD_D3',43:'SD_CLK',44:'SD_CMD',45:'SD_CD_N',46:'DVP_D5',47:'DVP_D6',48:'CSI_XCLK',49:'DVP_D7',50:'DVP_HREF',51:'DVP_VSYNC',52:'DVP_PCLK',53:'DVP_XCLK'};
 const named={GND:'GND',ESP_3V3:'+3V3',RTC_VBAT:'+3V3',CHIP_PU:'P4_EN',DM:'USB_HS_DM',DP:'USB_HS_DP',CSI_D0N:'CSI_D0N',CSI_D0P:'CSI_D0P',CSI_CLKP:'CSI_CLKP',CSI_CLKN:'CSI_CLKN',CSI_D1N:'CSI_D1N',CSI_D1P:'CSI_D1P'};
 const pins=p4.pins.map(p=>{const name=p.name;const m=/^GPIO(\d+)$/.exec(name);let n=m?route[+m[1]]:named[name];if(name==='GPIO35')n='P4_BOOT';if(name==='GPIO36')n='P4_STRAP36';if(name==='GPIO37')n='P4_REC_TX';if(name==='GPIO38')n='P4_REC_RX';return{pin:+p.pin,name,net:n||null};});
 if(pins.length!==88)throw Error('P4 module must have 88 pads');
 // One four-sided symbol follows the module manual's p7 schematic orientation.
 panel('p4-module',40,160,2280,2240,'U701 · ESP32-P4C5 核心板','88 个模块焊盘 · 顺序按 P4C5 手册第7页符号 · 非裸芯片脚号 / 非PCB封装图');
 component('U701','OSPTEK ESP32-P4C5 核心板（实物版次待核）','88焊盘邮票孔；按供应商封装复核',Object.fromEntries(pins.map(p=>[p.pin,{name:p.name,net:p.net}])),'按P4C5核心板手册对应88个焊盘；实物版次、66脚内部连接仍待核。功能分配是本项目候选。');
 const bx=500,by=620,bw=1320,bh=1320,pitch=48,inset=156,stem=40;
 const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rotated=(x,y,anchor)=>`text-anchor="${anchor}" transform="rotate(-90 ${x} ${y})"`;
 const nc=(x,y,anchor='start',rotate=false)=>{
  text(x,y,'NC',21,'nc',rotate?rotated(x,y,anchor):`text-anchor="${anchor}"`);
 };
 const cross=(x,y)=>{line(x-6,y-6,x+6,y+6);line(x-6,y+6,x+6,y-6);};
 put(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="4" class="chip" data-component-body="U701"/>`);
 text(bx+bw/2,by+bh/2-88,'U701',40,'ref','text-anchor="middle"');
 text(bx+bw/2,by+bh/2-22,'ESP32-P4C5',55,'heading','text-anchor="middle"');
 text(bx+bw/2,by+bh/2+36,'88 焊盘核心板',30,'heading','text-anchor="middle"');
 text(bx+bw/2,by+bh/2+94,'P4 + C5 · 模块内部电路不重复绘制',22,'muted','text-anchor="middle"');
 text(bx+bw/2,by+bh/2+135,'引脚名在框内 / 焊盘号在脚线旁 / 项目网络在框外',20,'muted','text-anchor="middle"');
 for(const p of pins){
  const side=p.pin<=22?'left':p.pin<=44?'bottom':p.pin<=66?'right':'top';
  const index=p.pin<=22?p.pin-1:p.pin<=44?p.pin-23:p.pin<=66?66-p.pin:88-p.pin;
  put(`<g data-component="U701" data-pad="${p.pin}" data-pin-name="${E(p.name)}" data-side="${side}">`);
  if(side==='left'||side==='right'){
   const left=side==='left',x=left?bx:bx+bw,y=by+inset+index*pitch,out=x+(left?-stem:stem);
   line(x,y,out,y,p.net);
   text(x+(left?22:-22),y+7,p.name,22,'pin',`text-anchor="${left?'start':'end'}"`);
   text(x+(left?-10:10),y-9,p.pin,17,'pin',`text-anchor="${left?'end':'start'}"`);
   const tx=out+(left?-18:18),anchor=left?'end':'start';
   if(p.net)net(tx,y+7,p.net,anchor,22);else{cross(out,y);nc(tx,y+7,anchor);}
  }else{
   const top=side==='top',x=bx+inset+index*pitch,y=top?by:by+bh,out=y+(top?-stem:stem);
   line(x,y,x,out,p.net);
   const labelY=y+(top?22:-22),netY=out+(top?-18:18),anchor=top?'start':'end';
   text(x+7,labelY,p.name,22,'pin',rotated(x+7,labelY,top?'end':'start'));
   text(x+9,y+(top?-12:26),p.pin,17,'pin');
   if(p.net)net(x+7,netY,p.net,anchor,22,`transform="rotate(-90 ${x+7} ${netY})"`);else{cross(x,out);nc(x+7,netY,anchor,true);}
  }
  put('</g>');
 }
 noteLines(90,2260,['NC＝本底板不接；GPIO6 / GPIO54 已供模块内部使用，不再分配。','66 脚定义有资料差异，暂不接负载；不得直接短接 +3V3。','84 / 85 / 86 接 +3V3；87 接外部复位电路。点击外侧网络名可高亮整板连接。'],21);
 panel('p4-supply',2340,160,1220,500,'P4 供电 / 复位','85、86 输入 3.3V；84 RTC_VBAT 同接；87 无内置 RC 复位。');
 cap(2400,305,'C701','100nF','+3V3');cap(2630,305,'C702','100nF','+3V3');cap(2860,305,'C703','22µF*','+3V3');cap(3150,305,'C704','1µF','+3V3');
 rv(2440,465,'R701','10k','+3V3','P4_EN');cap(2740,465,'C705','1µF*','P4_EN');
 component('SW701','RESET','按钮待选',{'1':{name:'1',net:'P4_EN'},'2':{name:'2',net:'GND'}},'拉低模块CHIP_PU，并复位摄像头I²C mux；RC值按电源爬升验证');
 net(3110,457,'P4_EN');line(3110,475,3200,475,'P4_EN');line(3200,475,3240,454);line(3250,475,3340,475,'GND');net(3340,505,'GND','end');text(3180,540,'SW701 RESET',18,'ref');
 noteLines(2370,612,['* 储能/RC为候选；模块峰值功耗与上电斜率需实测。'],19);
 panel('p4-can',2340,680,1220,600,'P4 TWAI / 经典 CAN 收发器','GPIO20 / 焊盘29 TX；GPIO21 / 焊盘30 RX；和 STM32 共用 H/L。');
 ic(2610,790,400,290,'U702','SN65HVD230D',[[1,'D','P4_CAN_TX'],[4,'R','P4_CAN_RX'],[3,'VCC','+3V3'],[2,'GND','GND']],[[7,'H','CAN_H'],[6,'L','CAN_L'],[8,'Rs','P4_CAN_RS'],[5,'Vref',null]],'SOIC-8','TI官方脚表；与U2同型候选，TX/RX各自独立；H/L是公共总线');
 cap(2400,1125,'C711','100nF','+3V3');rv(2660,1125,'R711','0Ω','P4_CAN_RS','GND');rh(3020,1145,'R712','120Ω / DNP','CAN_H','CAN_L',420,'仅物理端点安装；全总线恰好两个120Ω，不按MCU数量全部装');
 text(2370,1240,'USB-CAN 接 F4 页 J201；拔除上位机后双 MCU 仍在同一 CAN 总线上。',19,'muted');
 panel('p4-recovery',2340,1300,1220,690,'启动 / 恢复 / USB 调试','运行日志走 CAN；保留首次烧录和固件损坏时的硬件恢复入口。');
 rv(2430,1440,'R721','10k*','+3V3','P4_BOOT');rv(2770,1440,'R722','10k*','+3V3','P4_STRAP36');
 component('SW702','BOOT','按钮待选',{'1':{name:'1',net:'P4_BOOT'},'2':{name:'2',net:'GND'}},'启动锁存时拉低GPIO35；GPIO36保持高，下载模式按实物版次复核');
 net(3110,1428,'P4_BOOT');line(3110,1450,3200,1450,'P4_BOOT');line(3200,1450,3240,1429);line(3250,1450,3340,1450,'GND');net(3340,1480,'GND','end');text(3180,1520,'SW702 BOOT',18,'ref');
 testpoint(2430,1660,'TP701','P4_REC_TX');testpoint(2770,1660,'TP702','P4_REC_RX');testpoint(3110,1660,'TP703','P4_EN');
 conn(2400,1730,'P_USB_DEBUG','USB Serial/JTAG',[{label:'DM',net:'USB_DBG_DM'},{label:'DP',net:'USB_DBG_DP'},{label:'GND',net:'GND'}],{virtual:true,width:250,step:30,note:'GPIO24/25只预留逻辑调试口；实际USB座、VBUS检测和ESD按供应商底板设计核对后定型'});
 noteLines(2920,1770,['TP701/702 是恢复测试点。','不是第三组运行调试串口。','USB 调试与 USB-HS 摄像头','使用不同控制器/引脚。','GPIO34/6/54 底板不再占用。'],19);
 panel('p4-boundaries',2340,2010,1220,390,'模块版次与电压域边界','已对照模块手册焊盘；仍需确认实物与供应商硬件资料。');
 noteLines(2370,2115,['GPIO：42 分配 + 2 内部共用 + 5 启动/恢复 = 49。','焊盘66暂不接负载：资料冲突，核心板内部连接待核。','GPIO39–48 共用相关供电域；SD固定3.3V候选，禁切1.8V。','本页是核心板底板连接；不重复设计模块内部Flash/PSRAM。','USB、CSI、DVP同时运行的驱动/带宽/内存仍需验证。','CAN 不负责视频；水下视频回传链路仍需单独确定。'],20);
};
