// Pre-generate the BLD orientation icons under public/orientations/{key}.svg.
// One SVG per ORIENTATION_OPTIONS key (24 total). Uses sr-visualizer for the
// 3-face isometric cube look that matches the rest of the app's visuals.
//
// Run via `npm run gen-icons`. Re-run after palette changes (e.g. green hex).
//
// Pipeline:
//   1. jsdom provides a DOM so sr-visualizer's svg.js-based renderer works.
//   2. Configure colorScheme so face index 0 (U) = white, 2 (F) = green, etc.
//      — i.e. our app's "wg" default with white on top and green on front.
//   3. For each orientation key, pass ORIENTATION_MOVES[key] as the algorithm
//      so the cube state rotates to put the user's chosen top/front colors
//      where they belong before rendering.
//   4. Pull the rendered <svg> element's outerHTML out of the container and
//      write it to disk.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';

// Set up DOM globals BEFORE importing sr-visualizer (which imports svg.js,
// which expects window/document at module-load time).
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.Node = dom.window.Node;
// `globalThis.navigator` is read-only on modern Node, but svg.js only
// reads it lazily, and since `window.navigator` exists from jsdom that's
// what gets resolved when svg.js does `window.navigator`. No setup needed.

const SRVisualizer = await import('sr-visualizer');

// Match the engine's ORIENTATION_MOVES table (public/scramble/gen.js).
const ORIENTATION_MOVES = {
    wg: '',     wr: 'y',     wb: 'y2',    wo: "y'",
    yg: 'z2',   yr: 'x2 y',  yb: 'x2',    yo: "x2 y'",
    ob: 'z y2', ow: 'z y',   oy: "z y'",  og: 'z',
    rb: "z' y2",rw: "z' y'", ry: "z' y",  rg: "z'",
    go: "x y'", gy: 'x',     gw: 'x y2',  gr: 'x y',
    bo: "x' y'",by: "x' y2", bw: "x'",    br: "x' y",
};

// Face-letter → hex. Mirrors src/constants.js FACE_COLORS / visualCube.js.
const FACE_HEX = {
    w: '#ffffff', y: '#F0FF00', o: '#FB8C00',
    r: '#E8120A', g: '#00d800', b: '#2055FF',
};

// sr-visualizer Face enum: U=0, R=1, F=2, D=3, L=4, B=5.
// Configure with our app's "wg" base orientation: white on top, green front,
// red right, yellow bottom, orange left, blue back. The orientation moves
// (passed as `algorithm`) rotate from there to whatever the user picked.
const colorScheme = {
    0: FACE_HEX.w, // U
    1: FACE_HEX.r, // R
    2: FACE_HEX.g, // F
    3: FACE_HEX.y, // D
    4: FACE_HEX.o, // L
    5: FACE_HEX.b, // B
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.resolve(__dirname, '..', 'public', 'orientations');

// Render options. Small canvas (64×64) — SVG scales freely so the actual
// browser display size is set by CSS. Keep stroke + outline to draw clean
// black borders around the cube and stickers.
//
// viewportRotations matches the saved app-icon parameter set in
// public/logo.params.json: [[Y, 22], [X, -30], [Z, 0]]. Indices follow
// sr-visualizer's Axis enum (X=0, Y=1, Z=2). Using the same rotations
// here keeps the orientation icons visually consistent with the app logo.
//
// cubeOpacity / stickerOpacity are explicitly 100 (fully opaque) — the
// library's defaults are already 100, but make it explicit so it can't
// silently change.
// Generate both variants so the React component can pick by changing one
// line. cubeSize 3 = full 3×3 face grid; cubeSize 1 = single block per face
// (cleaner at very small icon sizes). outlineWidth/strokeWidth left at lib
// defaults (0.94 / 0) — those produce the clean thick black inter-sticker
// gaps that match the app logo.
const baseOptions = {
    width: 64,
    height: 64,
    colorScheme,
    cubeColor: '#000000',
    cubeOpacity: 100,
    stickerOpacity: 100,
    viewportRotations: [[1, 22], [0, -30], [2, 0]],
};

const VARIANTS = [
    { name: '3x3', cubeSize: 3 },
    { name: '1x1', cubeSize: 1 },
];

let written = 0;
for (const variant of VARIANTS) {
    const outDir = path.join(OUT_ROOT, variant.name);
    mkdirSync(outDir, { recursive: true });
    for (const [key, alg] of Object.entries(ORIENTATION_MOVES)) {
        const container = document.createElement('div');
        document.body.appendChild(container);
        SRVisualizer.cubeSVG(container, { ...baseOptions, cubeSize: variant.cubeSize, algorithm: alg });
        const svg = container.querySelector('svg');
        if (!svg) {
            console.error(`No SVG produced for ${variant.name}/${key}`);
            continue;
        }
        writeFileSync(path.join(outDir, `${key}.svg`), svg.outerHTML);
        container.remove();
        written += 1;
    }
}

console.log(`Wrote ${written} orientation icons (${VARIANTS.length} variants × ${Object.keys(ORIENTATION_MOVES).length} keys) under ${OUT_ROOT}`);
