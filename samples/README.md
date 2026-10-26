# Sample projects

## `golden/`: the golden test publication

A small, realistic S1000D **Issue 4.2** project for the fictional *PDU-200 power distribution unit*. Every file is valid against the bundled 4.2 schemas.

| File | Kind | What it exercises |
|---|---|---|
| `publication.xml` | Publication module (PMC-AGS-0AGS1-00001-00) | Three chapters, dmRef entries |
| `csdb/DMC-AGS-A-00-00-00-00A-018A-D.xml` | Descriptive | Introduction; a list; a dmRef cross-reference |
| `csdb/DMC-AGS-A-00-00-00-00A-012A-D.xml` | Descriptive | Warnings and cautions |
| `csdb/DMC-AGS-A-24-00-00-00A-040A-D.xml` | Descriptive | **Figure with a graphic** (ICN entity), **table**, internal and dmRef cross-references |
| `csdb/DMC-AGS-A-24-00-00-00A-030A-D.xml` | Descriptive | Technical data table |
| `csdb/DMC-AGS-A-24-00-00-00A-320A-D.xml` | Procedural | Operational test; **warning**; nested steps; dmRef |
| `csdb/DMC-AGS-A-24-10-00-00A-520A-D.xml` | Procedural | Remove procedure; warning, caution, note; support equipment |
| `csdb/DMC-AGS-A-24-10-00-00A-310A-D.xml` | Procedural | Visual inspection |
| `csdb/DMC-AGS-A-24-10-00-00A-720A-D.xml` | Procedural | Install procedure; required-condition dmRefs |
| `csdb/DMC-AGS-A-00-00-00-00A-022A-D.xml` | BREX | The project's business rules (5 rules) |
| `csdb/ICN-AGS-A-240000-A-0AGS1-00001-A-01-1.png` | Graphic | Block diagram used by the 040 module |
| `Media/emblem.png`, `Media/publisher-logo.png` | Branding | Title-page artwork |
| `project.json` | Build settings | `agastya` house template, sample front matter |
| `baseline.json` | Golden baseline | Page count and per-page text of the built PDF |

Run `npm run golden` to build it with the bundled toolchain and compare with the baseline. After a deliberate change to the sample or the pipeline, check the PDF and run `npm run golden -- --update`.

Element ids are unique across the whole publication (for example `tab-240030-01`), because the book is built as one document and a repeated id makes a cross-reference land on the wrong table.

## `broken/`: deliberately broken copy

For validation and BREX tests. `expected.json` lists exactly what must be reported:

- `DMC-…-040A-D.xml`: two schema errors (an unknown element, an attribute that is not allowed), and its graphic file is deliberately absent.
- `DMC-…-520A-D.xml`: schema-valid, but breaks four project BREX rules (classification 05, language `fr`, underline emphasis, a list nested two levels).
- `publication.xml`: also refers to a data module that does not exist.
