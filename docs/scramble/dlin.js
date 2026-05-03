const BUFFERS = {
    corner: ["UFR", "UFL", "UBR", "UBL", "DFR", "DFL", "DBL", "DBR"],
    edge: ["UF", "UR", "UB", "UL", "FR", "FL", "DF", "DB", "DR", "DL", "BR", "BL"]
};

// piece.js

class DlinPiece {
    constructor(x, y, z) {
        const xd = {0: "L", 1: "", 2: "R"};
        const yd = {0: "D", 1: "", 2: "U"};
        const zd = {0: "F", 1: "", 2: "B"};
        this.sides = [xd[x], yd[y], zd[z]];
    }

    getName(axis = 1) {
        const facePrecedence = {"U": 0, "D": 0, "F": 1, "B": 1, "R": 2, "L": 2, "": 3};
        let axisFace = this.sides[axis];
        if (!axisFace) axisFace = this.sides[2];
        const name = [...this.sides];
        const index = name.indexOf(axisFace);
        [name[index], name[0]] = [name[0], name[index]];
        const rest = name.slice(1).sort((a, b) => facePrecedence[a] - facePrecedence[b]);
        return name[0] + rest.join("");
    }

    swapStickers(axis1, axis2) {
        [this.sides[axis1], this.sides[axis2]] = [this.sides[axis2], this.sides[axis1]];
    }

    roll(k) {
        // Simulate numpy roll
        k = ((k % 3) + 3) % 3;
        this.sides = [...this.sides.slice(-k), ...this.sides.slice(0, -k)];
    }
}

// cube.js

const DLIN_FACES = {
    "L": {axis: 0, pos: 0},
    "M": {axis: 0, pos: 1},
    "R": {axis: 0, pos: 2},
    "F": {axis: 2, pos: 0},
    "S": {axis: 2, pos: 1},
    "B": {axis: 2, pos: 2},
    "U": {axis: 1, pos: 2},
    "E": {axis: 1, pos: 1},
    "D": {axis: 1, pos: 0}
};

class DlinCube {
    constructor() {
        // 3D array [x][y][z]
        this.cube = [];
        for (let x = 0; x < 3; x++) {
            this.cube[x] = [];
            for (let y = 0; y < 3; y++) {
                this.cube[x][y] = [];
                for (let z = 0; z < 3; z++) {
                    this.cube[x][y][z] = new DlinPiece(x, y, z);
                }
            }
        }
        this.solved = this._copyCube();
        this.scramble = "";
    }

    _copyCube() {
        const copy = [];
        for (let x = 0; x < 3; x++) {
            copy[x] = [];
            for (let y = 0; y < 3; y++) {
                copy[x][y] = [];
                for (let z = 0; z < 3; z++) {
                    const p = new DlinPiece(x, y, z);
                    p.sides = [...this.cube[x][y][z].sides];
                    copy[x][y][z] = p;
                }
            }
        }
        return copy;
    }

    resetCubeToSolved() {
        this.cube = this.solved;
    }

    singleTurn(face, clockwise = true) {
        let k = clockwise ? 1 : -1;
        if (["U", "L", "F", "S", "M"].includes(face)) {
            k = -k;
        }
        const {axis, pos} = DLIN_FACES[face];

        // Get the 2D slice at the given position
        const slice = this._getSlice(axis, pos);

        // Rotate the slice
        const rotated = this._rot90(slice, k);

        // Put the rotated slice back
        this._setSlice(axis, pos, rotated);

        // Swap stickers
        const axes = [0, 1, 2].filter(a => a !== axis);
        const [axis1, axis2] = axes;

        const sliceCoords = this._getSliceCoords(axis, pos);
        for (const [x, y, z] of sliceCoords) {
            this.cube[x][y][z].swapStickers(axis1, axis2);
        }
    }

