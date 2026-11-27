// Builds tokens.json from tokens.css so the two can never drift.
// Usage: node scripts/tokens-to-json.mjs   (run from the project root)
// Cascade mirrors the browser: light = :root, dark = :root+.dark, HC light = :root+.hc,
// HC dark = :root+.dark+.hc+.dark.hc (an element with class="dark hc").
import { readFileSync, writeFileSync } from "node:fs";

const css = readFileSync("tokens.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const blocks = {};
for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
  const sel = m[1].trim();
  const decls = {};
  for (const d of m[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) decls[d[1]] = d[2].trim();
  blocks[sel] = { ...(blocks[sel] || {}), ...decls };
}
const need = [":root", ".dark", ".hc", ".dark.hc"];
for (const s of need) if (!blocks[s]) throw new Error(`tokens.css is missing ${s}`);

const camel = (k) => k.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const modes = {
  light: { ...blocks[":root"] },
  dark: { ...blocks[":root"], ...blocks[".dark"] },
  highContrastLight: { ...blocks[":root"], ...blocks[".hc"] },
  highContrastDark: { ...blocks[":root"], ...blocks[".dark"], ...blocks[".hc"], ...blocks[".dark.hc"] },
};
const isColor = (v) => /^(#|rgba?\()/i.test(v);
const color = {}, cssVar = {};
for (const [mode, vars] of Object.entries(modes)) {
  color[mode] = {};
  for (const [k, v] of Object.entries(vars)) {
    if (!k.startsWith("cc-") || !isColor(v)) continue;
    const name = camel(k.slice(3));
    color[mode][name] = v;
    cssVar[name] = `--${k}`;
  }
}
const px = (v) => Number(String(v).replace("px", ""));
const root = blocks[":root"];
const pick = (re, rename) => Object.fromEntries(Object.entries(root).filter(([k]) => re.test(k)).map(([k, v]) => [rename(k), px(v)]));
const out = {
  $description: "CoachCal Design System v2 \"Ember\". GENERATED from tokens.css by scripts/tokens-to-json.mjs. Do not edit by hand. Numbers are px in CSS = pt in iOS / React Native.",
  source: "tokens.css",
  color,
  font: { text: root["cc-font"], rounded: root["cc-font-round"] },
  space: pick(/^s\d+$/, (k) => k),
  radius: pick(/^r-/, (k) => k.slice(2)),
  size: pick(/^(tap|btn|shutter|ring|ring-stroke|fab|ring-md|ring-md-stroke|ring-sm|ring-sm-stroke|macro-bar)$/, camel),
  type: Object.fromEntries(Object.entries(root).filter(([k]) => k.startsWith("t-")).map(([k, v]) => {
    const m = v.match(/^(\d{3})\s+([\d.]+)px\/([\d.]+)px\s+var\(--cc-font(-round)?\)$/);
    if (!m) throw new Error(`--${k} is not "weight sizepx/linepx var(--cc-font[-round])": ${v}`);
    return [camel(k.slice(2)), { size: +m[2], lineHeight: +m[3], weight: +m[1], family: m[4] ? "rounded" : "text" }];
  })),
  cssVar,
  typeVar: Object.fromEntries(Object.keys(root).filter((k) => k.startsWith("t-")).map((k) => [camel(k.slice(2)), `--${k}`])),
};
writeFileSync("tokens.json", JSON.stringify(out, null, 2) + "\n");
console.log(`tokens.json: ${Object.keys(color.light).length} colours × 4 modes, ${Object.keys(out.space).length} spaces, ${Object.keys(out.radius).length} radii, ${Object.keys(out.size).length} sizes, ${Object.keys(out.type).length} type styles`);
