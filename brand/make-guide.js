// Builds brand/guide.html from guide.src.html: inlines the logo SVGs and embeds the PNG icons as data URIs.
// Run after build.js and export.js:  node brand/make-guide.js
const fs = require("fs");
const path = require("path");

const dir = __dirname;
let copies = 0;
const pub = path.join(dir, "..", "frontend", "public", "brand");
let html = fs.readFileSync(path.join(dir, process.argv[2] || "guide.src.html"), "utf8");

html = html.replace(/\{\{img:([^}]+)\}\}/g, (_, name) => "data:image/png;base64," + fs.readFileSync(path.join(pub, name)).toString("base64"));
html = html.replace(/\{\{([a-z-]+)\}\}/g, (_, name) => {
  const svg = fs.readFileSync(path.join(dir, name + ".svg"), "utf8").trim();
  // drop the fixed pixel size so CSS controls it
  // every inlined copy gets its own mask/clip ids (duplicates break when the first copy sits in a hidden block)
  const n = ++copies;
  return svg
    .replace(/^<svg([^>]*?) width="\d+" height="\d+"/, "<svg$1")
    .replace(/id="(e\d+[mc])"/g, `id="$1_${n}"`)
    .replace(/url\(#(e\d+[mc])\)/g, `url(#$1_${n})`);
});

fs.writeFileSync(path.join(dir, process.argv[3] || "guide.html"), html);
console.log("guide.html", Math.round(html.length / 1024) + " KB");
