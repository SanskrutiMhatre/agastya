// Data module code segments, mirroring server/content/dmc.js (the server decides).

export const SEGMENTS = [
  { key: 'modelIdentCode', label: 'Model ident', re: /^[A-Z0-9]{2,14}$/, hint: '2–14 letters or digits', width: 'w-28' },
  { key: 'systemDiffCode', label: 'System diff.', re: /^[A-Z0-9]{1,4}$/, hint: '1–4', width: 'w-16' },
  { key: 'systemCode', label: 'System', re: /^[A-Z0-9]{2,3}$/, hint: '2–3', width: 'w-16' },
  { key: 'subSystemCode', label: 'Sub', re: /^[A-Z0-9]$/, hint: '1', width: 'w-12' },
  { key: 'subSubSystemCode', label: 'Sub-sub', re: /^[A-Z0-9]$/, hint: '1', width: 'w-12' },
  { key: 'assyCode', label: 'Assy', re: /^([A-Z0-9]{2}|[A-Z0-9]{4})$/, hint: '2 or 4', width: 'w-16' },
  { key: 'disassyCode', label: 'Disassy', re: /^[A-Z0-9]{2}$/, hint: '2', width: 'w-14' },
  { key: 'disassyCodeVariant', label: 'Var.', re: /^[A-Z0-9]{1,3}$/, hint: '1–3', width: 'w-14' },
  { key: 'infoCode', label: 'Info code', re: /^[A-Z0-9]{3}$/, hint: '3', width: 'w-16' },
  { key: 'infoCodeVariant', label: 'Var.', re: /^[A-Z0-9]$/, hint: '1', width: 'w-12' },
  { key: 'itemLocationCode', label: 'Item loc.', re: /^[ABCDTZ]$/, hint: 'A, B, C, D, T or Z', width: 'w-14' },
];

export function formatDmc(d) {
  const v = (k) => (d[k] || '').toUpperCase();
  return [v('modelIdentCode'), v('systemDiffCode'), v('systemCode'), `${v('subSystemCode')}${v('subSubSystemCode')}`,
    v('assyCode'), `${v('disassyCode')}${v('disassyCodeVariant')}`, `${v('infoCode')}${v('infoCodeVariant')}`, v('itemLocationCode'),
    ...(d.learnCode ? [v('learnCode'), v('learnEventCode')] : [])].join('-');
}

export function segmentErrors(d) {
  return SEGMENTS.filter((s) => !s.re.test((d[s.key] || '').toUpperCase())).map((s) => s.key);
}

// Common S1000D information codes for the picker (a sample, not the full list).
export const INFO_CODES = [
  ['012', 'General warnings and cautions'], ['018', 'Introduction'], ['030', 'Technical data'], ['040', 'Description'],
  ['041', 'Description of how it is made'], ['042', 'Description of function'], ['300', 'Examinations, tests and checks'],
  ['310', 'Visual inspection'], ['320', 'Operational test'], ['340', 'Functional test'], ['420', 'Fault isolation'],
  ['500', 'Disconnect, remove and disassemble'], ['520', 'Remove procedure'], ['600', 'Repairs'], ['700', 'Assemble, install and connect'],
  ['720', 'Install procedure'], ['800', 'Package, handling, storage'], ['941', 'Illustrated parts data'],
];

// The info code family suggests the schema: 1xx–3xx and 5xx–8xx are procedures.
export const suggestedSchema = (infoCode) => (/^941/.test(infoCode || '') ? 'ipd' : /^[1235678]/.test(infoCode || '') ? 'proced' : 'descript');

// "AGS-A-24-10-00-00A-520A-D" -> SNS keys for the tree.
export function snsOf(code) {
  const p = String(code).split('-');
  return { model: p[0], system: p[2] || '', sub: p[3] || '', assy: p[4] || '' };
}
