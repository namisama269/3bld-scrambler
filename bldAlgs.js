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

const J_PERM = "R U R' F' R U R' U' R' F R2 U' R' U'";

const UFR_TWISTS = {
    "LUB": "R' D R D' R' D R U2 R' D' R D R' D' R U2",
    "LUF": "U' R' D R D' R' D R U R' D' R D R' D' R",
    "LDB": "U' R D' R' U R U' R' U R D R' U' R U R'",
    "LDF": "U' D R' D' R U R' D R D' R' D R U' R' D' R U",
    "FUL": "R' D R D' R' D R U' R' D' R D R' D' R U",
    "FDL": "U' R' D R U R' D' R D R' D' R U' R' D R U D'",
    "FDR": "U R' D' R U' R' D R D' R' D R U R' D' R U' D",
    "RUB": "U R' D R D' R' D R U' R' D' R D R' D' R",
    "RDF": "U D' R' D R U' R' D' R D R' D' R U R' D R U'",
    "RDB": "R U' R' U R D R' U' R U R' U' R D' R' U",
    "BUL": "U2 R' D R D' R' D R U2 R' D' R D R' D' R",
    "BUR": "R' D R D' R' D R U R' D' R D R' D' R U'",
    "BDL": "R U' R' U R D' R' U' R U R' U' R D R' U",
    "BDR": "U' R D R' U R U' R' U R D' R' U' R U R'",
};

const UF_FLIPS = {
    "UB": "U' S R' F' R S' R' F R U' M' U2 M",
    "UL": "L E2 L2 E L U L' E' L2 E2 L' U'",
    "UR": "R' E2 R2 E' R' U' R E R2 E2 R U",
    "LU": "L E2 L2 E L U L' E' L2 E2 L' U'",
    "LB": "R E' R' U' R E R2 E2 R U R' E2 R",
    "LF": "R' E R U' R' E' R2 E2 R' U R E2 R'",
    "LD": "U' L E L' U2 L E' L' S' L2 S L2 U'",
    "FL": "R' E R U' R' E' R2 E2 R' U R E2 R'",
    "FR": "L E' L' U L E L2 E2 L U' L' E2 L",
    "FD": "R' F R S R' F2 R2 E R2 E' R S' R' F R",
    "RU": "R' E2 R2 E' R' U' R E R2 E2 R U",
    "RF": "L E' L' U L E L2 E2 L U' L' E2 L",
    "RB": "L' E L U L' E' L2 E2 L' U' L E2 L'",
    "RD": "U R' E' R U2 R' E R S R2 S' R2 U",
    "BU": "U' S R' F' R S' R' F R U' M' U2 M",
    "BL": "R E' R' U' R E R2 E2 R U R' E2 R",
    "BR": "L' E L U L' E' L2 E2 L' U' L E2 L'",
    "BD": "U2 M U' S R' F' R S' R' F R U' M'",
    "DB": "U2 M U' S R' F' R S' R' F R U' M'",
    "DL": "U' L E L' U2 L E' L' S' L2 S L2 U'",
    "DR": "U R' E' R U2 R' E R S R2 S' R2 U",
    "DF": "R' F R S R' F2 R2 E R2 E' R S' R' F R",
}

function generate3BLDEdge3CycleAlg(buffer, target1, target2) {
    // if FU is used, flip cycle to use UF
    if (buffer === "FU" || target1 === "FU" || target2 === "FU") {
        buffer = flipEdgeTarget(buffer);
        target1 = flipEdgeTarget(target1);
        target2 = flipEdgeTarget(target2);
    }

    // shift UF to buffer if it is not already
    if (target1 == "UF") {
        target1 = target2;
        target2 = buffer;
        buffer = "UF";
    }

    if (target2 == "UF") {
        target2 = target1;
        target1 = buffer;
        buffer = "UF";
    }

    // return single cycle if buffer is UF
    if (buffer == "UF") {
        return COMMS["UF"][target1][target2];
    }

    // return UF-sandwiched floating comm
    let comm1 = COMMS["UF"][buffer][target1];
    let comm2 = COMMS["UF"][target2][buffer];
    return comm1 + " " + comm2;
}

function generate3BLDCorner3CycleAlg(buffer, target1, target2) {
    // if FUR or RUF is used, twist cycle to use UFR
    if (buffer === "FUR" || target1 === "FUR" || target2 === "FUR") {
        buffer = twistCornerTarget(buffer, 1);
        target1 = twistCornerTarget(target1, 1);
        target2 = twistCornerTarget(target2, 1);
    }

    if (buffer === "RUF" || target1 === "RUF" || target2 === "RUF") {
        buffer = twistCornerTarget(buffer, 2);
        target1 = twistCornerTarget(target1, 2);
        target2 = twistCornerTarget(target2, 2);
    }

    // shift UFR to buffer if it is not already
    if (target1 == "UFR") {
        target1 = target2;
        target2 = buffer;
        buffer = "UFR";
    }

    if (target2 == "UFR") {
        target2 = target1;
        target1 = buffer;
        buffer = "UFR";
    }

    // console.log(`${buffer} ${target1} ${target2}`);

    // return single cycle if buffer is UFR
    if (buffer == "UFR") {
        return COMMS["UFR"][target1][target2];
    }

    // return UFR-sandwiched floating comm
    let comm1 = COMMS["UFR"][buffer][target1];
    let comm2 = COMMS["UFR"][target2][buffer];
    return comm1 + " " + comm2;
}

