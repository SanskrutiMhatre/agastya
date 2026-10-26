'use strict';
/*
  Data module shells and metadata stamping, following the Agastya original
  (backend/routes/templates.ts, services/DmMetadata.ts): the shells are
  files (vendor/templates/shells/<type><major><minor>.xml, copied from
  Agastya), and a new module is the shell with the author's identity stamped
  in by scoped regex rewrites, so the shell's comments, processing
  instructions and whitespace survive.

  Kept from the original:
    - the code is written into <dmIdent> only; the brexDmRef is untouched
      unless the project has its own BREX (then the module names it)
    - every rewrite is scoped to <identAndStatusSection>, first match
    - a blank field leaves the shell's value; issueDate is always stamped
    - security classification words map to their two-digit codes
  Added in Agastya (this project): every value is XML-escaped and the code
  has already passed dmc.validateDmc.
*/

const fs = require('node:fs');
const path = require('node:path');
const { writeOwnDmc } = require('./dmc');

const SHELL_DIR = path.join(__dirname, '..', '..', 'vendor', 'templates', 'shells');
const LABELS = { descript: 'Descriptive', proced: 'Procedural', ipd: 'Illustrated parts data' };

// The schema types new modules can be created as (newest shell per type).
const SCHEMA_TYPES = Object.fromEntries(Object.entries(LABELS).map(([id, label]) => [id, { label }]));

// The default S1000D 4.2 BREX (vendor/brex/S1000D-default-4.2.xml).
const DEFAULT_BREX = {
  modelIdentCode: 'S1000D', systemDiffCode: 'F', systemCode: '04', subSystemCode: '1', subSubSystemCode: '0',
  assyCode: '0301', disassyCode: '00', disassyCodeVariant: 'A', infoCode: '022', infoCodeVariant: 'A', itemLocationCode: 'D',
};

/*
  `proced42.xml` -> { id: 'proced42', schemaType: 'proced', issue: '4.2' }, newest
  issue first per type. Issue 2.3 shells are vendored but not offered: 2.3 uses
  different element names, so neither the identity stamping (here and in the
  original) nor a 2.3 schema (none is bundled) can work on them.
*/
function listShells() {
  let files = [];
  try { files = fs.readdirSync(SHELL_DIR); } catch { return []; }
  return files.map((f) => /^([a-z]+)([4-9])(\d)\.xml$/.exec(f)).filter(Boolean)
    .map((m) => ({ id: `${m[1]}${m[2]}${m[3]}`, schemaType: m[1], issue: `${m[2]}.${m[3]}`, label: `${LABELS[m[1]] || m[1]} (S1000D ${m[2]}.${m[3]})` }))
    .sort((a, b) => a.schemaType.localeCompare(b.schemaType) || b.issue.localeCompare(a.issue));
}

const newestShell = (schemaType) => listShells().find((s) => s.schemaType === schemaType) || null;

const SECURITY_CODE = { UNCLASSIFIED: '01', RESTRICTED: '02', CONFIDENTIAL: '03', SECRET: '04', 'TOP SECRET': '05' };
function securityCode(v) {
  const raw = String(v == null ? '' : v).trim();
  if (/^\d{2}$/.test(raw)) return raw;
  return SECURITY_CODE[raw.toUpperCase()] || '01';
}

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const esc = escAttr;

// Set attributes on the first <tag ...> in scope; keeps other attributes and the self-closing style.
function setAttrs(scope, tag, attrs) {
  const named = Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!named.length) return scope;
  return scope.replace(new RegExp(`<${tag}\\b([^>]*?)(/?)>`), (full, body, selfClose) => {
    let next = body;
    for (const [k, v] of named) {
      const re = new RegExp(`\\s${k}\\s*=\\s*"[^"]*"`);
      const rendered = ` ${k}="${escAttr(v)}"`;
      next = re.test(next) ? next.replace(re, rendered) : next.replace(/\s*$/, rendered);
    }
    if (selfClose) next = next.replace(/\s+$/, '');
    return `<${tag}${next}${selfClose ? ' /' : ''}>`;
  });
}

