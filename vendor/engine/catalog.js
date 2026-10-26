'use strict';
/*
  The XML catalogue: every s1000d.org URL our content names, mapped to the copy
  on disk.

  S1000D documents identify their schema and their character entity set by URL:

    xsi:noNamespaceSchemaLocation="http://www.s1000d.org/S1000D_4-2/xml_schema_flat/descript.xsd"
    <!ENTITY % ISOEntities PUBLIC "..." "http://www.s1000d.org/S1000D_4-2/ent/ISOEntities">

  Left alone, a parser resolves those over the network — which this application
  promises customers it never does, and which would fail anyway on the closed
  networks it is built for. Every tool here runs with the network off, so
  without a catalogue the schema is simply not found and the entities are not
  defined: content using "&deg;" fails to parse.

  A catalogue closes that gap properly, rather than by rewriting anyone's
  documents. The files keep the URLs they were authored with — which is what
  makes them portable to another tool chain — and resolution happens locally.

  Written at start-up rather than shipped, because the absolute paths differ
  between a development checkout and an installed application, and a catalogue
  with wrong paths fails by silently resolving nothing, which looks exactly
  like a document that needed no schema.
*/
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SCHEMAS } = require('./paths');

const CATALOG_FILE = path.join(os.tmpdir(), 'agastya-s1000d-catalog.xml');

// 4.2 -> S1000D_4-2, which is how the URLs are written.
const urlIssue = (iss) => 'S1000D_' + iss.replace('.', '-');

/*
  A literal space (or other reserved character) in the path makes libxml2
  reject the whole rewriteURI/rewriteSystem entry as an invalid URI
  reference — "rewriteURI entry 'rewritePrefix' broken" is libxml2's own
  wording for exactly this. Never surfaced from a dev checkout (no spaces
  in that path), but every real per-user install lands under
  "...\Programs\JSS Publisher\...", which has one right in the product
  name. Same fix as build.js's encodeHrefPath for the identical problem in
  xsl:import/include hrefs: percent-encode each path segment, but leave a
  Windows drive letter ("C:") alone — encodeURIComponent would otherwise
  turn it into "C%3A" and break the URI a different way.
*/
const fileUri = (p) => {
    const abs = path.resolve(p).split(path.sep).join('/');
    const encoded = abs.split('/').map((seg, i) =>
        (i === 0 && /^[A-Za-z]:$/.test(seg)) ? seg : encodeURIComponent(seg));
    return 'file:///' + encoded.join('/').replace(/^\//, '');
};

function installedIssues() {
    try { return fs.readdirSync(SCHEMAS).filter((d) => /^\d+\.\d+$/.test(d)).sort(); }
    catch { return []; }
}

/*
  Returns the catalogue's path, or null when there is nothing to map.

  Both a rewriteURI and a rewriteSystem rule per directory: schema locations
  are resolved as URIs, while an entity's SYSTEM identifier goes through the
  system-id lookup. Only one of the two ever matches for a given reference, and
  which one is not something the caller should have to know.
*/
function writeCatalog() {
    const issues = installedIssues();
    if (!issues.length) return null;

    const rules = [];
    for (const iss of issues) {
        const base = path.join(SCHEMAS, iss);
        const pairs = [['xml_schema_flat', base]];
        // The entity sets are not published for every issue; map only what is
        // actually here, so a missing set stays a visible warning rather than
        // resolving to another issue's characters.
        const ent = path.join(base, 'ent');
        if (fs.existsSync(ent)) pairs.push(['ent', ent]);

        for (const [segment, dir] of pairs) {
            const from = `http://www.s1000d.org/${urlIssue(iss)}/${segment}/`;
            const to = fileUri(dir) + '/';
            rules.push(`  <rewriteURI uriStartString="${from}" rewritePrefix="${to}"/>`);
            rules.push(`  <rewriteSystem systemIdStartString="${from}" rewritePrefix="${to}"/>`);
        }
    }

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<!-- Generated at start-up from the installed schema and entity sets. Do not edit. -->\n'
        + '<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">\n'
        + rules.join('\n') + '\n</catalog>\n';
    fs.writeFileSync(CATALOG_FILE, xml, 'utf8');
    return CATALOG_FILE;
}

/*
  libxml2 — which is xsltproc, and therefore the whole build — reads catalogues
  from XML_CATALOG_FILES. Set on the child rather than on this process so it
  cannot leak into anything else running here.

  Any catalogue the user has already configured is kept and ours appended: the
  variable is a space-separated list, and quietly replacing someone's own
  catalogue would be a surprising thing for a publishing tool to do.
*/
function catalogEnv() {
    const file = writeCatalog();
    if (!file) return {};
    const existing = String(process.env.XML_CATALOG_FILES || '').trim();
    const ours = fileUri(file);
    return { XML_CATALOG_FILES: existing ? `${existing} ${ours}` : ours };
}

module.exports = { writeCatalog, catalogEnv, installedIssues, CATALOG_FILE };
