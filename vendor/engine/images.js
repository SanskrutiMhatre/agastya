'use strict';
// Image dimension probing and jssbook graphic annotation.
//
// The layout needs each image's pixel size to fit it exactly (no reserved
// whitespace, no overflow). XSLT cannot read binary headers, so we stamp
// intrinsic-w / intrinsic-h onto every <graphic> before the FO stage.
//
// Extracted verbatim from server.js (Phase 0) so the web server and the
// Electron app share one implementation.

const fs = require('fs');
const path = require('path');

/*
  CSS lengths an SVG may state its size in, as pixels-per-unit at the 96 dpi
  the rest of the pipeline assumes (figures.xsl converts back with
  mm = px * 254 / 960). A bare number is already user units, i.e. px.
*/
const SVG_UNIT_PX = {
    '': 1, px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 960 / 25.4, in: 96,
};

function svgLengthToPx(value) {
    const m = /^\s*([+-]?[\d.]+)\s*([a-z]*)\s*$/i.exec(value || '');
    if (!m) return null;
    const unit = SVG_UNIT_PX[m[2].toLowerCase()];
    // A percentage is relative to a viewport we do not have, so it tells us
    // nothing about the intrinsic size — fall through to the viewBox instead.
    if (unit === undefined) return null;
    const px = parseFloat(m[1]) * unit;
    return px > 0 ? px : null;
}

/*
  Intrinsic size of an SVG.

  Prefers width/height on the root element, and falls back to the last two
  numbers of viewBox. An SVG that states only a viewBox (or sizes itself in
  percentages) is entirely ordinary, and without the fallback it would report
  no size at all and be laid out by the generic scale-down-to-fit path, losing
  its true aspect ratio.

  Text-scanned rather than XML-parsed: only the root element matters, the
  header is enough to hold it, and this must not fail on an SVG whose body is
  malformed in ways FOP itself tolerates.
*/
function svgPixelSize(head) {
    const tag = /<svg\b[^>]*>/i.exec(head);
    if (!tag) return null;
    const attr = (name) => {
        const m = new RegExp(name + '\\s*=\\s*["\']([^"\']*)["\']', 'i').exec(tag[0]);
        return m ? m[1] : null;
    };
    const w = svgLengthToPx(attr('width'));
    const h = svgLengthToPx(attr('height'));
    if (w && h) return { w: Math.round(w), h: Math.round(h) };

    const box = attr('viewBox');
    if (box) {
        const n = box.trim().split(/[\s,]+/).map(Number);
        if (n.length === 4 && n[2] > 0 && n[3] > 0) {
            // width/height win individually when present; the viewBox supplies
            // whichever is missing, keeping the aspect ratio correct.
            return { w: Math.round(w || n[2]), h: Math.round(h || n[3]) };
        }
    }
    return null;
}

/*
  Read an image header and return { w, h } in pixels, or null.

  PNG, JPEG, GIF and SVG are covered — the formats imageDims.js indexes. A
  format that returns null is not broken, it just loses exact sizing: the
  stylesheets fall back to scale-down-to-fit inside the page caps, which fits
  the page but not the image's own aspect ratio.
*/
function imagePixelSize(file) {
    let fd;
    try {
        fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(32);
        const n = fs.readSync(fd, buf, 0, 32, 0);
        if (n >= 24 && buf.toString('latin1', 1, 4) === 'PNG') {
            // IHDR width/height are big-endian at bytes 16 and 20
            return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
        }
        if (n >= 4 && buf[0] === 0xFF && buf[1] === 0xD8) {
            return jpegPixelSize(fd);
        }
        if (n >= 10 && buf.toString('latin1', 0, 3) === 'GIF') {
            // Logical screen width/height: little-endian at bytes 6 and 8.
            return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
        }
        // SVG: text, and the root element can sit behind an XML declaration,
        // a DOCTYPE and comments, so read a chunk rather than the 32-byte head.
        const start = buf.toString('utf8', 0, n).trimStart();
        if (start.startsWith('<')) {
            const text = Buffer.alloc(8192);
            const read = fs.readSync(fd, text, 0, 8192, 0);
            return svgPixelSize(text.toString('utf8', 0, read));
        }
        return null;
    } catch (e) {
        return null;
    } finally {
        if (fd !== undefined) try { fs.closeSync(fd); } catch (e) {}
    }
}