    _getSlice(axis, pos) {
        const slice = [];
        if (axis === 0) {
            for (let y = 0; y < 3; y++) {
                slice[y] = [];
                for (let z = 0; z < 3; z++) {
                    slice[y][z] = this.cube[pos][y][z];
                }
            }
        } else if (axis === 1) {
            for (let x = 0; x < 3; x++) {
                slice[x] = [];
                for (let z = 0; z < 3; z++) {
                    slice[x][z] = this.cube[x][pos][z];
                }
            }
        } else { // axis === 2
            for (let x = 0; x < 3; x++) {
                slice[x] = [];
                for (let y = 0; y < 3; y++) {
                    slice[x][y] = this.cube[x][y][pos];
                }
            }
        }
        return slice;
    }

    _setSlice(axis, pos, slice) {
        if (axis === 0) {
            for (let y = 0; y < 3; y++) {
                for (let z = 0; z < 3; z++) {
                    this.cube[pos][y][z] = slice[y][z];
                }
            }
        } else if (axis === 1) {
            for (let x = 0; x < 3; x++) {
                for (let z = 0; z < 3; z++) {
                    this.cube[x][pos][z] = slice[x][z];
                }
            }
        } else { // axis === 2
            for (let x = 0; x < 3; x++) {
                for (let y = 0; y < 3; y++) {
                    this.cube[x][y][pos] = slice[x][y];
                }
            }
        }
    }

    _getSliceCoords(axis, pos) {
        const coords = [];
        if (axis === 0) {
            for (let y = 0; y < 3; y++) {
                for (let z = 0; z < 3; z++) {
                    coords.push([pos, y, z]);
                }
            }
        } else if (axis === 1) {
            for (let x = 0; x < 3; x++) {
                for (let z = 0; z < 3; z++) {
                    coords.push([x, pos, z]);
                }
            }
        } else { // axis === 2
            for (let x = 0; x < 3; x++) {
                for (let y = 0; y < 3; y++) {
                    coords.push([x, y, pos]);
                }
            }
        }
        return coords;
    }

    _rot90(matrix, k) {
        // Normalize k to 0-3
        k = ((k % 4) + 4) % 4;
        let result = matrix.map(row => [...row]);
        for (let i = 0; i < k; i++) {
            result = this._rot90Once(result);
        }
        return result;
    }

    _rot90Once(matrix) {
        // numpy.rot90 rotates 90° counter-clockwise: new[i][j] = old[j][n-1-i]
        const n = matrix.length;
        const m = matrix[0].length;
        const result = [];
        for (let i = 0; i < m; i++) {
            result[i] = [];
            for (let j = 0; j < n; j++) {
                result[i][j] = matrix[j][m - 1 - i];
            }
        }
        return result;
    }

    wideTurn(face, clockwise = true) {
        let sliceClockwise = clockwise;
        if (["R", "U", "B"].includes(face)) {
            sliceClockwise = !clockwise;
        }
        let sliceFace;
        if (["L", "R"].includes(face)) {
            sliceFace = "M";
        } else if (["U", "D"].includes(face)) {
            sliceFace = "E";
        } else if (["F", "B"].includes(face)) {
            sliceFace = "S";
        }
        this.singleTurn(face, clockwise);
        this.singleTurn(sliceFace, sliceClockwise);
    }

    rotation(rot, clockwise = true) {
        const axis = rot[0];
        let moves;
        if (axis === "x") {
            moves = ["R", "M'", "L'"];
        } else if (axis === "y") {
            moves = ["U", "E'", "D'"];
        } else if (axis === "z") {
            moves = ["F", "S", "B'"];
        }

        if (!clockwise) {
            for (let i = 0; i < 3; i++) {
                for (const move of moves) {
                    this.doMove(move);
                }
            }
        } else {
            for (const move of moves) {
                this.doMove(move);
            }
        }
    }

    doMove(move) {
        if ("urfbld".includes(move[0])) {
            move = move[0].toUpperCase() + "w" + move.slice(1);
            this.doMove(move);
            return;
        }

        const clockwise = !move.includes("'");
        const face = move[0];
        let turn;
        if (move.includes("x") || move.includes("y") || move.includes("z")) {
            turn = () => this.rotation(face, clockwise);
        } else if (move.includes("w")) {
            turn = () => this.wideTurn(face, clockwise);
        } else {
            turn = () => this.singleTurn(face, clockwise);
        }

        if (move.includes("2")) {
            turn();
            turn();
        } else {
            turn();
        }
    }

