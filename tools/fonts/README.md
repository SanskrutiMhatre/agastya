# Bundled fonts

`DejaVuSans*.ttf` — DejaVu Sans, regular / bold / oblique / bold-oblique.

## Why they are here

FOP otherwise runs on the base-14 PDF fonts, which are WinAnsi-encoded. Any
character outside that set renders as `#` alongside a "Glyph not available"
warning that nothing surfaces to the user, so the defect reaches the printed
page unnoticed. U+01A5 LATIN SMALL LETTER P WITH HOOK in a `<para>` was the
case that exposed it; Symbol and ZapfDingbats, the previous fallbacks, do not
cover it either.

DejaVu Sans is registered in `../fop.xconf` and named *after* Helvetica in the
stylesheets' `font.fallback`, so it is consulted only for characters Helvetica
cannot render. Text the base-14 fonts already cover keeps its existing metrics,
and documents published before this change repaginate identically.

Both renderers load the same `fop.xconf`: the `fop` launcher via `-c`
(`engine/build.js`), and the warm `FopServer` daemon via its first argument
(`engine/fopd.js`). They must stay in step — configure only one and whether a
character renders would depend on whether the daemon happened to be warm.

## Licensing

DejaVu Sans is distributed under the DejaVu Fonts License, a permissive
Bitstream Vera–derived licence that allows redistribution, including as part of
a commercial product.

**Action required before shipping:** the upstream `LICENSE` text is not in this
directory. Obtain it from the DejaVu distribution (https://dejavu-fonts.github.io/)
and place it here as `LICENSE`, so the binaries ship with the licence they are
granted under.

## Platforms

A copy also lives in `server/tools-linux/fonts/`. That tree is gitignored and
assembled locally per the notes in `engine/paths.js`, so whatever assembles it
must place these four files there too. electron-builder maps `server/tools` on
Windows and `server/tools-linux` on Linux to the same `resources/tools`, which
is why `fop.xconf` resolves `font-base` relative to itself.
