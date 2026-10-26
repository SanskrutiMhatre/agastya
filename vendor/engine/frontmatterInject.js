'use strict';
// Splices the settings-driven front matter into a publication module for the
// direct S1000D -> FO pipeline.
//
// The JSS pipeline carries this data inside the jssbook it generates
// (<bookmeta> + <frontmatter>). The direct pipeline has no such generated
// intermediate — it renders the author's PM — so the same two blocks are
// injected into a working copy of the PM instead. s1000dtofo then renders them
// with the very same templates the JSS pipeline uses (see
// pipeline/s1000dtofo/frontmatter-shared.xsl, which includes
// jsstofo/frontmatter.xsl rather than duplicating it), so both engines produce
// identical front matter from one definition.
//
// The page XML files themselves are produced by the existing
// engine/frontmatter.js — reused as-is, not reimplemented.

const XI_NS = 'http://www.w3.org/2001/XInclude';

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

// Security codes carry through settings as either the S1000D two-digit code or
// an already-spelled-out label; the front matter prints the label.
const SECURITY = {
    '01': 'UNCLASSIFIED', '02': 'RESTRICTED', '03': 'CONFIDENTIAL',
    '04': 'SECRET', '05': 'TOP SECRET',
};

function monthName(m) {
    if (!m) return '';
    const n = parseInt(m, 10);
    return (n >= 1 && n <= 12) ? MONTHS[n - 1] : String(m);
}

/*
  The month/year printed on the title pages.

  Taken from the publication module's own <issueDate>, exactly as
  s1000dtojss.xsl's issue-month-year template does — NOT from
  publication.month/year in settings, which the JSS pipeline ignores here and
  which are usually blank. Reading them was why the date came out empty.
  Falls back to the same "Month"/"YYYY" placeholders the JSS pipeline uses so a
  missing date is visible rather than silently absent.
*/
function issueMonthYear(pmText) {
    const m = /<issueDate\b[^>]*>/.exec(pmText || '');
    const attr = (name) => (m && new RegExp(`\\b${name}="([^"]*)"`).exec(m[0]) || [])[1];
    const month = attr('month');
    const year = attr('year');
    return {
        month: month ? monthName(month) : 'Month',
        year: year || 'YYYY',
    };
}

/*
  The <publisher> elements for the title pages — one per configured publisher,
  however many there are.

  Shared with the JSS pipeline, which used to build this list in XSLT with the
  first publisher hardcoded and a single optional second. That made a third
  impossible and made the first ignore its own settings. Generating it once
  here means both engines show the same publishers from the same configuration.
*/
function publisherRows(branding, indent) {
    const pad = indent || '';
    return ((branding && branding.publishers) || []).map((p) => {
        const lines = Array.isArray(p.addressLines) ? p.addressLines
            : (p.addressLines ? String(p.addressLines).split('\n') : []);
        const logoAttrs = (p.logoWidth ? ` width="${escAttr(p.logoWidth)}"` : '')
            + (p.logoHeight ? ` height="${escAttr(p.logoHeight)}"` : '');
        return `${pad}<publisher>\n`
            + (p.logo ? `${pad}  <logo src="${escAttr(p.logo)}"${logoAttrs}/>\n` : '')
            + `${pad}  <name>${esc(p.name)}</name>\n`
            + lines.filter((l) => String(l).trim())
                .map((l) => `${pad}  <addressLine>${esc(l)}</addressLine>\n`).join('')
            + `${pad}</publisher>`;
    }).join('\n');
}

// A standalone document for the JSS stage-1 stylesheet to read with document().
function publishersXml(branding) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<!-- Generated per build from settings. Do not edit. -->\n'
        + `<publishers>\n${publisherRows(branding, '  ')}\n</publishers>\n`;
}

