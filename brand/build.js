// Generates the Eleventory logo files from geometry (no fonts, no downloads).
// The icon follows the supplied artwork: a speech-bubble "D" holding a magnifier whose lens shows two rising bars (the number 11).
// Run: node brand/build.js  ->  writes SVGs next to this file and into frontend/public/brand.
const fs = require("fs");
const path = require("path");

const INK = "#0A2E2C";
const LIGHT = "#F6F9F8";

// ---------------------------------------------------------------------------------------------
// Icon, drawn in the 1080 square of the supplied artwork. It occupies x,y 281..799 (518 square).
// ---------------------------------------------------------------------------------------------
const D_PATH = "M336 281H540A259 259 0 0 1 540 799H336A55 55 0 0 1 281 744V336A55 55 0 0 1 336 281Z";
const TAIL = "666 766 735 799 652 715";
const HANDLE_GAP = "540 501 1100 1061 1100 1163 540 603"; // the lens handle is the empty band between the bubble and its tail
const BAR_L = "417 575 516 486 516 800 441 800 441 575";
const BAR_R = "541 528 640 440 640 800 565 800 565 528";

let uid = 0;
/** The icon as a group in 1080 space. `ring:false` drops the thin lens rim (used for tiny favicons). */
function glyph(color, { ring = true } = {}) {
  const id = "e" + ++uid;
  return (
    `<defs>` +
    `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1080"><rect width="1080" height="1080" fill="#fff"/><circle cx="540" cy="540" r="209" fill="#000"/><polygon points="${HANDLE_GAP}" fill="#000"/></mask>` +
    `<clipPath id="${id}c"><circle cx="540" cy="540" r="174"/></clipPath>` +
    `</defs>` +
    `<g fill="${color}">` +
    `<g mask="url(#${id}m)"><path d="${D_PATH}"/><polygon points="${TAIL}"/></g>` +
    (ring ? `<circle cx="540" cy="540" r="180" fill="none" stroke="${color}" stroke-width="12"/>` : "") +
    `<g clip-path="url(#${id}c)"><polygon points="${BAR_L}"/><polygon points="${BAR_R}"/></g>` +
    `</g>`
  );
}

/** Place the glyph so its 518 box lands at (x,y) with the given size. */
const placed = (color, x, y, size, opts) => `<g transform="translate(${x} ${y}) scale(${size / 518}) translate(-281 -281)">${glyph(color, opts)}</g>`;

// ---------------------------------------------------------------------------------------------
// Wordmark: heavy geometric capitals. Cap height H, stroke s. Each letter returns {w, svg} in a box 0..w by 0..H.
// ---------------------------------------------------------------------------------------------
function letter(ch, H, s) {
  const h = s / 2;
  const wh = s * 1.18; // horizontal thickness of a diagonal
  const n = (v) => +v.toFixed(2);
  const rect = (x, y, w, hh) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(hh)}"/>`;
  const poly = (...p) => `<polygon points="${p.map((v) => n(v)).join(" ")}"/>`;
  const line = (d) => `<path d="${d}" fill="none" stroke-width="${n(s)}"/>`;
  switch (ch) {
    case "E": {
      const w = 0.6 * H;
      return { w, svg: line(`M${h} 0V${H}M0 ${h}H${w}M0 ${H / 2}H${0.88 * w}M0 ${H - h}H${w}`) };
    }
    case "L": {
      const w = 0.56 * H;
      return { w, svg: line(`M${h} 0V${H}M0 ${H - h}H${w}`) };
    }
    case "T": {
      const w = 0.64 * H;
      return { w, svg: line(`M0 ${h}H${w}M${w / 2} 0V${H}`) };
    }
    case "V": {
      const w = 0.82 * H;
      return { w, svg: poly(0, 0, wh, 0, w / 2 + wh / 2, H, w / 2 - wh / 2, H) + poly(w - wh, 0, w, 0, w / 2 + wh / 2, H, w / 2 - wh / 2, H) };
    }
    case "N": {
      const w = 0.74 * H;
      return { w, svg: rect(0, 0, s, H) + rect(w - s, 0, s, H) + poly(0, 0, wh * 1.1, 0, w, H, w - wh * 1.1, H) };
    }
    case "Y": {
      const w = 0.8 * H;
      const ym = 0.5 * H;
      const sw = wh * 0.96;
      return { w, svg: poly(0, 0, wh, 0, w / 2 + wh / 2, ym, w / 2 - wh / 2, ym) + poly(w - wh, 0, w, 0, w / 2 + wh / 2, ym, w / 2 - wh / 2, ym) + rect(w / 2 - sw / 2, ym - 1, sw, H - ym + 1) };
    }
    case "M": {
      const w = 0.94 * H;
      const ap = 0.7 * H;
      return { w, svg: rect(0, 0, s, H) + rect(w - s, 0, s, H) + poly(0, 0, wh, 0, w / 2 + wh / 2, ap, w / 2 - wh / 2, ap) + poly(w - wh, 0, w, 0, w / 2 + wh / 2, ap, w / 2 - wh / 2, ap) };
    }
    case "O": {
      const r = (H - s) / 2;
      return { w: H, svg: `<circle cx="${H / 2}" cy="${H / 2}" r="${n(r)}" fill="none" stroke-width="${n(s)}"/>` };
    }
    case "C": {
      const r = (H - s) / 2;
      const a = (42 * Math.PI) / 180;
      const x = H / 2 + r * Math.cos(a);
      const dy = r * Math.sin(a);
      return { w: x + h * 0.4, svg: `<path d="M${n(x)} ${n(H / 2 - dy)}A${n(r)} ${n(r)} 0 1 0 ${n(x)} ${n(H / 2 + dy)}" fill="none" stroke-width="${n(s)}"/>` };
    }
    case "R": {
      const w = 0.68 * H;
      const Hb = 0.6 * H;
      const rb = (Hb - s) / 2;
      const a = 0.36 * w;
      return {
        w,
        svg:
          rect(0, 0, s, H) +
          line(`M${h} ${h}H${n(w - h - rb)}A${n(rb)} ${n(rb)} 0 0 1 ${n(w - h - rb)} ${n(Hb - h)}H${h}`) +
          poly(a, Hb - s, a + wh, Hb - s, w, H, w - wh, H),
      };
    }
    default:
      throw new Error("no glyph " + ch);
  }
}

