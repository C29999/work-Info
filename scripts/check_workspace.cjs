const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const design = path.join(root, 'design');
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
const errors = [];
let links = 0;
let scripts = 0;
const checkLink = (file, value) => {
  if (!value || /^(?:#|\?|[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return;
  const relative = decodeURIComponent(value.split(/[?#]/)[0]);
  if (!relative) return;
  links++;
  if (!fs.existsSync(path.resolve(path.dirname(file), relative))) {
    errors.push(`${path.relative(root, file)} -> ${relative}`);
  }
};

const pages = [path.join(root, 'index.html'), ...fs.readdirSync(design)
  .filter(name => name.endsWith('.html')).map(name => path.join(design, name))];
for (const file of pages) {
  const dom = new JSDOM(fs.readFileSync(file, 'utf8'));
  try {
    for (const element of dom.window.document.querySelectorAll('[href], [src], object[data]')) {
      for (const attribute of ['href', 'src', 'data']) checkLink(file, element.getAttribute(attribute));
    }
    for (const script of dom.window.document.scripts) {
      if (script.src || script.type === 'application/json') continue;
      try {
        new vm.Script(script.textContent, { filename: path.basename(file) });
        scripts++;
      } catch (error) {
        errors.push(`${path.basename(file)}: ${error.message}`);
      }
    }
  } finally {
    dom.window.close();
  }
}

const jsonFiles = fs.readdirSync(design).filter(name => name.endsWith('.json'));
for (const name of jsonFiles) JSON.parse(fs.readFileSync(path.join(design, name), 'utf8'));
const board = JSON.parse(fs.readFileSync(path.join(design, '无人船_整板_原理图连接表.json'), 'utf8'));
const dom = new JSDOM(fs.readFileSync(path.join(design, '原理图设计.html'), 'utf8'));
try {
  assert.deepEqual(JSON.parse(dom.window.document.getElementById('schematic-data').textContent), board,
    'HTML embedded connection data must match standalone JSON');
} finally {
  dom.window.close();
}
assert.equal(new Set(board.components.map(component => component.ref)).size, board.components.length,
  'Component references must be unique');
const nets = {};
for (const component of board.components) {
  for (const [pin, definition] of Object.entries(component.pins)) {
    if (definition.net === null) continue;
    (nets[definition.net] ??= []).push({ ref: component.ref, pin, name: definition.name,
      kind: component.kind, sheet: component.sheet, domain: component.domain });
  }
}
assert.deepEqual(nets, board.nets, 'Net index must match component pin connections');
const f4 = board.components.find(component => component.ref === 'U1');
const p4 = board.components.find(component => component.ref === 'U701');
assert.equal(Object.keys(f4.pins).length, 100);
assert.equal(Object.keys(p4.pins).length, 88);
for (const name of fs.readdirSync(path.join(root, 'scripts')).filter(name => /\.(?:cjs|js)$/.test(name))) {
  new vm.Script(fs.readFileSync(path.join(root, 'scripts', name), 'utf8'), { filename: name });
}
assert.deepEqual(errors, [], 'Local links and inline JavaScript must be valid');
console.log(JSON.stringify({ pages: pages.length, localLinks: links, inlineScripts: scripts,
  jsonFiles: jsonFiles.length, revision: board.revision, components: board.components.length,
  networks: Object.keys(nets).length, f4Pins: 100, p4Pads: 88, errors }, null, 2));
