// Checkpoint 2c units: the compiled content models, the position-aware
// automaton, the structured editor's document layer and the XML panel's
// scanner. The client modules run here unchanged, with xmldom standing in for
// the browser's DOMParser and XMLSerializer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import xmldom from '@xmldom/xmldom';
import { contentModelFor, modelKeys } from '../client/src/schema/contentModel.js';
import * as X from '../client/src/editor/xmlDoc.js';
import { openStack } from '../client/src/editor/xmlScan.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
// xmldom as the browser: parse errors are collected rather than thrown.
const impl = {
  DOMParser: xmldom.DOMParser, XMLSerializer: xmldom.XMLSerializer,
  errorHandler: (report) => ({ warning: () => {}, error: report, fatalError: report }),
};

test('the committed content models are up to date with the bundled XSDs', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-content-models.mjs'), '--check'], { encoding: 'utf8' });
  assert.match(out, /up to date/);
  const keys = modelKeys();
  for (const k of ['4.1/descript', '4.2/descript', '4.2/proced', '4.2/ipd', '5.0/descript', '6.0/descript', '4.2/pm', '4.2/brex']) assert.ok(keys.includes(k), k);
});

test('the compiled 4.2 descriptive model matches the Agastya original exactly', () => {
  const ours = JSON.parse(read('client/src/data/content-models.json'));
  const orig = JSON.parse(read('docs/reference/agastya sourcecode/Agastya_V.01/frontend/src/data/content-models.json'));
  for (const key of ['4.2/descript', '4.2/proced']) {
    const a = ours.models[key], b = orig.models[key];
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), key);
    for (const n of Object.keys(a)) assert.deepEqual(ours.defs[a[n]].c, orig.defs[b[n]].c, `${key} ${n}`);
  }
});

test('position-aware insertion: figure, content and levelledPara', () => {
  const m = contentModelFor('4.2', 'descript');
  assert.equal(m.key, '4.2/descript');
  assert.deepEqual(m.insertableAt('figure', ['title', 'graphic'], 2), ['graphic', 'legend']);
  assert.deepEqual(m.insertableAt('figure', ['title', 'graphic'], 0), [], 'nothing before the title');
  assert.ok(m.insertableAt('content', [], 0).includes('description'));
  assert.ok(!m.insertableAt('content', [], 0).includes('procedure'), 'a descriptive module is not offered procedures');
  assert.ok(contentModelFor('4.2', 'proced').insertableAt('content', [], 0).includes('procedure'));
  assert.ok(m.isValidSequence('figure', ['title', 'graphic', 'graphic']));
  assert.ok(!m.isValidSequence('figure', ['graphic']));
  assert.equal(m.firstInvalidIndex('figure', ['graphic']), 0);
  assert.equal(m.firstInvalidIndex('figure', ['title']), 1, 'incomplete: graphic is still needed');
  assert.ok(m.holdsText('para') && m.holdsText('title') && !m.holdsText('levelledPara') && !m.holdsText('figure'));
  assert.deepEqual(m.requiredChildren('figure'), ['title', 'graphic']);
  assert.ok(m.attributesOf('emphasis').emphasisType.includes('em01'));
  const unknownIssue = contentModelFor('9.9', 'descript');
  assert.equal(unknownIssue.key, '4.2/descript');
  assert.equal(unknownIssue.exact, false);
});