// Walk JPEG segments to the SOF marker that carries the dimensions.
function jpegPixelSize(fd) {
    let offset = 2;
    const head = Buffer.alloc(9);
    for (;;) {
        if (fs.readSync(fd, head, 0, 9, offset) < 9) return null;
        if (head[0] !== 0xFF) return null;
        const marker = head[1];
        const len = head.readUInt16BE(2);
        // SOF0..SOF15 (excluding DHT/JPGA/DAC) carry height/width at +5,+7
        if (marker >= 0xC0 && marker <= 0xCF &&
            marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
            return { h: head.readUInt16BE(5), w: head.readUInt16BE(7) };
        }
        offset += 2 + len;
    }
}

// Add intrinsic-w / intrinsic-h (pixels) to every <graphic> in a jssbook file
// that does not already carry them. Graphic src paths are resolved relative to
// baseDir (the project working directory).
// Index every image under `dirs`, keyed by lowercased bare filename, so a
// graphic whose src points at the wrong folder can still be located. ICN
// filenames are unique within a CSDB, which makes the basename a safe key.
function buildFileIndex(baseDir, dirs) {
    const idx = new Map();
    for (const d of dirs) {
        const abs = path.join(baseDir, d);
        if (!fs.existsSync(abs)) continue;
        for (const name of fs.readdirSync(abs)) {
            const key = name.toLowerCase();
            const rel = d.replace(/\/*$/, '/') + name;
            if (!idx.has(key)) idx.set(key, rel); // first dir wins
            // Also keyed without the extension, so a reference the stylesheet
            // had to guess as "<icn>.png" still finds an ICN uploaded in a
            // different format. Never overwrites a real file name.
            const stem = key.replace(/\.[^.]+$/, '');
            if (stem !== key && !idx.has(stem)) idx.set(stem, rel);
        }
    }
    return idx;
}

function annotateGraphicDimensions(bookPath, baseDir, searchDirs) {
    if (!fs.existsSync(bookPath)) return { stamped: 0, missing: 0, repaired: 0 };
    const dir = baseDir || path.dirname(bookPath);
    const index = buildFileIndex(dir, searchDirs && searchDirs.length ? searchDirs : ['csdb', 'Media']);
    let xml = fs.readFileSync(bookPath, 'utf8');
    let stamped = 0, missing = 0, repaired = 0;
    xml = xml.replace(/<graphic\b([^>]*?)\/>/g, (whole, attrs) => {
        if (/\bintrinsic-w=/.test(attrs)) return whole;
        const m = attrs.match(/\bsrc="([^"]*)"/);
        if (!m) return whole;
        let src = m[1];
        let size = imagePixelSize(path.join(dir, src));
        if (!size || !size.w || !size.h) {
            // The path did not resolve. The stylesheet has to guess a folder
            // whenever an ICN has no usable unparsed entity declaration (a
            // stale entity name survives a data module being copied between
            // publications), and that guess is a fixed default. If the file
            // exists under some other scanned folder, point at it instead of
            // silently rendering nothing.
            // By exact file name first, then ignoring the extension: the
            // stylesheet's guess always ends ".png", so an ICN uploaded as a
            // .jpg or .svg never matched and the figure rendered as nothing.
            const base = path.basename(src).toLowerCase();
            const found = index.get(base) || index.get(base.replace(/\.[^.]+$/, ''));
            if (found && found !== src) {
                const s2 = imagePixelSize(path.join(dir, found));
                if (s2 && s2.w && s2.h) {
                    attrs = attrs.replace(/\bsrc="[^"]*"/, `src="${found}"`);
                    src = found; size = s2; repaired++;
                }
            }
        }
        if (!size || !size.w || !size.h) { missing++; return whole; }
        stamped++;
        return `<graphic${attrs} intrinsic-w="${size.w}" intrinsic-h="${size.h}"/>`;
    });
    fs.writeFileSync(bookPath, xml, 'utf8');
    return { stamped, missing, repaired };
}

// buildFileIndex is exported because it encodes WHERE THE BUILD LOOKS for an
// image — csdb before Media, by exact name then by name without its extension.
// Anything that needs to predict whether a graphic will resolve (the Validation
// report; the ICN-entity generator) has to ask the same question the same way,
// or it reports on a pipeline that does not exist.
module.exports = { imagePixelSize, annotateGraphicDimensions, buildFileIndex };
