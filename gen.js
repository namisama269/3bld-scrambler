const CORNERS = [
    ["UFR", "RUF", "FUR"],
    ["UFL", "FUL", "LUF"],
    ["UBR", "BUR", "RUB"],
    ["UBL", "LUB", "BUL"],
    ["DFR", "FDR", "RDF"],
    ["DFL", "LDF", "FDL"],
    ["DBR", "RDB", "BDR"],
    ["DBL", "BDL", "LDB"],
]

const EDGES = [
    ["UF", "FU"],
    ["UB", "BU"],
    ["UR", "RU"],
    ["UL", "LU"],
    ["FR", "RF"],
    ["FL", "LF"],
    ["DF", "FD"],
    ["DB", "BD"],
    ["DR", "RD"],
    ["DL", "LD"],
    ["BR", "RB"],
    ["BL", "LB"],
]

function getPiece(target) {
    if (target.length == 3) {
        for (let i = 0; i < CORNERS.length; ++i) {
            if (CORNERS[i].includes(target)) {
                return CORNERS[i];
            }
        }
    }
    else {
        for (let i = 0; i < EDGES.length; ++i) {
            if (EDGES[i].includes(target)) {
                return EDGES[i];
            }
        }
    }

    return [];
}

function generateCommTargets(indices, type, solvePieceIfOdd) {
    let targets = [];
    let numOrientations = type == "c" ? 3 : 2;

    indices = shuffleArray(indices);
    for (let i = 0; i < indices.length; ++i) {
        let ori = Math.floor(Math.random() * numOrientations);
        if (type == "c") {
            targets.push(CORNERS[indices[i]][ori]);
        }
        else {
            targets.push(EDGES[indices[i]][ori]);
        }
    }

    if (targets.length % 2 == 1) {
        // 20% chance to fix odd number of targets by solving a piece instead of cycle breaking
        let solvePiece = Math.floor(Math.random() * 5);

        if (solvePieceIfOdd || solvePiece == 2) {
            const removeI = Math.floor(Math.random() * targets.length);
            targets.splice(removeI, 1);
        }
        else {
            let breakI = Math.floor(Math.random() * (targets.length - 2));
            let oris = getPiece(targets[breakI]);

            let newOris = [];
            for (let i = 0; i < oris.length; ++i) {
                if (oris[i] != targets[breakI]) {
                    newOris.push(oris[i]);
                }
            }

            let breakJ = Math.floor(Math.random() * newOris.length);
            targets.push(newOris[breakJ]);
        }
    }

    return targets;
}
