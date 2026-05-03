// Tool for procedurally generating BLD algs using only UF/UFR comms

function flipEdgeTarget(target) {
    // assert: target.length = 2, valid edge target
    return target[1] + target[0];
}

const CORNER_ORIENTATIONS = [
    ["UBL", "LUB", "BUL"],
    ["UBR", "BUR", "RUB"],
    ["UFL", "FUL", "LUF"],
    ["UFR", "RUF", "FUR"],
    ["DBL", "BDL", "LDB"],
    ["DBR", "RDB", "BDR"],
    ["DFL", "LDF", "FDL"],
    ["DFR", "FDR", "RDF"]
];

function twistCornerTarget(target, times) {
    // assert: target.length = 3, valid corner target

    let piece = -1, orientation = -1;

    for (let i = 0; i < 8; ++i) {
        for (let j = 0; j < 3; ++j) {
            if (CORNER_ORIENTATIONS[i][j] == target) {
                piece = i;
                orientation = j;
                break;
            }
        }
    }

    return CORNER_ORIENTATIONS[piece][(orientation+times)%3];
}

function getEdgeParityAlg(buffer, target) {
    let alg = null;
    if (buffer === "UF" || buffer === "FU") {
        alg = PARITY_UF_X_UFR_UBR[target];
    } else if (buffer === "UR" || buffer === "RU") {
        alg = PARITY_UR_X_UFR_UBR[target];
    }
    if (!alg) {
        console.error("getEdgeParityAlg: No alg found for buffer=" + buffer + ", target=" + target);
    }
    return alg || "";
}

function generateEOAlg(edges, buffer = "UF") {
    let alg = "";

    edges.forEach(edge => {
        const piece = EDGES.find(p => p.includes(edge));
        alg += " " + getEdgeParityAlg(buffer, piece[0]);
        alg += " " + getEdgeParityAlg(buffer, piece[1]);
    });

    return alg;
}

function generateCOAlg(corners) {
    let alg = "";

    corners.forEach(corner => {
        const piece = CORNERS.find(p => p.includes(corner));
        const udTarget = piece[0];
        alg += " " + PARITY_UF_UR_UFR_X[corner];
        alg += " " + PARITY_UF_UR_UFR_X[udTarget];
    });

    return alg;
}

function generateParityAlg(_edge1, _edge2, _corner1, corner2) {
    return PARITY_UF_UR_UFR_X[corner2];
}

function doEdgeComm() {
    let inputText = document.getElementById('edgeMemo').value;
    let targets = inputText.split(" ");
    let target1 = targets[1];
    let target2 = targets[2];
    cube.move(PARITY_UF_X_UFR_UBR[target1]);
    cube.move(PARITY_UF_X_UFR_UBR[target2]);
    vc.cubeString = cube.asString();
    vc.drawCube(ctx);
}

function doCornerComm() {
    let inputText = document.getElementById('cornerMemo').value;
    let targets = inputText.split(" ");
    let target1 = targets[1];
    let target2 = targets[2];
    cube.move(PARITY_UF_UR_UFR_X[target1]);
    cube.move(PARITY_UF_UR_UFR_X[target2]);
    vc.cubeString = cube.asString();
    vc.drawCube(ctx);
}

function doEO() {
    let inputText = document.getElementById('EOMemo').value;
    let edges = inputText.split(" ");
    cube.move(generateEOAlg(edges));
    vc.cubeString = cube.asString();
    vc.drawCube(ctx);
}

function doCO() {
    let inputText = document.getElementById('COMemo').value;
    let corners = inputText.split(" ");
    cube.move(generateCOAlg(corners));
    vc.cubeString = cube.asString();
    vc.drawCube(ctx);
}

function doParity() {
    let inputText = document.getElementById('parityMemo').value;
    let targets = inputText.split(" ");
    let edge1 = targets[0];
    let edge2 = targets[1];
    let corner1 = targets[2];
    let corner2 = targets[3];
    cube.move(generateParityAlg(edge1, edge2, corner1, corner2));
    vc.cubeString = cube.asString();
    vc.drawCube(ctx);
}

function getScramble() {
    console.log("Scramble/Solution:")
    console.log(invertMoves(cube.solve()));
    console.log(cube.solve());
}

function getMovesFromComm() {
    let inputText = document.getElementById('commtomoves').value;
    let moves = commToMoves(inputText);
    console.log(alg.cube.simplify(moves));
}

