const navToggle=document.querySelector('.mobile-nav-toggle'),navSide=document.querySelector('.sidebar');
function closeNav(){navSide.classList.remove('open');navToggle?.setAttribute('aria-expanded','false');}
navToggle?.addEventListener('click',()=>{const on=navSide.classList.toggle('open');navToggle.setAttribute('aria-expanded',String(on));});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNav();});
document.querySelectorAll('.sidebar a').forEach(a=>a.addEventListener('click',closeNav));
function activeNav(a){if(!a)return;document.querySelectorAll('.toc a').forEach(n=>{n.classList.toggle('active',n===a);if(n===a)n.setAttribute('aria-current','location');else n.removeAttribute('aria-current');});}
function setModule(id){const select=document.getElementById('section');if(!select)return;select.value=id;select.dispatchEvent(new Event('change'));document.getElementById('schematic').scrollIntoView({block:'start'});history.replaceState(null,'',id?'?module='+id+'#schematic':location.pathname+'#schematic');activeNav(document.querySelector(id?'[data-module="'+id+'"]':'.toc [data-section="schematic"]'));}
document.querySelectorAll('[data-module]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();setModule(a.dataset.module);}));
document.querySelectorAll('.toc a[data-section]').forEach(a=>a.addEventListener('click',e=>{if(a.dataset.section==='schematic'){e.preventDefault();setModule('');}else activeNav(a);}));
document.getElementById('fit')?.addEventListener('click',()=>setModule(''));
const sections=[...document.querySelectorAll('.toc a[data-section]')].map(a=>document.getElementById(a.dataset.section)).filter(Boolean);
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{const e=entries.find(e=>e.isIntersecting);if(e){const mod=new URLSearchParams(location.search).get('module');activeNav(document.querySelector(e.target.id==='schematic'&&mod?'[data-module="'+mod+'"]':'.toc [data-section="'+e.target.id+'"]'));}},{rootMargin:'-5% 0px -70% 0px'});sections.forEach(s=>observer.observe(s));}
window.addEventListener('message',e=>{if(!e.data||e.data.kind!=='boat:height')return;const f=[...document.querySelectorAll('iframe[data-auto-height]')].find(f=>f.contentWindow===e.source);const h=Number(e.data.height);if(f&&Number.isFinite(h)&&h>100&&h<5000)f.style.height=Math.ceil(h)+'px';});