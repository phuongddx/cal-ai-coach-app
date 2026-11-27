// Verify CoachCal v2 additions (27/11/2026).
// 1) tokens.json == values Chrome computes from tokens.css for :root, .dark, .hc, .dark.hc (+ space/radius/size/font)
// 2) every text node in the new frames has contrast >= 4.5:1 against its real (composited) background
// 3) screenshots each new frame to previews/<frame-id>.png
// 4) optional: compares existing frames against a baseline copy of the project (BASELINE=dir)
// Usage: PLAYWRIGHT=/path/to/playwright node scripts/verify.mjs
import { createRequire } from "node:module";
import fs from "node:fs"; import path from "node:path"; import url from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(fs.readFileSync(path.join(root, "tokens.json"), "utf8"));
const out = { tokens: {}, contrast: [], shots: [], regressions: [] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(url.pathToFileURL(path.join(root, "index.html")).href);
await page.waitForTimeout(500);

/* ---------- 1. tokens ---------- */
const modes = { light: "", dark: "dark", highContrastLight: "hc", highContrastDark: "dark hc" };
const norm = (v) => String(v).replace(/\s+/g, "").toLowerCase().replace(/(\D)\.(\d)/g, "$10.$2");
let mism = 0, checked = 0;
for (const [mode, cls] of Object.entries(modes)) {
  const comp = await page.evaluate(({ cls, vars }) => {
    const el = document.createElement("div"); el.className = cls; document.body.appendChild(el);
    const cs = getComputedStyle(el); const r = {}; for (const [k, v] of Object.entries(vars)) r[k] = cs.getPropertyValue(v).trim();
    el.remove(); return r;
  }, { cls, vars: tokens.cssVar });
  const expect = tokens.color[mode];
  const keysCss = Object.keys(comp), keysJson = Object.keys(expect);
  if (keysCss.length !== keysJson.length) { mism++; out.tokens[mode + ":count"] = [keysCss.length, keysJson.length]; }
  for (const k of keysJson) { checked++; if (norm(comp[k]) !== norm(expect[k])) { mism++; out.tokens[`${mode}.${k}`] = { css: comp[k], json: expect[k] }; } }
}
// every --cc-* colour var defined in tokens.css must be in tokens.json
const cssText = fs.readFileSync(path.join(root, "tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const declared = [...new Set([...cssText.matchAll(/(--cc-[a-z0-9-]+)\s*:/g)].map((m) => m[1]))].filter((v) => !/font/.test(v));
const missing = declared.filter((v) => !Object.values(tokens.cssVar).includes(v));
if (missing.length) { mism += missing.length; out.tokens.missingInJson = missing; }
const scal = await page.evaluate(({ sizeKeys, typeVar }) => { const cs = getComputedStyle(document.documentElement); const g = (v) => cs.getPropertyValue(v).trim();
  return { s: ["s1","s2","s3","s4","s5","s6","s8","s10","s12"].map((k) => [k, g("--" + k)]), r: ["sm","md","lg","xl","pill","btn"].map((k) => [k, g("--r-" + k)]),
    z: Object.keys(sizeKeys).map((k) => [k, g(sizeKeys[k])]), f: [g("--cc-font"), g("--cc-font-round")],
    t: Object.entries(typeVar).map(([k, v]) => [k, g(v)]) }; }, { sizeKeys: Object.fromEntries(Object.keys(tokens.size).map((k) => [k, "--" + k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())])), typeVar: tokens.typeVar });
for (const [k, v] of scal.s) { checked++; if (parseFloat(v) !== tokens.space[k]) { mism++; out.tokens["space." + k] = [v, tokens.space[k]]; } }
for (const [k, v] of scal.r) { checked++; if (parseFloat(v) !== tokens.radius[k]) { mism++; out.tokens["radius." + k] = [v, tokens.radius[k]]; } }
for (const [k, v] of scal.z) { checked++; if (parseFloat(v) !== tokens.size[k]) { mism++; out.tokens["size." + k] = [v, tokens.size[k]]; } }
// type: parse the computed custom property and compare with tokens.json.type
const famOf = (v) => (norm(v).includes(norm(tokens.font.rounded)) ? "rounded" : norm(v).includes(norm(tokens.font.text)) ? "text" : "?");
for (const [k, v] of scal.t) { checked++; const m = v.match(/^(\d{3})\s+([\d.]+)px\/([\d.]+)px\s+(.+)$/); const j = tokens.type[k];
  if (!m || !j || +m[1] !== j.weight || +m[2] !== j.size || +m[3] !== j.lineHeight || famOf(m[4]) !== j.family) { mism++; out.tokens["type." + k] = [v, j]; } }
if (Object.keys(tokens.type).length !== scal.t.length) { mism++; out.tokens["type:count"] = [scal.t.length, Object.keys(tokens.type).length]; }
const declaredT = [...new Set([...cssText.matchAll(/(--t-[a-z0-9-]+)\s*:/g)].map((m) => m[1]))];
const missingT = declaredT.filter((v) => !Object.values(tokens.typeVar).includes(v)); if (missingT.length) { mism += missingT.length; out.tokens.missingTypeInJson = missingT; }
checked += 2; if (norm(scal.f[0]) !== norm(tokens.font.text)) { mism++; out.tokens["font.text"] = [scal.f[0], tokens.font.text]; }
if (norm(scal.f[1]) !== norm(tokens.font.rounded)) { mism++; out.tokens["font.rounded"] = [scal.f[1], tokens.font.rounded]; }
console.log(`TOKENS: ${checked} values checked, ${mism} mismatches`);

/* ---------- 2. contrast ---------- */
const scopes = (process.env.SCOPES || "#diaryEditRow,#exportRow,#onbDark,#billingDarkRow,#hcRow .phone,#authRow,#targetRow,#scanSheetsRow,#paywallStateRow,#darkMoreRow").split(",");
const phoneHandles = await page.$$(scopes.map((s) => s.trim().includes(".phone") ? s.trim() : `${s.trim()} .phone`).join(","));
let worst = 99, n = 0;
for (const ph of phoneHandles) {
  await ph.scrollIntoViewIfNeeded();
  const res = await ph.evaluate((phone) => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
    const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bgOf = (el) => { // composite backgrounds from the page root down to el
      const chain = []; for (let e = el; e; e = e.parentElement) chain.unshift(e);
      let c = [255, 255, 255, 1];
      for (const e of chain) { const cs = getComputedStyle(e); let b = parse(cs.backgroundColor);
        if ((!b || b[3] === 0) && cs.backgroundImage.includes("gradient")) { const solid = [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).find((x) => x[3] === 1); if (solid) b = solid; }
        if (b && b[3] > 0) c = over(b, c); }
      return c; };
    const fig = phone.closest("[data-frame]"); const id = fig ? fig.dataset.frame : "?";
    const out = []; const walker = document.createTreeWalker(phone, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) { const t = walker.currentNode; if (!t.textContent.trim()) continue; const el = t.parentElement;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const pr = phone.getBoundingClientRect(); if (r.bottom < pr.top || r.top > pr.bottom || r.right < pr.left || r.left > pr.right) continue; // clipped off-screen
      const top = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
      if (top && top.closest("[data-scrim]") ) continue; // under the scrim: inactive
      const isSvg = el instanceof SVGElement; let fg = parse(isSvg ? cs.fill : cs.color); if (!fg) continue;
      let op = 1; for (let e = el; e && e !== phone.parentElement; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
      const bg = bgOf(el); fg = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
      out.push({ id, text: t.textContent.trim().slice(0, 40), ratio: +ratio(fg, bg).toFixed(2), fg: cs.color, size: cs.fontSize }); }
    return out; });
  for (const r of res) { n++; worst = Math.min(worst, r.ratio); if (r.ratio < 4.5) out.contrast.push(r); }
}
console.log(`CONTRAST: ${n} text runs in ${phoneHandles.length} phones, min ${worst.toFixed(2)}:1, ${out.contrast.length} below 4.5`);
out.contrast.forEach((r) => console.log("  FAIL", r.id, r.ratio, JSON.stringify(r.text), r.fg, r.size));

/* ---------- 3. screenshots ---------- */
fs.mkdirSync(path.join(root, "previews"), { recursive: true });
const figs = await page.$$("[data-frame]");
for (const f of figs) { const id = await f.getAttribute("data-frame"); await f.scrollIntoViewIfNeeded();
  const target = (await f.$(".phone")) || f; const file = path.join(root, "previews", `${id}.png`);
  await target.screenshot({ path: file, animations: "disabled" }); out.shots.push(path.relative(root, file)); }
console.log(`PREVIEWS: ${out.shots.length} PNGs in previews/`);

/* ---------- 4. regression vs baseline ---------- */
if (process.env.BASELINE) {
  const shoot = async (p, file) => { const pg = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    await pg.goto(url.pathToFileURL(file).href); await pg.waitForTimeout(400);
    await pg.addStyleTag({ content: "nav.toc{display:none !important}" }); await pg.waitForTimeout(150); // TOC grows each round; hide it so frame positions match
    const sel = ["#system", "#scan", "#core", "#profile", "#billing", "#onboarding", "#glance", "#icon #iconRow"].map((s) => `${s} figure.frame`).join(",");
    const list = await pg.$$(sel); const bufs = []; for (const f of list) { await f.scrollIntoViewIfNeeded(); bufs.push(await f.screenshot({ animations: "disabled" })); }
    const onb = await pg.$eval("#onb", (e) => e.innerHTML); const cap = await pg.$$eval(sel, (l) => l.map((f) => (f.querySelector("figcaption")?.firstChild?.textContent || "").trim()));
    await pg.close(); return { bufs, onb, cap }; };
  const a = await shoot(null, path.join(process.env.BASELINE, "index.html")), b = await shoot(null, path.join(root, "index.html"));
  console.log(`REGRESSION: ${a.bufs.length} baseline frames, ${b.bufs.length} now; light onboarding HTML ${a.onb === b.onb ? "identical" : "CHANGED"}`);
  a.bufs.forEach((buf, i) => { if (!b.bufs[i] || !buf.equals(b.bufs[i])) { out.regressions.push(a.cap[i]); console.log("  pixels differ:", a.cap[i]); } });
}
if (errors.length) console.log("PAGE ERRORS:", errors);
fs.writeFileSync(path.join(root, "previews", "verify-report.json"), JSON.stringify(out, null, 2));
await browser.close();
process.exit(mism || out.contrast.length || errors.length ? 1 : 0);
