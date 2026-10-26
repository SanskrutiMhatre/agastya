'use strict';
// Post-render sanity checks on the generated XSL-FO.
//
// These run on the FO rather than on the source or the stylesheets, so they
// hold for both pipelines and catch a bad reference however it arose — a
// stale unparsed-entity name, a wrong fallback folder, or a stylesheet that
// simply emitted nothing. FOP does not fail on a missing image: it logs and
// leaves a blank, so without this a build reports success while pages come
// out with holes in them.

const fs = require('fs');
const path = require('path');

// fo:external-graphic carries src either bare or wrapped in url('...').
const SRC_RE = /src="(?:url\((['"]?)([^'")]*)\1\)|([^"]*))"/g;

function imageRefs(foText) {
    const out = [];
    for (const m of String(foText || '').matchAll(SRC_RE)) {
        out.push(m[2] !== undefined ? m[2] : (m[3] || ''));
    }
    return out;
}

/*
  Returns { total, empty, missing } where `missing` is a de-duplicated list of
  { src, count } for paths that do not resolve on disk. `empty` counts src=""
  separately: that is always a stylesheet bug rather than absent artwork, so
  it is worth distinguishing in the report.
*/
function checkImages(foPath, baseDir) {
    if (!fs.existsSync(foPath)) return { total: 0, empty: 0, missing: [] };
    const dir = baseDir || path.dirname(foPath);
    const refs = imageRefs(fs.readFileSync(foPath, 'utf8'));
    const counts = new Map();
    let empty = 0;
    for (const src of refs) {
        if (!src) { empty++; continue; }
        if (fs.existsSync(path.join(dir, src))) continue;
        counts.set(src, (counts.get(src) || 0) + 1);
    }
    return {
        total: refs.length,
        empty,
        missing: [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([src, count]) => ({ src, count })),
    };
}

// Compact one-line summary, or '' when everything resolved.
function formatImageCheck(r) {
    if (!r || (!r.empty && !r.missing.length)) return '';
    const parts = [];
    if (r.empty) parts.push(`${r.empty} with no src (stylesheet bug)`);
    if (r.missing.length) {
        const shown = r.missing.slice(0, 5).map((m) => m.src + (m.count > 1 ? ` x${m.count}` : ''));
        const more = r.missing.length - shown.length;
        parts.push(`${r.missing.length} unresolved: ${shown.join(', ')}${more > 0 ? `, +${more} more` : ''}`);
    }
    return parts.join('; ');
}

module.exports = { imageRefs, checkImages, formatImageCheck };