    getCoords(p) {
        const d = {};
        for (const x of p) {
            if (DLIN_FACES[x]) {
                d[DLIN_FACES[x].axis] = DLIN_FACES[x].pos;
            }
        }
        for (let i = 0; i < 3; i++) {
            if (!(i in d)) {
                d[i] = 1;
            }
        }
        return [d[0], d[1], d[2]];
    }

    pseudoswap(e1, e2) {
        // HARDCODED UF UR FOR NOW
        this.cube[1][2][0].sides = ['', 'U', 'R'];
        this.cube[2][2][1].sides = ['F', 'U', ''];
    }

    scrambleFromString(scram) {
        this.scramble = scram;
        const moves = scram.split(" ");
        for (const move of moves) {
            if (move) {
                this.doMove(move);
            }
        }
    }
}

// tracer.js

class Tracer extends DlinCube {
    constructor(buffers, trace = "both") {
        super();
        this.tracing = {edge: [], corner: []};
        this.buffers = {...buffers};
        this.loopcube = [];
        for (let x = 0; x < 3; x++) {
            for (let y = 0; y < 3; y++) {
                for (let z = 0; z < 3; z++) {
                    this.loopcube.push([x, y, z]);
                }
            }
        }

        this.traceCorners = trace === "corners" || trace === "both";
        this.traceEdges = trace === "edges" || trace === "both";
    }

    findPiece(piecename) {
        const pieceSet = new Set(piecename);
        for (const pos of this.loopcube) {
            const [x, y, z] = pos;
            const name = this.cube[x][y][z].getName();
            if (this._setsEqual(new Set(name), pieceSet)) {
                return pos;
            }
        }
        return null;
    }

    _setsEqual(a, b) {
        if (a.size !== b.size) return false;
        for (const item of a) {
            if (!b.has(item)) return false;
        }
        return true;
    }

    rotateIntoOrientation() {
        const rotations = [];
        const uCenter = this.findPiece("U");
        const direction = Math.max(...uCenter.filter(v => v !== 1));
        const axis = uCenter.indexOf(direction);
        let rotation = null;

        if (axis === 2) {
            rotation = direction === 0 ? "x" : "x'";
        } else if (axis === 0) {
            rotation = direction === 0 ? "z" : "z'";
        } else if (axis === 1) {
            rotation = direction === 0 ? "z2" : null;
        }

        if (rotation) {
            this.doMove(rotation);
            rotations.push(rotation);
        }

        const fCenter = this.findPiece("F");
        const fDirection = Math.max(...fCenter.filter(v => v !== 1));
        const fAxis = fCenter.indexOf(fDirection);

        if (fAxis === 2) {
            rotation = fDirection === 0 ? null : "y2";
        } else if (fAxis === 0) {
            rotation = fDirection === 2 ? "y" : "y'";
        }

        if (rotation) {
            this.doMove(rotation);
            rotations.push(rotation);
        }

        this.tracing.rotation = rotations;
    }

    coordsFromName(name) {
        const coords = [1, 1, 1];
        for (const side of name) {
            if (side === "F") coords[2] = 0;
            else if (side === "B") coords[2] = 2;
            else if (side === "U") coords[1] = 2;
            else if (side === "D") coords[1] = 0;
            else if (side === "R") coords[0] = 2;
            else if (side === "L") coords[0] = 0;
        }
        return coords;
    }

    whereTo(a) {
        const axis = DLIN_FACES[a[0]].axis;
        const piece = this.coordsFromName(a);
        const [x, y, z] = piece;
        return this.cube[x][y][z].getName(axis);
    }

    setBuffer(target) {
        this.buffer = target;
    }

    traceFromTarget(target, targets = null) {
        targets = targets || [];
        const to = this.whereTo(target);
        const toSet = new Set(to);
        const bufferSet = new Set(this.buffer);
        if (this._setsEqual(toSet, bufferSet)) {
            return targets.length > 0 ? targets : null;
        } else {
            targets.push(to);
            this.traceFromTarget(to, targets);
        }
        return targets;
    }

