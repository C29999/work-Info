'use strict';

module.exports=()=>`<div class="dialog-heading"><div><span class="eyebrow">ESP32 · 下载与恢复</span><h2>P4 和 C5 分别烧录</h2></div><button id="close-flash">关闭</button></div>
<p class="notice">本主板 Rev F 有 P4 手动 UART 恢复电路。C5 下载焊盘尚未引出，橙色定位仅帮助查找模块焊盘。</p>
<div class="flash-cards">
 <section class="flash-card p4-card"><h3>① ESP32-P4</h3><p>主程序：视频、存储与外部通信。</p><button data-program-route="flash-p4">定位 P4 下载 / 恢复电路</button><p>TP701 / TP702、SW701 / SW702 已画。USB Serial/JTAG 是逻辑预留口，未接实物 USB 插座。</p></section>
 <section class="flash-card c5-card"><h3>② ESP32-C5</h3><p>无线协处理器：固件需与 P4 端的 ESP-Hosted 配置匹配。</p><button data-program-route="flash-c5">定位 C5 待引出焊盘</button><p>模块焊盘 4 / 5 / 6 / 7 / 82 在本主板上均为 NC。</p></section>
</div>
<div id="flash-instructions">
 <h3>P4 · 本主板上的手动 UART</h3>
 <ol>
  <li>板上正常供电，下载器只接匹配目标电平的 TX / RX / GND。下载器 RX → TP701（P4 TX，模块 64 / GPIO37）；下载器 TX → TP702（P4 RX，模块 65 / GPIO38）。参考底板串口为 3.3 V 逻辑；接线前核对实物电平。</li>
  <li>按住 SW702 BOOT，按下并松开 SW701 RESET，再松开 BOOT。复位释放时模块 62 / GPIO35 为低，63 / GPIO36 为高。TP703 是 P4 EN（模块 87）。</li>
  <li>在目标为 <code>esp32p4</code> 的项目中运行 <code>idf.py -p COMx flash</code>。手动下载后，如未自动运行，松开 BOOT 再按 RESET。</li>
 </ol>
 <p>P4 原生 USB Serial/JTAG 在模块 50（D−）/ 51（D+），即当前 <code>P_USB_DEBUG</code>。USB-HS 摄像头插座走另一组信号，不能当下载口。</p>
 <h3>C5 · 原厂载板或后续夹具</h3>
 <table class="flash-table"><thead><tr><th>模块焊盘</th><th>烧录用途</th></tr></thead><tbody>
 <tr><td>4 / C5_U0RXD</td><td>接下载器 TX</td></tr><tr><td>5 / C5_U0TXD</td><td>接下载器 RX</td></tr>
 <tr><td>6 / GPIO28</td><td>BOOT：C5 复位释放时拉低</td></tr><tr><td>7 / GPIO27</td><td>C5 复位释放时保持高</td></tr>
 <tr><td>82 / P4 GPIO54</td><td>模块内部与 C5 CHIP_PU 共用复位路径。需确认 P4 此时不驱动该线，避免外部下载电路与 P4 争用。</td></tr>
 </tbody></table>
 <p>若用原厂 P4C5 开发底板，插其 CH343P 下载口，把目标开关拨到 C5；它带下载切换与复位电路。自制主板需先补独立下载引出（含共地）和复位控制，SW701 / SW702 只控制 P4。</p>
 <p>在目标为 <code>esp32c5</code> 的项目中用对应端口烧录。若烧厂商提供的 ESP-Hosted 镜像，按该镜像随附的地址烧录，并确认与 P4 主程序匹配。</p>
 <p>资料：<a href="../references/P4C5核心板说明书.pdf">模块焊盘和内部连接</a>、<a href="../references/P4-module开发板原理图V1.4.pdf">厂商下载切换电路</a>、<a href="https://github.com/osptek/devboard-esp32p4c5_module/blob/main/README_EN.md">原厂开发底板操作</a>、<a href="https://docs.espressif.com/projects/esptool/en/latest/esp32p4/advanced-topics/boot-mode-selection.html">P4 启动条件</a>、<a href="https://docs.espressif.com/projects/esptool/en/latest/esp32c5/advanced-topics/boot-mode-selection.html">C5 启动条件</a>。</p>
</div>`;
