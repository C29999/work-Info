const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../design');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const write=(n,s)=>fs.writeFileSync(path.join(root,n),s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pins=[...read('../scripts/data/p4c5-core-pins.md').matchAll(/^\|\s*(\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|/gm)].map(m=>({pin:+m[1],name:m[2].trim(),sourceNote:m[3].trim(),evidence:'说明书 §3.2，PDF 第8–10页；核心板仓库 pin-definition.md'}));
if(pins.length!==88||new Set(pins.map(p=>p.pin)).size!==88)throw Error('Invalid module pads');
const groups=[
 {id:'can',name:'CAN · 双主控 / 上位机',color:'#16806a',note:'TWAI0 经 GPIO Matrix 路由；另加 3.3V CAN 收发器。与 F4 共用经典 CAN，日志限速，不传视频。'},
 {id:'lidar',name:'UART · 激光雷达',color:'#7651b5',note:'UART1 经 GPIO Matrix 路由。TX/RX 以 P4 方向命名；雷达的电平、速率、单双向和是否需要收发器待定。'},
 {id:'external',name:'UART · 外部通信',color:'#7651b5',note:'UART2 接一块 4G 或 LoRa 模块；并发第二块、PWRKEY/RESET/RTS/CTS 须另分配。不是调试串口。'},
 {id:'radio',name:'SPI · 2.4GHz 模块',color:'#3974a9',note:'SPI2 使用 GPIO7–10 的原生映射，GPIO11/5 预留 IRQ/EN；模块接口及控制极性待定。'},
 {id:'camera',name:'MIPI CSI · 摄像头',color:'#c47719',note:'两条数据差分对和一条时钟对使用专用管脚；GPIO22/23 共用摄像头 SCCB/I²C，GPIO48 输出 CSI XCLK。CSI RESET/PWDN 改由外置 I²C GPIO 扩展器控制；DVP 共用管理总线，地址冲突需隔离/多路复用。传感器电平、电源、时钟与固件初始化待核定。'},
 {id:'uvc',name:'USB HS · UVC 摄像头',color:'#a34482',note:'专用 DM/DP 接受支持的 USB UVC 摄像头；5V VBUS 经限流开关供电。GPIO3 高有效 EN 外加下拉默认关闭，GPIO2 接低有效过流反馈并上拉；数据口加低电容 ESD。USB、CSI、DVP 三接口的并行采集、编码、SD 与网络带宽待实测。'},
 {id:'sd',name:'SDMMC · microSD',color:'#137e9c',note:'外置卡候选 slot0 / GPIO39–44，另含检测 GPIO45；与内部 C5 的 SDIO 分离。初期以 3.3V、4bit、20MHz 为目标，VDDO4、pad66、slot0 电压配置及实物版本核定后才能连接。'},
 {id:'tether',name:'RS485 · 水下线缆',color:'#b3526e',note:'UART3 TX/RX/RTS 经 GPIO Matrix → 独立 RS485 收发器 → A/B 线缆 → 岸端。暂按双线半双工：DE 与 /RE 共控，外部下拉默认接收；用 UART_MODE_RS485_HALF_DUPLEX，禁用 RTS/CTS 硬件流控并核定收发换向。仅按控制/遥测预算；视频回传链路另定。缆长、波特率、参考地、终端、隔离保护待定，与 F4 BMS/超声波总线分开。'},
 {id:'dvp',name:'DVP · 8bit 摄像头',color:'#c15b2a',note:'LCD_CAM DVP 路径：D0–D7/PCLK/VSYNC/DE(HREF)/XCLK 共12脚直接连接 P4，经 GPIO Matrix；不用 ISP DVP 路径，避免与 CSI 共享 ISP 接入。XCLK 用 LCD_CAM 时钟，频率需满足源时钟整数分频及传感器要求。SCCB 共 GPIO22/23；RESET/PWDN 经 I²C GPIO 扩展器，必要时加 I²C 多路复用。GPIO0/1 不再接32kHz晶振，GPIO4 MTMS不可同时用外接GPIO JTAG。电平、时序、驱动与并发吞吐待验证。'},
 {id:'pump',name:'GPIO · 水泵控制',color:'#378775',note:'GPIO31 仅输出 PUMP_EN 到板外功率驱动，不可直接带水泵。暂按高有效、外部下拉默认关闭；驱动电压/电流、感性负载保护、实际水泵用途及故障安全状态待定。'},
 {id:'usb',name:'USB · 下载 / 恢复',color:'#557087',note:'GPIO24/25 用于 USB Serial/JTAG；保留 BOOT 与 RESET。GPIO37/38 只预留维修测试点，不增加专用 UART 调试插座。'},
 {id:'internal',name:'模块内部占用',color:'#9b6d28',note:'P4 GPIO14–19 已接 C5 SDIO且不外露；GPIO6→C5 GPIO2，GPIO54→C5 CHIP_PU。不得重复分配。'},
 {id:'system',name:'电源 / 启动 / 保留',color:'#5e6c80',note:'包含电源地、C5脚、启动绑带和暂未分配信号；未分配不等于无条件可用。'}
];
const routes=[];
function add(id,items){const g=groups.find(g=>g.id===id);for(const [gpio,signal,label,extra='']of items){const p=pins.find(p=>p.name==='GPIO'+gpio);if(!p)throw Error('Missing GPIO'+gpio);routes.push({pin:p.pin,gpio:'GPIO'+gpio,group:id,module:g.name,signal,label,note:g.note+(extra?' '+extra:''),status:'候选分配，未冻结',color:g.color});}}
add('can',[[20,'TWAI0_TX','CAN_TX'],[21,'TWAI0_RX','CAN_RX']]);
add('lidar',[[12,'UART1_TX','LIDAR_TX'],[13,'UART1_RX','LIDAR_RX']]);
add('external',[[26,'UART2_TX','EXT_TX'],[27,'UART2_RX','EXT_RX']]);
add('radio',[[7,'SPI2_CS','RF_CS'],[8,'SPI2_MOSI','RF_MOSI'],[9,'SPI2_SCLK','RF_SCLK'],[10,'SPI2_MISO','RF_MISO'],[11,'GPIO input','RF_IRQ'],[5,'GPIO output','RF_EN']]);
add('camera',[[22,'I2C SDA','CAM_SDA'],[23,'I2C SCL','CAM_SCL'],[48,'Clock output / LEDC candidate','CSI_XCLK']]);
add('uvc',[[3,'USB_CAM_VBUS_EN','CAM_5V_EN'],[2,'USB_CAM_OC_N','CAM_OC_N']]);
add('sd',[[39,'SDMMC_SLOT0_D0','SD_D0'],[40,'SDMMC_SLOT0_D1','SD_D1'],[41,'SDMMC_SLOT0_D2','SD_D2'],[42,'SDMMC_SLOT0_D3','SD_D3'],[43,'SDMMC_SLOT0_CLK','SD_CLK'],[44,'SDMMC_SLOT0_CMD','SD_CMD'],[45,'GPIO input','SD_CD']]);
add('tether',[[28,'UART3_TX','TETHER_TX'],[29,'UART3_RX','TETHER_RX'],[30,'UART3_RTS / DE','TETHER_DE']]);
add('pump',[[31,'GPIO output','PUMP_EN']]);
add('dvp',[[0,'LCD_CAM DVP D0','DVP_D0'],[1,'LCD_CAM DVP D1','DVP_D1'],[4,'LCD_CAM DVP D2','DVP_D2'],[32,'LCD_CAM DVP D3','DVP_D3'],[33,'LCD_CAM DVP D4','DVP_D4'],[46,'LCD_CAM DVP D5','DVP_D5'],[47,'LCD_CAM DVP D6','DVP_D6'],[49,'LCD_CAM DVP D7','DVP_D7'],[50,'LCD_CAM DVP DE','DVP_HREF'],[51,'LCD_CAM DVP VSYNC','DVP_VSYNC'],[52,'LCD_CAM DVP PCLK','DVP_PCLK'],[53,'LCD_CAM DVP XCLK','DVP_XCLK']]);
add('usb',[[24,'USB Serial/JTAG D−','USB_DBG_D−'],[25,'USB Serial/JTAG D+','USB_DBG_D+']]);
if(routes.length!==42||new Set(routes.map(r=>r.gpio)).size!==42)throw Error('Allocation collision');
if(routes.some(r=>/^GPIO(6|14|15|16|17|18|19|54)$/.test(r.gpio)))throw Error('Internal GPIO reused');
for(const p of pins){
 const r=routes.find(r=>r.pin===p.pin);
 Object.assign(p,{group:'system',color:'#67758b',label:'未分配',note:'未分配；使用前核对复用、电平、供电域和时序。',allocationStatus:'保留 / 待定'});
 if(r){Object.assign(p,{group:r.group,color:r.color,label:r.label,note:r.note,allocationStatus:r.status});continue;}
 if(p.name==='GND'){p.label='地';p.note='所有地脚连接统一参考地；高速接口的回流连续性需核定。';}
 else if(p.name==='ESP_3V3'){p.label='3.3V 输入';p.note='核心板 3.3V 输入，不是 6S 电池输入。系统需降压、瞬态保护和足够峰值电流；按模块版次核定去耦。';}
 else if(p.pin===2){p.label='C5 射频天线';p.note='手册表写 LAN_OUT，符号写 LNA_OUT；实际为 C5 RF 天线接口，绝非以太网 LAN 信号。';}
 else if(p.name.startsWith('C5_')){p.label=p.pin<=5?'C5 烧录保留':p.pin<=8?'C5 绑带保留':'C5 保留';p.note=p.sourceNote+'；本方案不将 C5 引脚计入 P4 的 GPIO 余量。当前整板未引出 C5 UART/绑带/EN 下载入口，相关焊盘保持 NC；需要下载 C5 时须补电路并处理共享复位驱动。';}
 else if(p.name==='GPIO6'||p.name==='GPIO54'){p.group='internal';p.color='#9b6d28';p.label=p.name==='GPIO6'?'内部 → C5 IO2':'内部 → C5 EN';p.note=groups.find(g=>g.id==='internal').note+' 依据说明书 PDF 第10页连接图。';p.allocationStatus='已确认内部占用';}
 else if(p.name.startsWith('CSI_')){p.group='camera';p.color='#c47719';p.label='摄像头专用差分';p.note='已确认专用 CSI 物理脚；候选接 MIPI 摄像头。按芯片、传感器及连接器要求核对差分阻抗、匹配、极性、ESD及电源。';p.allocationStatus='专用脚已确认 / 连接候选';}
 else if(p.name.startsWith('DSI_')){p.label='本地屏预留';p.note='专用 MIPI DSI 管脚。本期在上位机显示视频；未分配本地屏的控制、背光或触摸 GPIO。';}
 else if(p.name==='DM'||p.name==='DP'){p.group='uvc';p.color='#a34482';p.label=p.name==='DM'?'USB_CAM_D−':'USB_CAM_D+';p.note='专用 USB2.0 HS OTG 差分脚，候选接受支持的 USB UVC 摄像头；与 GPIO24/25 USB Serial/JTAG 独立。'+groups.find(g=>g.id==='uvc').note;p.allocationStatus='专用脚已确认 / 连接候选';}
 else if(p.name==='GPIO34'){p.label='JTAG 绑带保留';p.note='保留启动绑带；不得接 DVP 或其他外设负载，按芯片修订核对 JTAG/eFuse 配置。';}
 else if(p.name==='GPIO35'){p.label='BOOT 模式保留';p.note='模块内部无上拉；正常启动 GPIO35 为高；下载时 GPIO35 低且 GPIO36 高。整板已提供 GPIO35/36 上拉、BOOT 按钮和 EN 复位电路；阻容、时序及实物版次仍需验证。';}
 else if(p.name==='GPIO36'){p.label='BOOT 配置';p.note='模块内部无上拉；下载模式要求 GPIO35 低、GPIO36 高。整板已提供 GPIO35/36 上拉、BOOT 按钮和 EN 复位电路；阻容、时序及实物版次仍需验证。';}
 else if(p.name==='GPIO37'||p.name==='GPIO38'){p.label=p.name==='GPIO37'?'恢复 TX 测试点':'恢复 RX 测试点';p.note='UART0 与 strapping 复用，保留维修测试点和启动电平；不是新增运行调试串口。';}
 else if(p.pin===66){p.color='#b36a19';p.label='电源定义待确认';p.note='手册称 ESP_LDO_VO4 输出；开发底板 V1.5 符号标 VFB_VO4/LDO_VO4_ADJ。资料存在版本差异，需核心板实际原理图/修订确认，禁止据此当固定 3.3V 输出或直接短接 3.3V。';p.allocationStatus='资料冲突 / 待确认';}
 else if(p.pin===84){p.label='RTC 备份供电';p.note='手册要求不可悬空，范围 2.3–3.6V，可接 3.3V；核定备份供电方案。';}
 else if(p.pin===87){p.label='P4 EN / RESET';p.note='模块无内部 RC 复位；整板已提供 R701/C705 与 SW701 RESET，按芯片时序及实物验证。';}
 else if(p.name==='GPIO0'||p.name==='GPIO1'){p.label='RTC / 扩展预留';p.note='可用于低速晶振，需确认是否启用 RTC 晶振，再决定是否释放为扩展 GPIO。';}
}
const sourceLinks=[
 ['官方 Camera Driver（CSI / LCD_CAM DVP）','https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/peripherals/camera_driver.html'],
 ['LCD_CAM DVP GPIO Matrix / XCLK 官方实现','https://github.com/espressif/esp-idf/blob/v6.1.1/components/esp_driver_cam/dvp/src/esp_cam_ctlr_dvp_cam.c'],
 ['官方 UART / RS485 半双工驱动','https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/peripherals/uart.html'],
 ['官方 USB UVC Host 组件','https://components.espressif.com/components/espressif/usb_host_uvc/versions/2.6.0/readme'],
 ['官方 esp_video 摄像头框架','https://github.com/espressif/esp-video-components/tree/master/esp_video'],
 ['用户提供的开发板仓库','https://github.com/osptek/devboard-esp32p4c5_module'],
 ['同厂 88 脚核心板定义','https://github.com/osptek/esp32-p4c5-core-board'],
 ['ESP32-P4 硬件设计指南（RMII / strapping / 电源）','https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32p4/schematic-checklist-esp32p4.html'],
 ['SDMMC slot0 / slot1 官方说明','https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/peripherals/sdmmc_host.html']
];
const data={revision:'2026-11-18 / P4C5-candidate-r4-flashing-boundaries',part:'osptek ESP32-P4C5 88-pin core',userNamedPart:'ESP32-P4C3（实物型号待确认）',package:'88脚邮票孔核心板；非裸芯片封装',status:'模块脚号已核对；功能为候选；未冻结',view:'说明书第7页原理图符号方向；不是PCB封装顶视图',sources:{manual:'../references/P4C5核心板说明书.pdf',pages:'p7 符号；p8–10 引脚表；p10 内部SDIO；p11 启动/复位；p13无核心板原理图',links:sourceLinks},budget:{exposedP4GPIO:49,assigned:42,internallyShared:2,bootRecoveryReserved:5,otherUnallocated:0},internalConnections:[['GPIO17','C5 GPIO13','SDIO D3'],['GPIO16','C5 GPIO14','SDIO D2'],['GPIO15','C5 GPIO7','SDIO D1'],['GPIO14','C5 GPIO8','SDIO D0'],['GPIO18','C5 GPIO9','SDIO CLK'],['GPIO19','C5 GPIO10','SDIO CMD'],['GPIO6','C5 GPIO2','辅助信号'],['GPIO54','C5 CHIP_PU','C5复位']],cameraControlExpansion:{status:'条件候选，型号/引脚/默认态/固件适配待定',busGPIO:[22,23],outputs:['CSI_RESET','CSI_PWDN','DVP_RESET','DVP_PWDN'],minimumOutputs:4,sameAddressPolicy:'CSI/DVP若同地址需I2C隔离或多路复用，不可默认直接并联',firmware:'扩展器须在摄像头驱动初始化前配置；复位、PWDN、时钟与供电顺序按传感器适配，不能将扩展器端口号直接当P4 GPIO号'},groups,routes,pins};
const t=(x,y,s,size=17,color='#405674',extra='')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" ${extra}>${esc(s)}</text>`;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1500" role="img" aria-labelledby="p4-title p4-desc"><title id="p4-title">ESP32-P4C5 核心板 88脚候选引脚配置</title><desc id="p4-desc">说明书符号方向，左边1到22，底边23到44，右边45到66，顶边67到88。不是芯片或PCB封装图。彩色为候选用途，棕色为内部占用。</desc><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#e5ebf3" stroke-width=".6"/></pattern></defs><rect width="1600" height="1500" fill="#fff"/><rect width="1600" height="1500" fill="url(#grid)"/>${t(40,45,'ESP32-P4C5 · 88 脚核心板',29,'#092b66','font-weight="700"')}${t(40,78,'模块 pad ≠ 裸芯片 pin · 来自说明书的脚号 + 本项目候选用途',18)}<rect x="390" y="360" width="820" height="800" rx="2" fill="#f7faff" stroke="#1769e0" stroke-width="3"/><path d="M390 390L420 360" stroke="#1769e0" stroke-width="4"/>`;
for(const p of pins){const n=p.pin,c=p.color;let line,txt,hit;
 if(n<=22){const y=425+(n-1)*31;line=`M390 ${y}H365`;txt=t(410,y+6,p.name,17,c)+t(348,y+5,n,14,'#66758c','text-anchor="middle"')+t(328,y+6,p.label,17,c,'text-anchor="end"');hit=`x="35" y="${y-14}" width="490" height="29"`;}
 else if(n<=44){const x=475+(n-23)*31;line=`M${x} 1160V1185`;txt=t(x+5,1140,p.name,17,c,`transform="rotate(-90 ${x+5} 1140)"`)+t(x,1204,n,14,'#66758c','text-anchor="middle"')+t(x+5,1221,p.label,17,c,`transform="rotate(90 ${x+5} 1221)"`);hit=`x="${x-14}" y="1090" width="29" height="310"`;}
 else if(n<=66){const y=1076-(n-45)*31,corner=n===45||n===66;line=`M1210 ${y}H1235`;txt=t(corner?1272:1190,y+6,p.name,17,c,corner?'':'text-anchor="end"')+t(1252,y+5,n,14,'#66758c','text-anchor="middle"')+t(corner?1400:1272,y+6,p.label,17,c);hit=`x="1080" y="${y-14}" width="485" height="29"`;}
 else{const x=1126-(n-67)*31;line=`M${x} 360V335`;txt=t(x-5,380,p.name,17,c,`transform="rotate(90 ${x-5} 380)"`)+t(x,320,n,14,'#66758c','text-anchor="middle"')+t(x+5,300,p.label,17,c,`transform="rotate(-90 ${x+5} 300)"`);hit=`x="${x-14}" y="105" width="29" height="310"`;}
 svg+=`<g class="pin-hit" data-pin="${n}" data-group="${p.group}" tabindex="0" role="button" aria-label="${esc('#'+n+' '+p.name+' '+p.label)}"><title>${esc('#'+n+' '+p.name+'：'+p.note)}</title><rect class="hit-area" ${hit} rx="4" fill="transparent"/><path d="${line}" fill="none" stroke="${c}" stroke-width="${routes.some(r=>r.pin===n)?4:2}"/>${txt}</g>`;
}
const center=[['ESP32-P4 + ESP32-C5',35,'#092b66'],['88 脚邮票孔核心板',25,'#405674'],['49 GPIO：42 分配 + 2 内部 + 5 启动',21,'#1769e0'],['CAN 2 · UART信号 7 · SPI 6 · SD 7',21,'#405674'],['CSI控制 3 · DVP 12 · 水泵 1',21,'#405674'],['USB相机控制 2 · USB下载 2',20,'#a34482'],['USB UVC + MIPI CSI + 8bit DVP',22,'#c47719'],['摄像头 RESET / PWDN → I²C 扩展器',20,'#c15b2a'],['GPIO34–38 启动 / 恢复保留',20,'#9b6d28'],['无空闲 GPIO · 扩展器与地址条件待核定',19,'#b3526e'],['pad66 电源定义 / 实物版次待确认',19,'#b36a19'],['资料为 P4C5；用户称 P4C3，需对实物',18,'#66758c']];
center.forEach((a,i)=>svg+=t(800,538+i*40,a[0],a[1],a[2],'text-anchor="middle"'+(i===0?' font-weight="700"':'')));
svg+=`${t(40,1438,'彩色：候选用途     棕色：内部占用     灰色：电源 / 保留     摄像头控制扩展器为必要条件',20)}${t(40,1476,'物理编号按核心板说明书符号排列；可点选查看证据与连接限制。运行诊断共用 CAN，USB 用于下载 / 恢复。',17)}</svg>`;
const f4html=read('STM32F407引脚配置图.html');
const baseCSS=f4html.match(/<style>([\s\S]*?)<\/style>/)[1];
const css=baseCSS+`.alert{background:#fff6e5;border-left:4px solid #c58a2f;padding:12px 16px;border-radius:8px;margin:16px 0}.statline{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.statline span{background:#eaf3ff;color:#092b66;padding:5px 10px;border-radius:6px}.embedded header,.embedded .overview{display:none}.embedded main{padding:10px}.embedded .toolbar{margin-top:0}.embedded .inspect{min-height:110px}.embedded .table-scroll{max-height:430px}.embedded .caption{font-size:12px}.pin-hit:focus-visible .hit-area{fill:#e5a44135}.pin-hit.selected .hit-area{fill:#1769e020}tbody button{padding:4px 9px}th{position:sticky;top:0}.sources li{margin:6px 0}@media(max-width:700px){.notes{grid-template-columns:1fr}}`;
const tableRows=routes.map(r=>`<tr data-group="${r.group}"><td>${esc(r.module)}</td><td>${esc(r.label)}</td><td><b>${r.gpio}</b></td><td>#${r.pin}</td><td>${esc(r.signal)}</td><td><button data-select-pin="${r.pin}">定位引脚</button></td></tr>`).join('');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ESP32-P4C5 核心板引脚配置图</title><style>${css}</style></head><body>
<header><small>UNIFIED BOAT CONTROL · ESP MODULE PIN MAP</small><h1>ESP32-P4C5 · 核心板引脚配置图</h1><p>88 个模块焊盘逐脚对应说明书。脚号为资料事实，彩色功能为当前统一主板的候选分配。</p><nav><a target="_top" href="无人船统一主板方案.html#esp32-pin-configuration">返回主方案 · 双 MCU 引脚</a><a target="_top" href="STM32F407引脚配置图.html">STM32F4 引脚图</a></nav></header>
<main><div class="overview"><div class="alert"><strong>型号待核对：</strong>你称模块为 P4C3，但提供的说明书和仓库均为 osptek P4C5。本图按 P4C5 核心板绘制，不代表 P4C3 可以直接套用；也不使用开发底板排针号代替核心板焊盘号。</div><section class="decisions"><div class="current"><strong>42 个 P4 GPIO · 条件分配</strong><p>覆盖 CAN、雷达、外部通信、2.4GHz、SD、水下 RS485、水泵、CSI/DVP/USB 摄像头及 USB 下载。</p></div><div><strong>内部 C5 占用已排除</strong><p>GPIO14–19 用于内部 SDIO；外露的 GPIO6、54 仍与 C5 相连，禁止重复分配。</p></div><div><strong>无空闲 GPIO · 需摄像头扩展器</strong><p>GPIO34–38 留给启动与恢复。CSI/DVP RESET 与 PWDN 共4线改由 I²C GPIO 扩展器控制；地址冲突另需隔离/多路复用。</p></div></section></div>
<div class="toolbar" id="pin-map-controls"><label for="module-filter">高亮模块 <select id="module-filter"><option value="">全部引脚</option>${groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></label><div class="actions"><button id="zoom-map" type="button" aria-pressed="false">放大读图</button><button id="export-csv" type="button">导出引脚 CSV</button><a href="ESP32P4C5引脚配置图.svg" download>下载 SVG</a></div></div>
<div id="chip-viewport" class="viewport">${svg}</div><p class="caption">说明书符号方向：左 1→22，底 23→44，右 45→66，顶 67→88；不是 PCB 封装顶视图。#数字为模块焊盘，GPIO数字为 P4 信号。</p>
<aside id="inspection" class="inspect" aria-live="polite"><h2>点击任意引脚查看连接</h2><p>CAN：#29 GPIO20 TX、#30 GPIO21 RX；外部 SD 与内部 C5 分控制器。#66 电源定义、摄像头控制扩展器与实际模块版次仍需核定。</p></aside>
<div class="notes"><div class="panel"><h3>三种摄像头接口 · USB / CSI / DVP</h3><p>USB UVC 使用 pad48 DM / pad49 DP，GPIO3 使能限流5V供电，GPIO2接过流反馈。CSI 使用专用差分脚与 GPIO48 XCLK；新增8bit DVP 经 LCD_CAM 用12个GPIO。三路同时采集、编码、SD录像及转发尚未验证。</p></div><div class="panel"><h3>摄像头控制扩展 · 必须补齐</h3><p>GPIO22/23 共用 SCCB/I²C；扩展器至少提供 CSI/DVP 各 RESET、PWDN 共4个输出，高速DVP信号保持直连P4。同地址摄像头需I²C隔离/多路复用；扩展器型号、电压、默认态、复位时序与驱动初始化待定，不能把扩展器端口号直接当作P4 GPIO号。</p></div><div class="panel"><h3>SD 与 C5 分开</h3><p>C5 已连接 P4 GPIO14–19。按官方映射推导内部采用 slot1；外置卡候选 slot0 的 GPIO39–44，GPIO45 做检测。SD 卡供电来自系统 3.3V；pad66/VDDO4 及固件电压配置未冻结。</p></div><div class="panel"><h3>水下线缆 · 独立 RS485</h3><p>UART3：GPIO28 TX / 29 RX / 30 DE → 收发器 → A/B → 岸端。暂按半双工控制/遥测，不承诺视频回传；终端、参考地、隔离保护、缆长与波特率待定。水泵由GPIO31经板外功率驱动控制，LED仍由STM32 PB8控制。</p></div><div class="panel"><h3>CAN 运行诊断</h3><p>GPIO20/21 经独立 3.3V 收发器接 F4 与 USB-CAN。无证据显示核心板带 CAN 收发器，本图按外加预算。保留 USB24/25、BOOT/RESET；37/38 仅保留恢复测试点。</p></div></div>
<h2>候选分配 · 42 个 GPIO</h2><p class="caption">不含 CSI 六个与 USB HS 两个专用差分脚。不计 C5 GPIO，不包含额外屏控、4G 开机控制/流控或驱动故障输入；摄像头慢速控制依赖外置扩展器。外围型号确定后复核。</p><div class="table-scroll"><table><thead><tr><th>模块</th><th>用途</th><th>P4 GPIO</th><th>核心板焊盘</th><th>候选功能</th><th>定位</th></tr></thead><tbody>${tableRows}</tbody></table></div>
<details><summary>全部 88 个焊盘 · 已确认名称与候选用途</summary><div class="table-scroll"><table><thead><tr><th>焊盘</th><th>说明书名称</th><th>本项目用途</th><th>状态 / 说明</th></tr></thead><tbody>${pins.map(p=>`<tr><td>#${p.pin}</td><td>${esc(p.name)}</td><td>${esc(p.label)}</td><td>${esc(p.allocationStatus+'；'+p.note)}</td></tr>`).join('')}</tbody></table></div></details>
<details><summary>核心板内部 P4 ↔ C5 连接</summary><div class="table-scroll"><table><thead><tr><th>P4</th><th>C5</th><th>内部连接 · PDF 第10页</th></tr></thead><tbody>${data.internalConnections.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>
<section class="sources"><h2>证据与改板边界</h2><p><strong>直接确认：</strong>说明书第7页模块符号、第8–10页引脚表、第10页内部 SDIO/复位连接、第11页启动与外部复位要求。模块 pad2 是 C5 射频天线，尽管表内写作 LAN_OUT，也不是以太网接口。</p><p><strong>工程分配：</strong>42 GPIO 分配、内部 slot1 / 外置 slot0、摄像头 GPIO 扩展器、水下 RS485 与 CAN 收发器均为本项目候选；开发底板 V1.5 的 TF_CARD 使用 GPIO39–44 与检测45，仅作为参考证据。CAN、UART、DVP等按矩阵路由；SD使用所列slot0脚，USB与CSI专用脚不混用。DVP选择LCD_CAM路径，XCLK需满足时钟整数分频；GPIO0/1不接32kHz晶振，GPIO4不再用于GPIO JTAG。</p><p><strong>尚待确认：</strong>实物究竟 P4C3 还是 P4C5、核心板修订/芯片代次、pad66 电源定义与 VDDO4、启动电路、摄像头/扩展器/外部通信模块型号、电平与电源、SCCB地址隔离、扩展器初始化时序、水下线缆速率及独立视频回传方案。说明书第13页没有完整核心板原理图；不能宣称已完成电气验证。</p><ul>${sourceLinks.map(([label,url])=>`<li><a href="${url}" target="_blank" rel="noopener">${esc(label)}</a></li>`).join('')}<li>本地来源：P4C5核心板说明书.pdf（用户提供，已渲染查看相关页）</li></ul><p><a href="ESP32P4C5引脚配置数据.json" download>完整配置 JSON</a> · <a href="../docs/双主控资源预算与候选引脚.md">双主控资源记录</a> · 核查日期：2026-11-18。HTML / SVG 用于评审，不能代替 EDA 封装、网表和电气验证。</p></section>
</main><script type="application/json" id="pin-data">${JSON.stringify(data).replace(/</g,'\\u003c')}</script><script>
const config=JSON.parse(document.getElementById('pin-data').textContent),box=document.getElementById('inspection');
if(new URLSearchParams(location.search).get('embed')==='1')document.body.classList.add('embedded');
function show(title,detail){box.replaceChildren();const h=document.createElement('h2'),p=document.createElement('p');h.textContent=title;p.textContent=detail;box.append(h,p);}
function highlight(group,pin){document.querySelectorAll('.pin-hit').forEach(n=>n.classList.toggle('selected',pin?Number(n.dataset.pin)===pin:!!group&&n.dataset.group===group));document.querySelectorAll('tr[data-group]').forEach(n=>n.classList.toggle('active',!!group&&n.dataset.group===group));}
function choosePin(pin){const p=config.pins.find(p=>p.pin===pin);if(!p)return;highlight(p.group,pin);show('#'+pin+' · '+p.name+' → '+p.label,p.allocationStatus+'。'+p.note+' 物理焊盘依据：'+p.evidence);}
document.querySelectorAll('.pin-hit').forEach(n=>{n.addEventListener('click',()=>choosePin(Number(n.dataset.pin)));n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choosePin(Number(n.dataset.pin));}});});
document.getElementById('module-filter').addEventListener('change',e=>{const g=config.groups.find(g=>g.id===e.target.value);highlight(g?.id);if(g)show(g.name,config.pins.filter(p=>p.group===g.id).map(p=>'#'+p.pin+' '+p.name+' '+p.label).join('；')+'。'+g.note);else show('全部 88 个焊盘','彩色功能为候选分配；已确认名称和物理脚号来自核心板资料。');});
document.querySelectorAll('[data-select-pin]').forEach(n=>n.addEventListener('click',()=>{choosePin(Number(n.dataset.selectPin));document.getElementById('chip-viewport').scrollIntoView({block:'start'});}));
document.getElementById('zoom-map').addEventListener('click',e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));e.currentTarget.textContent=on?'显示全图':'放大读图';document.getElementById('chip-viewport').classList.toggle('detail',on);});
document.getElementById('export-csv').addEventListener('click',()=>{const rows=[['模块','用途','P4_GPIO','模块焊盘','候选功能','状态','设计边界'],...config.routes.map(r=>[r.module,r.label,r.gpio,r.pin,r.signal,r.status,r.note])];const csv='\\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\\r\\n'),u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='ESP32P4C5_候选引脚.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);});
</script></body></html>`;
for(const m of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))if(!m[0].includes('application/json'))new vm.Script(m[1]);
write('ESP32P4C5引脚配置图.html',html);write('ESP32P4C5引脚配置图.svg',svg);write('ESP32P4C5引脚配置数据.json',JSON.stringify(data,null,2));
console.log(JSON.stringify({pads:pins.length,assignedGPIO:routes.length,groups:Object.fromEntries(groups.map(g=>[g.id,routes.filter(r=>r.group===g.id).length])),budget:data.budget}));
