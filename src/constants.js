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
