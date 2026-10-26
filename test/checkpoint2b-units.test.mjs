// Checkpoint 2b units: the publication module reader and writer, the
// builder's splice and round trip, XInclude detection, and the client's tree
// operations (ported from the Agastya original).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as tree from '../client/src/lib/pmcTree.js';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pmc = require('../vendor/engine/pmc.js');
const pub = require('../server/content/publication.js');
const { xincludeProblem } = require('../server/content/xinclude.js');

const golden = fs.readFileSync(path.join(ROOT, 'samples', 'golden', 'publication.xml'), 'utf8');

test('a pmEntry with several dmRefs is a chapter of modules; nothing is dropped', () => {
  const m = pmc.parsePm(golden);
  assert.deepEqual(pmc.countEntries(m.entries), { folders: 3, dms: 8, total: 11 });
  assert.deepEqual(m.entries.map((e) => [e.title, e.children.length]), [['General', 2], ['Description and technical data', 2], ['Maintenance procedures', 4]]);
  const mixed = '<pm><content><pmEntry><pmEntryTitle>A</pmEntryTitle><dmRef><dmRefIdent><dmCode modelIdentCode="X" systemDiffCode="A" systemCode="00" subSystemCode="0" subSubSystemCode="0" assyCode="00" disassyCode="00" disassyCodeVariant="A" infoCode="040" infoCodeVariant="A" itemLocationCode="D"/></dmRefIdent></dmRef><pmEntry><pmEntryTitle>B</pmEntryTitle></pmEntry></pmEntry></content></pm>';
  const x = pmc.parsePm(mixed);
  assert.equal(x.entries[0].type, 'folder');
  assert.deepEqual(x.entries[0].children.map((c) => c.type), ['dm', 'folder']);
});

test('the builder replaces only <content>, and the golden tree round-trips (indentation aside)', () => {
  const m = pmc.parsePm(golden);
  const entries = pub.validateEntries(JSON.parse(JSON.stringify(m.entries)));
  const out = pub.applyEntries(golden, entries);
  assert.equal(out.slice(0, out.indexOf('<content')), golden.slice(0, golden.indexOf('<content')));
  assert.equal(out.replace(/\s+/g, ''), golden.replace(/\s+/g, ''));
  assert.ok(pub.roundTrip(out, entries));
  const moved = [entries[2], entries[0], entries[1]];
  assert.ok(pub.roundTrip(pub.applyEntries(golden, moved), moved));
  assert.ok(!pub.roundTrip(pub.applyEntries(golden, moved), entries), 'a different order is not the same tree');
  const withInclude = [{ type: 'include', href: 'csdb/DMC-A.xml' }];
  assert.match(pub.applyEntries(golden, withInclude), /<pm xmlns:xi="http:\/\/www\.w3\.org\/2001\/XInclude"/);
});

test('any tree the builder can make reads back as the same tree (random trees)', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let n = 0;
  const dm = () => {
    const e = { type: 'dm', dmCode: { modelIdentCode: 'AGS', systemDiffCode: 'A', systemCode: String(10 + (n++ % 80)), subSystemCode: '0', subSubSystemCode: '0', assyCode: '00', disassyCode: '00', disassyCodeVariant: 'A', infoCode: '040', infoCodeVariant: 'A', itemLocationCode: 'D' } };
    if (rnd() < 0.3) e.title = `Titled ${n}`;
    if (rnd() < 0.5) { e.techName = `Tech ${n}`; e.infoName = 'Description'; }
    return e;
  };
  const make = (depth) => Array.from({ length: Math.floor(rnd() * 4) }, () => (depth < 3 && rnd() < 0.45
    ? { type: 'folder', title: rnd() < 0.85 ? `Chapter ${n++}` : '', children: make(depth + 1) }
    : dm()));
  for (let i = 0; i < 300; i++) {
    const entries = pub.validateEntries(make(0).length ? make(0) : [dm()]);
    const text = pub.applyEntries(golden, entries);
    assert.ok(pub.roundTrip(text, entries), `tree ${i}: ${JSON.stringify(entries).slice(0, 300)}`);
    assert.deepEqual(pmc.countEntries(pmc.parsePm(text).entries), pmc.countEntries(entries), `tree ${i}`);
  }
  // The case that once failed: a chapter with one untitled module.
  const lone = [{ type: 'folder', title: 'Annex', children: [dm()] }].map((e) => ({ ...e, children: e.children.map((c) => { const { title, ...rest } = c; void title; return rest; }) }));
  assert.ok(pub.roundTrip(pub.applyEntries(golden, lone), lone));
});

