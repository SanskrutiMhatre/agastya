'use strict';
// Unit tests: DMC identity, shells, BREX, graphics rules, path containment,
// and the content rules in evaluate().
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dmc = require('../server/content/dmc');
const { renderShell, listShells, securityCode } = require('../server/content/shells');
const dmrl = require('../server/content/dmrl');
const brex = require('../server/content/brex');
const graphics = require('../server/content/graphics');
const { resolveInProject } = require('../server/content/workspace');
const { assertWritableXml } = require('../server/content/xmlcheck');
const { validateDocument } = require('../vendor/engine/validateSchema');
const { evaluate } = require('../server/auth/authz');
const { tmpdir } = require('./helpers');

const D = { modelIdentCode: 'AGS', systemDiffCode: 'A', systemCode: '24', subSystemCode: '1', subSubSystemCode: '0', assyCode: '00', disassyCode: '00', disassyCodeVariant: 'A', infoCode: '520', infoCodeVariant: 'A', itemLocationCode: 'D' };

test('DMC: format, file name and parse are consistent; the own code is not a dmRef', () => {
  assert.equal(dmc.formatDmc(D), 'AGS-A-24-10-00-00A-520A-D');
  assert.equal(dmc.dmcFilename(D), 'DMC-AGS-A-24-10-00-00A-520A-D.xml');
  assert.deepEqual(dmc.parseDmcString('DMC-AGS-A-24-10-00-00A-520A-D.xml'), D);
  assert.equal(dmc.parseDmcString('AGS-A-24-10-00-00A-52A-D'), null);
  const xml = fs.readFileSync(path.join(__dirname, '..', 'samples', 'golden', 'csdb', 'DMC-AGS-A-24-10-00-00A-720A-D.xml'), 'utf8');
  assert.equal(dmc.formatDmc(dmc.parseOwnDmc(xml)), 'AGS-A-24-10-00-00A-720A-D', 'not the brexDmRef or a dmRef inside');
});

test('DMC: every segment is checked, so a code can never form a hostile file name', () => {
  for (const [k, v] of [['modelIdentCode', '..'], ['modelIdentCode', 'A/B'], ['systemCode', 'x\\y'], ['infoCode', '0 4'], ['assyCode', '000'], ['itemLocationCode', 'E'], ['disassyCodeVariant', '']]) {
    assert.equal(dmc.validateDmc({ ...D, [k]: v }).ok, false, `${k}=${v}`);
  }
  assert.equal(dmc.validateDmc({ ...D, modelIdentCode: 'ags' }).dmc.modelIdentCode, 'AGS', 'upper-cased');
});

test('DMC: learn codes are two extra segments, and only go together', () => {
  const L = { ...D, learnCode: 'T01', learnEventCode: 'A' };
  assert.equal(dmc.dmcFilename(L), 'DMC-AGS-A-24-10-00-00A-520A-D-T01-A.xml');
  assert.deepEqual(dmc.parseDmcString('DMC-AGS-A-24-10-00-00A-520A-D-T01-A'), L);
  assert.equal(dmc.validateDmc({ ...D, learnCode: 'T01' }).ok, false);
  assert.equal(dmc.validateDmc({ ...D, learnCode: 'X01', learnEventCode: 'A' }).ok, false);
  assert.equal(dmc.validateDmc({ ...D, learnCode: 'H12', learnEventCode: 'F' }).ok, false);
});

