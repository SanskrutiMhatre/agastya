'use strict';
/*
  DMRL (data module requirement list) spreadsheets, following the Agastya
  original (backend/src/services/DmrlExcel.ts and XlsxGrid.ts).

  Export writes the original's 16-column master layout: group labels on
  row 1, field names on row 2, data from row 3, frozen under the header:
    dmc | ModelIC | SDC | System | SubSystem | SubSubSys | Assembly |
    DisCode | DisCodV | Infocode | InfoCodeV | ItemLoCode |
    TechName | InfoName | status | Allocated

  Import reads the workbook parts directly (jszip + xmldom, matching element
  local names), as the original does, because ExcelJS cannot open the
  prefixed-namespace workbooks the Open XML SDK writes. It reads the sheet
  named "DMRL" (or the first), takes the row in the first 10 that resolves
  the most known headings as the header (so the master layout and the
  5-column export both work), skips spacing rows and pre-filled blank stubs
  (DMC--------), and reports every other unusable row with its number.
  Structured code columns win over the assembled DMC column; missing
  segments take the original's defaults when a model ident code is given.

  Added in Agastya (this project): every code passes dmc.validateDmc before
  it is used (it becomes a file name), each workbook part is size-capped
  before it is inflated, and preview never writes.
*/

const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const { validateDmc, formatDmc, parseDmcString } = require('./dmc');

// The original's DEFAULT_DM_CODE (services/Dmc.ts), for segments a row leaves blank.
const DEFAULT_DM_CODE = {
  modelIdentCode: 'MODEL', systemDiffCode: 'A', systemCode: '00', subSystemCode: '0', subSubSystemCode: '0',
  assyCode: '00', disassyCode: '00', disassyCodeVariant: 'A', infoCode: '000', infoCodeVariant: 'A', itemLocationCode: 'D',
};
const CODE_FIELDS = new Set(Object.keys(DEFAULT_DM_CODE));

const GROUPS = ['', 'DMC', '', '', '', '', '', '', '', '', '', '', 'Technical Name', 'Information Name', '', 'Allocated'];
const FIELDS = ['dmc', 'ModelIC', 'SDC', 'System', 'SubSystem', 'SubSubSys', 'Assembly',
  'DisCode', 'DisCodV', 'Infocode', 'InfoCodeV', 'ItemLoCode', 'TechName', 'InfoName', 'status', 'Allocated'];

// Header text -> field, lower-cased with spaces and _ - . / removed (the original's aliases).
const HEADER_ALIASES = {};
const alias = (field, ...names) => { for (const n of names) HEADER_ALIASES[n] = field; };
alias('dmcString', 'dmc', 'dmccode', 'dmcode', 'datamodulecode');
alias('modelIdentCode', 'modelic', 'modelidentcode', 'model');
alias('systemDiffCode', 'sdc', 'systemdiffcode', 'systemdifferencecode');
alias('systemCode', 'system', 'systemcode', 'chapnum', 'chapter');
alias('subSystemCode', 'subsystem', 'subsystemcode', 'section');
alias('subSubSystemCode', 'subsubsys', 'subsubsystem', 'subsubsystemcode', 'subsect');
alias('assyCode', 'assembly', 'assycode', 'unitassy', 'subject');
alias('disassyCode', 'discode', 'disassycode');
alias('disassyCodeVariant', 'discodv', 'disassycodevariant', 'discodevariant');
alias('infoCode', 'infocode', 'incode', 'informationcode');
alias('infoCodeVariant', 'infocodev', 'incodev', 'infocodevariant');
alias('itemLocationCode', 'itemlocode', 'itemloc', 'itemlocationcode', 'ilc');
alias('techName', 'techname', 'technicalname');
alias('infoName', 'infoname', 'informationname');
alias('status', 'status');
alias('allocated', 'allocated', 'dmallocated');

const normalise = (s) => String(s == null ? '' : s).toLowerCase().replace(/[\s_\-./]/g, '').trim();

