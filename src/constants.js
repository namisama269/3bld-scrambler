// Shared piece data + default ordering. These lists were previously inline in
// the legacy index.html — kept identical so the scramble engine produces the
// same target sets when reading config from React state.

export const ALL_CORNERS = [
    ['UFR', 'RUF', 'FUR'],
    ['UFL', 'FUL', 'LUF'],
    ['UBR', 'BUR', 'RUB'],
    ['UBL', 'LUB', 'BUL'],
    ['DFR', 'FDR', 'RDF'],
    ['DFL', 'LDF', 'FDL'],
    ['DBR', 'RDB', 'BDR'],
    ['DBL', 'BDL', 'LDB'],
];

export const ALL_EDGES = [
    ['UF', 'FU'],
    ['UB', 'BU'],
    ['UR', 'RU'],
    ['UL', 'LU'],
    ['FR', 'RF'],
    ['FL', 'LF'],
    ['DF', 'FD'],
    ['DB', 'BD'],
    ['DR', 'RD'],
    ['DL', 'LD'],
    ['BR', 'RB'],
    ['BL', 'LB'],
];

export const DEFAULT_CORNER_BUFFER_ORDER = [
    'UFR', 'UFL', 'UBR', 'UBL', 'DFR', 'DFL', 'DBR', 'DBL',
];

export const DEFAULT_EDGE_BUFFER_ORDER = [
    'UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL', 'BR', 'BL',
];

// Weighted-distribution weights, indexed by position in the buffer order.
// Each entry = (#non-buffer-pieces × stickers-per-piece) × ((#−1) × stickers).
// Counts the number of (1st-target, 2nd-target) sticker pairs available with
// that buffer chosen — matches the natural distribution of cases a solver
// encounters. Keep in sync with the duplicate in public/scramble/main.js.
export const EDGE_WEIGHTS = [440, 360, 288, 224, 168, 120, 80, 48, 24, 8];
export const CORNER_WEIGHTS = [378, 270, 180, 108, 54, 18];
export const F2E_FIRST_PIECES = ['UB', 'UL', 'FR', 'FL', 'DF', 'DR', 'DL', 'DB', 'BR', 'BL'];

export const CORNER_SCRAMBLE_TYPES = ['Solved', 'Random', 'Targets', 'Floating', 'Twist', '2-Swap'];
export const EDGE_SCRAMBLE_TYPES = ['Solved', 'Random', 'Targets', 'Floating', 'Flips', '2-Swap'];

// Holding orientation options (key letters → top, front face). Keep keys
// aligned with ORIENTATION_OPTIONS in the scramble engine so
// getOrientationMoves() resolves. The labels are computed at render time
// from FACE_NAMES so we don't store the same data twice.
export const ORIENTATION_OPTIONS = {
    wg: '', wr: '', wb: '', wo: '',
    yg: '', yr: '', yb: '', yo: '',
    og: '', ow: '', ob: '', oy: '',
    rg: '', rw: '', rb: '', ry: '',
    gy: '', gr: '', gw: '', go: '',
    bw: '', br: '', by: '', bo: '',
};

// Face-letter → human-readable color name.
export const FACE_NAMES = {
    w: 'White', y: 'Yellow', o: 'Orange',
    r: 'Red', g: 'Green', b: 'Blue',
};

// Face-letter → hex (matches public/scramble/visualCube.js so swatches stay
// in sync with the rendered cube colors).
export const FACE_COLORS = {
    w: '#ffffff',
    y: '#F0FF00',
    o: '#FB8C00',
    r: '#E8120A',
    // g: '#66FF33',
    g: '#00d800',
    b: '#2055FF',
};

// Defaults for the user-editable per-face color scheme. Keyed by face letter
// (U/R/F/B/L/D) so it slots straight into VisualCube.stickerColors. Values
// must mirror the U/R/F/L/B/D constants in public/scramble/visualCube.js so
// the React-side defaults render the same as the engine before any edits.
export const DEFAULT_STICKER_COLORS = {
    U: FACE_COLORS.w,
    R: FACE_COLORS.r,
    F: FACE_COLORS.g,
    L: FACE_COLORS.o,
    B: FACE_COLORS.b,
    D: FACE_COLORS.y,
};

// Whole-cube rotation alg per holding orientation. Mirror of the table in
// public/scramble/gen.js (loaded as a non-module global, not importable
// from the React side). Keep these two copies in sync.
export const ORIENTATION_MOVES = {
    wg: '',     wr: 'y',     wb: 'y2',    wo: "y'",
    yg: 'z2',   yr: 'x2 y',  yb: 'x2',    yo: "x2 y'",
    ob: 'z y2', ow: 'z y',   oy: "z y'",  og: 'z',
    rb: "z' y2", rw: "z' y'", ry: "z' y", rg: "z'",
    go: "x y'", gy: 'x',     gw: 'x y2',  gr: 'x y',
    bo: "x' y'", by: "x' y2", bw: "x'",   br: "x' y",
};