test('the Agastya shells are valid as stamped (every 4.x shell), with every value escaped and only dmIdent rewritten', async () => {
  for (const s of listShells()) {
    const xml = renderShell({ templateId: s.id, dmc: D, techName: 'Pump <A> & "B"', infoName: '</techName><script>', languageIsoCode: 'en', countryIsoCode: 'IN', securityClassification: '01', issueNumber: '001', inWork: '00' });
    const r = await validateDocument('x.xml', xml);
    assert.deepEqual(r.diagnostics, [], s.id);
    assert.match(r.schema, new RegExp(`Issue ${s.issue.replace('.', '\\.')}`));
    assert.ok(!/<script>/.test(xml));
    assert.equal(dmc.formatDmc(dmc.parseOwnDmc(xml)), 'AGS-A-24-10-00-00A-520A-D', s.id);
    assert.match(xml, /<dmStatus issueType="new"/);
    assert.match(xml, /<brexDmRef>[\s\S]*?modelIdentCode="S1000D"/, 'the shell\'s BREX reference is kept when the project has none');
    await assertWritableXml(xml);
  }
  assert.ok(!listShells().some((s) => s.issue === '2.3'), '2.3 shells are not offered');
  assert.equal(securityCode('Top Secret'), '05');
  assert.equal(securityCode('03'), '03');
  assert.throws(() => renderShell({ schemaType: 'descript', templateId: 'proced42', dmc: D }));
});

test('BREX: flags 0 and 2 are evaluated, flag 1 and value-less rules are advisory, bad XPath is skipped', () => {
  const brexXml = `<dmodule><content><brex><contextRules><structureObjectRuleGroup>
    <structureObjectRule><objectPath allowedObjectFlag="0">//emphasis</objectPath><objectUse>No emphasis</objectUse></structureObjectRule>
    <structureObjectRule><objectPath allowedObjectFlag="2">//security/@securityClassification</objectPath><objectUse>01 only</objectUse><objectValue valueForm="single" valueAllowed="01"/></structureObjectRule>
    <structureObjectRule><objectPath allowedObjectFlag="1">//para</objectPath><objectUse>ok</objectUse></structureObjectRule>
    <structureObjectRule><objectPath allowedObjectFlag="0">//[[[</objectPath><objectUse>broken</objectUse></structureObjectRule>
    <structureObjectRule><objectPath allowedObjectFlag="0">count (//para) &gt; 5</objectPath><objectUse>spaced function</objectUse></structureObjectRule>
  </structureObjectRuleGroup></contextRules></brex></content></dmodule>`;
  const rules = brex.parseBrex(brexXml);
  assert.equal(rules.length, 5);
  const r = brex.checkBrex('<dmodule><security securityClassification="03"/><para><emphasis>x</emphasis></para></dmodule>', rules);
  assert.equal(r.findings.length, 2);
  assert.equal(r.advisory, 1);
  assert.equal(r.skipped, 1);
  assert.equal(brex.repairXPath('count (//a)'), 'count(//a)');
});

test('BREX, as in the original: empty values are not checked against a flag-2 list; findings carry the decision id', () => {
  const rules = brex.parseBrex(`<dmodule><content><brex><contextRules><structureObjectRuleGroup>
    <structureObjectRule><brDecisionRef brDecisionIdentNumber="BREX-X-001"/><objectPath allowedObjectFlag="2">//para/@lang</objectPath><objectUse>en only</objectUse><objectValue valueAllowed="en"/></structureObjectRule>
  </structureObjectRuleGroup></contextRules></brex></content></dmodule>`);
  const r = brex.checkBrex('<dmodule><para lang=""/><para lang="  "/><para lang="fr"/></dmodule>', rules);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].decisionId, 'BREX-X-001');
});

test('the default S1000D 4.2 BREX is bundled and parses', () => {
  const rules = brex.parseBrex(fs.readFileSync(path.join(__dirname, '..', 'vendor', 'brex', 'S1000D-default-4.2.xml'), 'utf8'));
  assert.ok(rules.length > 200, String(rules.length));
  assert.ok(rules.some((r) => r.decisionId === 'BREX-S1-00030'));
});

