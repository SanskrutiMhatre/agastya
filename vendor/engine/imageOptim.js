'use strict';
// Image optimisation for smaller PDFs.
//
// The PDF is essentially its images: a 646-page book measured 20.5 MB, of
// which 19.2 MB was PNG data. So this works on the images and leaves the PDF
// machinery alone.
//
// Two different jobs, because the artwork is two different kinds of thing:
//
//   Line art / screenshots with few colours   -> PNG, always lossless.
//       Dropping a fully-opaque alpha channel and palettising where the image
//       uses <=256 colours is free: identical pixels, fewer bytes. Measured
//       ~14% across a real CSDB.
//
//   Photographic images (>256 colours)        -> JPEG, quality from the level.
//       This is where the weight is (13.7 MB of 19.2 in the same CSDB) and the
//       only way to make a real dent. It IS lossy; the caller decides.
//
// Nothing here downsamples. The artwork in these publications is already about
// 77 dpi at print size, so reducing resolution — what Ghostscript's presets do
// — would visibly damage it for very little gain.
//
// Source files are never modified: optimised copies go to a cache directory
// and the generated FO is pointed at them.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const jpeg = require('jpeg-js');

// ---------------------------------------------------------------------------
// PNG read/write (8-bit RGB / RGBA / palette — what real CSDB artwork uses)
// ---------------------------------------------------------------------------

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readChunks(b) {
    const out = [];
    let p = 8;
    while (p + 8 <= b.length) {
        const len = b.readUInt32BE(p);
        out.push({ type: b.toString('ascii', p + 4, p + 8), data: b.slice(p + 8, p + 8 + len) });
        p += 12 + len;
    }
    return out;
}

function paeth(a, b, c) {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Returns { w, h, bpp, px } with filters reversed, or null if unsupported.
function decodePng(b) {
    if (b.length < 33 || !b.slice(0, 8).equals(PNG_SIG)) return null;
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20), depth = b[24], ct = b[25];
    if (depth !== 8 || (ct !== 2 && ct !== 6) || b[28] !== 0) return null; // no interlace
    const bpp = ct === 6 ? 4 : 3, stride = w * bpp;
    let raw;
    try {
        raw = zlib.inflateSync(Buffer.concat(readChunks(b).filter((c) => c.type === 'IDAT').map((c) => c.data)));
    } catch { return null; }
    if (raw.length < h * (stride + 1)) return null;

    const px = Buffer.alloc(h * stride);
    let off = 0;
    for (let y = 0; y < h; y++) {
        const f = raw[off++];
        const cur = px.slice(y * stride, (y + 1) * stride);
        raw.copy(cur, 0, off, off + stride);
        off += stride;
        const prev = y ? px.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? cur[i - bpp] : 0, bb = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
            if (f === 1) cur[i] = (cur[i] + a) & 255;
            else if (f === 2) cur[i] = (cur[i] + bb) & 255;
            else if (f === 3) cur[i] = (cur[i] + ((a + bb) >> 1)) & 255;
            else if (f === 4) cur[i] = (cur[i] + paeth(a, bb, c)) & 255;
        }
    }
    return { w, h, bpp, px };
}

function crc32(buf) {
    let c = ~0;
    for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
    return ~c >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, cr]);
}

// Per-scanline adaptive filtering (the standard minimum-sum-of-absolute-
// differences heuristic) — this is most of what makes a PNG small.
function filterRows(px, w, h, bpp) {
    const stride = w * bpp;
    const out = Buffer.alloc(h * (stride + 1));
    for (let y = 0; y < h; y++) {
        const cur = px.slice(y * stride, (y + 1) * stride);
        const prev = y ? px.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
        let best = null, bestSum = Infinity, bestF = 0;
        for (const f of [0, 1, 2, 3, 4]) {
            const t = Buffer.alloc(stride);
            let sum = 0;
            for (let i = 0; i < stride; i++) {
                const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
                let v = cur[i];
                if (f === 1) v = (cur[i] - a) & 255;
                else if (f === 2) v = (cur[i] - b) & 255;
                else if (f === 3) v = (cur[i] - ((a + b) >> 1)) & 255;
                else if (f === 4) v = (cur[i] - paeth(a, b, c)) & 255;
                t[i] = v;
                sum += v < 128 ? v : 256 - v;
            }
            if (sum < bestSum) { bestSum = sum; best = t; bestF = f; }
        }
        out[y * (stride + 1)] = bestF;
        best.copy(out, y * (stride + 1) + 1);
    }
    return out;
}

