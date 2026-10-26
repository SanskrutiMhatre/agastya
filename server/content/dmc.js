'use strict';
/*
  Data Module Code identity. The DMC is the single source of a data
  module's file name (DMC-<code>.xml), so a module resolves from the
  publication module at build time. Every segment is checked against its
  S1000D character set and length; a code that passes cannot contain path
  separators, dots or anything else that would make a hostile file name.

  Segments (S1000D 4.2):
    modelIdentCode 2-14 A-Z0-9 · systemDiffCode 1-4 · systemCode 2-3 ·
    subSystemCode 1 · subSubSystemCode 1 · assyCode 2 or 4 ·
    disassyCode 2 · disassyCodeVariant 1-3 · infoCode 3 · infoCodeVariant 1 ·
    itemLocationCode 1 (A, B, C, D, T or Z)
  Optional, for S1000D learning modules (as in the Agastya original):
    learnCode 3 (T or H then two A-Z0-9) · learnEventCode 1 (A-E)
  Both are appended as two more segments of the code and file name when present.
*/

const SEGMENTS = [
  ['modelIdentCode', /^[A-Z0-9]{2,14}$/],
  ['systemDiffCode', /^[A-Z0-9]{1,4}$/],
  ['systemCode', /^[A-Z0-9]{2,3}$/],
  ['subSystemCode', /^[A-Z0-9]$/],
  ['subSubSystemCode', /^[A-Z0-9]$/],
  ['assyCode', /^([A-Z0-9]{2}|[A-Z0-9]{4})$/],
  ['disassyCode', /^[A-Z0-9]{2}$/],
  ['disassyCodeVariant', /^[A-Z0-9]{1,3}$/],
  ['infoCode', /^[A-Z0-9]{3}$/],
  ['infoCodeVariant', /^[A-Z0-9]$/],
  ['itemLocationCode', /^[ABCDTZ]$/],
];
const NAMES = SEGMENTS.map(([n]) => n);
const LEARN = [['learnCode', /^[TH][A-Z0-9]{2}$/], ['learnEventCode', /^[A-E]$/]];

// Returns { ok, dmc, error } with dmc normalised to upper case.
function validateDmc(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'A data module code is required.' };
  const dmc = {};
  for (const [name, re] of SEGMENTS) {
    const v = String(input[name] == null ? '' : input[name]).trim().toUpperCase();
    if (!re.test(v)) return { ok: false, error: `Data module code: ${name} "${v.slice(0, 20)}" is not valid.` };
    dmc[name] = v;
  }
  for (const [name, re] of LEARN) {
    const v = String(input[name] == null ? '' : input[name]).trim().toUpperCase();
    if (!v) continue;
    if (!re.test(v)) return { ok: false, error: `Data module code: ${name} "${v.slice(0, 20)}" is not valid.` };
    dmc[name] = v;
  }
  if (!dmc.learnCode !== !dmc.learnEventCode) return { ok: false, error: 'Data module code: learnCode and learnEventCode go together.' };
  return { ok: true, dmc };
}

// AGS-A-24-00-00-00A-040A-D
function formatDmc(d) {
  const parts = [d.modelIdentCode, d.systemDiffCode, d.systemCode, `${d.subSystemCode}${d.subSubSystemCode}`,
    d.assyCode, `${d.disassyCode}${d.disassyCodeVariant}`, `${d.infoCode}${d.infoCodeVariant}`, d.itemLocationCode];
  // Two extra segments, as the Agastya original writes them: ...-D-T01-A
  if (d.learnCode) parts.push(d.learnCode, d.learnEventCode);
  return parts.join('-');
}

const dmcFilename = (d) => `DMC-${formatDmc(d)}.xml`;

function parseAttrs(tag) {
  const out = {};
  const re = /([A-Za-z_][\w.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(tag))) out[m[1]] = m[3] !== undefined ? m[3] : m[4];
  return out;
}

/*
  The module's OWN code: the first <dmCode> inside <dmIdent>. dmRefs and the
  brexDmRef also contain <dmCode> elements and must never be mistaken for it.
*/
function parseOwnDmc(xml) {
  const ident = /<dmIdent\b[^>]*>([\s\S]*?)<\/dmIdent>/.exec(String(xml));
  if (!ident) return null;
  const tag = /<dmCode\b([^>]*)\/?>/.exec(ident[1]);
  if (!tag) return null;
  const v = validateDmc(parseAttrs(tag[1]));
  return v.ok ? v.dmc : null;
}

// Parse "AGS-A-24-00-00-00A-040A-D" (with or without a DMC- prefix) into segments.
function parseDmcString(s) {
  const t = String(s || '').trim().toUpperCase().replace(/^DMC-/, '').replace(/\.XML$/, '');
  const m = /^([A-Z0-9]{2,14})-([A-Z0-9]{1,4})-([A-Z0-9]{2,3})-([A-Z0-9])([A-Z0-9])-([A-Z0-9]{2}|[A-Z0-9]{4})-([A-Z0-9]{2})([A-Z0-9]{1,3})-([A-Z0-9]{3})([A-Z0-9])-([ABCDTZ])(?:-([TH][A-Z0-9]{2})-([A-E]))?$/.exec(t);
  if (!m) return null;
  return validateDmc({
    modelIdentCode: m[1], systemDiffCode: m[2], systemCode: m[3], subSystemCode: m[4], subSubSystemCode: m[5],
    assyCode: m[6], disassyCode: m[7], disassyCodeVariant: m[8], infoCode: m[9], infoCodeVariant: m[10], itemLocationCode: m[11],
    learnCode: m[12], learnEventCode: m[13],
  }).dmc || null;
}

const xmlText = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Title and S1000D issue declared by a data module (for import and listing).
function readIdentity(xml) {
  const s = String(xml);
  const tech = /<techName>([\s\S]*?)<\/techName>/.exec(s);
  const info = /<infoName>([\s\S]*?)<\/infoName>/.exec(s);
  const schema = /noNamespaceSchemaLocation\s*=\s*"[^"]*?\/([a-z]+)\.xsd"/i.exec(s);
  const issue = /S1000D[_-]?(\d)[-._](\d)/i.exec(s.slice(0, 4000));
  return {
    dmc: parseOwnDmc(s),
    techName: tech ? xmlText(tech[1].replace(/<[^>]+>/g, '')).trim() : '',
    infoName: info ? xmlText(info[1].replace(/<[^>]+>/g, '')).trim() : '',
    schemaType: schema ? schema[1].toLowerCase() : null,
    issue: issue ? `${issue[1]}.${issue[2]}` : null,
    isDataModule: /<dmodule[\s>]/.test(s),
  };
}

/*
  Rewrite only the dmCode inside <dmIdent>, in canonical attribute order, and
  leave the rest of the document byte-identical (the Agastya original's
  writeDmCode). The brexDmRef and dmRefs carry their own dmCode and are
  never touched.
*/
const ORDER = [...NAMES, 'learnCode', 'learnEventCode'];
function writeOwnDmc(xml, d) {
  const ident = /<dmIdent\b[^>]*>[\s\S]*?<\/dmIdent>/.exec(xml);
  if (!ident) return xml;
  const tag = `<dmCode ${ORDER.filter((k) => d[k]).map((k) => `${k}="${d[k]}"`).join(' ')}/>`;
  const patched = ident[0].replace(/<dmCode\b[^>]*\/>/, tag);
  return xml.slice(0, ident.index) + patched + xml.slice(ident.index + ident[0].length);
}

module.exports = { writeOwnDmc, validateDmc, formatDmc, dmcFilename, parseOwnDmc, parseDmcString, parseAttrs, readIdentity, NAMES };
