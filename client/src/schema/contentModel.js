// What may go HERE, not merely what may go inside: the S1000D content models
// compiled by scripts/build-content-models.mjs (particle trees with sequence,
// choice and occurrence kept), turned into automata and simulated. Ported
// from the Agastya original (frontend/src/schema/ContentModel.ts); here a
// model is an object bound to one document's issue and schema type instead of
// a module-wide singleton, so two editors can never share the wrong one.
//
// A candidate is valid at index i when the child sequence with it spliced in
// at i can still be completed into a valid one. No heuristics.

import DATA from '../data/content-models.json' with { type: 'json' };

export const DEFAULT_ISSUE = '4.2';
export const DEFAULT_TYPE = 'descript';

// maxOccurs above this is treated as unbounded (over-accepts a 13th item; the XSD check still catches it).
const EXPAND_CAP = 12;

function build(particle) {
  const states = [];
  const names = new Set();
  let open = false;
  const newState = () => { states.push({ eps: [], on: new Map(), any: [] }); return states.length - 1; };
  const link = (a, b) => { states[a].eps.push(b); };

  function frag(p) {
    const once = () => {
      if (p.k === 'e') {
        names.add(p.n);
        const s = newState(), f = newState();
        states[s].on.set(p.n, [f]);
        return [s, f];
      }
      if (p.k === 'a') {
        open = true;
        const s = newState(), f = newState();
        states[s].any.push(f);
        return [s, f];
      }
      if (p.k === 's') {
        const s = newState();
        let cur = s;
        for (const item of p.c) { const [is, ie] = frag(item); link(cur, is); cur = ie; }
        return [s, cur];
      }
      const s = newState(), f = newState();
      for (const item of p.c) { const [is, ie] = frag(item); link(s, is); link(ie, f); }
      return [s, f];
    };
    const min = Math.max(0, p.min);
    const unbounded = p.max === -1 || p.max > EXPAND_CAP;
    const max = unbounded ? Math.max(min, 1) : p.max;
    const entry = newState();
    let cur = entry;
    for (let i = 0; i < min; i++) { const [is, ie] = once(); link(cur, is); cur = ie; }
    if (unbounded) {
      const loop = cur;
      const [is, ie] = once();
      link(loop, is); link(ie, loop);
      const exit = newState();
      link(loop, exit);
      return [entry, exit];
    }
    const exit = newState();
    link(cur, exit);
    for (let i = min; i < max; i++) { const [is, ie] = once(); link(cur, is); link(ie, exit); cur = ie; }
    return [entry, exit];
  }

  if (!particle) { const s = newState(); return { states, start: s, accept: s, names, open }; }
  const [start, accept] = frag(particle);
  return { states, start, accept, names, open };
}

function closure(nfa, set) {
  const out = new Set();
  const stack = [...set];
  while (stack.length) {
    const s = stack.pop();
    if (out.has(s)) continue;
    out.add(s);
    for (const n of nfa.states[s].eps) if (!out.has(n)) stack.push(n);
  }
  return out;
}

function step(nfa, set, name) {
  const next = new Set();
  for (const s of set) {
    const st = nfa.states[s];
    for (const t of st.on.get(name) || []) next.add(t);
    for (const t of st.any) next.add(t);
  }
  return closure(nfa, next);
}

function run(nfa, names) {
  let set = closure(nfa, [nfa.start]);
  for (const n of names) { set = step(nfa, set, n); if (!set.size) return null; }
  return set;
}

// Shared automata: definitions are interned across models, so a def index identifies one.
const nfaCache = new Map();
function nfaForDef(defIndex) {
  let n = nfaCache.get(defIndex);
  if (!n) { n = build(DATA.defs[defIndex] ? DATA.defs[defIndex].c : null); nfaCache.set(defIndex, n); }
  return n;
}

export const modelKeys = () => Object.keys(DATA.models).sort();