    absoluteTarget(target) {
        return new Set(target);
    }

    findFlips() {
        const flips = [];
        for (const piece of this.loopcube) {
            const [x, y, z] = piece;
            if (x !== 1 && y !== 1 && z !== 1) continue; // Must have a 1
            if (![x, y, z].includes(1)) continue;

            const name = new DlinPiece(x, y, z).getName();
            const toName = this.cube[x][y][z].getName();
            if (this._setsEqual(new Set(name), new Set(toName)) && name !== toName) {
                flips.push(name);
            }
        }
        return flips;
    }

    findTwists() {
        const twists = [];
        for (const piece of this.loopcube) {
            const [x, y, z] = piece;
            // Must NOT have a 1 (corner piece)
            if (x === 1 || y === 1 || z === 1) continue;

            const name = new DlinPiece(x, y, z).getName();
            const toName = this.cube[x][y][z].getName();
            if (this._setsEqual(new Set(name), new Set(toName)) && name !== toName) {
                const absTarget = new Set(name);
                const fromSticker = name[0];
                const toSticker = toName[0];
                let ori;

                if (["R", "L"].includes(toSticker) && ["U", "D"].includes(fromSticker)) {
                    ori = 1;
                } else if (["F", "B"].includes(toSticker) && ["U", "D"].includes(fromSticker)) {
                    ori = -1;
                } else if (["U", "D"].includes(toSticker) && ["F", "B"].includes(fromSticker)) {
                    ori = 1;
                } else if (["R", "L"].includes(toSticker) && ["F", "B"].includes(fromSticker)) {
                    ori = -1;
                } else if (["U", "D"].includes(toSticker) && ["R", "L"].includes(fromSticker)) {
                    ori = 1;
                } else if (["F", "B"].includes(toSticker) && ["R", "L"].includes(fromSticker)) {
                    ori = -1;
                }

                const specialCorners = [
                    new Set(["U", "F", "R"]),
                    new Set(["U", "B", "L"]),
                    new Set(["D", "B", "R"]),
                    new Set(["D", "F", "L"])
                ];
                if (specialCorners.some(s => this._setsEqual(s, absTarget))) {
                    ori = -ori;
                }

                twists.push({location: name, orientation: ori});
            }
        }
        return twists;
    }

    edgeCycleOri(targets) {
        return this.whereTo(targets[targets.length - 1]) === this.buffer ? 0 : 1;
    }

    cornerCycleOri(targets) {
        const lastTarget = this.whereTo(targets[targets.length - 1]);
        const absTarget = new Set(lastTarget);
        const lastSticker = lastTarget[0];
        const bufferSticker = this.buffer[0];

        if (lastTarget === this.buffer) {
            return 0;
        }

        let ori;
        if (["R", "L"].includes(lastSticker) && ["U", "D"].includes(bufferSticker)) {
            ori = 1;
        } else if (["F", "B"].includes(lastSticker) && ["U", "D"].includes(bufferSticker)) {
            ori = -1;
        } else if (["U", "D"].includes(lastSticker) && ["F", "B"].includes(bufferSticker)) {
            ori = 1;
        } else if (["R", "L"].includes(lastSticker) && ["F", "B"].includes(bufferSticker)) {
            ori = -1;
        } else if (["U", "D"].includes(lastSticker) && ["R", "L"].includes(bufferSticker)) {
            ori = 1;
        } else if (["F", "B"].includes(lastSticker) && ["R", "L"].includes(bufferSticker)) {
            ori = -1;
        }

        const specialCorners = [
            new Set(["U", "F", "R"]),
            new Set(["U", "B", "L"]),
            new Set(["D", "B", "R"]),
            new Set(["D", "F", "L"])
        ];
        if (specialCorners.some(s => this._setsEqual(s, absTarget))) {
            ori = -ori;
        }

        return ori;
    }

    cycleParity(targets) {
        return targets.length % 2 === 1 ? 1 : 0;
    }

