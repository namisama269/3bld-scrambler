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

export const T2C_FIRST_PIECES = ['UFL', 'UBR', 'UBL', 'DFR', 'DFL', 'DBL'];

// Weighted-distribution weights, indexed by position in the buffer order.
// Each entry = (#non-buffer-pieces × stickers-per-piece) × ((#−1) × stickers).
// Counts the number of (1st-target, 2nd-target) sticker pairs available with
// that buffer chosen — matches the natural distribution of cases a solver
// encounters. Keep in sync with the duplicate in public/scramble/main.js.
export const EDGE_WEIGHTS = [440, 360, 288, 224, 168, 120, 80, 48, 24, 8];
export const CORNER_WEIGHTS = [378, 270, 180, 108, 54, 18];
export const F2E_FIRST_PIECES = ['UB', 'UL', 'FR', 'FL', 'DF', 'DR', 'DL', 'DB', 'BR', 'BL'];

export const CORNER_SCRAMBLE_TYPES = ['Solved', 'Random', 'Targets', 'Floating', 'Twist', 'LTCT', '2-Swap'];
export const EDGE_SCRAMBLE_TYPES = ['Solved', 'Random', 'Targets', 'Floating', 'Flips', '2-Swap'];

// Holding orientation options (key → human label). Keep keys aligned with
// ORIENTATION_OPTIONS in the scramble engine so getOrientationMoves() resolves.
export const ORIENTATION_OPTIONS = {
    wg: 'White top, Green front',
    wr: 'White top, Red front',
    wb: 'White top, Blue front',
    wo: 'White top, Orange front',
    yg: 'Yellow top, Green front',
    yr: 'Yellow top, Red front',
    yb: 'Yellow top, Blue front',
    yo: 'Yellow top, Orange front',
    og: 'Orange top, Green front',
    ow: 'Orange top, White front',
    ob: 'Orange top, Blue front',
    oy: 'Orange top, Yellow front',
    rg: 'Red top, Green front',
    rw: 'Red top, White front',
    rb: 'Red top, Blue front',
    ry: 'Red top, Yellow front',
    gy: 'Green top, Yellow front',
    gr: 'Green top, Red front',
    gw: 'Green top, White front',
    go: 'Green top, Orange front',
    bw: 'Blue top, White front',
    br: 'Blue top, Red front',
    by: 'Blue top, Yellow front',
    bo: 'Blue top, Orange front',
};

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
