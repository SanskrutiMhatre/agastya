// The XML document under the structured editor: parse, address, edit,
// serialise. Pure functions over a DOM, so they run in the browser and in
// Node tests (pass xmldom's DOMParser/XMLSerializer there).
//
//   - The prolog (XML declaration, comments, the DOCTYPE with its ICN entity
//     declarations) and anything after the root element are kept verbatim;
//     only the root element is re-serialised, and only after an edit.
//   - Entity references other than the five predefined ones (S1000D uses
//     the ISO sets: &ndash; &deg; ...) are declared in an external set the
//     browser never loads, so a plain parse would reject a valid module.
//     They are protected as marker text before parsing and put back on
//     output, so they survive untouched.
//   - Elements are addressed by their path of element-child indexes from the
//     root ([] is the root, [1, 0] its second element's first element).

const PREDEFINED = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);
const OPEN = '', CLOSE = '';

const protect = (s) => s.replace(/&([A-Za-z_][\w.-]*);/g, (m, name) => (PREDEFINED.has(name) ? m : `${OPEN}${name}${CLOSE}`));
const restore = (s) => s.replace(new RegExp(`${OPEN}([A-Za-z_][\\w.-]*)${CLOSE}`, 'g'), '&$1;');
// For display: a protected entity shows as &name;
export const displayText = restore;

// Where the root element starts and ends in the source text.
function rootSpan(text) {
  const re = /<(!--[\s\S]*?-->|\?[\s\S]*?\?>|!DOCTYPE(?:[^[>]|\[[\s\S]*?\])*>|([A-Za-z_][\w:.-]*))/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[2]) {
      const start = m.index;
      const name = m[2];
      const close = text.lastIndexOf(`</${name}`);
      const end = close === -1 ? text.length : text.indexOf('>', close) + 1;
      return { start, end: end || text.length };
    }
  }
  return { start: 0, end: text.length };
}

/*
  Parse. Returns { doc, prolog, epilogue } or { error: { message, line } }.
  `impl` = { DOMParser, XMLSerializer } (defaults to the browser's).
*/
export function parseXml(text, impl = globalThis) {
  const span = rootSpan(text);
  const prolog = text.slice(0, span.start);
  const epilogue = text.slice(span.end);
  // Outside the root element only comments, processing instructions and white space may appear.
  const stray = epilogue.replace(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g, '');
  if (/\S/.test(stray)) {
    const at = span.end + epilogue.search(/\S/);
    return { error: { message: 'Extra content after the end of the root element.', line: text.slice(0, at).split('\n').length } };
  }
  let errorMessage = null;
  const parser = new impl.DOMParser(impl.errorHandler ? { errorHandler: impl.errorHandler((m) => { errorMessage = errorMessage || m; }) } : undefined);
  const body = protect(text.slice(span.start, span.end));
  let doc;
  try { doc = parser.parseFromString(body, 'application/xml'); } catch (e) { errorMessage = errorMessage || e.message; }
  const perr = doc && doc.getElementsByTagName('parsererror')[0];
  if (!doc || !doc.documentElement || perr || errorMessage) {
    const msg = String(errorMessage || (perr && perr.textContent) || 'The XML could not be read.');
    const lm = /line(?: number)?[^\d]*(\d+)/i.exec(msg);
    const prologLines = prolog.split('\n').length - 1;
    return { error: { message: msg.replace(/\s+/g, ' ').replace(/^.*?error[^:]*:\s*/i, '').slice(0, 300), line: lm ? Number(lm[1]) + prologLines : 1 } };
  }
  return { doc, prolog, epilogue };
}

export function serializeXml(parsed, impl = globalThis) {
  const s = new impl.XMLSerializer().serializeToString(parsed.doc.documentElement);
  return parsed.prolog + restore(s) + parsed.epilogue;
}

// ---- addressing ---------------------------------------------------------------

export const elementChildren = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 1);
export const childNames = (el) => elementChildren(el).map((c) => c.nodeName);

export function elementAt(doc, path) {
  let el = doc.documentElement;
  for (const i of path) {
    el = elementChildren(el)[i];
    if (!el) return null;
  }
  return el;
}

export function pathOf(el) {
  const path = [];
  while (el && el.parentNode && el.parentNode.nodeType === 1) {
    path.unshift(elementChildren(el.parentNode).indexOf(el));
    el = el.parentNode;
  }
  return path;
}

// ---- edits (each mutates the parsed doc; the caller serialises) -------------

function indentOf(parent) {
  // The whitespace used before the parent's existing element children, for tidy insertion.
  for (const n of Array.from(parent.childNodes)) if (n.nodeType === 3 && /^\s*\n[ \t]*$/.test(n.data)) return n.data;
  return null;
}

