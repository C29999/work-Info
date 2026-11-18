"""Read-only connection-table / rendered-symbol consistency; not EDA ERC/DRC."""
import collections
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
repo = Path(__file__).resolve().parent.parent
root = repo / 'design'
reports = repo / 'reports'
reports.mkdir(exist_ok=True)
data = json.loads((root/'无人船_整板_原理图连接表.json').read_text(encoding='utf-8'))
byref = {c['ref']: c for c in data['components']}
errors, detail = [], []
checked = collections.Counter()


def eq_num(a, b):
    return a is not None and abs(float(a)-float(b)) < 0.01


def text_of(el):
    return ''.join(el.itertext())


def tag(el, name):
    return el.tag.split('}')[-1] == name


def canon(el):
    return (el.tag.split('}')[-1], tuple(sorted(el.attrib.items())),
            (el.text or '').strip(), tuple(canon(c) for c in el))


html = (root/'原理图设计.html').read_text(encoding='utf-8')
embedded = re.search(r'<script id="schematic-data" type="application/json">(.*?)</script>', html, re.S)
html_matches = bool(embedded) and json.loads(embedded.group(1)) == data
if not html_matches:
    errors.append('Embedded HTML connection data differs from standalone JSON')
computed = {}
for c in data['components']:
    for pin, p in c['pins'].items():
        if p['net'] is not None:
            computed.setdefault(p['net'], []).append(dict(ref=c['ref'], pin=pin, name=p['name'],
                kind=c['kind'], sheet=c['sheet'], domain=c['domain']))
if computed != data['nets']:
    errors.append('Net endpoint index mismatch')
svg = ET.parse(root/'无人船_整板_原理图.svg').getroot()
found = re.search(r'<svg\b[^>]*id="svg-board".*?</svg>', html, re.S)
if not found or canon(ET.fromstring(found.group(0))) != canon(svg):
    errors.append('Inline vs standalone SVG mismatch')
parents = {child: parent for parent in svg.iter() for child in parent}
panels = [e for e in svg.iter() if e.get('data-panel')]
for panel in panels:
    # Scope each generic IC to direct siblings in its local coordinate group.
    # This also handles the nested translated 3.3V buck without false overlaps.
    for chip in [e for e in panel.iter() if tag(e, 'rect') and e.get('class') == 'chip']:
        siblings = list(parents[chip])
        texts = [e for e in siblings if tag(e, 'text')]
        lines = [e for e in siblings if tag(e, 'line')]
        x, y, w, h = [float(chip.get(k)) for k in ('x', 'y', 'width', 'height')]
        refs = [e for e in texts if e.get('class') == 'ref' and
                eq_num(e.get('x'), x+w/2) and eq_num(e.get('y'), y+29)]
        if not refs:
            continue  # U1/U701 have explicit per-pin groups, checked below.
        ref = text_of(refs[0])
        if ref not in byref:
            errors.append('Unknown rendered chip '+ref)
            continue
        component = byref[ref]
        seen = set()
        for ptxt in [e for e in texts if e.get('class') == 'pin' and
                     (eq_num(e.get('x'), x+10) or eq_num(e.get('x'), x+w-10)) and
                     y+80 <= float(e.get('y')) <= y+h+0.1]:
            left = eq_num(ptxt.get('x'), x+10)
            val = text_of(ptxt)
            pin, name = val.split(' ', 1) if left else tuple(reversed(val.rsplit(' ', 1)))
            if pin not in component['pins'] or pin in seen:
                errors.append(f'{ref}: unexpected/duplicate display pin {val}')
                continue
            seen.add(pin)
            p = component['pins'][pin]
            if p['name'] != name:
                errors.append(f'{ref}.{pin} name mismatch')
            yy = float(ptxt.get('y'))-5
            x1, x2 = (x-26, x) if left else (x+w, x+w+26)
            wires = [e for e in lines if eq_num(e.get('x1'), x1) and eq_num(e.get('x2'), x2)
                     and eq_num(e.get('y1'), yy) and eq_num(e.get('y2'), yy)]
            if len(wires) != 1 or wires[0].get('data-wire') != p['net']:
                errors.append(f'{ref}.{pin} wire differs from JSON')
            checked[ref] += 1
        detail.append(f'{panel.get("data-panel")}/{ref}: {len(seen)} pins')
for ref, attr in [('U1', 'data-mcu-pin'), ('U701', 'data-pad')]:
    groups = [e for e in svg.iter() if e.get(attr) is not None and
              (ref == 'U1' or e.get('data-component') == ref)]
    numbers = [e.get(attr) for e in groups]
    if len(numbers) != len(set(numbers)) or set(numbers) != set(byref[ref]['pins']):
        errors.append(ref+' visible pin set mismatch')
    for group in groups:
        pin = group.get(attr)
        p = byref[ref]['pins'][pin]
        labels = [e.get('data-net') for e in group.iter() if e.get('data-net') is not None]
        wires = [e for e in group if tag(e, 'line') and e.get('class') == 'wire']
        if not wires or wires[0].get('data-wire') != p['net'] or labels != ([] if p['net'] is None else [p['net']]):
            errors.append(f'{ref}.{pin} wire/label differs from JSON')
        short = re.match(r'^P[A-I]\d+', p['name'])
        name = p['name'] if ref == 'U701' or not short else short.group(0)
        if not any(text_of(e) == name for e in group if tag(e, 'text')):
            errors.append(f'{ref}.{pin} missing visible pin name')
        if p['net'] is None and not any(text_of(e) == 'NC' for e in group if tag(e, 'text')):
            errors.append(f'{ref}.{pin} missing visible NC')
        checked[ref] += 1
for ref, c in byref.items():
    if ref.startswith('U') and checked[ref] != len(c['pins']):
        errors.append(f'{ref}: checked {checked[ref]} pins, expected {len(c["pins"])}')
for e in svg.iter():
    for key in ['data-net', 'data-wire']:
        if e.get(key) is not None and e.get(key) not in computed:
            errors.append('SVG displays unindexed network '+e.get(key))
result = {'method': 'Read-only JSON endpoint and SVG symbol consistency; not EDA ERC/DRC or hardware validation',
          'errors': errors, 'component_count': len(data['components']), 'network_count': len(computed),
          'chip_pins_checked': dict(checked), 'details': detail, 'html_data_matches': html_matches,
          'net_index_matches': computed == data['nets']}
(reports/'electrical-consistency-check.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(bool(errors))
