#!/usr/bin/env node
/*
 * Owner tool: lists and captures every frame of the Ember canvas as a PNG.
 *
 *   node scripts/rn/ember-frames.cjs docs/design/ember/index.html out           # list the frames
 *   node scripts/rn/ember-frames.cjs docs/design/ember/index.html out capture   # write the PNGs
 *
 * It writes one PNG per frame (2x: a phone screen is 780 by 1690) and a manifest.json that pairs
 * each file with its section and caption. The committed copies live in docs/design/ember/frames/:
 * regenerate them when the canvas changes.
 *
 * Needs Google Chrome and playwright-core, which is NOT a dependency of this repository:
 *   mkdir -p /tmp/ember-frames && cd /tmp/ember-frames && npm init -y && npm i playwright-core
 *   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     NODE_PATH=/tmp/ember-frames/node_modules node <repo>/scripts/rn/ember-frames.cjs ...
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const [, , html, out, mode] = process.argv;
if (!html || !out) {
  console.error('usage: node scripts/rn/ember-frames.cjs <index.html> <output directory> [capture]');
  process.exit(2);
}
const slug = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto('file://' + path.resolve(html));
  await page.waitForTimeout(1000);
  const frames = await page.evaluate(() => {
    const firstLine = (element) => (element ? element.innerText.trim().split('\n')[0] : '');
    const phones = [...document.querySelectorAll('.phone')].map((el, index) => ({
      kind: 'screen',
      pick: '.phone',
      nth: index,
      section: (el.closest('section') || {}).id || '',
      id: (el.closest('figure') || {}).id || '',
      caption: firstLine(el.closest('figure')?.querySelector('figcaption')) || firstLine(el.parentElement.querySelector(':scope > figcaption, :scope > b')),
    }));
    // The whole figure: a frame can hold several cards (the steps of the Live Activity), and its
    // first child alone would lose the others.
    const glance = [...document.querySelectorAll('#glance figure.frame')].map((el, index) => ({
      kind: 'glanceable',
      pick: '#glance figure.frame',
      nth: index,
      section: 'glance',
      id: el.id || '',
      caption: firstLine(el.querySelector('figcaption')),
    }));
    // A frame of any other section that holds no phone (a widget, a Live Activity, a step list).
    const panels = [...document.querySelectorAll('figure.frame:not(:has(.phone))')].filter(
      (el) => (el.closest('section') || {}).id !== 'glance',
    );
    const others = panels.map((el) => ({
      kind: 'panel',
      pick: 'figure.frame:not(:has(.phone))',
      nth: [...document.querySelectorAll('figure.frame:not(:has(.phone))')].indexOf(el),
      section: (el.closest('section') || {}).id || '',
      id: el.id || '',
      caption: firstLine(el.querySelector('figcaption')) || el.id || 'frame',
    }));
    return phones.concat(glance).concat(others);
  });
  if (mode !== 'capture') {
    console.log(JSON.stringify(frames, null, 2));
    await browser.close();
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  // A frame keeps the number it had in the committed manifest, so a frame added in the middle of
  // the canvas does not shift the numbers the catalog and the units cite. The identity of a frame
  // is the id of its figure; the caption serves only for a frame without an id, because Designer
  // may reword a caption. A new frame takes the number after the highest one already taken.
  const manifestPath = path.join(out, 'manifest.json');
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  const oldNumber = new Map(
    previous.map((entry) => [`${entry.section}|${entry.id || entry.caption}`, Number.parseInt(entry.file, 10)]),
  );
  const taken = new Set();
  const numbers = frames.map((frame) => {
    const old = oldNumber.get(`${frame.section}|${frame.id || frame.caption}`);
    if (old !== undefined && !taken.has(old)) {
      taken.add(old);
      return old;
    }
    return null;
  });
  let next = Math.max(0, ...taken) + 1;
  const manifest = [];
  for (const [index, frame] of frames.entries()) {
    if (numbers[index] === null) {
      numbers[index] = next;
      taken.add(next);
      next += 1;
    }
    const name = `${String(numbers[index]).padStart(2, '0')}-${frame.section}-${slug(frame.caption) || 'frame'}.png`;
    const element = page.locator(frame.pick).nth(frame.nth);
    await element.scrollIntoViewIfNeeded();
    await element.screenshot({ path: path.join(out, name) });
    manifest.push({ file: name, kind: frame.kind, section: frame.section, id: frame.id, caption: frame.caption });
  }
  // A frame that left the canvas takes its picture with it. Only a picture the previous manifest
  // of this tool listed goes: never any file that happens to carry such a name, so a wrong output
  // directory costs nothing.
  const kept = new Set(manifest.map((entry) => entry.file));
  for (const entry of previous) {
    const picture = path.join(out, entry.file);
    if (!kept.has(entry.file) && fs.existsSync(picture)) fs.rmSync(picture);
  }
  manifest.sort((a, b) => Number.parseInt(a.file, 10) - Number.parseInt(b.file, 10));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`captured ${manifest.length} frames (${frames.filter((f) => f.kind === 'screen').length} screens, ${frames.filter((f) => f.kind === 'glanceable').length} glanceables)`);
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
