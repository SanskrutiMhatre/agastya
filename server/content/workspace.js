'use strict';
/*
  Project workspaces on disk, in the S1000D project layout the PDF engine
  reads directly:

    <dataDir>/projects/<projectId>/
      project.json        build settings (house template, publication identity, front matter)
      publication.xml     the publication module
      csdb/               data modules (DMC-*.xml) and entity-declared graphics
      Media/              artwork resolved by ICN, branding
      jss/frontmatter/    front-matter pages (static pages seeded at creation)
      .deleted/           soft-deleted data modules (never built)

  Every path that comes from a request goes through resolveInProject(): a
  relative path with no '..', no absolute or drive prefix, no backslash, no
  NUL, that still lands inside the project directory after resolution.
*/

const fs = require('node:fs');
const path = require('node:path');
const { safeRelPath } = require('../../vendor/engine/xmlGuard');

const PROJECT_ID_RE = /^prj-[0-9a-f]{10}$/;

function projectsRoot(dataDir) {
  return path.join(dataDir, 'projects');
}

function projectDir(dataDir, projectId) {
  if (!PROJECT_ID_RE.test(String(projectId))) throw new Error('invalid project id');
  return path.join(projectsRoot(dataDir), projectId);
}

/*
  Join a request-supplied relative path onto a project directory, or return
  null if it is unsafe or escapes. Symbolic links are not followed out of
  the project either: the resolved real path of the nearest existing parent
  must stay inside.
*/
function resolveInProject(dir, rel) {
  const safe = safeRelPath(rel);
  if (!safe) return null;
  const abs = path.resolve(dir, safe);
  const root = path.resolve(dir) + path.sep;
  if (!abs.startsWith(root)) return null;
  let probe = abs;
  while (!fs.existsSync(probe) && probe.startsWith(root)) probe = path.dirname(probe);
  try {
    const real = fs.realpathSync(probe);
    const realRoot = fs.realpathSync(dir) + path.sep;
    if (real !== realRoot.slice(0, -1) && !(real + path.sep).startsWith(realRoot)) return null;
  } catch { return null; }
  return abs;
}

function emptyPublicationModule(project) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<pm xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xlink="http://www.w3.org/1999/xlink" xsi:noNamespaceSchemaLocation="http://www.s1000d.org/S1000D_4-2/xml_schema_flat/pm.xsd">
  <identAndStatusSection>
    <pmAddress>
      <pmIdent>
        <pmCode modelIdentCode="MODEL" pmIssuer="00000" pmNumber="00001" pmVolume="00"/>
        <language languageIsoCode="en" countryIsoCode="IN"/>
        <issueInfo issueNumber="001" inWork="00"/>
      </pmIdent>
      <pmAddressItems>
        <issueDate year="${new Date().getUTCFullYear()}" month="${String(new Date().getUTCMonth() + 1).padStart(2, '0')}" day="${String(new Date().getUTCDate()).padStart(2, '0')}"/>
        <pmTitle>${esc(project.name)}</pmTitle>
      </pmAddressItems>
    </pmAddress>
    <pmStatus issueType="new">
      <security securityClassification="01"/>
      <responsiblePartnerCompany><enterpriseName>Unknown</enterpriseName></responsiblePartnerCompany>
      <applic><displayText><simplePara>All</simplePara></displayText></applic>
      <brexDmRef><dmRef><dmRefIdent><dmCode modelIdentCode="S1000D" systemDiffCode="F" systemCode="04" subSystemCode="1" subSubSystemCode="0" assyCode="0301" disassyCode="00" disassyCodeVariant="A" infoCode="022" infoCodeVariant="A" itemLocationCode="D"/></dmRefIdent></dmRef></brexDmRef>
      <qualityAssurance><unverified/></qualityAssurance>
    </pmStatus>
  </identAndStatusSection>
  <content>
  </content>
</pm>
`;
}

function defaultProjectJson(project) {
  return {
    schemaVersion: 1,
    name: project.name,
    type: 'S1000D',
    pipeline: 's1000dtojss',
    templateRef: 'agastya',
    input: { pm: 'publication.xml', csdbDir: 'csdb', mediaDir: 'Media' },
    publication: {
      bookName: 'Technical Manual', systemName: project.name, publicationNo: '', inbrNo: '', nsn: '',
      contractNo: '', projectCode: '', ltDocumentNo: '', month: '', year: '', securityClassification: 'UNCLASSIFIED',
    },
    frontMatter: {},
    overrides: { layout: {} },
  };
}

/*
  The pipeline's static front-matter pages, copied into a new project as the
  Agastya original does (Workspace.seedStaticFrontMatter): the stage-1
  stylesheet includes all of them when no page-order file exists, and an
  include it cannot resolve fails the whole build. Never overwrites.
*/
const FRONT_MATTER_SOURCE = path.join(__dirname, '..', '..', 'vendor', 'pipeline', 'jss', 'frontmatter');
function seedStaticFrontMatter(dir) {
  let files = [];
  try { files = fs.readdirSync(FRONT_MATTER_SOURCE); } catch { return; }
  const dest = path.join(dir, 'jss', 'frontmatter');
  for (const f of files) {
    const src = path.join(FRONT_MATTER_SOURCE, f);
    const target = path.join(dest, f);
    if (fs.statSync(src).isFile() && !fs.existsSync(target)) fs.copyFileSync(src, target);
  }
}

/*
  Create the workspace if it does not exist yet. Idempotent and
  non-destructive: existing files are never overwritten.
*/
function ensureWorkspace(dataDir, project) {
  const dir = projectDir(dataDir, project.id);
  for (const sub of ['csdb', 'Media', path.join('jss', 'frontmatter'), '.deleted']) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  const pj = path.join(dir, 'project.json');
  if (!fs.existsSync(pj)) fs.writeFileSync(pj, JSON.stringify(defaultProjectJson(project), null, 2) + '\n', 'utf8');
  const pm = path.join(dir, 'publication.xml');
  if (!fs.existsSync(pm)) fs.writeFileSync(pm, emptyPublicationModule(project), 'utf8');
  seedStaticFrontMatter(dir);
  return dir;
}

// Write a file atomically: a temporary file beside it, then rename.
function writeFileAtomic(abs, data) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, abs);
}

module.exports = { projectsRoot, projectDir, resolveInProject, ensureWorkspace, writeFileAtomic, PROJECT_ID_RE, defaultProjectJson };