test('document layer: the prolog, ISO entities and untouched text survive an edit', () => {
  const src = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE dmodule [\n<!ENTITY ICN-X SYSTEM "ICN-X.png" NDATA png>\n]>\n<dmodule>\n  <content>\n    <description>\n      <para>Range 10&ndash;20 &amp; more</para>\n    </description>\n  </content>\n</dmodule>\n';
  const p = X.parseXml(src, impl);
  assert.ok(!p.error, p.error && p.error.message);
  assert.equal(X.serializeXml(p, impl), src, 'nothing edited, nothing changed');
  X.setAttribute(p, [0, 0, 0], 'id', 'par-0001');
  const out = X.serializeXml(p, impl);
  assert.ok(out.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE dmodule [\n<!ENTITY ICN-X SYSTEM "ICN-X.png" NDATA png>\n]>\n'));
  assert.match(out, /<para id="par-0001">Range 10&ndash;20 &amp; more<\/para>/);
  assert.equal(X.displayText(X.elementAt(p.doc, [0, 0, 0]).firstChild.data), 'Range 10&ndash;20 & more');
});

test('document layer: insert (filled from the model), inline insert at the cursor, move, delete, text', () => {
  const m = contentModelFor('4.2', 'descript');
  const src = '<dmodule>\n  <content>\n    <description>\n      <para>One</para>\n      <para>Turn the switch off.</para>\n    </description>\n  </content>\n</dmodule>';
  const p = X.parseXml(src, impl);
  const fig = X.insertElement(p, [0, 0], 2, 'figure', m);
  assert.deepEqual(fig, [0, 0, 2]);
  assert.deepEqual(X.childNames(X.elementAt(p.doc, fig)), ['title', 'graphic'], 'a new figure has what it needs');
  const em = X.insertInline(p, [0, 0, 1], 0, 9, 'emphasis', m);
  X.setText(p, em, 0, 'the switch');
  const para2 = X.elementAt(p.doc, [0, 0, 1]);
  assert.equal(new xmldom.XMLSerializer().serializeToString(para2), '<para>Turn the <emphasis>the switch</emphasis>switch off.</para>');
  const moved = X.moveElement(p, [0, 0, 2], -1);
  assert.deepEqual(moved, [0, 0, 1]);
  assert.deepEqual(X.childNames(X.elementAt(p.doc, [0, 0])), ['para', 'figure', 'para']);
  X.removeElement(p, [0, 0, 1]);
  assert.deepEqual(X.childNames(X.elementAt(p.doc, [0, 0])), ['para', 'para']);
  const out = X.serializeXml(p, impl);
  assert.ok(!/\n\s*\n\s*\n/.test(out), 'no pile of blank lines after the delete');
  assert.deepEqual(X.pathOf(X.elementAt(p.doc, [0, 0, 1])), [0, 0, 1]);
});

test('document layer: content-model problems are found where they are', () => {
  const m = contentModelFor('4.2', 'descript');
  const p = X.parseXml('<dmodule><content><description><figure><graphic infoEntityIdent="ICN-A"/></figure><para>x</para></description></content></dmodule>', impl);
  const problems = X.contentProblems(p.doc, m);
  const fig = problems.find((x) => x.name === 'figure');
  assert.ok(fig, JSON.stringify(problems));
  assert.deepEqual(fig.path, [0, 0, 0]);
  assert.match(fig.message, /<graphic> is not allowed here in <figure>/);
  assert.ok(problems.some((x) => x.name === 'dmodule'), 'identAndStatusSection is missing');
});

test('document layer: a parse error is reported, with the prolog counted in its line', () => {
  // (Mismatched tags are caught by the browser's strict parser: covered by the browser tests.)
  const r = X.parseXml('<?xml version="1.0"?>\n<dmodule att="unterminated>\n</dmodule>', impl);
  assert.ok(r.error);
  assert.ok(r.error.line >= 1, JSON.stringify(r.error));
});

test('every golden module: an edit keeps every element, attribute and text, and the prolog', () => {
  const dir = path.join(ROOT, 'samples', 'golden', 'csdb');
  const shape = (doc) => {
    const out = [];
    const walk = (el) => { out.push(`${el.nodeName}[${Array.from(el.attributes).map((a) => `${a.name}=${a.value}`).sort().join(',')}]`); for (const n of Array.from(el.childNodes)) { if (n.nodeType === 1) walk(n); else if (n.nodeType === 3 && n.data.trim()) out.push(`#${n.data.trim()}`); } };
    walk(doc.documentElement);
    return out;
  };
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.xml'))) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const p = X.parseXml(text, impl);
    assert.ok(!p.error, `${f}: ${p.error && p.error.message}`);
    assert.equal(X.serializeXml(X.parseXml(text, impl), impl).slice(0, p.prolog.length), p.prolog, `${f}: prolog`);
    const before = shape(p.doc);
    X.setAttribute(p, [], 'id', 'e2e-edit');
    const again = X.parseXml(X.serializeXml(p, impl), impl);
    assert.ok(!again.error, `${f}: ${again.error && again.error.message}`);
    const after = shape(again.doc);
    assert.equal(after[0].includes('id=e2e-edit'), true, f);
    assert.deepEqual(after.slice(1), before.slice(1), `${f}: everything but the edited attribute is the same`);
  }
});

test('XML panel scanner: the open elements and the children each has so far', () => {
  const stack = openStack('<?xml version="1.0"?><dmodule><content><description><para>a<emphasis>b</emphasis></para><figure><title>T</title><graphic infoEntityIdent="I"/>');
  assert.deepEqual(stack.map((s) => s.name), ['dmodule', 'content', 'description', 'figure']);
  assert.deepEqual(stack[2].children, ['para']);
  assert.deepEqual(stack[3].children, ['title', 'graphic']);
  const m = contentModelFor('4.2', 'descript');
  const top = stack[stack.length - 1];
  assert.deepEqual(m.insertableAt(top.name, top.children, top.children.length), ['graphic', 'legend'], 'what completion offers there');
});
