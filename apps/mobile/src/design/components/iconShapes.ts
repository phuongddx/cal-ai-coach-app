/**
 * The icon set of the Ember canvas: one entry per `<symbol id="i-…">` of `docs/design/ember/index.html`,
 * the name is the id without the `i-` prefix, the shape attributes are copied verbatim (24 x 24
 * viewBox, Lucide-style strokes). `Icon.test.tsx` READS index.html and compares the names and
 * every attribute with this table: edit the canvas or this file alone and the test fails.
 * Generated once from the canvas; do not reformat the strings.
 */

export type IconShape =
  | { tag: 'path'; d: string; fill?: string }
  | { tag: 'circle'; cx: string; cy: string; r: string }
  | { tag: 'rect'; x: string; y: string; width: string; height: string; rx?: string };

export const iconShapes = {
  x: [
    { tag: 'path', d: 'M18 6 6 18M6 6l12 12' },
  ],
  back: [
    { tag: 'path', d: 'm15 18-6-6 6-6' },
  ],
  chev: [
    { tag: 'path', d: 'm9 18 6-6-6-6' },
  ],
  check: [
    { tag: 'path', d: 'M20 6 9 17l-5-5' },
  ],
  plus: [
    { tag: 'path', d: 'M5 12h14M12 5v14' },
  ],
  minus: [
    { tag: 'path', d: 'M5 12h14' },
  ],
  camera: [
    { tag: 'path', d: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z' },
    { tag: 'circle', cx: '12', cy: '13', r: '3.2' },
  ],
  image: [
    { tag: 'rect', x: '3', y: '3', width: '18', height: '18', rx: '3' },
    { tag: 'circle', cx: '9', cy: '9', r: '2' },
    { tag: 'path', d: 'm21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21' },
  ],
  flip: [
    { tag: 'path', d: 'M21 12a9 9 0 0 0-9-9 9.7 9.7 0 0 0-6.7 2.7L3 8' },
    { tag: 'path', d: 'M3 3v5h5' },
    { tag: 'path', d: 'M3 12a9 9 0 0 0 9 9 9.7 9.7 0 0 0 6.7-2.7L21 16' },
    { tag: 'path', d: 'M16 16h5v5' },
  ],
  flash: [
    { tag: 'path', d: 'M13 2 4 14h7l-1 8 9-12h-7z' },
  ],
  barcode: [
    { tag: 'path', d: 'M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14' },
  ],
  label: [
    { tag: 'path', d: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8h10M7 12h10M7 16h6' },
  ],
  pencil: [
    { tag: 'path', d: 'M12 20h9' },
    { tag: 'path', d: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z' },
  ],
  sun: [
    { tag: 'circle', cx: '12', cy: '12', r: '4' },
    { tag: 'path', d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4' },
  ],
  sunrise: [
    { tag: 'path', d: 'M12 2v6M4.9 10.9l1.4 1.4M2 18h2M20 18h2M19.1 10.9l-1.4 1.4M22 22H2M16 18a4 4 0 0 0-8 0M8 6l4-4 4 4' },
  ],
  moon: [
    { tag: 'path', d: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z' },
  ],
  apple: [
    { tag: 'path', d: 'M12 6.5c-1.5-1.3-4-1.6-5.6-.2C4.3 8 4.6 12 6.2 15.4 7.4 18 9 20.5 10.6 20.5c.8 0 1-.5 1.4-.5s.6.5 1.4.5c1.6 0 3.2-2.5 4.4-5.1C19.4 12 19.7 8 17.6 6.3 16 4.9 13.5 5.2 12 6.5z' },
    { tag: 'path', d: 'M12 6.5C12 4.5 13 3 15 2.5' },
  ],
  chart: [
    { tag: 'path', d: 'M3 3v18h18' },
    { tag: 'path', d: 'm7 15 4-4 3 3 6-6' },
  ],
  spark: [
    { tag: 'path', d: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z' },
    { tag: 'path', d: 'M19 15v4M17 17h4' },
  ],
  user: [
    { tag: 'circle', cx: '12', cy: '8', r: '4' },
    { tag: 'path', d: 'M4 21a8 8 0 0 1 16 0' },
  ],
  flame: [
    { tag: 'path', d: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3 0 1.4.9 2.5 2.5 2.5z' },
  ],
  drop: [
    { tag: 'path', d: 'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z' },
  ],
  info: [
    { tag: 'circle', cx: '12', cy: '12', r: '10' },
    { tag: 'path', d: 'M12 16v-4M12 8h.01' },
  ],
  alert: [
    { tag: 'path', d: 'm21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z' },
    { tag: 'path', d: 'M12 9v4M12 17h.01' },
  ],
  lock: [
    { tag: 'rect', x: '3', y: '11', width: '18', height: '11', rx: '2' },
    { tag: 'path', d: 'M7 11V7a5 5 0 0 1 10 0v4' },
  ],
  keyboard: [
    { tag: 'rect', x: '2', y: '6', width: '20', height: '12', rx: '2' },
    { tag: 'path', d: 'M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10' },
  ],
  fork: [
    { tag: 'path', d: 'M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7' },
  ],
  search: [
    { tag: 'circle', cx: '11', cy: '11', r: '7' },
    { tag: 'path', d: 'm21 21-4.3-4.3' },
  ],
  shield: [
    { tag: 'path', d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  ],
  card: [
    { tag: 'rect', x: '2', y: '5', width: '20', height: '14', rx: '2' },
    { tag: 'path', d: 'M2 10h20' },
  ],
  download: [
    { tag: 'path', d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' },
  ],
  trash: [
    { tag: 'path', d: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
  ],
  trophy: [
    { tag: 'path', d: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 3.8M18 2H6v7a6 6 0 0 0 12 0z' },
  ],
  heart: [
    { tag: 'path', d: 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z' },
  ],
  bell: [
    { tag: 'path', d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0' },
  ],
  eyeoff: [
    { tag: 'path', d: 'M9.9 9.9a3 3 0 1 0 4.2 4.2M10.7 5.1A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13 13 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20' },
  ],
  undo: [
    { tag: 'path', d: 'M3 7v6h6' },
    { tag: 'path', d: 'M21 17a9 9 0 0 0-15-6.7L3 13' },
  ],
  cal: [
    { tag: 'rect', x: '3', y: '4', width: '18', height: '18', rx: '2' },
    { tag: 'path', d: 'M16 2v4M8 2v4M3 10h18' },
  ],
  target: [
    { tag: 'circle', cx: '12', cy: '12', r: '9' },
    { tag: 'circle', cx: '12', cy: '12', r: '5' },
    { tag: 'circle', cx: '12', cy: '12', r: '1' },
  ],
  run: [
    { tag: 'circle', cx: '14', cy: '4', r: '2' },
    { tag: 'path', d: 'm7 21 3-6 3 2v5M5 12l3-3 4 1 3 4 4 1M10 15l-1-5' },
  ],
  scale: [
    { tag: 'rect', x: '3', y: '3', width: '18', height: '18', rx: '4' },
    { tag: 'path', d: 'M8 9a4 4 0 0 1 8 0M12 9l1.5-2' },
  ],
  flag: [
    { tag: 'path', d: 'M4 22V4a1 1 0 0 1 1-1h12l-2 4 2 4H5' },
  ],
  ruler: [
    { tag: 'path', d: 'M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0zM14.5 12.5l2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2' },
  ],
  receipt: [
    { tag: 'path', d: 'M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z' },
    { tag: 'path', d: 'M8 9h8M8 13h6' },
  ],
  help: [
    { tag: 'circle', cx: '12', cy: '12', r: '10' },
    { tag: 'path', d: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01' },
  ],
  mail: [
    { tag: 'rect', x: '2', y: '4', width: '20', height: '16', rx: '2' },
    { tag: 'path', d: 'm22 7-10 6L2 7' },
  ],
  globe: [
    { tag: 'circle', cx: '12', cy: '12', r: '10' },
    { tag: 'path', d: 'M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20' },
  ],
  moonsun: [
    { tag: 'circle', cx: '12', cy: '12', r: '9' },
    { tag: 'path', d: 'M12 3v18a9 9 0 0 0 0-18z', fill: 'currentColor' },
  ],
  leaf: [
    { tag: 'path', d: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z' },
    { tag: 'path', d: 'M2 21c0-3 1.9-5.4 5.2-6' },
  ],
  dumbbell: [
    { tag: 'path', d: 'M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11' },
  ],
  scan: [
    { tag: 'path', d: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2' },
    { tag: 'circle', cx: '12', cy: '12', r: '3.5' },
  ],
} as const satisfies Record<string, readonly IconShape[]>;

export type IconName = keyof typeof iconShapes;

export const iconNames = Object.keys(iconShapes) as IconName[];