/*
  Create an element and fill it with what its model requires (recursively,
  a few levels deep). `model` is a content model from contentModelFor().
*/
export function createElementFilled(doc, name, model, depth = 0) {
  const el = doc.createElement(name);
  if (depth < 4 && model) {
    let children = model.requiredChildren(name);
    // The element the author inserts gets a title and a first paragraph when its model allows them
    // (a levelledPara may legally be empty, which is never what is wanted).
    if (depth === 0 && !children.length && !model.holdsText(name)) {
      if (model.insertableAt(name, [], 0).includes('title')) children = ['title'];
      if (model.insertableAt(name, children, children.length).includes('para')) children = [...children, 'para'];
      if (!model.canExtend(name, children)) children = [];
    }
    for (const child of children) el.appendChild(createElementFilled(doc, child, model, depth + 1));
  }
  return el;
}

// Insert a new element as element-child `index` of the element at `parentPath`; returns its path.
export function insertElement(parsed, parentPath, index, name, model) {
  const parent = elementAt(parsed.doc, parentPath);
  const kids = elementChildren(parent);
  const el = createElementFilled(parsed.doc, name, model);
  const ref = kids[index] || null;
  const mixed = model && model.holdsText(parent.nodeName);
  const ws = mixed ? null : indentOf(parent);
  if (ref) {
    parent.insertBefore(el, ref);
    if (ws) parent.insertBefore(parsed.doc.createTextNode(ws), ref);
  } else {
    const last = parent.lastChild;
    // Keep the closing tag's own indentation after the new element.
    if (ws && last && last.nodeType === 3 && /^\s+$/.test(last.data)) {
      parent.insertBefore(parsed.doc.createTextNode(ws), last);
      parent.insertBefore(el, last);
    } else {
      parent.appendChild(el);
    }
  }
  return [...parentPath, Math.min(index, kids.length)];
}

// Split a text node at `offset` and put a new inline element there; returns its path.
export function insertInline(parsed, parentPath, nodeIndex, offset, name, model) {
  const parent = elementAt(parsed.doc, parentPath);
  const node = parent.childNodes[nodeIndex];
  const el = createElementFilled(parsed.doc, name, model);
  if (node && node.nodeType === 3) {
    const after = node.data.slice(offset);
    node.data = node.data.slice(0, offset);
    const next = node.nextSibling;
    parent.insertBefore(el, next);
    if (after) parent.insertBefore(parsed.doc.createTextNode(after), next);
  } else {
    parent.insertBefore(el, node || null);
  }
  return pathOf(el);
}

export function removeElement(parsed, path) {
  const el = elementAt(parsed.doc, path);
  const parent = el.parentNode;
  const prev = el.previousSibling;
  parent.removeChild(el);
  // Drop the indentation that preceded it, so blank lines do not pile up.
  if (prev && prev.nodeType === 3 && /^\s+$/.test(prev.data) && prev.previousSibling) parent.removeChild(prev);
}

// Swap with the previous (-1) or next (+1) element sibling; returns the new path.
export function moveElement(parsed, path, delta) {
  const el = elementAt(parsed.doc, path);
  const parent = el.parentNode;
  const kids = elementChildren(parent);
  const i = kids.indexOf(el);
  const j = i + delta;
  if (j < 0 || j >= kids.length) return path;
  if (delta < 0) parent.insertBefore(el, kids[j]);
  else parent.insertBefore(el, kids[j].nextSibling);
  return [...path.slice(0, -1), j];
}

export function setAttribute(parsed, path, name, value) {
  const el = elementAt(parsed.doc, path);
  if (value === null || value === undefined || value === '') el.removeAttribute(name);
  else el.setAttribute(name, value);
}

// Replace the text of child node `nodeIndex` (a text node) of the element at `path`.
export function setText(parsed, path, nodeIndex, value) {
  const el = elementAt(parsed.doc, path);
  const node = el.childNodes[nodeIndex];
  const v = protect(value);
  if (node && node.nodeType === 3) node.data = v;
  else if (!node && v) el.appendChild(parsed.doc.createTextNode(v));
}

// Child-name sequences that become invalid with an edit, for enabling actions.
export function namesAfterRemove(el, index) { const n = childNames(el); n.splice(index, 1); return n; }
export function namesAfterMove(el, index, delta) {
  const n = childNames(el);
  const j = index + delta;
  if (j < 0 || j >= n.length) return null;
  [n[index], n[j]] = [n[j], n[index]];
  return n;
}

/*
  Content-model problems in the whole document: elements whose element
  children are not a valid sequence for their model. Returns
  [{ path, name, index, message }], index = first offending child (or the
  child count when something required is missing).
*/
export function contentProblems(doc, model, limit = 200) {
  const out = [];
  const walk = (el, path) => {
    if (out.length >= limit) return;
    const names = childNames(el);
    if (model.isKnown(el.nodeName)) {
      const bad = model.firstInvalidIndex(el.nodeName, names);
      if (bad !== -1) {
        out.push({
          path, name: el.nodeName, index: bad,
          message: bad < names.length
            ? `<${names[bad]}> is not allowed here in <${el.nodeName}>.`
            : `<${el.nodeName}> is incomplete: it needs ${(model.insertableAt(el.nodeName, names, names.length) || []).slice(0, 3).map((x) => `<${x}>`).join(' or ') || 'more content'}.`,
        });
      }
    }
    elementChildren(el).forEach((c, i) => walk(c, [...path, i]));
  };
  walk(doc.documentElement, []);
  return out;
}