function encodePng(w, h, bpp, px, palette) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = palette ? 3 : 2;
    const parts = [PNG_SIG, chunk('IHDR', ihdr)];
    if (palette) parts.push(chunk('PLTE', palette));
    parts.push(chunk('IDAT', zlib.deflateSync(filterRows(px, w, h, bpp), { level: 9 })));
    parts.push(chunk('IEND', Buffer.alloc(0)));
    return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// Optimisation
// ---------------------------------------------------------------------------

/*
  Compression level 0-100 -> JPEG quality.

  0 means "lossless only" and is handled before this is consulted. Above that
  the curve is deliberately gentle at the low end: 30 still gives q75, which is
  visually clean on photographs, while 100 gives q40 for when size matters more
  than fidelity.
*/
function qualityFor(level) {
    return Math.max(30, Math.min(92, Math.round(90 - level * 0.5)));
}

const MAX_PALETTE = 256;

/*
  Optimise one image buffer. Returns { data, kind, changed }.

  `kind` is 'png-lossless' | 'jpeg' | 'unchanged'. A result is only returned
  when it is actually smaller — an image that resists optimisation is left
  exactly as it was rather than rewritten for nothing.
*/
function optimiseBuffer(buf, level) {
    const dec = decodePng(buf);
    if (!dec) return { data: buf, kind: 'unchanged', changed: false };
    let { w, h, bpp, px } = dec;

    // Drop the alpha channel only when every single pixel is opaque. In a real
    // CSDB this alone covered 67 of 74 RGBA images — 9.9 MB of dead channel.
    if (bpp === 4) {
        let opaque = true;
        for (let i = 3; i < px.length; i += 4) if (px[i] !== 255) { opaque = false; break; }
        if (!opaque) return { data: buf, kind: 'unchanged', changed: false }; // real transparency: leave alone
        const rgb = Buffer.alloc(w * h * 3);
        for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
            rgb[j] = px[i]; rgb[j + 1] = px[i + 1]; rgb[j + 2] = px[i + 2];
        }
        px = rgb; bpp = 3;
    }

    // Count distinct colours: this is what separates line art from photographs.
    const map = new Map();
    let fewColours = true;
    for (let i = 0; i < px.length; i += 3) {
        const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
        if (!map.has(key)) {
            if (map.size >= MAX_PALETTE) { fewColours = false; break; }
            map.set(key, map.size);
        }
    }

    let out, kind;
    if (fewColours) {
        // Line art. JPEG would put ringing artefacts around every hard edge
        // AND usually be bigger, so it stays lossless whatever the level.
        const plte = Buffer.alloc(map.size * 3);
        for (const [k, idx] of map) {
            plte[idx * 3] = (k >> 16) & 255; plte[idx * 3 + 1] = (k >> 8) & 255; plte[idx * 3 + 2] = k & 255;
        }
        const idxPx = Buffer.alloc(w * h);
        for (let i = 0, j = 0; i < px.length; i += 3, j++) {
            idxPx[j] = map.get((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
        }
        out = encodePng(w, h, 1, idxPx, plte);
        kind = 'png-lossless';
    } else if (level > 0) {
        const rgba = Buffer.alloc(w * h * 4);
        for (let i = 0, j = 0; i < px.length; i += 3, j += 4) {
            rgba[j] = px[i]; rgba[j + 1] = px[i + 1]; rgba[j + 2] = px[i + 2]; rgba[j + 3] = 255;
        }
        out = jpeg.encode({ data: rgba, width: w, height: h }, qualityFor(level)).data;
        kind = 'jpeg';
    } else {
        out = encodePng(w, h, 3, px, null);
        kind = 'png-lossless';
    }

    if (out.length >= buf.length) return { data: buf, kind: 'unchanged', changed: false };
    return { data: out, kind, changed: true };
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_ROOT = '.imgcache';
const IMAGE_RE = /\.(png|jpe?g)$/i;

// Identity of a source file for cache purposes. Size+mtime rather than a hash
// of the content: these are megabyte images and the build already re-reads
// them enough.
const stamp = (st, level) => crypto.createHash('sha1')
    .update(`${st.size}:${st.mtimeMs}:${level}`).digest('hex').slice(0, 16);

/*
  Optimise every image under `dirs` into <project>/.imgcache/<level>/<dir>/,
  keeping the original filenames.

  Filenames are kept even when the bytes become JPEG. That is safe because FOP
  identifies images by content, not extension (verified), and it means neither
  stylesheet needs to know this happened — only the generated FO's src paths
  are redirected, in one pass, by rewriteFoImagePaths below.
*/
function buildImageCache(projectDir, dirs, level, onProgress) {
    const rel = path.join(CACHE_ROOT, String(level));
    const root = path.join(projectDir, rel);
    const stats = { files: 0, optimised: 0, before: 0, after: 0, cached: 0 };
    const map = new Map(); // 'csdb/X.png' -> '.imgcache/50/csdb/X.png'

    for (const d of dirs) {
        const srcDir = path.join(projectDir, d);
        if (!fs.existsSync(srcDir)) continue;
        const outDir = path.join(root, d);
        fs.mkdirSync(outDir, { recursive: true });

        for (const name of fs.readdirSync(srcDir)) {
            if (!IMAGE_RE.test(name)) continue;
            const src = path.join(srcDir, name);
            let st;
            try { st = fs.statSync(src); } catch { continue; }
            stats.files++;
            stats.before += st.size;

            const outPath = path.join(outDir, name);
            const tagPath = outPath + '.tag';
            const tag = stamp(st, level);

            // Reuse when the source has not changed and the level is the same;
            // re-encoding 131 images on every build would dominate build time.
            if (fs.existsSync(outPath) && fs.existsSync(tagPath)
                && fs.readFileSync(tagPath, 'utf8') === tag) {
                stats.after += fs.statSync(outPath).size;
                stats.cached++;
                map.set(`${d}/${name}`.replace(/\\/g, '/'), path.join(rel, d, name).replace(/\\/g, '/'));
                continue;
            }

            let res;
            try { res = optimiseBuffer(fs.readFileSync(src), level); }
            catch { res = { data: null, changed: false }; }

            if (res.changed) {
                fs.writeFileSync(outPath, res.data);
                fs.writeFileSync(tagPath, tag, 'utf8');
                stats.after += res.data.length;
                stats.optimised++;
                map.set(`${d}/${name}`.replace(/\\/g, '/'), path.join(rel, d, name).replace(/\\/g, '/'));
            } else {
                // Not worth rewriting — leave the build pointing at the original.
                stats.after += st.size;
            }
            if (onProgress && stats.files % 25 === 0) onProgress(stats);
        }
    }
    return { map, stats, rel };
}

/*
  Point the generated FO at the cached images.

  Done on the FO rather than in either stylesheet so both pipelines are covered
  by one code path and neither has to know optimisation exists. src appears
  both bare and wrapped in url('...').
*/
function rewriteFoImagePaths(foText, map) {
    if (!map || map.size === 0) return { text: foText, rewritten: 0 };
    let rewritten = 0;
    const text = String(foText).replace(/src="(?:url\((['"]?)([^'")]*)\1\)|([^"]*))"/g, (whole, q, inUrl, bare) => {
        const src = inUrl !== undefined ? inUrl : bare;
        const to = map.get(String(src).replace(/^\.\//, ''));
        if (!to) return whole;
        rewritten++;
        return inUrl !== undefined ? `src="url('${to}')"` : `src="${to}"`;
    });
    return { text, rewritten };
}

module.exports = {
    optimiseBuffer, buildImageCache, rewriteFoImagePaths,
    qualityFor, decodePng, encodePng, CACHE_ROOT,
};