test('entry validation: unknown fields and hostile values are refused with the entry named', () => {
  assert.throws(() => pub.validateEntries([{ type: 'folder', title: 'a', children: [{ type: 'dm', dmCode: { modelIdentCode: 'A', evil: 'x' } }] }]), /Entry 1\/1 dmCode has an unknown field "evil"/);
  assert.throws(() => pub.validateEntries([{ type: 'dm', dmCode: { modelIdentCode: '<x>' } }]), /not a valid value/);
  assert.throws(() => pub.validateEntries([{ type: 'folder', title: 'x\u0001', children: [] }]), /control characters/);
  assert.throws(() => pub.validateEntries([{ type: 'dm', dmCode: {} }]), /no data module code/);
  assert.throws(() => pub.validateEntries(Array.from({ length: 5001 }, () => ({ type: 'folder', title: 'x', children: [] }))), /at most 5000/);
  assert.deepEqual(pub.validateEntries([{ type: 'folder', title: 'T', children: [] }]), [{ type: 'folder', title: 'T', children: [] }]);
});

test('XInclude: found by namespace however it is written', () => {
  const ns = 'http://www.w3.org/2001/XInclude';
  assert.equal(xincludeProblem('<dmodule><para>include me</para></dmodule>'), null);
  assert.match(xincludeProblem(`<dmodule xmlns:xi="${ns}"><xi:include href="a.xml"/></dmodule>`).message, /not allowed in a data module/);
  assert.ok(xincludeProblem(`<dmodule><x:include xmlns:x="${ns}" href="a"/></dmodule>`));
  assert.ok(xincludeProblem('<dmodule><include xmlns="http://www.w3.org/2003/XInclude" href="a"/></dmodule>'), 'the 2003 namespace too');
  assert.ok(xincludeProblem('<dmodule xmlns:q="http&#58;//www.w3.org/2001/XInclude"><q:include href="a"/></dmodule>'), 'a character reference in the namespace');
  assert.equal(xincludeProblem(`<pm xmlns:xi="${ns}"><xi:include href="csdb/DMC-A-B.xml"/><xi:include href="DMC-C.xml"/></pm>`), null);
  for (const href of ['../x.xml', 'csdb/../../x.xml', '/etc/passwd', 'C:/x.xml', 'file:///c:/x.xml', 'http://x/y.xml', 'csdb\\x.xml', 'project.json', 'publication.xml']) {
    assert.ok(xincludeProblem(`<pm xmlns:xi="${ns}"><xi:include href="${href}"/></pm>`), href);
  }
  assert.ok(xincludeProblem(`<pm xmlns:xi="${ns}"><xi:include href="csdb/A.xml" parse="text"/></pm>`));
});

test('client tree: moves keep every module exactly once, in the expected order', () => {
  const dm = (n) => ({ type: 'dm', dmCode: { modelIdentCode: n } });
  const entries = [{ type: 'folder', title: 'A', children: [dm('1'), dm('2')] }, { type: 'folder', title: 'B', children: [dm('3')] }, dm('4')];
  const ids = (e) => JSON.stringify(e).match(/"modelIdentCode":"\d"/g).map((x) => x.slice(-2, -1)).join('');
  assert.equal(ids(tree.moveTo(entries, [0, 0], [1], 1)), '2314');
  assert.equal(tree.moveTo(entries, [0], [0], 0), entries, 'a chapter into itself is refused');
  assert.equal(tree.moveTo(entries, [0], [0, 1], 0), entries, 'or into its own descendant');
  assert.equal(ids(tree.moveTo(entries, [2], [], 0)), '4123');
  const up = tree.moveBy(entries, [1], -1);
  assert.deepEqual(up.path, [0]);
  assert.equal(up.entries[0].title, 'B');
  assert.equal(tree.moveBy(entries, [0], -1).entries, entries, 'the first cannot move up');
  const down = tree.moveBy(entries, [0, 0], 1);
  assert.equal(ids(down.entries), '2134');
  assert.deepEqual(down.path, [0, 1]);
  assert.deepEqual(tree.dropTarget(entries, [1], 'inside'), { parentPath: [1], index: 1 });
  assert.deepEqual(tree.dropTarget(entries, [2], 'inside'), { parentPath: [], index: 2 }, 'a module has no inside');
  assert.deepEqual(tree.countOf(entries), { folders: 2, dms: 4, total: 6 });
  assert.equal(tree.labelFor({ type: 'dm', dmCode: {}, techName: 'Fan', infoName: 'Description' }), 'Fan – Description');
  assert.equal(entries[0].children.length, 2, 'the original is never mutated');
});