const PARITY_UR_X_UFR_UBR = {
    "UB": "R2 D' R2 U R D R' D' R U' R' U R' U' D",
    "DL": "R2 S' R' U R' U' R' F R2 U' R' U' R U R' F' S",
    "DB": "r M' U R' F' R U R' U' R' F R2 U' R' U' M2",
    "DF": "U M' U2 M U R U R' U' R' F R2 U' R' U' R U R' F'",
    "UL": "R U R' U' R' F R2 U' R' U' R U R' F'",
    "LB": "R' U R U' R D B D' R' f' U f R'",
    "LF": "R U' R' U R' D' F' D R F R' F' R",
    "LD": "D r U R' F' R U R' U' R' F R2 U' R' U' M D'",
    "FU": "R D F' D' F' R2 F R2 F R2 D F D' R",
    "FL": "R2 F' R F R U' R2 F R F R' F' R U R",
    "FR": "R' U' R D' R' U D R2 D' R' D R'",
    "FD": "r U R' F' R U R' U' R' F R2 U' R' U' M",
    "RB": "U' R' U2 R U2 R' U' R U' R' U R f R f'",
    "RF": "U R F R2 F' U F2 U' F R F U' R' D R2 D'",
    "UF": "R U R' F' R U R' U' R' F R2 U' R' U'",
    "RD": "D' r U R' F' R U R' U' R' F R2 U' R' U' M D",
    "BL": "R' B R2 B' R2 U2 B' U2 F R2 F' R'",
    "BR": "R U R' D R U' D' R2 D R D' R",
    "BD": "R' F R F' R U2 r' U r U2 R'",
    "DR": "S' R U R' U' R' F R2 U' R' U' R U R' F' S",
    "BU": "R M U R' F' R U R' U' R' F R2 U' R' U' M'",
    "LU": "R' U R U2 R' U' F U R U' R' F' U2 R U",
};

const PARITY_UF_X_UFR_UBR = {
    "UB": "S R' F R f' R' F R2 U R' U' R' F' R2 U R'",
    "DL": "S2 R2 D' R' D R' f2 R D' R' F2",
    "DB": "D' R' U' R U' R2 D R' U R U' D' R2 U2 R D",
    "DF": "D R' U' R2 U R U' D' R2 U R U' R2 D R U R D'",
    "UL": "U' R' U2 R' D' R U' R' D R U R U' R' U' R",
    "LB": "R u R' F' R U R' U' R' F R2 U' R' U' R E R'",
    "LF": "R' E R U' R' E' R U R U R' F' R U R' U' R' F R2 U' R' U'",
    "LD": "U D F2 R U' R' F R U R' F U' F D'",
    "FL": "r U R' U' r' F R U2 R U' R' U' R U' R' F'",
    "FR": "R2 U' R U D' R U R' D R U2 R U",
    "FD": "U F2 R U' R' F R U R' F U' F",
    "RB": "R2 D' F R U R' F U' F U F2 D R U' R",
    "RF": "R F' U' F' R2 F R2 U R2 F' R F R F R' F",
    "RD": "S' R U R' F' R U R' U' R' F R2 U' R' U' S",
    "BL": "B' R2 U' F R' F' U2 R B U' B' R2 B R U' R'",
    "BR": "R' U2 R' F R2 U' R' U' R U R' F' R U R' U R",
    "BD": "U' D' R' U D R' U' R D' R U F R' F' D",
    "UR": "R U R' F' R U R' U' R' F R2 U' R' U'",
    "RU": "R D F' D' F' R2 F R2 F R2 D F D' R",
    "DR": "R' U' R U' R2 D R' U R U' D' R2 U2 R",
    "BU": "R U2 R' U2 R' F R U R U2 R' U' R U R' F'",
    "LU": "S R U R' F' R U R' U' R' F R2 U' R' U' S'",
};

// Jb perm: UF UR UFL UBR parity = PARITY_UF_UR_UFR_X["UBR"]
const Jb_PERM = "R U R' F' R U R' U' R' F R2 U' R' U'";

// UF UR flip: flips both UF and UR edges
const UF_UR_FLIP = "R' E2 R2 E' R' U' R E R2 E2 R U";

const PARITY_UF_UR_UFR_X = {
    "UBL": "R D' R2 U2 R U' R' F2 U' F2 R U' R2 D R2",
    "DBR": "U R2 U' R U R' F' R U R' U' R' F R2 U' R U'",
    "DBL": "U D' R F' R' U R U F U' F' U' F R' U2 D",
    "DFR": "U D R2 U' R2 U R2 D' R2 U R2 U' R2 U2",
    "UBR": "R U R' F' R U R' U' R' F R2 U' R' U'",
    "LUF": "R' U' R2 U R' D R U' D' R2 D R U D' R",
    "LDB": "R U D' R' F' R U R' U' R' F R2 U' R' U' R D R'",
    "LDF": "U D R U' R U R' F' R U R' U' R' F R2 U' R2 U' D'",
    "FUL": "D R D' R2 U F2 U' F2 R2 D R' D' R U' R' U R'",
    "FDL": "U2 D R' F R2 U' R' U' R U R' F' R U R' U D'",
    "FDR": "U R U' R U R' F' R U R' U' R' F R2 U' R2 U'",
    "RDF": "U2 R' F R2 U' R' U' R U R' F' R U R' U",
    "RUB": "R U R' U R U2 R2 F' R U R' U' R' F R2 U' R' U2 R",
    "UFL": "U' D R2 D' R2 U R D R' D' R U' R' U R'",
    "RDB": "R U D R' F' R U R' U' R' F R2 U' R' U' R D' R'",
    "BUR": "U' R' U2 R U R2 F R U R U' R' F' R U'",
    "BDL": "U' R' D' R U R' U' D R D' R D R' U R' D' R D R",
    "BDR": "U2 D' R' F R2 U' R' U' R U R' F' R U R' U D",
    "DFL": "U R2 D R U' R2 D' R2 U D R U R U' R' U2 R' D' R",
    "BUL": "U R' D R2 U' R' U R2 D' R2 U R U' R' U2",
    "LUB": "U R' U' R U R' F' R U R' U' R' F R2 U2",
};
