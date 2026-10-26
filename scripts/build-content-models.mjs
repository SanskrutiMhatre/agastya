#!/usr/bin/env node
/*
  Compile the S1000D XSD content models into the form the structured editor
  asks position-aware questions of. Ported from the Agastya original
  (backend/scripts/build-content-models.mjs, commit db7e250; decisions.md E1),
  reading the schemas bundled in vendor/schemas.

  Each element's model is kept as a particle tree (sequence, choice and
  occurrence intact), not flattened to a list of names, so the editor can
  tell what may come NEXT at a given position:

    { version, models: { "4.2/descript": { element: defIndex } },
      defs: [ { c: Particle|null, a: { attr: enumIndex|null }, t?: 1 } ],
      enums: string[][] }

    Particle = { k:'e', n, min, max } | { k:'s'|'c', c:[...], min, max } | { k:'a', min, max }
    max === -1 means unbounded; t: 1 marks an element that holds text.

  One model per (issue, schema type), never unioned: in 4.2 <content> takes
  <description> in a descriptive module and <procedure> in a procedural one.
  Definitions are interned across models.

  Usage: node scripts/build-content-models.mjs [--check] [--issues 4.1,4.2,5.0,6.0]
    --check  build in memory and compare with the committed file (exit 1 if stale)
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xmldom from '@xmldom/xmldom';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const SCHEMA_ROOT = arg('schemas', path.join(ROOT, 'vendor', 'schemas'));
const OUT = arg('out', path.join(ROOT, 'client', 'src', 'data', 'content-models.json'));
const ISSUES = arg('issues', '4.1,4.2,5.0,6.0').split(',').map((s) => s.trim()).filter(Boolean);
// Support vocabularies with no authoring model.
const SKIP_SCHEMAS = new Set(['dc', 'rdf', 'xcf', 'xlink', 'xml']);

const quiet = () => {};
const parser = new xmldom.DOMParser({ errorHandler: { warning: quiet, error: quiet, fatalError: quiet } });

const local = (el) => el.localName || String(el.nodeName).replace(/^.*:/, '');
function kids(el, ...names) {
  const out = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType !== 1) continue;
    if (names.length === 0 || names.includes(local(n))) out.push(n);
  }
  return out;
}
const attr = (el, name) => (el.hasAttribute(name) ? el.getAttribute(name) : null);
function occurs(el) {
  const min = attr(el, 'minOccurs');
  const max = attr(el, 'maxOccurs');
  return { min: min === null ? 1 : parseInt(min, 10), max: max === null ? 1 : (max === 'unbounded' ? -1 : parseInt(max, 10)) };
}
const wrap = (p) => (p.min === 1 && p.max === 1 ? p : { k: 's', c: [p], min: 1, max: 1 });

class Schema {
  constructor(text) {
    this.root = parser.parseFromString(text, 'text/xml').documentElement;
    this.complexTypes = new Map(); this.simpleTypes = new Map(); this.groups = new Map();
    this.attributeGroups = new Map(); this.globalAttributes = new Map(); this.globalElements = new Map();
    for (const el of kids(this.root)) {
      const name = attr(el, 'name');
      if (!name) continue;
      const map = { complexType: this.complexTypes, simpleType: this.simpleTypes, group: this.groups, attributeGroup: this.attributeGroups, attribute: this.globalAttributes, element: this.globalElements }[local(el)];
      if (map) map.set(name, el);
    }
  }

  // A complexType's particle tree, or null when it holds no elements.
  particleOf(ct, depth = 0) {
    if (!ct || depth > 12) return null;
    for (const cc of kids(ct, 'complexContent')) {
      for (const ext of kids(cc, 'extension', 'restriction')) {
        const baseName = attr(ext, 'base');
        const base = baseName ? this.complexTypes.get(baseName) : null;
        const basePart = base && local(ext) === 'extension' ? this.particleOf(base, depth + 1) : null;
        const own = this.particleFromContainer(ext, depth + 1);
        if (basePart && own) return { k: 's', c: [basePart, own], min: 1, max: 1 };
        return own || basePart;
      }
    }
    if (kids(ct, 'simpleContent').length > 0) return null;
    return this.particleFromContainer(ct, depth);
  }

  particleFromContainer(el, depth) {
    for (const child of kids(el, 'sequence', 'choice', 'all', 'group')) return this.particle(child, depth);
    return null;
  }

  particle(el, depth = 0) {
    if (depth > 40) return null;
    const { min, max } = occurs(el);
    const name = local(el);
    if (name === 'element') {
      const ref = attr(el, 'ref') || attr(el, 'name');
      return ref ? { k: 'e', n: ref, min, max } : null;
    }
    if (name === 'any') return { k: 'a', min, max };
    if (name === 'group') {
      const ref = attr(el, 'ref');
      const g = ref ? this.groups.get(ref) : el;
      if (!g) return null;
      const inner = this.particleFromContainer(g, depth + 1);
      if (!inner) return null;
      return min === 1 && max === 1 ? inner : { ...wrap(inner), min, max };
    }
    if (name === 'sequence' || name === 'choice' || name === 'all') {
      const items = [];
      for (const child of kids(el, 'element', 'group', 'sequence', 'choice', 'all', 'any')) {
        const p = this.particle(child, depth + 1);
        if (p) items.push(p);
      }
      if (!items.length) return null;
      // xs:all is order-free: modelled as a choice (over-accepts order, never rejects a legal document).
      return { k: name === 'sequence' ? 's' : 'c', c: items, min, max };
    }
    return null;
  }

  attributesOf(ct, depth = 0) {
    const out = {};
    if (!ct || depth > 8) return out;
    const collect = (container) => {
      for (const a of kids(container, 'attribute')) {
        const ref = attr(a, 'ref');
        const nm = ref || attr(a, 'name');
        if (!nm || attr(a, 'use') === 'prohibited') continue;
        out[nm] = this.attributeValues(ref ? this.globalAttributes.get(ref) : a);
      }
      for (const ag of kids(container, 'attributeGroup')) {
        const ref = attr(ag, 'ref');
        const g = ref ? this.attributeGroups.get(ref) : ag;
        if (g) Object.assign(out, this.attributesOf(g, depth + 1));
      }
      for (const cc of kids(container, 'complexContent', 'simpleContent')) {
        for (const ext of kids(cc, 'extension', 'restriction')) {
          const baseName = attr(ext, 'base');
          const base = baseName ? this.complexTypes.get(baseName) : null;
          if (base) Object.assign(out, this.attributesOf(base, depth + 1));
          collect(ext);
        }
      }
    };
    collect(ct);
    return out;
  }

  attributeValues(attrEl) {
    if (!attrEl) return [];
    const fixed = attr(attrEl, 'fixed');
    if (fixed) return [fixed];
    const inline = kids(attrEl, 'simpleType')[0];
    const typeName = attr(attrEl, 'type');
    const st = inline || (typeName ? this.simpleTypes.get(typeName) : null);
    if (!st) return [];
    const values = [];
    const seen = new Set();
    const walk = (node, d) => {
      if (d > 6) return;
      for (const child of kids(node)) {
        const n = local(child);
        if (n === 'enumeration') { const v = attr(child, 'value'); if (v !== null) values.push(v); }
        else if (n === 'restriction' && attr(child, 'base') && this.simpleTypes.has(attr(child, 'base')) && !seen.has(attr(child, 'base'))) {
          seen.add(attr(child, 'base'));
          walk(child, d + 1);
          walk(this.simpleTypes.get(attr(child, 'base')), d + 1);
        } else walk(child, d + 1);
      }
    };
    walk(st, 0);
    return [...new Set(values)];
  }

  // Text lives here: a simple or built-in type, simpleContent, or mixed content.
  holdsText(el) {
    const typeName = attr(el, 'type');
    if (typeName && !this.complexTypes.has(typeName)) return true;
    const ct = this.typeOfElement(el);
    if (!ct) return false;
    if (attr(ct, 'mixed') === 'true') return true;
    if (kids(ct, 'simpleContent').length > 0) return true;
    for (const cc of kids(ct, 'complexContent')) {
      if (attr(cc, 'mixed') === 'true') return true;
      for (const ext of kids(cc, 'extension', 'restriction')) {
        const baseName = attr(ext, 'base');
        const base = baseName ? this.complexTypes.get(baseName) : null;
        if (baseName && !base) return true;
        if (base && attr(base, 'mixed') === 'true') return true;
        if (base && kids(base, 'simpleContent').length > 0) return true;
      }
    }
    return false;
  }

  typeOfElement(el) {
    const typeName = attr(el, 'type');
    if (typeName && this.complexTypes.has(typeName)) return this.complexTypes.get(typeName);
    return kids(el, 'complexType')[0] || null;
  }
}

const enums = [], enumIndex = new Map(), defs = [], defIndex = new Map();
function internEnum(values) {
  if (!values || !values.length) return null;
  const key = values.join('\u0000');
  let i = enumIndex.get(key);
  if (i === undefined) { i = enums.length; enums.push(values); enumIndex.set(key, i); }
  return i;
}
function internDef(content, attrs, text) {
  const a = {};
  for (const k of Object.keys(attrs).sort()) a[k] = internEnum(attrs[k]);
  const def = text ? { c: content, a, t: 1 } : { c: content, a };
  const key = JSON.stringify(def);
  let i = defIndex.get(key);
  if (i === undefined) { i = defs.length; defs.push(def); defIndex.set(key, i); }
  return i;
}

const models = {};
const report = [];
for (const issue of ISSUES) {
  const dir = path.join(SCHEMA_ROOT, issue);
  if (!fs.existsSync(dir)) { console.warn(`  ! no schemas for issue ${issue}`); continue; }
  let schemas = 0, elements = 0;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.xsd')).sort()) {
    const type = path.basename(file, '.xsd');
    if (SKIP_SCHEMAS.has(type)) continue;
    const schema = new Schema(fs.readFileSync(path.join(dir, file), 'utf8'));
    const model = {};
    for (const [name, el] of [...schema.globalElements].sort((x, y) => x[0].localeCompare(y[0]))) {
      if (name.includes(':')) continue;
      const ct = schema.typeOfElement(el);
      model[name] = internDef(ct ? schema.particleOf(ct) : null, ct ? schema.attributesOf(ct) : {}, schema.holdsText(el));
    }
    models[`${issue}/${type}`] = model;
    schemas++; elements += Object.keys(model).length;
  }
  report.push([issue, schemas, elements]);
}

const text = JSON.stringify({ version: 1, enums, defs, models }) + '\n';
if (args.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== text) { console.error(`${path.relative(ROOT, OUT)} is out of date: run npm run content-models`); process.exit(1); }
  console.log('content models up to date');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text, 'utf8');
  console.log('S1000D content models (particle trees, sequence preserved)');
  for (const [issue, s, e] of report) console.log(`  issue ${issue.padEnd(4)} ${String(s).padStart(2)} schemas  ${String(e).padStart(5)} elements`);
  console.log(`  models ${Object.keys(models).length} · unique defs ${defs.length} · enum lists ${enums.length} -> ${path.relative(ROOT, OUT)} (${(Buffer.byteLength(text) / 1024).toFixed(0)} KB)`);
}