/** A word at cap height H. `tracking` is extra space between letters (absolute units). Returns {width, svg}. */
function word(text, H, s, tracking) {
  let x = 0;
  const parts = [];
  for (const ch of text) {
    const l = letter(ch, H, s);
    parts.push(`<g transform="translate(${+x.toFixed(2)} 0)">${l.svg}</g>`);
    x += l.w + tracking;
  }
  return { width: x - tracking, svg: parts.join("") };
}

// Main name and the quiet line under it. Units: main cap height = 100.
const NAME = "ELEVENTORY";
const SUB = "COMMERCE";
const MAIN_S = 21;
const MAIN_TRACK = 13;
const main = word(NAME, 100, MAIN_S, MAIN_TRACK);
const SUB_H = 51;
const SUB_S = 8.6;
// spread the sub line so it ends exactly where the name ends
const subNatural = word(SUB, SUB_H, SUB_S, 0).width;
const SUB_TRACK = (main.width - subNatural) / (SUB.length - 1);
const sub = word(SUB, SUB_H, SUB_S, SUB_TRACK);
const GAP = 60;
const TEXT_H = 100 + GAP + SUB_H; // 211

function textBlock(color, x, y, k) {
  return (
    `<g transform="translate(${x} ${y}) scale(${k})" fill="${color}" stroke="${color}" stroke-linejoin="miter" stroke-linecap="butt">` +
    `<g stroke="none">${""}</g>` +
    `<g>${main.svg}</g>` +
    `<g transform="translate(0 ${100 + GAP})">${sub.svg}</g>` +
    `</g>`
  );
}

const svg = (w, h, inner, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"${extra}>${inner}</svg>\n`;
const label = ' role="img" aria-label="Eleventory"';

// Horizontal: icon height equals the two-line text block, as in the supplied lockup.
function horizontal(color) {
  const I = 518;
  const k = I / TEXT_H;
  const gap = 0.2 * I;
  const textW = main.width * k;
  const W = Math.ceil(I + gap + textW + 2);
  return svg(W, I, placed(color, 0, 0, I) + textBlock(color, I + gap, 0, k), label);
}

// Stacked: icon above the name, centred.
function stacked(color) {
  const pad = 30;
  const textW = main.width;
  const icon = 0.56 * textW;
  const gap = 55;
  const W = Math.ceil(textW + pad * 2);
  const H = Math.ceil(pad + icon + gap + TEXT_H + pad);
  return svg(W, H, placed(color, (W - icon) / 2, pad, icon) + textBlock(color, pad, pad + icon + gap, 1), label);
}

function wordmarkOnly(color) {
  return svg(Math.ceil(main.width + 2), 100, `<g fill="${color}" stroke="${color}" stroke-linejoin="miter" stroke-linecap="butt">${main.svg}</g>`, label);
}

// Tiles: icon on a solid square. Favicon drops the thin rim and enlarges the glyph so it survives 16px.
function tile(bg, fg, { rx = 216, scale = 1, ring = true } = {}) {
  return svg(
    1080,
    1080,
    `<rect width="1080" height="1080" rx="${rx}" fill="${bg}"/><g transform="translate(540 540) scale(${scale}) translate(-540 -540)">${glyph(fg, { ring })}</g>`,
    label,
  );
}

const files = {
  "mark.svg": svg(518, 518, `<g transform="translate(-281 -281)">${glyph(INK)}</g>`, label),
  "mark-reverse.svg": svg(518, 518, `<g transform="translate(-281 -281)">${glyph(LIGHT)}</g>`, label),
  "mark-tile.svg": tile(INK, LIGHT),
  "logo-horizontal.svg": horizontal(INK),
  "logo-horizontal-reverse.svg": horizontal(LIGHT),
  "logo-stacked.svg": stacked(INK),
  "logo-stacked-reverse.svg": stacked(LIGHT),
  "wordmark.svg": wordmarkOnly(INK),
  "wordmark-reverse.svg": wordmarkOnly(LIGHT),
  "favicon.svg": tile(INK, LIGHT, { rx: 190, scale: 1.5, ring: false }),
  // full-bleed for app icons (the phone rounds the corners); glyph stays inside the maskable safe zone
  "app-icon.svg": tile(INK, LIGHT, { rx: 0, scale: 1.1 }),
};

const outDirs = [__dirname, path.join(__dirname, "..", "frontend", "public", "brand")];
for (const dir of outDirs) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
}
// remove files from the earlier "11 tile" concept
for (const old of ["logo-mono-ink.svg", "logo-mono-white.svg", "mark-glyph-light.svg", "mark-glyph-dark.svg"]) {
  for (const dir of outDirs) {
    try { fs.unlinkSync(path.join(dir, old)); } catch (e) { /* not there */ }
  }
}
console.log("wrote", Object.keys(files).length, "files; name width", Math.round(main.width), "tracking", Math.round(SUB_TRACK));
module.exports = { glyph, placed, INK, LIGHT };