test('next ICN follows the highest existing sequence, or starts from the model', () => {
  assert.equal(graphics.nextIcn(['ICN-AGS-00007-A-001-01', 'ICN-AGS-00012-A-001-01'], 'AGS'), 'ICN-AGS-00013-A-001-01');
  assert.equal(graphics.nextIcn([], 'pdu-200'), 'ICN-PDU200-00001-A-001-01');
  assert.equal(graphics.nextIcn(['ICN-X-00001-A', 'icn-x-00002-a'], 'X'), 'ICN-X-00003-A', 'existing ICNs are compared without case');
});

test('DMRL reader: a prefixed-namespace (Open XML SDK) workbook, the 5-column export and code defaults', async () => {
  const JSZip = require('jszip');
  const zip = new JSZip();
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  zip.file('xl/workbook.xml', `<x:workbook xmlns:x="${ns}" xmlns:r="${rns}"><x:sheets><x:sheet name="Notes" sheetId="1" r:id="rId1"/><x:sheet name="DMRL" sheetId="2" r:id="rId2"/></x:sheets></x:workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>');
  zip.file('xl/sharedStrings.xml', `<x:sst xmlns:x="${ns}"><x:si><x:t>DMC</x:t></x:si><x:si><x:t>Technical Name</x:t></x:si><x:si><x:t>Information Name</x:t></x:si><x:si><x:t>DMC-AGS-A-24-10-00-00A-520A-D</x:t></x:si><x:si><x:t>Fan</x:t></x:si></x:sst>`);
  zip.file('xl/worksheets/sheet1.xml', `<x:worksheet xmlns:x="${ns}"><x:sheetData/></x:worksheet>`);
  zip.file('xl/worksheets/sheet2.xml', `<x:worksheet xmlns:x="${ns}"><x:sheetData>
    <x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1" t="s"><x:v>1</x:v></x:c><x:c r="C1" t="s"><x:v>2</x:v></x:c></x:row>
    <x:row r="2"><x:c r="A2" t="s"><x:v>3</x:v></x:c><x:c r="B2" t="s"><x:v>4</x:v></x:c><x:c r="C2" t="inlineStr"><x:is><x:t>Remove</x:t></x:is></x:c></x:row>
    <x:row r="3"><x:c r="A3" t="inlineStr"><x:is><x:t>DMC-----</x:t></x:is></x:c></x:row>
    <x:row r="4"><x:c r="A4" t="inlineStr"><x:is><x:t>DMC-NOT-A-CODE</x:t></x:is></x:c></x:row>
  </x:sheetData></x:worksheet>`);
  const r = await dmrl.readDmrl(await zip.generateAsync({ type: 'nodebuffer' }));
  assert.equal(r.sheetName, 'DMRL');
  assert.deepEqual(r.rows.map((x) => [x.row, x.dmcString, x.techName, x.infoName]), [[2, 'AGS-A-24-10-00-00A-520A-D', 'Fan', 'Remove']]);
  assert.deepEqual(r.skipped.map((s) => s.row), [4], 'the blank stub is skipped silently');
  await assert.rejects(dmrl.readDmrl(Buffer.from('nope')), /UNREADABLE/);
  assert.equal(dmrl.schemaFor('auto', { infoCode: '520' }), 'proced');
  assert.equal(dmrl.schemaFor('descript', { infoCode: '520' }), 'descript');
});

test('graphics: content sniffing, ICN rule, entity declarations and expected location', () => {
  assert.equal(graphics.detectFormat(Buffer.from('89504e470d0a1a0a00', 'hex')), 'png');
  assert.equal(graphics.detectFormat(Buffer.from('ffd8ffe000104a46', 'hex')), 'jpeg');
  assert.equal(graphics.detectFormat(Buffer.from('GIF89a\0\0')), 'gif');
  assert.equal(graphics.detectFormat(Buffer.from('<svg xmlns=')), null);
  assert.ok(graphics.ICN_RE.test('ICN-AGS-A-240000-A-0AGS1-00001-A-01-1'));
  assert.ok(!graphics.ICN_RE.test('ICN-../../x'));
  const declared = graphics.declaredEntities(['<!DOCTYPE dmodule [<!NOTATION png SYSTEM "png"><!ENTITY ICN-AGS-1234 SYSTEM "ICN-AGS-1234.png" NDATA png>]><dmodule/>',
    '<!DOCTYPE dmodule [<!ENTITY ICN-AGS-9999 SYSTEM "../../evil.png" NDATA png>]><dmodule/>']);
  assert.deepEqual(graphics.expectedLocation('ICN-AGS-1234', declared), { rel: 'csdb/ICN-AGS-1234.png', declared: true });
  assert.deepEqual(graphics.expectedLocation('ICN-AGS-9999', declared), { rel: 'Media/ICN-AGS-9999.png', declared: false }, 'an escaping declaration is never followed');
  // Case is kept as written and compared without case (the original's rule).
  assert.deepEqual(graphics.referencedIcns('<graphic infoEntityIdent=" ICN-aGs-1 "/><symbol infoEntityIdent="ICN-AGS-2"/><graphic infoEntityIdent="ICN-AGS-1"/>'), ['ICN-aGs-1', 'ICN-AGS-2']);
  assert.deepEqual(graphics.expectedLocation('icn-ags-1234', declared), { rel: 'csdb/ICN-AGS-1234.png', declared: true });
  assert.equal(graphics.normaliseIcn(' ICN-Ab-1234.PNG '), 'ICN-Ab-1234');
  assert.equal(graphics.canonicalIcn('icn-ags-2', ['ICN-AGS-2']), 'ICN-AGS-2');
  assert.equal(graphics.MAX_GRAPHIC_BYTES, 64 * 1024 * 1024);
});

test('path containment refuses traversal, absolute paths, drive letters, backslashes and NUL', () => {
  const dir = tmpdir();
  fs.mkdirSync(path.join(dir, 'csdb'));
  assert.ok(resolveInProject(dir, 'csdb/DMC-X.xml'));
  for (const bad of ['../x', 'csdb/../../x', '/etc/passwd', 'C:/Windows/win.ini', 'csdb\\..\\x', 'csdb/\0x', '', 'csdb//x', './x']) {
    assert.equal(resolveInProject(dir, bad), null, JSON.stringify(bad));
  }
});

test('content rules: Authors who own or are assigned write; managers read; the administrator needs an override', () => {
  const owner = { id: 'w1', role: 'author' };
  const member = { id: 'w2', role: 'author' };
  const stranger = { id: 'w3', role: 'author' };
  const pm = { id: 'pm', role: 'project_manager' };
  const admin = { id: 'a', role: 'software_admin' };
  const authorProject = { id: 'p', owner_id: 'w1' };
  const pmProject = { id: 'q', owner_id: 'pm' };
  const code = (v) => (v.ok ? 'ALLOW' : `${v.http} ${v.code}`);
  assert.equal(code(evaluate(owner, 'content.write', { project: authorProject })), 'ALLOW');
  assert.equal(code(evaluate(member, 'content.write', { project: pmProject, membership: {} })), 'ALLOW');
  assert.equal(code(evaluate(stranger, 'content.write', { project: authorProject })), '404 NOT_FOUND');
  assert.equal(code(evaluate(pm, 'content.write', { project: pmProject })), '403 FORBIDDEN');
  assert.equal(code(evaluate(pm, 'content.read', { project: pmProject })), 'ALLOW');
  assert.equal(code(evaluate(pm, 'content.read', { project: authorProject })), '404 NOT_FOUND');
  assert.equal(code(evaluate(admin, 'content.write', { project: authorProject })), '403 OVERRIDE_REQUIRED');
  assert.equal(code(evaluate(admin, 'content.read', { project: authorProject })), 'ALLOW');
  assert.equal(code(evaluate(stranger, 'content.build', { project: authorProject })), '404 NOT_FOUND');
});