async function exportDmrl(project, modules) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Agastya';
  wb.created = new Date();
  const sheet = wb.addWorksheet('DMRL');
  sheet.addRow(GROUPS);
  sheet.addRow(FIELDS);
  sheet.getRow(2).font = { bold: true };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FF6B7280' } };
  for (const m of modules) {
    const c = { ...DEFAULT_DM_CODE, ...(parseDmcString(m.dmc) || {}) };
    sheet.addRow([
      `DMC-${m.dmc}`,
      c.modelIdentCode, c.systemDiffCode, c.systemCode, c.subSystemCode, c.subSubSystemCode,
      c.assyCode, c.disassyCode, c.disassyCodeVariant, c.infoCode, c.infoCodeVariant, c.itemLocationCode,
      m.tech_name || '', m.info_name || '', m.status || '-', '-',
    ]);
  }
  sheet.columns.forEach((col, i) => { col.width = i === 0 ? 38 : i >= 12 && i <= 13 ? 30 : 11; });
  sheet.views = [{ state: 'frozen', ySplit: 2 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── Reading (port of XlsxGrid.ts) ──────────────────────────────────────────

const MAX_PART = 40 * 1024 * 1024; // inflated size of any one part we read

function byLocalName(root, name) {
  const out = [];
  const all = root.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if ((el.localName || el.nodeName.replace(/^.*:/, '')) === name) out.push(el);
  }
  return out;
}
const attr = (el, name) => el.getAttribute(name) || el.getAttribute(`r:${name}`) || '';
const quiet = () => {};
const parse = (xml) => new DOMParser({ errorHandler: { warning: quiet, error: quiet, fatalError: quiet } }).parseFromString(xml.replace(/^﻿/, ''), 'text/xml');
const textOf = (el) => byLocalName(el, 't').map((t) => t.textContent || '').join('');

function parseRef(ref) {
  const m = /^([A-Z]+)(\d+)$/i.exec(ref);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: parseInt(m[2], 10) };
}

async function partText(zip, name) {
  const f = zip.file(name);
  if (!f) return null;
  const size = f._data && f._data.uncompressedSize;
  if (typeof size === 'number' && size > MAX_PART) throw new Error('UNREADABLE');
  return f.async('string');
}

