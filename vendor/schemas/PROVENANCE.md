# S1000D XSD schema sets

One directory per **specification issue**. Copied unmodified from
`Toolkit/xml-validator-main/xml-validator-main`, which keeps the official
S1000D releases separated:

| Directory | Source                     | Files |
|-----------|----------------------------|-------|
| `3.0/`    | `react-editor/public/schemas/3.0` | 24 |
| `4.1/`    | `xml_schema_flat_V.4.1`    | 31 |
| `4.2/`    | `xml_schema_flat_V.4.2`    | 33 |
| `5.0/`    | `xml_schema_flat_V.05`     | 33 |
| `6.0/`    | `xml_schema_flat_V.06`     | 33 |

`xml.xsd` (the W3C namespace schema, identical across issues) was added to the
sets that omit it, since every S1000D schema imports it.

## Why per issue

The application previously validated everything against a single flat
`Shema_S1000D/` folder, and that folder was a **mixture**: `descript.xsd`
carried `Issue number: 5.0` while `proced.xsd` and `fault.xsd` carried `4.2`.
Every description module was therefore checked against 5.0 rules and every
procedure against 4.2, regardless of what the module itself declared — and the
app ships templates for Issues 2.3, 4.1 and 4.2, so the mismatch was routine.

The difference is not academic. In `ipd.xsd`:

```
4.1   figureNumberAttType = xs:positiveInteger, pattern \d{2}
4.2   figureNumberAttType = xs:string,          pattern [A-Z0-9]{1}[0-9]{1}
```

so `figureNumber="00"` is valid under 4.2 and invalid under 4.1. A single
schema set cannot be right for both.

## Choosing a set

`services/SchemaIssue.ts` reads the issue from the document's own
`xsi:noNamespaceSchemaLocation` (`.../S1000D_4-2/...`). `issueNumber` inside
`<dmIdent>` is deliberately **not** used — that is the revision of the
DOCUMENT, not the version of the specification.

When the declared issue has no set installed, the nearest **older** one is used
and the substitution is reported in the validation result, never applied
silently. Issue 2.3 has no published flat schema set here, so 2.3 modules
resolve to 3.0 and say so.

`Shema_S1000D/` is left in place because the HTML and PDF stylesheets reference
it. Validation no longer reads from it.

## What is committed

All five issue sets, about 34 MB.

They have to be here, not merely on the machine that happens to build the
installer. `build.files` in package.json includes `schemas/`, and
electron-builder packages from the WORKING DIRECTORY rather than from git — so
a set present locally but missing from the repository produces two installers
of the same version offering different validation menus, depending on who built
them, with nothing in the interface to show the difference.

Every publication in this workspace declares Issue 4.2 (989 declarations, no
other issue anywhere). The rest are carried for content that arrives from
elsewhere: a supplier's modules, or a publication being migrated between
issues.

Nothing breaks if a file declares an issue that is not installed. The validator
reports it — "declares S1000D Issue 5.0, and no schema set for that issue is
installed (available: ...)" — rather than passing it silently, which would read
as "checked and fine".

The validation panel lists whatever is in this directory, read at run time. To
add an issue, copy its directory in; to withdraw one, delete it. Neither needs
a code change.

## Character entity sets (`<issue>/ent/`)

Issues 3.0, 4.2 and 5.0 also carry the official S1000D/OASIS character entity
sets, copied unmodified from the LIRX schema pack under
`Toolkit/Mid_final/Vektra/Settings/Validation/LIRXSchemaPack/S1000D_*/ent`.
Twenty files each: the `ISOEntities` driver and the nineteen ISO sets it pulls
in (`iso-num.ent`, `iso-tech.ent`, and so on).

4.1 and 6.0 have no set here because the pack has none for them. They are
deliberately NOT mapped to a neighbouring issue: substituting one issue's
characters for another's would be silent and unverifiable, and the missing
mapping shows up as a warning instead.

They matter more than they look. A document declares them by URL —

    <!ENTITY % ISOEntities PUBLIC "..." "http://www.s1000d.org/S1000D_4-2/ent/ISOEntities">

— and every tool here runs with the network off, so without a local copy the
entities are never defined and libxml2 DROPS them: `40&deg;C` publishes as
`40C`. No error, just characters missing from the manual.

server/engine/catalog.js maps those URLs onto these directories at start-up and
hands the catalogue to xsltproc, the validator and the XML language server, so
documents keep the URLs they were authored with and still resolve locally.
