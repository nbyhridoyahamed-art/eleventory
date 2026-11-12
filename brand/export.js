// Rasterises the favicon and app icons with headless Chrome (transparent background), then packs favicon.ico.
// Run after build.js:  node brand/export.js
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const out = path.join(__dirname, "..", "frontend", "public", "brand");
const tmp = path.join(__dirname, "_tmp");
const slash = (p) => p.split("\\").join("/");
fs.mkdirSync(tmp, { recursive: true });

function png(svgName, size, name) {
  const html = path.join(tmp, name + ".html");
  fs.writeFileSync(
    html,
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="file:///${slash(path.join(out, svgName))}">`,
  );
  const target = path.join(out, name);
  const r = spawnSync(
    chrome,
    ["--headless", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000", `--window-size=${size},${size}`, `--screenshot=${target}`, "file:///" + slash(html)],
    { encoding: "utf8" },
  );
  if (!fs.existsSync(target)) throw new Error("no png for " + name + " " + r.stderr);
}

png("favicon.svg", 16, "favicon-16.png");
png("favicon.svg", 32, "favicon-32.png");
png("favicon.svg", 48, "favicon-48.png");
png("app-icon.svg", 180, "apple-touch-icon.png");
png("app-icon.svg", 192, "icon-192.png");
png("app-icon.svg", 512, "icon-512.png");

// favicon.ico holding three PNG images (every current browser reads PNG-in-ICO)
const imgs = [16, 32, 48].map((s) => ({ s, data: fs.readFileSync(path.join(out, `favicon-${s}.png`)) }));
const head = Buffer.alloc(6);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(imgs.length, 4);
let offset = 6 + 16 * imgs.length;
const dirs = imgs.map(({ s, data }) => {
  const d = Buffer.alloc(16);
  d.writeUInt8(s, 0);
  d.writeUInt8(s, 1);
  d.writeUInt16LE(1, 4);
  d.writeUInt16LE(32, 6);
  d.writeUInt32LE(data.length, 8);
  d.writeUInt32LE(offset, 12);
  offset += data.length;
  return d;
});
fs.writeFileSync(path.join(out, "favicon.ico"), Buffer.concat([head, ...dirs, ...imgs.map((i) => i.data)]));
fs.rmSync(tmp, { recursive: true, force: true });
console.log("done");
