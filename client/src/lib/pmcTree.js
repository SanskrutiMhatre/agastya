// Pure tree operations for the publication index, ported from the Agastya
// original (frontend/src/lib/pmcTree.ts). Kept free of React: these decide
// where a chapter lands, and an off-by-one silently drops or duplicates a
// module in the book. An entry is addressed by its index path from the root
// ([2,0,1] = second child of the first child of the third entry). Every
// function returns new arrays; nothing is mutated in place.

const clone = (v) => JSON.parse(JSON.stringify(v));
const isFolder = (e) => !!e && e.type === 'folder';

export function getAt(entries, path) {
  let node = { children: entries };
  for (const i of path) {
    if (!node || !node.children) return undefined;
    node = node.children[i];
  }
  return node;
}

// True when `inner` is `outer` or inside it: stops a chapter being dropped into itself.
export function isWithin(outer, inner) {
  if (outer.length > inner.length) return false;
  return outer.every((v, i) => inner[i] === v);
}

export function removeAt(entries, path) {
  const next = clone(entries);
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1];
  const parent = parentPath.length ? getAt(next, parentPath) : { children: next };
  if (!parent || !parent.children) return { entries: next };
  const [removed] = parent.children.splice(idx, 1);
  return { entries: next, removed };
}

// Insert `node` as child `index` of `parentPath` ([] = top level).
export function insertAt(entries, parentPath, index, node) {
  const next = clone(entries);
  const parent = parentPath.length ? getAt(next, parentPath) : { children: next };
  if (!parent) return next;
  if (!parent.children) parent.children = [];
  const i = Math.max(0, Math.min(index, parent.children.length));
  parent.children.splice(i, 0, clone(node));
  return next;
}

/*
  Move the entry at `from` to child `index` of `toParent`. Removing the source
  first shifts later siblings down by one, so a destination after the source
  in the same parent is decremented. Returns the original array when the move
  is impossible (a chapter into itself) or a no-op.
*/
export function moveTo(entries, from, toParent, index) {
  if (isWithin(from, toParent)) return entries;
  const fromParent = from.slice(0, -1);
  const fromIndex = from[from.length - 1];
  const sameParent = fromParent.length === toParent.length && fromParent.every((v, i) => toParent[i] === v);
  if (sameParent && (index === fromIndex || index === fromIndex + 1)) return entries;
  const { entries: without, removed } = removeAt(entries, from);
  if (!removed) return entries;
  return insertAt(without, toParent, sameParent && index > fromIndex ? index - 1 : index, removed);
}

export function updateAt(entries, path, fn) {
  const next = clone(entries);
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1];
  const parent = parentPath.length ? getAt(next, parentPath) : { children: next };
  if (!parent || !parent.children || !parent.children[idx]) return next;
  parent.children[idx] = fn(parent.children[idx]);
  return next;
}

export function countOf(entries) {
  let folders = 0, dms = 0;
  const walk = (list) => (list || []).forEach((e) => { if (isFolder(e)) { folders++; walk(e.children); } else dms++; });
  walk(entries);
  return { folders, dms, total: folders + dms };
}

// A drop onto `path`: 'inside' only means something for a chapter.
export function dropTarget(entries, path, where) {
  const node = getAt(entries, path);
  if (where === 'inside' && isFolder(node)) return { parentPath: path, index: (node.children || []).length };
  const idx = path[path.length - 1];
  return { parentPath: path.slice(0, -1), index: where === 'after' ? idx + 1 : idx };
}

// Agastya: keyboard and button moves (one step up or down among siblings).
export function moveBy(entries, path, delta) {
  const idx = path[path.length - 1];
  const parentPath = path.slice(0, -1);
  const parent = parentPath.length ? getAt(entries, parentPath) : { children: entries };
  const target = idx + delta;
  if (!parent || target < 0 || target >= parent.children.length) return { entries, path };
  return { entries: moveTo(entries, path, parentPath, delta > 0 ? target + 1 : target), path: [...parentPath, target] };
}

export function dmcOf(e) {
  if (!e || e.type !== 'dm' || !e.dmCode) return '';
  const c = e.dmCode;
  const seg = [c.modelIdentCode, c.systemDiffCode, c.systemCode, (c.subSystemCode || '') + (c.subSubSystemCode || ''),
    c.assyCode, (c.disassyCode || '') + (c.disassyCodeVariant || ''), (c.infoCode || '') + (c.infoCodeVariant || ''), c.itemLocationCode];
  return seg.every((s) => s === undefined) ? '' : seg.join('-');
}

// titles: optional { DMC: 'Tech – Info' } for dmRefs that carry no title of their own.
export function labelFor(e, titles = null) {
  if (e.type === 'folder') return e.title || '(untitled chapter)';
  if (e.type === 'include') return (e.title && e.title.trim()) || e.href.replace(/^.*\//, '');
  if (e.type === 'pmRef') return e.title || e.pmTitle || '(publication reference)';
  const parts = [e.techName && e.techName.trim(), e.infoName && e.infoName.trim()].filter(Boolean);
  const name = parts.length ? parts.join(' – ') : ((titles && titles[dmcOf(e)]) || dmcOf(e) || '(module)');
  return e.title ? `${e.title} (${name})` : name;
}

// A pool module as a dmRef entry (the original's poolToEntry).
export function poolToEntry(m) {
  const out = { type: 'dm', dmCode: m.dmCode || {} };
  for (const k of ['identExtension', 'issueInfo', 'language', 'techName', 'infoName', 'issueDate']) if (m[k] !== undefined && m[k] !== null) out[k] = m[k];
  return out;
}