// Replace the text of the first <tag>...</tag> (or <tag/>) in scope.
function setText(scope, tag, value) {
  if (value === undefined || value === null || value === '') return scope;
  const text = escText(value);
  const paired = new RegExp(`(<${tag}(?:\\s[^>]*)?>)[\\s\\S]*?(</${tag}>)`);
  if (paired.test(scope)) return scope.replace(paired, (m, a, b) => `${a}${text}${b}`);
  const selfClosing = new RegExp(`<${tag}((?:\\s[^>]*)?)/>`);
  if (selfClosing.test(scope)) return scope.replace(selfClosing, (m, a) => `<${tag}${a}>${text}</${tag}>`);
  return scope;
}

const dmCodeTag = (d) => `<dmCode ${['modelIdentCode', 'systemDiffCode', 'systemCode', 'subSystemCode', 'subSubSystemCode', 'assyCode', 'disassyCode', 'disassyCodeVariant', 'infoCode', 'infoCodeVariant', 'itemLocationCode']
  .map((k) => `${k}="${escAttr(d[k])}"`).join(' ')}/>`;

/*
  Stamp identity into a data module (the original's stampDmMetadata).
  meta: { dmc, techName, infoName, securityClassification, languageIsoCode,
          countryIsoCode, issueNumber, inWork, date, originator, rpcCode, brex }
*/
function stampMetadata(xml, meta) {
  let out = meta.dmc ? writeOwnDmc(xml, meta.dmc) : xml;
  const section = /<identAndStatusSection\b[^>]*>[\s\S]*?<\/identAndStatusSection>/.exec(out);
  if (!section) return out;
  let scope = section[0];
  scope = setAttrs(scope, 'language', { languageIsoCode: meta.languageIsoCode, countryIsoCode: meta.countryIsoCode });
  scope = setAttrs(scope, 'issueInfo', { issueNumber: meta.issueNumber, inWork: meta.inWork });
  const d = meta.date || new Date();
  scope = setAttrs(scope, 'issueDate', { year: String(d.getFullYear()), month: String(d.getMonth() + 1).padStart(2, '0'), day: String(d.getDate()).padStart(2, '0') });
  scope = setText(scope, 'techName', meta.techName);
  scope = setText(scope, 'infoName', meta.infoName);
  scope = setAttrs(scope, 'security', { securityClassification: meta.securityClassification ? securityCode(meta.securityClassification) : undefined });
  scope = setAttrs(scope, 'responsiblePartnerCompany', { enterpriseCode: meta.rpcCode });
  scope = setAttrs(scope, 'originator', { enterpriseCode: meta.originator });
  // Agastya (this project): a project with its own BREX module is named in brexDmRef.
  if (meta.brex) scope = scope.replace(/(<brexDmRef\b[\s\S]*?)<dmCode\b[^>]*\/>/, (m, a) => `${a}${dmCodeTag(meta.brex)}`);
  return out.slice(0, section.index) + scope + out.slice(section.index + section[0].length);
}

/*
  A new module from a shell. opts: { schemaType, templateId?, ...stampMetadata fields }.
  Throws on an unknown schema type or template id.

  A new module is always a new issue, so dmStatus/@issueType is stamped
  "new". Agastya's descript41.xml shell says "changed", which the default
  S1000D BREX (BREX-S1-00030) rejects for issue 001-00; the vendored shell is
  kept as copied and corrected here.
*/
function renderShell(opts) {
  const shell = opts.templateId ? listShells().find((s) => s.id === opts.templateId) : newestShell(opts.schemaType);
  if (!shell || (opts.schemaType && shell.schemaType !== opts.schemaType)) throw new Error('unknown shell');
  const xml = fs.readFileSync(path.join(SHELL_DIR, `${shell.id}.xml`), 'utf8').replace(/^﻿/, '');
  const stamped = stampMetadata(xml, opts);
  const section = /<identAndStatusSection\b[^>]*>[\s\S]*?<\/identAndStatusSection>/.exec(stamped);
  if (!section) return stamped;
  return stamped.slice(0, section.index) + setAttrs(section[0], 'dmStatus', { issueType: 'new' }) + stamped.slice(section.index + section[0].length);
}

module.exports = { renderShell, stampMetadata, listShells, newestShell, securityCode, SCHEMA_TYPES, DEFAULT_BREX, dmCodeTag, esc };