    traceAll(piecetype, buffers) {
        const solved = [];
        for (const buffer of buffers) {
            const bufferAbs = this.absoluteTarget(buffer);
            if (solved.some(s => this._setsEqual(this.absoluteTarget(s), bufferAbs))) {
                continue;
            }
            this.setBuffer(buffer);
            const targets = this.traceFromTarget(buffer);
            if (targets) {
                for (const target of targets) {
                    solved.push(target);
                }
                const parity = this.cycleParity(targets);
                const ori = piecetype === "edge" ? this.edgeCycleOri(targets) : this.cornerCycleOri(targets);
                this.tracing[piecetype].push({
                    type: "cycle",
                    buffer: buffer,
                    targets: targets,
                    orientation: ori,
                    parity: parity
                });
            }
        }

        if (piecetype === "edge") {
            const flips = this.findFlips();
            for (const flip of flips) {
                this.tracing.edge.push({
                    type: "misoriented",
                    buffer: flip,
                    targets: [],
                    orientation: 1,
                    parity: 0
                });
            }
        } else if (piecetype === "corner") {
            const twists = this.findTwists();
            for (const twist of twists) {
                this.tracing.corner.push({
                    type: "misoriented",
                    buffer: twist.location,
                    targets: [],
                    orientation: twist.orientation,
                    parity: 0
                });
            }
        }
    }

    modifyBufferOrder(edgebuffers, cornerbuffers) {
        this.buffers.edge = edgebuffers;
        this.buffers.corner = cornerbuffers;
    }

    manualSwap(e1, e2) {
        // CURRENTLY ONLY SUPPORTS PSEUDOSWAPS PRESERVING F/B EO
        const coords1 = this.coordsFromName(e1);
        const coords2 = this.coordsFromName(e2);
        const [x1, y1, z1] = coords1;
        const [x2, y2, z2] = coords2;

        const slice1 = this.cube[x1][y1][z1].sides.indexOf('');
        const slice2 = this.cube[x2][y2][z2].sides.indexOf('');

        const nonSlice1 = [0, 1, 2].filter(i => i !== slice1).sort();
        const nonSlice2 = [0, 1, 2].filter(i => i !== slice2).sort();

        let piece1 = this.cube[x1][y1][z1].sides.filter(f => f);
        let piece2 = this.cube[x2][y2][z2].sides.filter(f => f);

        // idk why you have to do this but it works
        const sortedSlices = [slice1, slice2].sort();
        if ((sortedSlices[0] === 0 && sortedSlices[1] === 1) ||
            (sortedSlices[0] === 0 && sortedSlices[1] === 2)) {
            piece2 = [...piece2].reverse();
            piece1 = [...piece1].reverse();
        }

        this.cube[x1][y1][z1].sides[nonSlice1[0]] = piece2[0];
        this.cube[x1][y1][z1].sides[nonSlice1[1]] = piece2[1];
        this.cube[x2][y2][z2].sides[nonSlice2[0]] = piece1[0];
        this.cube[x2][y2][z2].sides[nonSlice2[1]] = piece1[1];
    }

    sortTracing() {
        this.tracing.edge.sort((a, b) =>
            this.buffers.edge.indexOf(a.buffer) - this.buffers.edge.indexOf(b.buffer)
        );
        this.tracing.corner.sort((a, b) =>
            this.buffers.corner.indexOf(a.buffer) - this.buffers.corner.indexOf(b.buffer)
        );
    }

    traceCube() {
        this.tracing = {edge: [], corner: [], scramble: this.scramble};
        this.rotateIntoOrientation();
        if (this.traceCorners) {
            this.traceAll("corner", this.buffers.corner);
        }
        if (this.traceEdges) {
            this.traceAll("edge", this.buffers.edge);
        }
        this.sortTracing();
    }
}

// Exports for Node.js / CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BUFFERS, DlinPiece, DLIN_FACES, DlinCube, Tracer };
}

// Expose to window so ES modules (the React app) can reach these. Classic
// <script>-tag classes/consts don't auto-attach to the global object.
if (typeof window !== 'undefined') {
    window.BUFFERS = BUFFERS;
    window.DlinPiece = DlinPiece;
    window.DLIN_FACES = DLIN_FACES;
    window.DlinCube = DlinCube;
    window.Tracer = Tracer;
}