// Every worksheet as a grid of trimmed strings (rows[r][c], 0-based). Values stay text: "00" is a code, not a number.
async function readXlsx(buffer) {
  let zip;
  try { zip = await JSZip.loadAsync(buffer); } catch { throw new Error('UNREADABLE'); }
  const workbookXml = await partText(zip, 'xl/workbook.xml');
  if (!workbookXml) throw new Error('UNREADABLE');

  const shared = [];
  const sharedXml = await partText(zip, 'xl/sharedStrings.xml');
  if (sharedXml) for (const si of byLocalName(parse(sharedXml), 'si')) shared.push(textOf(si));

  const relTarget = new Map();
  const relsXml = await partText(zip, 'xl/_rels/workbook.xml.rels');
  if (relsXml) {
    for (const rel of byLocalName(parse(relsXml), 'Relationship')) {
      relTarget.set(attr(rel, 'Id'), attr(rel, 'Target').replace(/^\/?xl\//, '').replace(/^\//, ''));
    }
  }

  const sheets = [];
  const sheetEls = byLocalName(parse(workbookXml), 'sheet');
  for (let i = 0; i < sheetEls.length; i++) {
    const el = sheetEls[i];
    const name = attr(el, 'name') || `Sheet${i + 1}`;
    const rid = el.getAttribute('r:id') || attr(el, 'id');
    const target = (rid && relTarget.get(rid)) || `worksheets/sheet${i + 1}.xml`;
    // Parts are looked up inside the zip only, never on disk.
    const xml = (await partText(zip, `xl/${target}`)) || (await partText(zip, `xl/worksheets/sheet${i + 1}.xml`));
    if (!xml) continue;
    const rows = [];
    for (const c of byLocalName(parse(xml), 'c')) {
      const pos = parseRef(attr(c, 'r'));
      if (!pos || pos.row > 100000 || pos.col > 200) continue;
      const type = attr(c, 't');
      let value = '';
      if (type === 's') {
        const idx = parseInt((byLocalName(c, 'v')[0] || {}).textContent || '', 10);
        value = Number.isFinite(idx) ? (shared[idx] || '') : '';
      } else if (type === 'inlineStr') {
        value = textOf(c);
      } else {
        // A formula's cached result, not its text (the master's DMC column is a CONCATENATE).
        value = (byLocalName(c, 'v')[0] || {}).textContent || '';
      }
      const r = pos.row - 1, col = pos.col - 1;
      while (rows.length <= r) rows.push([]);
      const row = rows[r];
      while (row.length <= col) row.push('');
      row[col] = value.trim();
    }
    sheets.push({ name, rows });
  }
  return sheets;
}

// The row in the first 10 that resolves the most known field names.
function findHeader(rows) {
  let best = { headerRow: -1, map: new Map() };
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const map = new Map();
    (rows[r] || []).forEach((cell, col) => { const f = HEADER_ALIASES[normalise(cell)]; if (f) map.set(col, f); });
    if (map.size > best.map.size) best = { headerRow: r, map };
  }
  return best;
}

const isBlankStub = (dmc) => dmc.replace(/^DMC-/i, '').replace(/-/g, '').trim() === '';

/*
  Returns { sheetName, columns, rows: [{ row, dmc, dmcString, techName, infoName, status, allocated }], skipped: [{ row, reason }] }
  Throws Error('UNREADABLE') if the workbook cannot be read.
*/
async function readDmrl(buffer) {
  const sheets = await readXlsx(buffer);
  const sheet = sheets.find((s) => normalise(s.name) === 'dmrl') || sheets[0];
  if (!sheet) return { sheetName: '', columns: [], rows: [], skipped: [] };

  const { headerRow, map } = findHeader(sheet.rows);
  if (map.size === 0) {
    return { sheetName: sheet.name, columns: [], rows: [], skipped: [{ row: 0, reason: 'No recognisable column headings. Expected at least a DMC column, or the eleven code columns (ModelIC, SDC, System, …).' }] };
  }

  const rows = [], skipped = [], seen = new Map();
  for (let r = headerRow + 1; r < sheet.rows.length; r++) {
    const excelRow = sheet.rows[r] || [];
    const values = {};
    for (const [col, field] of map) values[field] = excelRow[col] || '';
    const rowNumber = r + 1; // 1-based, as the author sees it in Excel
    if (Object.values(values).every((v) => v === '')) continue;
    if (isBlankStub(values.dmcString || '') && !values.modelIdentCode && !values.techName) continue;

    const structured = {};
    for (const [field, value] of Object.entries(values)) if (CODE_FIELDS.has(field) && value) structured[field] = value;

    let dmc = null;
    if (structured.modelIdentCode) {
      const check = validateDmc({ ...DEFAULT_DM_CODE, ...structured });
      if (!check.ok) { skipped.push({ row: rowNumber, reason: check.error }); continue; }
      dmc = check.dmc;
    } else if (values.dmcString) {
      dmc = parseDmcString(values.dmcString);
      if (!dmc) { skipped.push({ row: rowNumber, reason: `"${values.dmcString.slice(0, 60)}" is not a valid DMC — expected 8 dash-separated segments like DMC-CRAFT-A-24-00-00-00A-042A-A.` }); continue; }
    } else {
      skipped.push({ row: rowNumber, reason: 'No DMC and no model identification code.' });
      continue;
    }

    const dmcString = formatDmc(dmc);
    if (seen.has(dmcString)) { skipped.push({ row: rowNumber, reason: `Duplicate of an earlier row (${dmcString}, row ${seen.get(dmcString)}).` }); continue; }
    seen.set(dmcString, rowNumber);
    rows.push({
      row: rowNumber, dmc, dmcString,
      techName: (values.techName || '').slice(0, 200), infoName: (values.infoName || '').slice(0, 200),
      status: (values.status || '').slice(0, 40), allocated: (values.allocated || '').slice(0, 80),
    });
  }
  return { sheetName: sheet.name, columns: [...new Set(map.values())], rows, skipped };
}

/*
  Schema for an imported row. The original takes one schema type for the
  whole import (default 'descript'); 'auto' (Agastya) picks by info code
  family: 1xx-3xx and 5xx-8xx procedures, everything else descriptive.
*/
const schemaFor = (choice, dmc) => (choice === 'auto' ? (/^[1235678]/.test(dmc.infoCode) ? 'proced' : 'descript') : choice);

module.exports = { exportDmrl, readDmrl, readXlsx, schemaFor, DEFAULT_DM_CODE, FIELDS };