// Mirrors the <bookmeta> that s1000dtojss.xsl emits, so the shared front-matter
// templates find exactly the shape they expect.
function bookmetaXml(effective, pmText) {
    const pub = (effective && effective.publication) || {};
    const date = issueMonthYear(pmText);
    const branding = (effective && effective.branding) || {};
    const cls = pub.securityClassification || '';
    const security = SECURITY[cls] || String(cls).toUpperCase();

    const publishers = publisherRows(branding, '      ');

    return `  <bookmeta>
    <bookName>${esc(pub.bookName)}</bookName>
    <systemName>${esc(pub.systemName)}</systemName>
    <security>${esc(security)}</security>
    <publicationNo>${esc(pub.publicationNo)}</publicationNo>
    <inbrNo>${esc(pub.inbrNo)}</inbrNo>
    <nsn>${esc(pub.nsn)}</nsn>
    <contractNo>${esc(pub.contractNo)}</contractNo>
    <projectCode>${esc(pub.projectCode)}</projectCode>
    <ltDocumentNo>${esc(pub.ltDocumentNo)}</ltDocumentNo>
    <month>${esc(date.month)}</month>
    <year>${esc(date.year)}</year>
${branding.emblem ? `    <emblem src="${escAttr(branding.emblem)}"/>\n` : ''}    <publishers>
${publishers}
    </publishers>
  </bookmeta>`;
}

// The running order now lives in engine/frontMatterPages.js, shared with the
// JSS engine, so the two pipelines cannot drift apart. FRONT_MATTER_ORDER is
// kept as a derived view for callers (and tests) that still ask for it.
const { enabledPages, resolvePages } = require('./frontMatterPages');

const FRONT_MATTER_ORDER = resolvePages(null).map((p) => (
    p.element ? (p.file ? { element: p.element, file: p.file } : { element: p.element }) : p.file
));

/*
  Insert <bookmeta> and <frontmatter> as the first children of <pm>.

  `available` is the set of page files that actually exist on disk (some are
  generated from settings, others are static pages shipped with the app); an
  entry with no file is skipped rather than becoming a broken include.
  Returns { text, injected }.
*/
function injectJssFrontMatter(pmText, effective, available, dirRel) {
    const have = new Set(available || []);
    const open = /<pm(\s[^>]*)?>/.exec(pmText);
    if (!open) return { text: pmText, injected: 0 };

    let injected = 0;
    const rows = [];
    for (const page of enabledPages(effective && effective.frontMatter)) {
        const entry = page.element
            ? (page.file ? { element: page.element, file: page.file } : { element: page.element })
            : page.file;
        if (typeof entry === 'object') {
            // Contents, figures, tables and the system-name page are built by
            // the stylesheet from the document itself, so there is no file to
            // include. Abbreviations are the exception: nothing derives them
            // automatically, so the stencil is authored by hand and must be
            // included when it exists — emitting the bare element instead is
            // what made manual <abbreviation> entries silently disappear and
            // print the blank pro-forma.
            if (entry.file && have.has(entry.file)) {
                rows.push(`    <xi:include href="${escAttr((dirRel ? dirRel + '/' : '') + entry.file)}"/>`);
                injected++;
            } else {
                rows.push(`    <${entry.element}/>`);
            }
            continue;
        }
        if (!have.has(entry)) continue;
        rows.push(`    <xi:include href="${escAttr((dirRel ? dirRel + '/' : '') + entry)}"/>`);
        injected++;
    }
    if (!injected) return { text: pmText, injected: 0 };

    const block = `\n${bookmetaXml(effective, pmText)}\n  <frontmatter>\n${rows.join('\n')}\n  </frontmatter>`;

    const at = open.index + open[0].length;
    let out = pmText.slice(0, at) + block + pmText.slice(at);
    if (!/xmlns:xi\s*=/.test(out)) {
        out = out.replace(/<pm(\s|>)/, `<pm xmlns:xi="${XI_NS}"$1`);
    }
    return { text: out, injected };
}

module.exports = { injectJssFrontMatter, bookmetaXml, publishersXml, FRONT_MATTER_ORDER };
