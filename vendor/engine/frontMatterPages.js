'use strict';
// The front-matter running order: which prelim pages a publication has, in what
// sequence, and what each is called.
//
// This is the single source of truth. It used to be duplicated — once as a
// hardcoded array in frontmatterInject.js for the direct S1000D engine, and
// again as a fixed sequence of xsl:apply-templates in s1000dtojss.xsl for the
// JSS one. Two lists that had to be kept in step by hand is exactly the shape
// of bug that hid <symbol> and the abbreviations stencil: the engines diverge
// and nothing says so.
//
// A page is one of three kinds:
//   file     an XML page, either generated from settings or a hand-edited
//            stencil shipped with the app
//   element  an empty element the stylesheet fills in from the document
//            (contents, figures, tables)
//   both     an element that uses a file when one exists and falls back to the
//            empty element otherwise (abbreviations, the system-name page)

/*
  `title` is the heading the stylesheet prints. null means the page has no
  heading of its own (the two title pages are banner layouts).

  `generated` marks pages engine/frontmatter.js writes from settings; the rest
  are stencils the author edits directly. `required` marks pages that cannot be
  switched off — a publication without its title page is not a publication.
*/
const CATALOGUE = [
    { id: 'titlePageJoint', file: '01-title-page-joint.xml', title: null, generated: true, required: true, label: 'Title page (joint)' },
    { id: 'titlePage', file: '02-title-page.xml', title: null, generated: true, required: true, label: 'Title page' },
    { id: 'proprietary', file: '03-proprietary.xml', title: null, generated: true, label: 'Proprietary notice' },
    { id: 'foreword', file: '04-foreword.xml', title: 'FOREWORD', generated: true, label: 'Foreword' },
    { id: 'recordOfChanges', file: '05-record-of-changes.xml', title: 'RECORD OF CHANGES', generated: true, label: 'Record of changes' },
    { id: 'associatedHandbooks', file: '06-associated-handbooks.xml', title: 'ASSOCIATED HANDBOOKS', generated: true, label: 'Associated handbooks' },
    { id: 'safetyWarning', file: '07-safety-warning.xml', title: null, generated: true, label: 'Safety warning' },
    { id: 'firstAid', file: '08-first-aid.xml', title: 'FIRST AID IN CASE OF ELECTRIC SHOCK', generated: true, label: 'First aid' },
    { id: 'cautionsNotes', file: '09-cautions-notes.xml', title: null, generated: true, label: 'Cautions and notes' },
    { id: 'demolition', file: '10-demolition.xml', title: 'DEMOLITION OF MATERIAL TO PREVENT ENEMY USE', generated: true, label: 'Demolition' },
    { id: 'changeNotice', file: '11-change-notice.xml', title: 'CHANGE NOTICE', generated: true, label: 'Change notice' },
    { id: 'listOfAbbreviations', element: 'listOfAbbreviations', file: '12-list-of-abbreviations.xml', title: 'LIST OF ABBREVIATIONS', generated: true, label: 'List of abbreviations' },
    { id: 'listOfContents', element: 'listOfContents', title: 'LIST OF CONTENTS', label: 'List of contents' },
    { id: 'listOfFigures', element: 'listOfFigures', title: 'LIST OF FIGURES', label: 'List of figures' },
    { id: 'listOfTables', element: 'listOfTables', title: 'LIST OF TABLES', label: 'List of tables' },
    { id: 'systemNamePage', element: 'systemNamePage', file: '14-system-name-page.xml', title: null, generated: true, label: 'System illustration' },
    { id: 'descriptionOfSymbols', file: '13-description-of-symbols.xml', title: 'DESCRIPTION OF SYMBOLS', generated: true, label: 'Description of symbols' },
];

const byId = new Map(CATALOGUE.map((p) => [p.id, p]));

/*
  Apply a project's settings to the catalogue.

  `pages` is the saved list: [{ id, enabled, title }, ...]. Anything the
  settings do not mention keeps its catalogue defaults and stays enabled, so an
  older project — or one that has never touched these settings — renders
  exactly as it did before. Unknown ids are custom pages the author added.

  Returns the resolved running order.
*/
function resolvePages(settings) {
    const saved = (settings && Array.isArray(settings.pages)) ? settings.pages : null;
    if (!saved || !saved.length) {
        return CATALOGUE.map((p) => ({ ...p, enabled: true }));
    }

    const seen = new Set();
    const out = [];
    for (const entry of saved) {
        if (!entry || !entry.id || seen.has(entry.id)) continue;
        seen.add(entry.id);
        const base = byId.get(entry.id);
        if (base) {
            out.push({
                ...base,
                enabled: base.required ? true : entry.enabled !== false,
                title: entry.title !== undefined && entry.title !== '' ? entry.title : base.title,
            });
        } else if (entry.file) {
            // A page the author added. It has no catalogue entry, so everything
            // about it comes from the saved settings.
            out.push({
                id: entry.id, file: entry.file, title: entry.title || null,
                custom: true, label: entry.label || entry.id, enabled: entry.enabled !== false,
            });
        }
    }
    // A page added to the catalogue after this project was saved would
    // otherwise silently disappear from the book; append it rather than lose it.
    for (const p of CATALOGUE) {
        if (!seen.has(p.id)) out.push({ ...p, enabled: true });
    }
    return out;
}

// Only the pages that will actually be emitted.
function enabledPages(settings) {
    return resolvePages(settings).filter((p) => p.enabled);
}

/*
  Page titles as [name, value] parameter pairs for the stylesheets, but only
  where the project has overridden the catalogue default — sending the rest
  would just be noise in the driver stylesheet.
*/
function titleParams(settings) {
    const out = [];
    for (const p of resolvePages(settings)) {
        const base = byId.get(p.id);
        if (!base || !base.title || !p.title || p.title === base.title) continue;
        out.push([`fm.title.${p.id}`, p.title]);
    }
    return out;
}

module.exports = { CATALOGUE, resolvePages, enabledPages, titleParams, byId };