// Given an orientation key, return a map: cube-position-letter →
// original-face-letter that's currently at that position after applying
// ORIENTATION_MOVES[key] to a solved cube. Used by the color-scheme editor
// so the U/R/F/B/L/D labels above the swatches always refer to "current top
// / right / etc." in the held orientation, while the swatch *edits* the
// underlying face that physically lives there.
//
// Cycle direction was verified by walking known orientations:
//   wg → wr (y rotation): F should become red — matches y cycling
//     F→L→B→R→F (color direction).
//   wg → gy (x rotation): U should become green — matches x cycling
//     U→B→D→F→U (color direction).
//   wg → og (z rotation): U should become orange — matches z cycling
//     U→R→D→L→U (color direction).
export function faceAtPositionFor(orientationKey) {
    const perm = { U: 'U', R: 'R', F: 'F', B: 'B', L: 'L', D: 'D' };
    const alg = ORIENTATION_MOVES[orientationKey];
    if (!alg) return perm;

    // Color goes a→b means "the face originally at a is now at b position",
    // i.e. perm[b] = oldPerm[a]. cycle4(a,b,c,d) does a→b→c→d→a.
    const cycle4 = (a, b, c, d) => {
        const oA = perm[a], oB = perm[b], oC = perm[c], oD = perm[d];
        perm[b] = oA; perm[c] = oB; perm[d] = oC; perm[a] = oD;
    };
    const swap = (a, b) => { const t = perm[a]; perm[a] = perm[b]; perm[b] = t; };

    for (const move of alg.trim().split(/\s+/)) {
        switch (move) {
            case 'x':  cycle4('U', 'B', 'D', 'F'); break;
            case "x'": cycle4('U', 'F', 'D', 'B'); break;
            case 'x2': swap('U', 'D'); swap('F', 'B'); break;
            case 'y':  cycle4('F', 'L', 'B', 'R'); break;
            case "y'": cycle4('F', 'R', 'B', 'L'); break;
            case 'y2': swap('F', 'B'); swap('L', 'R'); break;
            case 'z':  cycle4('U', 'R', 'D', 'L'); break;
            case "z'": cycle4('U', 'L', 'D', 'R'); break;
            case 'z2': swap('U', 'D'); swap('L', 'R'); break;
        }
    }
    return perm;
}

export function orientationLabel(key) {
    return `${FACE_NAMES[key[0]]} / ${FACE_NAMES[key[1]]}`;
}

// Target-ordering modes for the multiselect lists.
//   'piece' — natural piece-iteration order from ALL_CORNERS / ALL_EDGES.
//             This is the default and matches what the helpers produce
//             before any sorting.
//   'face'  — face groups in U > L > F > R > B > D order, with within-face
//             traversal following the Speffz clockwise sticker layout.
//             (We use Speffz only as a within-face ordering convention; the
//             specific letter labels A→X are not surfaced anywhere.)

// Sticker positions in canonical Speffz layout. Used purely as a sort key
// for 'face' mode — names are in the codebase's "face-first" convention
// (UFR = corner with U-face sticker named UFR).
const SPEFFZ_CORNER_STICKERS = [
    'UBL', 'UBR', 'UFR', 'UFL',   // U face
    'LUB', 'LUF', 'LDF', 'LDB',   // L face
    'FUL', 'FUR', 'FDR', 'FDL',   // F face
    'RUF', 'RUB', 'RDB', 'RDF',   // R face
    'BUR', 'BUL', 'BDL', 'BDR',   // B face
    'DFL', 'DFR', 'DBR', 'DBL',   // D face
];
const SPEFFZ_EDGE_STICKERS = [
    'UB', 'UR', 'UF', 'UL',       // U face
    'LU', 'LF', 'LD', 'LB',       // L face
    'FU', 'FR', 'FD', 'FL',       // F face
    'RU', 'RB', 'RD', 'RF',       // R face
    'BU', 'BL', 'BD', 'BR',       // B face
    'DF', 'DR', 'DB', 'DL',       // D face
];
const SPEFFZ_RANK = (() => {
    const m = new Map();
    SPEFFZ_CORNER_STICKERS.forEach((s, i) => m.set(s, i));
    SPEFFZ_EDGE_STICKERS.forEach((s, i) => m.set(s, i));
    return m;
})();

export function orderTargets(targets, mode) {
    if (mode !== 'face') return targets; // 'piece' = input as-is
    return [...targets].sort((a, b) => (SPEFFZ_RANK.get(a) ?? 99) - (SPEFFZ_RANK.get(b) ?? 99));
}

export function getTargetsExcludingBuffer(buffer) {
    const targets = [];
    ALL_CORNERS.forEach((corner) => {
        if (corner[0] !== buffer) corner.forEach((o) => targets.push(o));
    });
    return targets;
}

export function getTwistTargets(buffer) {
    const targets = [];
    ALL_CORNERS.forEach((corner) => {
        if (corner[0] !== buffer) {
            corner.forEach((o) => {
                if (!o.startsWith('U') && !o.startsWith('D')) targets.push(o);
            });
        }
    });
    return targets;
}

export function getUDStickerTargets(buffer) {
    const targets = [];
    ALL_CORNERS.forEach((corner) => {
        if (corner[0] !== buffer) targets.push(corner[0]);
    });
    return targets;
}

export function getEdgeParityTargets(buffer) {
    const targets = [];
    ALL_EDGES.forEach((edge) => {
        if (edge[0] !== buffer) edge.forEach((s) => targets.push(s));
    });
    return targets;
}

export function getFlipTargets(buffer) {
    const targets = [];
    const isUF = buffer === 'UF';
    const isUR = buffer === 'UR';
    const parityEdgePrimary = isUF ? 'UR' : isUR ? 'UF' : null;
    ALL_EDGES.forEach((edge) => {
        if (edge[0] === buffer) return;
        if (parityEdgePrimary && edge[0] === parityEdgePrimary) return;
        targets.push(edge[0]);
    });
    return targets;
}

export function getFlipParityTargets(buffer) {
    const targets = [];
    ALL_EDGES.forEach((edge) => {
        if (edge[0] === buffer) return;
        edge.forEach((s) => targets.push(s));
    });
    return targets;
}