/*
  The model for a document's issue and schema type, falling back to the same
  type at the default issue, then the default model. `exact` says whether
  the document's own combination was found.
*/
export function contentModelFor(issue, schemaType) {
  const type = schemaType || DEFAULT_TYPE;
  const candidates = [issue ? `${issue}/${type}` : null, `${DEFAULT_ISSUE}/${type}`, `${DEFAULT_ISSUE}/${DEFAULT_TYPE}`].filter(Boolean);
  const key = candidates.find((k) => DATA.models[k]);
  const model = DATA.models[key];
  const nfaFor = (name) => (model[name] === undefined ? null : nfaForDef(model[name]));

  const api = {
    key,
    exact: key === candidates[0],
    isKnown: (name) => model[name] !== undefined,
    // Does this element hold text (simple type, simpleContent or mixed)?
    holdsText: (name) => model[name] !== undefined && DATA.defs[model[name]].t === 1,
    // Every element this one may contain anywhere in its model.
    allowedChildren: (parent) => { const n = nfaFor(parent); return n ? [...n.names] : []; },
    isContainer: (parent) => { const n = nfaFor(parent); return !!n && (n.names.size > 0 || n.open); },
    // Is this exact child sequence valid for `parent`? (Unknown elements are not judged.)
    isValidSequence(parent, children) {
      const n = nfaFor(parent);
      if (!n) return true;
      const set = run(n, children);
      return !!set && set.has(n.accept);
    },
    // Could this sequence still be completed into a valid one?
    canExtend(parent, children) { const n = nfaFor(parent); return !n || !!run(n, children); },
    // The first index where the sequence stops being extendable; children.length when incomplete; -1 when valid.
    firstInvalidIndex(parent, children) {
      const n = nfaFor(parent);
      if (!n) return -1;
      let set = closure(n, [n.start]);
      for (let i = 0; i < children.length; i++) {
        const next = step(n, set, children[i]);
        if (!next.size) return i;
        set = next;
      }
      return set.has(n.accept) ? -1 : children.length;
    },
    /*
      What may be inserted at `index` among `children`. When the existing
      children are not even a valid prefix, the element's whole vocabulary
      is offered instead: an empty menu would go silent exactly when the
      author needs it to repair something (as in the original).
    */
    insertableAt(parent, children, index) {
      const n = nfaFor(parent);
      if (!n) return [];
      const at = Math.max(0, Math.min(index, children.length));
      const head = children.slice(0, at), tail = children.slice(at);
      const out = [...n.names].filter((c) => !!run(n, [...head, c, ...tail]));
      if (out.length) return out.sort();
      if (!run(n, children)) return [...n.names].sort();
      return [];
    },
    // Attribute name -> permitted values ([] when free text).
    attributesOf(name) {
      if (model[name] === undefined) return {};
      const def = DATA.defs[model[name]];
      const out = {};
      for (const [a, ref] of Object.entries(def.a || {})) out[a] = ref === null ? [] : DATA.enums[ref] || [];
      return out;
    },
    /*
      The children a new element needs to be valid on its own, chosen from
      the model: the shortest path to acceptance, preferring for each step an
      element that holds text. Returns names (each is then filled the same way).
    */
    requiredChildren(parent) {
      const n = nfaFor(parent);
      if (!n) return [];
      // Breadth-first over state sets: the fewest elements that reach acceptance.
      const startSet = closure(n, [n.start]);
      if (startSet.has(n.accept)) return [];
      const keyOf = (set) => [...set].sort((a, b) => a - b).join(',');
      const seen = new Set([keyOf(startSet)]);
      let frontier = [{ set: startSet, path: [] }];
      for (let depth = 0; depth < 8 && frontier.length; depth++) {
        const next = [];
        for (const { set, path } of frontier) {
          const candidates = [...n.names].sort((a, b) => Number(api.holdsText(b)) - Number(api.holdsText(a)) || a.localeCompare(b));
          for (const c of candidates) {
            const s2 = step(n, set, c);
            if (!s2.size) continue;
            const p2 = [...path, c];
            if (s2.has(n.accept)) return p2;
            const k = keyOf(s2);
            if (!seen.has(k)) { seen.add(k); next.push({ set: s2, path: p2 }); }
          }
        }
        frontier = next;
      }
      return [];
    },
  };
  return api;
}
