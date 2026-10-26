'use strict';
// Two-layer configuration: a house-style template overlaid by a project.
//
//   effective = merge(house, project)
//
// The effective config is the single source of truth for a build. This module
// loads and merges it, and maps the layout section to the xsltproc parameters
// the jsstofo stylesheet already understands.
//
// Phase 0 note: only parameters that ALREADY exist in jsstofo.xsl are emitted,
// and their defaults in default.house.json equal the stylesheet defaults, so a
// build driven from the config is byte-identical to the previous hard-coded
// pipeline. Per-level heading spacing/indent (headings[].spaceBefore etc.) are
// carried in the config but not emitted until jsstofo gains those params
// (Phase 3).

const fs = require('fs');
const path = require('path');

// Adds deltaMm to a "<number>mm" length string, e.g. bumpMm('8mm', 6) -> '14mm'.
// Returns the value unchanged if it isn't a plain mm length.
function bumpMm(value, deltaMm) {
    const m = /^(-?\d+(?:\.\d+)?)\s*mm$/.exec(String(value == null ? '' : value).trim());
    if (!m) return value;
    return (parseFloat(m[1]) + deltaMm) + 'mm';
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadHouse(configDir, id) {
    return readJson(path.join(configDir, `${id}.house.json`));
}

function loadProject(projectJsonPath) {
    return readJson(projectJsonPath);
}

function isPlainObject(x) {
    return x && typeof x === 'object' && !Array.isArray(x);
}

// Deep merge: objects merge key-by-key; arrays and scalars from `over` replace
// those in `base`. Keys whose name starts with "//" (JSON comments) are dropped.
function deepMerge(base, over) {
    const out = {};
    for (const k of Object.keys(base || {})) {
        if (k.startsWith('//')) continue;
        out[k] = base[k];
    }
    for (const k of Object.keys(over || {})) {
        if (k.startsWith('//')) continue;
        const b = out[k], o = over[k];
        out[k] = (isPlainObject(b) && isPlainObject(o)) ? deepMerge(b, o) : o;
    }
    return out;
}

// Combine a house template and a project into the effective config.
function mergeConfig(house, project) {
    project = project || {};
    const layout = deepMerge(house.layout || {}, (project.overrides && project.overrides.layout) || {});
    const branding = {
        emblem: house.branding && house.branding.emblem,
        // A project publisher list replaces the template's entirely (a joint
        // title page is all-or-nothing, not merged slot-by-slot).
        publishers: project.publishers || (house.branding && house.branding.publishers) || []
    };
    /*
      One front-matter block for both engines.

      There used to be a second, s1000dFrontMatter, on the premise that the two
      engines might want different wording. In practice it split every setting
      in two: the page files were generated from whichever block was non-empty
      while the parameters derived from front matter were read from the shared
      one, so a project with anything in the S1000D block took its pages from
      one tab and their headings from the other. Nobody was using it for its
      stated purpose — only one house template had ever been written to, and
      then only by someone trying to find where a setting had gone.

      Any value still stored under the old key is merged in underneath, so a
      project that did use it keeps its content rather than silently reverting.
    */
    const frontMatter = deepMerge(
        deepMerge(house.s1000dFrontMatterDefaults || {}, project.s1000dFrontMatter || {}),
        deepMerge(house.frontMatterDefaults || {}, project.frontMatter || {}),
    );
    return {
        schemaVersion: house.schemaVersion,
        templateId: house.id,
        layout,
        branding,
        publication: project.publication || {},
        input: project.input || {},
        frontMatter,
    };
}

// Map effective.layout to the [name, value] xsltproc params jsstofo consumes.
// Only params that exist in jsstofo.xsl today are emitted (Phase 0).
function stage2Params(eff) {
    const L = eff.layout || {};
    const p = L.page || {}, f = L.fonts || {}, fig = L.figures || {}, caps = fig.caps || {};
    const H = L.headings || [];
    const params = [];
    const add = (n, v) => { if (v !== undefined && v !== null) params.push([n, String(v)]); };

    add('page-width', p.width);
    add('page-height', p.height);
    add('page-margin-top', p.marginTop);
    add('page-margin-bottom', p.marginBottom);
    add('margin-inner', p.marginInner);
    add('margin-outer', p.marginOuter);
    add('body-margin-top', p.bodyMarginTop);
    add('body-margin-bottom', p.bodyMarginBottom);
    add('region-before-extent', p.headerExtent);
    add('region-after-extent', p.footerExtent);

    add('font-family', f.family);
    add('font-size', f.bodySize);
    add('line-height', f.lineHeight);
    add('header-footer-size', f.headerFooterSize);
    add('table-font-size', f.tableSize);
    // The cover/title page's own headline typography — the biggest text in
    // the book, and previously the one piece of it Settings had no lever
    // for at all. Emitted to both engines (see stage2Params' one caller for
    // each), since they share the same front-matter markup.
    add('cover.title.font-family', f.coverTitleFamily);
    add('cover.title.font-size', f.coverTitleSize);

    /*
      Security classification banner ("RESTRICTED" and friends).

      Emitted only for values the project actually sets — `add` skips blanks —
      so an untouched project sends nothing and each stylesheet keeps its own
      default appearance. That matters because the two engines start from
      different looks (the JSS cover banner is red and underlined, the direct
      engine's running head is plain bold), and sending a value here overrides
      BOTH to the same thing, which is the point of putting it in Settings.
    */
    const cls = L.classification || {};
    add('classification.size', cls.size);
    add('classification.color', cls.color);
    add('classification.weight', cls.weight);
    add('classification.decoration', cls.decoration);
    add('classification.align', cls.align);

    // The running header's publication line. Blank text keeps the model code
    // plus the suffix, which is what every existing book prints today.
    const hdr = L.header || {};
    add('header.publication.text', hdr.publicationText);
    add('header.publication.suffix', hdr.publicationSuffix);

    // Where figure numbers restart: per data module, or once through the
    // publication. Tables have no equivalent — see tables.xsl.
    add('figure.numbering', fig.numbering);
    add('classification.padding.top', cls.paddingTop);
    add('classification.padding.bottom', cls.paddingBottom);
    add('classification.padding.left', cls.paddingLeft);
    add('classification.padding.right', cls.paddingRight);

    add('heading1-size', L.chapterTitleSize);
    // heading2/3-size still drive front-matter page titles; keep them synced to
    // the first two body-heading levels.
    if (H[0]) add('heading2-size', H[0].size);
    if (H[1]) add('heading3-size', H[1].size);

    // Per-level body headings (levels 1-4): size, spacing, indents, uppercase.
    // bodyIndent (where the title text starts, and where the body paragraphs
    // below the heading also start — jsstofo renders the heading as a
    // hanging-indent list-block, so both are always indentLeft + titleGap)
    // is always DERIVED, never read as its own absolute value, so a heading
    // and its body text can never drift out of sync. titleGap is the one
    // knob: an explicit numeric mm value overrides the auto default, which
    // is wider at deeper levels because the section number itself is longer
    // there — level 1 numbers like "3.4", level 4 numbers like "3.4.2.1.3" —
    // and too narrow a gap wraps a long number inside its own label column.
    H.forEach((h) => {
        const n = h.level;
        if (!n) return;
        const autoGap = 10 + n * 5;
        const gap = (h.titleGap === undefined || h.titleGap === '' || h.titleGap === null)
            ? autoGap : Number(h.titleGap);
        add(`heading.${n}.size`, h.size);
        add(`heading.${n}.spaceBefore`, h.spaceBefore);
        add(`heading.${n}.spaceAfter`, h.spaceAfter);
        add(`heading.${n}.indent`, h.indentLeft);
        add(`heading.${n}.bodyIndent`, bumpMm(h.indentLeft, gap));
        if (h.uppercase !== undefined) add(`heading.${n}.uppercase`, h.uppercase ? '1' : '0');
        if (h.pageBreakBefore !== undefined) add(`heading.${n}.pageBreakBefore`, h.pageBreakBefore ? '1' : '0');
    });

    // Front-matter first-aid artwork. firstAidImage existed in the house
    // template but nothing ever read it, so the stencil's hardcoded src was
    // the only way to change the picture.
    const fmx = eff.frontMatter || {};
    // Per-page heading overrides (Settings > Front Matter > Pages).
    for (const [n, v] of require('./frontMatterPages').titleParams(fmx)) add(n, v);

    /*
      Overrides for the fixed wording inside the front-matter pages. Flat
      key/value, keyed exactly as the $fm.label.* parameters are named, so a
      new label needs no change here — only the stylesheet and the catalogue
      the Settings table is drawn from.
    */
    /*
      Flattened, because the Settings path helper splits a dotted key into
      nested objects: writing "labels.handbooks.colInbr" stores
      { labels: { handbooks: { colInbr: ... } } }, not a flat key. Reading it
      back as a flat map found one entry called "handbooks" whose value was an
      object, so the override reached the stylesheet as [object Object] — or,
      in practice, as nothing at all.
    */
    const flattenLabels = (obj, prefix, out) => {
        for (const [k, v] of Object.entries(obj || {})) {
            const key = prefix ? `${prefix}.${k}` : k;
            if (v && typeof v === 'object' && !Array.isArray(v)) flattenLabels(v, key, out);
            else if (v !== undefined && v !== null && String(v).trim() !== '') out.push([key, v]);
        }
        return out;
    };
    for (const [k, v] of flattenLabels(fmx.labels, '', [])) add(`fm.label.${k}`, v);

    /*
      Which set of prelims the book gets. 'jss' is the stencil front matter —
      title pages, proprietary notice, foreword and the rest; 's1000d' is the
      four-page S1000D-default set (title page, table of contents, list of
      illustrations, list of abbreviations) built from the publication module
      itself. S1000D engine only; the JSS engine has no such alternative.
    */
    add('frontmatter.style', fmx.style);

    /*
      Title-page artwork for the S1000D-default prelims. Bounds, not sizes —
      the picture scales uniformly inside them — so leaving one blank keeps
      the stylesheet's own bound rather than removing the limit.
    */
    const s1fm = fmx.s1000d || {};
    add('fm.s1000d.image.width', s1fm.imageWidth);
    add('fm.s1000d.image.height', s1fm.imageHeight);
    add('fm.s1000d.logo.height', s1fm.logoHeight);
    // Contents-table column toggles. Booleans arrive from Settings as true/
    // false; the stylesheet params are the '0'/'1' strings every other
    // xsl:if-gated toggle in this pipeline already uses.
    if (s1fm.showChapterColumn !== undefined) add('toc.s1000d.showChapter', s1fm.showChapterColumn ? '1' : '0');
    if (s1fm.showPageColumn !== undefined) add('toc.s1000d.showPage', s1fm.showPageColumn ? '1' : '0');

    add('firstaid.image', fmx.firstAidImage);
    add('firstaid.image.width', fmx.firstAidImageWidth);
    add('firstaid.image.height', fmx.firstAidImageHeight);

    /*
      The system-illustration page's own picture bounds, kept apart from the
      figure caps: that page is given over to the illustration and usually
      wants a larger one than a picture sitting in the text. Blank leaves the
      stylesheet's default, which is the figure cap.
    */
    add('systemimage.max.width', fmx.systemImageWidth);
    add('systemimage.max.height', fmx.systemImageHeight);

    add('toc.section.depth', (L.toc || {}).sectionDepth);

    /*
      Margin notes (Settings > Margin notes), S1000D engine only.

      The enabled flags are emitted as '1'/'0' rather than passed through, so
      an unset value reads as off rather than as the empty string the
      stylesheet would then have to interpret. "Produced by" carries no name:
      the stylesheet reads it from the publication module itself.
    */
    const side = (L.sideNotes || {});
    const draft = side.draft || {};
    const prod = side.producedBy || {};
    const flag = (v, name) => add(name, v === true || v === '1' || v === 1 ? '1' : '0');
    flag(draft.enabled, 'side.note.enabled');
    add('side.note.text', draft.text);
    add('side.note.top', draft.top);
    flag(prod.enabled, 'produced.by.enabled');
    add('produced.by.prefix', prod.prefix);
    add('produced.by.top', prod.top);
    add('side.note.font.size', side.fontSize);
    add('side.note.margin', side.margin);
    if (L.blankVersos !== undefined) add('blank.versos', L.blankVersos ? '1' : '0');

    // List spacing (Settings > Lists). Per-style label gaps, nesting indent and
    // inter-item space, emitted as plain mm numbers (the stylesheet adds units).
    // A legacy single `gap` maps onto the lettered gap.
    const lists = L.lists || {};
    const setNum = (v, name) => { if (v !== undefined && v !== null && v !== '') add(name, `${v}`); };
    setNum(lists.gapAlpha !== undefined && lists.gapAlpha !== '' ? lists.gapAlpha : lists.gap, 'list.gap.alpha');
    setNum(lists.gapRoman, 'list.gap.roman');
    setNum(lists.gapBullet, 'list.gap.bullet');
    setNum(lists.itemSpace, 'list.item.space');
    setNum(lists.indent, 'list.indent');

    // Symbols are hazard/notice icons, not figures, so they carry their own
    // small size rather than being bounded by the page-sized caps below.
    add('symbol.size', fig.symbolSize);
    add('graphic.cap.portrait.w', (caps.portrait || {}).w);
    add('graphic.cap.portrait.h', (caps.portrait || {}).h);
    add('graphic.cap.landscape.w', (caps.landscape || {}).w);
    add('graphic.cap.landscape.h', (caps.landscape || {}).h);
    add('graphic.cap.a3landscape.w', (caps.a3landscape || {}).w);
    add('graphic.cap.a3landscape.h', (caps.a3landscape || {}).h);

    /*
      The ICN printed under a figure (Settings > Figures). Emitted as '1'/'0'
      rather than passed through so an unset value reads as a decision rather
      than as the empty string the stylesheet would have to interpret.

      Defaults to ON: the stylesheet has printed it since before this was
      settable, and a book already in review should not lose a line of its
      figures because the setting was introduced. S1000D engine only — the JSS
      engine never printed it.
    */
    /*
      Notice style (Settings > Notices). Presentational only — the same
      warning/caution/note source renders as any of the three, so a
      publication can follow whichever house style its customer expects.
      S1000D engine only; the JSS engine has one style of its own.
    */
    const notices = L.notices || {};
    add('notice.style', notices.style);
    /*
      Blank means "use the stylesheet's colour", so it must not be SENT — the
      general `add` here passes an empty string through, and an empty
      notice colour would draw the box borders and label in nothing at all.
      Clearing the field in Settings is the ordinary way to reach this.
    */
    const colour = (v, name) => { if (v !== undefined && v !== null && String(v).trim() !== '') add(name, String(v).trim()); };
    colour(notices.warningColor, 'notice.warning.color');
    colour(notices.cautionColor, 'notice.caution.color');
    colour(notices.noteColor, 'notice.note.color');

    /*
      How the notice's TEXT is set, as opposed to the frame around it. Both
      engines take these names, so a house style configured once looks the
      same whichever pipeline built the book.

      Undefined leaves the stylesheet default (both on) alone; only an
      explicit false turns one off. Written that way because these are the
      convention for hazard text and a project that has never opened the
      Notices pane should still get it.
    */
    const onOff = (v, name) => {
        if (v === undefined || v === null || v === '') return;
        add(name, (v === false || v === '0' || v === 0) ? '0' : '1');
    };
    onOff(notices.textCaps, 'notice.text.caps');
    onOff(notices.textBold, 'notice.text.bold');

    add('show.graphic.icn', fig.showIcn === undefined || fig.showIcn === null
        ? undefined
        : (fig.showIcn === false || fig.showIcn === '0' || fig.showIcn === 0 ? '0' : '1'));

    // Columns for a figure's callout-key legend.
    if (fig.legendCols !== undefined && fig.legendCols !== null && fig.legendCols !== '')
        add('figure.legend.cols', `${fig.legendCols}`);

    return params;
}

// Map effective config to the stage-1 (s1000dtojss) params. Not wired into the
// build yet (Phase 2 handles publishers/front matter); provided so the mapping
// lives in one place.
function stage1Params(eff) {
    const pub = eff.publication || {};
    const b = eff.branding || {};
    const pubs = b.publishers || [];
    const params = [];
    const add = (n, v) => { if (v !== undefined && v !== null && v !== '') params.push([n, String(v)]); };
    // security.classification is passed by buildJss itself (it applies to both
    // stages), so it is intentionally not emitted here.
    add('book.name', pub.bookName);
    add('system.name', pub.systemName);
    add('pub.publicationNo', pub.publicationNo);
    add('pub.inbrNo', pub.inbrNo);
    add('pub.nsn', pub.nsn);
    add('pub.contractNo', pub.contractNo);
    add('pub.projectCode', pub.projectCode);
    add('pub.ltDocumentNo', pub.ltDocumentNo || (eff.frontMatter && eff.frontMatter.foreword && eff.frontMatter.foreword.documentNo));
    // Consumed by content.xsl where it maps <symbol> onto a jssbook <graphic>,
    // so the JSS engine sizes icons exactly as the direct one does.
    add('symbol.size', (eff.figures || {}).symbolSize);
    add('emblem.src', b.emblem);
    if (pubs[0]) add('publisher.logo.src', pubs[0].logo);
    if (pubs[1]) {
        add('publisher2.name', pubs[1].name);
        add('publisher2.logo.src', pubs[1].logo);
        add('publisher2.address', (pubs[1].addressLines || [])[0]);
    }
    return params;
}

module.exports = { loadHouse, loadProject, mergeConfig, deepMerge, stage2Params, stage1Params };
