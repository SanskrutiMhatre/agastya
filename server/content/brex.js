'use strict';
/*
  BREX (business rules exchange) checking, as the Agastya documentation
  describes it: the project's own BREX data module, found through the
  module's <brexDmRef>, evaluated with real XPath.

    allowedObjectFlag 0  the object must not occur: every match is a breach
    allowedObjectFlag 1  allowed, nothing to check (counted, not evaluated)
    allowedObjectFlag 2  allowed with restricted values: a value outside the
                         <objectValue valueAllowed="..."> list is a breach;
                         a rule with no values is advisory
  A rule whose XPath cannot be evaluated is counted as skipped, never as a
  breach. As in the Agastya original (services/Brex.ts): an empty value is
  not checked against a flag-2 list, and a finding carries the rule's
  brDecisionRef identifier when it has one. Which BREX applies (the
  project's own, or the bundled S1000D default) is decided in validation.js.
*/

const { DOMParser } = require('@xmldom/xmldom');
const xpath = require('xpath');
const { parseAttrs } = require('./dmc');

const XPATH_FUNCTIONS = ['last', 'position', 'count', 'id', 'local-name', 'namespace-uri', 'name', 'string', 'concat',
  'starts-with', 'contains', 'substring-before', 'substring-after', 'substring', 'string-length', 'normalize-space',
  'translate', 'boolean', 'not', 'true', 'false', 'lang', 'number', 'sum', 'floor', 'ceiling', 'round'];

// The xpath package rejects "count (x)"; S1000D BREX files are often written that way.
function repairXPath(expr) {
  let s = String(expr || '').trim();
  for (const f of XPATH_FUNCTIONS) s = s.replace(new RegExp(`\\b${f.replace('-', '\\-')}\\s+\\(`, 'g'), `${f}(`);
  return s;
}

function parseXml(text) {
  const errors = [];
  const doc = new DOMParser({
    locator: {},
    errorHandler: { warning: () => {}, error: (m) => errors.push(m), fatalError: (m) => errors.push(m) },
  }).parseFromString(text, 'text/xml');
  return { doc, errors };
}

const textOf = (n) => (n ? String(n.textContent || '').replace(/\s+/g, ' ').trim() : '');

// Rules from a BREX data module's text.
function parseBrex(text) {
  const { doc } = parseXml(text);
  const rules = [];
  const nodes = xpath.select('//contextRules//structureObjectRule', doc);
  for (const r of nodes) {
    const op = xpath.select1('objectPath', r);
    if (!op) continue;
    const flagAttr = op.getAttribute('allowedObjectFlag');
    rules.push({
      path: textOf(op),
      flag: flagAttr === '' ? 2 : Number(flagAttr),
      use: textOf(xpath.select1('objectUse', r)),
      decisionId: (xpath.select1('brDecisionRef', r) || { getAttribute: () => null }).getAttribute('brDecisionIdentNumber') || null,
      values: xpath.select('objectValue', r).map((v) => ({ value: v.getAttribute('valueAllowed'), form: v.getAttribute('valueForm') || 'single', text: textOf(v) })),
    });
  }
  return rules;
}

// A readable location: the element path down to the node, with sibling indexes.
function locate(node) {
  const parts = [];
  let n = node.nodeType === 2 ? node.ownerElement : node;
  const attr = node.nodeType === 2 ? `/@${node.nodeName}` : '';
  while (n && n.nodeType === 1) {
    let i = 1;
    for (let s = n.previousSibling; s; s = s.previousSibling) if (s.nodeType === 1 && s.nodeName === n.nodeName) i++;
    parts.unshift(i > 1 ? `${n.nodeName}[${i}]` : n.nodeName);
    n = n.parentNode;
  }
  return parts.join('/') + attr;
}

const lineOf = (node) => (node.nodeType === 2 ? node.ownerElement : node).lineNumber || 1;

function valueAllowed(value, values) {
  return values.some((v) => {
    if (v.form === 'range' && /~/.test(v.value || '')) {
      const [lo, hi] = v.value.split('~');
      return value >= lo && value <= hi;
    }
    if (v.form === 'pattern') { try { return new RegExp(`^(?:${v.value})$`).test(value); } catch { return false; } }
    return value === v.value;
  });
}

/*
  Check one module against parsed rules.
  Returns { findings, evaluated, skipped, advisory }.
*/
function checkBrex(xmlText, rules) {
  const { doc, errors } = parseXml(xmlText);
  if (!doc || !doc.documentElement || errors.length) {
    return { findings: [{ rule: null, line: 1, location: '', message: 'The module could not be parsed for BREX checking.' }], evaluated: 0, skipped: rules.length, advisory: 0 };
  }
  const findings = [];
  let evaluated = 0, skipped = 0, advisory = 0;
  for (const rule of rules) {
    if (rule.flag === 1) { advisory++; continue; }
    if (rule.flag === 2 && !rule.values.length) { advisory++; continue; }
    let nodes;
    try { nodes = xpath.select(repairXPath(rule.path), doc); } catch { skipped++; continue; }
    // A boolean expression (e.g. count(//x) > 5): true breaches a flag-0 rule.
    if (typeof nodes === 'boolean') {
      if (rule.flag !== 0) { skipped++; continue; }
      evaluated++;
      if (nodes) findings.push({ rule: rule.path, decisionId: rule.decisionId, line: 1, location: doc.documentElement.nodeName, message: `Not allowed: ${rule.use || rule.path}` });
      continue;
    }
    if (!Array.isArray(nodes)) { skipped++; continue; }
    evaluated++;
    for (const n of nodes) {
      if (rule.flag === 0) {
        findings.push({ rule: rule.path, decisionId: rule.decisionId, line: lineOf(n), location: locate(n), message: `Not allowed: ${rule.use || rule.path}` });
      } else {
        const value = (n.nodeType === 2 ? n.value : textOf(n)).trim();
        if (value !== '' && !valueAllowed(value, rule.values)) {
          findings.push({
            rule: rule.path, decisionId: rule.decisionId, line: lineOf(n), location: locate(n),
            message: `Value "${value}" is not allowed (allowed: ${rule.values.map((v) => v.value).join(', ')}). ${rule.use}`.trim(),
          });
        }
      }
    }
  }
  return { findings, evaluated, skipped, advisory };
}

// The DMC named by a module's <brexDmRef>, as a string like AGS-A-00-00-00-00A-022A-D.
function brexRefOf(xmlText) {
  const m = /<brexDmRef\b[\s\S]*?<dmCode\b([^>]*)\/?>/.exec(String(xmlText));
  if (!m) return null;
  const a = parseAttrs(m[1]);
  return [a.modelIdentCode, a.systemDiffCode, a.systemCode, `${a.subSystemCode || ''}${a.subSubSystemCode || ''}`,
    a.assyCode, `${a.disassyCode || ''}${a.disassyCodeVariant || ''}`, `${a.infoCode || ''}${a.infoCodeVariant || ''}`, a.itemLocationCode]
    .map((x) => String(x || '').toUpperCase()).join('-');
}

const cache = new Map();
function rulesFor(key, text) {
  if (!cache.has(key)) {
    if (cache.size > 50) cache.clear();
    cache.set(key, parseBrex(text));
  }
  return cache.get(key);
}

module.exports = { parseBrex, checkBrex, brexRefOf, repairXPath, rulesFor };