function generateEOAlg(edges) {
    // assert: edges is array of strings of length 2 and are valid edge targets
    let alg = "";

    edges.forEach(edge => {
        alg += " ";
        alg += UF_FLIPS[edge];
    });

    return alg;
}

function generateCOAlg(corners) {
    // assert: corners is array of strings of length 3 and are valid corner targets
    let alg = "";

    corners.forEach(corner => {
        alg += " ";
        alg += UFR_TWISTS[corner];
    });

    return alg;
}

function generateParityAlg(edge1, edge2, corner1, corner2) {
    // assert:
    let alg = "";

    // set up edges to UF/UR swapped and corners to UFR/UBR swapped then do J perm

    // if UR piece is used, flip orientation to UR and make it edge1
    if (edge1 === "RU" || edge2 === "RU") {
        edge1 = flipEdgeTarget(edge1);
        edge2 = flipEdgeTarget(edge2);
    }

    if (edge2 === "UR") {
        [edge1, edge2] = [edge2, edge1];
    }

    if (edge1 === "UR") {
        // UF/RU swap
        if (edge2 === "FU") {
            alg += UF_FLIPS["UR"];
        }
        // UF/UR swap, add moves to avoid starting alg with space
        else if (edge2 === "UF") {
            alg += "U U'";
        }
        // swap UR/x outside of UF change to UF UR x
        else {
            alg += COMMS["UF"]["UR"][edge2];
        }
        // console.log(alg);
    }
    // UF piece and another piece other than UR is used
    else if (edge1 === "FU" || edge2 === "FU") {
        edge1 = flipEdgeTarget(edge1);
        edge2 = flipEdgeTarget(edge2);
    }
    else if (edge2 === "UF") {
        [edge1, edge2] = [edge2, edge1];
    }
    // swap UF-x change to UF x UR
    else if (edge1 === "UF") {
        alg += COMMS["UF"][edge2]["UR"];
    }
    // general case: 2e2e
    else {
        alg += COMMS["UF"][edge1][edge2];
        alg += " ";
        alg += COMMS["UF"][edge1]["UR"];
    }

    alg += " ";

    // UFR piece is used
    if (corner1 === "FUR" || corner2 === "FUR") {
        corner1 = twistCornerTarget(corner1, 1);
        corner2 = twistCornerTarget(corner2, 1);
    }

    if (corner1 === "RUF" || corner2 === "RUF") {
        corner1 = twistCornerTarget(corner1, 2);
        corner2 = twistCornerTarget(corner2, 2);
    }

    if (corner2 === "UFR") {
        [corner1, corner2] = [corner2, corner1];
    }

    if (corner1 === "UFR") {
        // UFR/UBR not swapped already
        if (corner2 !== "UBR") {
            alg += COMMS["UFR"][corner2]["UBR"];
        }
        
        alg += " " + J_PERM;
        // console.log(alg);
        return alg;
    }

    // UBR and piece other than UFR is used
    if (corner2 === "UBR" || corner2 === "RUB" || corner2 === "BUR") {
        [corner1, corner2] = [corner2, corner1];
        // console.log(`${corner1} ${corner2}`);
    }

    // if UBR piece is involved, do a comm and fix CO with a UFR twist alg
    if (corner1 === "UBR" || corner1 === "RUB" || corner1 === "BUR") {
        alg += COMMS["UFR"][corner1][corner2];
        if (corner1 !== "UBR") {
            alg += " ";
            alg += UFR_TWISTS[corner1];
        }
        // console.log(`${corner1} ${corner2}`);
    }
    // general case: 2e2e
    else {
        alg += COMMS["UFR"][corner1][corner2];
        alg += " ";
        alg += COMMS["UFR"][corner1]["UBR"];
    }

    alg += " " + J_PERM;

    // console.log(alg);

    return alg;
}

function doEdgeComm() {
    let inputText = document.getElementById('edgeMemo').value;
    let targets = inputText.split(" ");
    let buffer = targets[0];
    let target1 = targets[1];
    let target2 = targets[2];
    cube.move(generate3BLDEdge3CycleAlg(buffer, target1, target2));
    vc.cubeString = cube.asString();
    vc.drawCube(ctx);
}

function doCornerComm() {
    let inputText = document.getElementById('cornerMemo').value;
    let targets = inputText.split(" ");
    let buffer = targets[0];
    let target1 = targets[1];
    let target2 = targets[2];
    cube.move(generate3BLDCorner3CycleAlg(buffer, target1, target2));
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
