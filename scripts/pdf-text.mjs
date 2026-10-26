/*
  Text extraction from a PDF for the golden test (and for manual checks):

    node scripts/pdf-text.mjs <file.pdf>        prints page count and each page's text

  Uses pdfjs-dist (a development dependency) in Node, with no worker and no
  network. Text on a page is joined in content-stream order with whitespace
  collapsed, which is stable across runs for the same PDF.
*/
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

export async function extractPdfText(pdfPath) {
  const pdfjs = await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const standardFontDataUrl = pathToFileURL(path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + path.sep).href;
  const doc = await pdfjs.getDocument({ data, standardFontDataUrl, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('')
      .replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
    pages.push(text);
  }
  await doc.destroy();
  return { pageCount: pages.length, pages };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node scripts/pdf-text.mjs <file.pdf>'); process.exit(2); }
  const r = await extractPdfText(file);
  console.log(`${r.pageCount} pages`);
  r.pages.forEach((t, i) => console.log(`\n--- page ${i + 1} ---\n${t}`));
}
