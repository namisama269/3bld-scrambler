Cube.initSolver();
const cube = new Cube();
const canvas = document.getElementById('cubeCanvas');
const ctx = canvas.getContext('2d');

// const cornerLabels = ["Solved", "Comms", "Parity", "UFR 2T", "Floating 2T", "UFR 3T", "LTCT", "T2C", "Floating 2C"];
// const edgeLabels = ["Solved", "Comms", "UF 2F", "Floating 2F", "LTEF", "F2E", "Floating 2E"];

let vc = new VisualCube(1200, 1200, 360, -0.523598, -0.209439, 0, 3, 0.08);
// vc.drawInside = true;

const holdingOrientation = document.getElementById('holdingOrientation');

let debugString = "";

document.addEventListener("DOMContentLoaded", function() {
    const savedValue = localStorage.getItem('holdingOrientation');
    if (savedValue !== null) {
        holdingOrientation.value = savedValue;
    }
    holdingOrientation.addEventListener('input', function() {
        localStorage.setItem('holdingOrientation', holdingOrientation.value);
    });

    cube.move(holdingOrientation.value);
    vc.cubeString = cube.asString();
    vc.drawCube(ctx);
});

function handleCheckboxToggle() {
    const useRestrictedMemo = isRestrictedMemoChecked();
    // console.log('Restricted Memo Toggled:', useRestrictedMemo);
    if (useRestrictedMemo) {
        restrictedMemoStickerIndices.forEach((index) => { 
        vc.cubeString = setCharAt(vc.cubeString, index, 'r');
        });
        // vc.cubeString = "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr";
    } else {
        vc.cubeString = cube.asString();
    }
    // console.log(vc.cubeString);
    vc.drawCube(ctx);
}


function resetCube() {
    cube.identity();
    vc.cubeString = cube.asString();
    vc.drawCube(ctx);
}

// generate scramble

function generateScramble() {
    console.log("Generating scramble");
    cube.identity();
    debugString = "";
    debugText.classList.add('hidden');

    const cornerSelected = [];
    const cornerCheckboxes = document.getElementById("cornerCheckboxes").querySelectorAll('input[type="checkbox"]');;
    cornerCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            cornerSelected.push(checkbox.value);
        }
    });

    const edgeSelected = [];
    const edgeCheckboxes = document.getElementById("edgeCheckboxes").querySelectorAll('input[type="checkbox"]');;
    edgeCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            edgeSelected.push(checkbox.value);
        }
    });

    let cornerScrambleType = cornerSelected.length ? cornerSelected[Math.floor(Math.random() * cornerSelected.length)]: "Solved";
    let edgeScrambleType = edgeSelected.length ? edgeSelected[Math.floor(Math.random() * edgeSelected.length)]: "Solved";
    console.log("Corner scramble type: " + cornerScrambleType);
    debugString += "Corner scramble type: " + cornerScrambleType + "\n";
    console.log("Edge scramble type: " + edgeScrambleType);
    debugString += "Edge scramble type: " + edgeScrambleType + "\n";

    let cornerPieces = [1,2,3,4,5,6,7];
    let edgePieces = [1,2,3,4,5,6,7,8,9,10,11];

    let solveCornerIfOdd = false;
    let solveEdgeIfOdd = false;

    if (cornerScrambleType == "Solved") {
        cornerPieces = [];
    }
    else if (cornerScrambleType == "Parity") {
        let parityI = Math.floor(Math.random() * cornerPieces.length);
        let parityPiece = CORNERS[cornerPieces[parityI]];
        let parityTarget = parityPiece[Math.floor(Math.random() * parityPiece.length)];
        cornerPieces.splice(parityI, 1);

        cube.move(generateParityAlg("UF", "UR", "UFR", parityTarget));
        console.log("Corner parity: " + parityTarget);
        debugString += "Corner parity: " + parityTarget + "\n";
    }
    else if (cornerScrambleType == "UFR 2T") {
        let twistI = Math.floor(Math.random() * cornerPieces.length);
        let twistPiece = CORNERS[cornerPieces[twistI]];
        let ori = Math.floor(Math.random() * 2) + 1; // random int 1 or 2
        let twist = twistPiece[ori];
        cornerPieces.splice(twistI, 1);

        cube.move(invertMoves(generateCOAlg([twist])));
        console.log("UFR 2-twist: " + twist);
        debugString += "UFR 2-twist: " + twist + "\n";
    }
    else if (cornerScrambleType == "Floating 2T") {
        let shuffledCornerPieces = shuffleArray(cornerPieces);
        let ori1 = Math.floor(Math.random() * 2) + 1; // random int 1 or 2
        let ori2 = 3 - ori1; // other direction
        let twist1 = CORNERS[shuffledCornerPieces[0]][ori1];
        let twist2 = CORNERS[shuffledCornerPieces[1]][ori2];
        cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0] && x != shuffledCornerPieces[1]);

        cube.move(invertMoves(generateCOAlg([twist1])));
        cube.move(invertMoves(generateCOAlg([twist2])));
        console.log("Floating 2-twist: " + twist1 + " " + twist2);
        debugString += "Floating 2-twist: " + twist1 + " " + twist2 + "\n";
    }
    else if (cornerScrambleType == "UFR 3T") {
        let shuffledCornerPieces = shuffleArray(cornerPieces);
        let ori = Math.floor(Math.random() * 2) + 1; // random int 1 or 2
        let twist1 = CORNERS[shuffledCornerPieces[0]][ori];
        let twist2 = CORNERS[shuffledCornerPieces[1]][ori];
        cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0] && x != shuffledCornerPieces[1]);

        cube.move(invertMoves(generateCOAlg([twist1])));
        cube.move(invertMoves(generateCOAlg([twist2])));
        console.log("UFR 3-twist: " + twist1 + " " + twist2);
        debugString += "UFR 3-twist: " + twist1 + " " + twist2 + "\n";
    }
    else if (cornerScrambleType == "LTCT") {
        let shuffledCornerPieces = shuffleArray(cornerPieces);
        let parityOri = Math.floor(Math.random() * 3); // random int 0, 1 or 2
        let twistOri = Math.floor(Math.random() * 2) + 1; // random int 1 or 2
        let parity = CORNERS[shuffledCornerPieces[0]][parityOri];
        let twist = CORNERS[shuffledCornerPieces[1]][twistOri];
        cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0] && x != shuffledCornerPieces[1]);

        cube.move(invertMoves(generateCOAlg([twist])));
        cube.move(generateParityAlg("UF", "UR", "UFR", parity));
        console.log("LTCT: " + parity + "[" + twist + "]");
        debugString += "LTCT: " + parity + "[" + twist + "]" + "\n";
    }
    else if (cornerScrambleType == "T2C") {
        let shuffledCornerPieces = shuffleArray(cornerPieces);
        let piece1 = CORNERS[shuffledCornerPieces[0]];
        let piece2 = CORNERS[shuffledCornerPieces[1]];
        let i1 = Math.floor(Math.random() * 2) + 1; // random int 1 or 2
        let i2 = Math.floor(Math.random() * 3); // random int 0, 1 or 2
        let t1 = piece1[0];
        let t2 = piece2[i2];
        let t3 = piece1[i1]
        cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0] && x != shuffledCornerPieces[1]);

        cube.move(generateParityAlg("UF", "UR", "UFR", t3));
        cube.move(generate3BLDCorner3CycleAlg("UFR", t2, t1));
        console.log("T2C: " + t1 + " " + t2 + " " + t3);
        debugString += "T2C: " + t1 + " " + t2 + " " + t3 + "\n";
    }
    else if (cornerScrambleType == "Floating 2C") {
        let shuffledCornerPieces = shuffleArray(cornerPieces);
        let piece1 = CORNERS[shuffledCornerPieces[0]];
        let piece2 = CORNERS[shuffledCornerPieces[1]];
        let i2 = Math.floor(Math.random() * 3); // random int 0, 1 or 2
        let t1 = piece1[0];
        let t2 = piece2[i2];
        cornerPieces = cornerPieces.filter(x => x != shuffledCornerPieces[0] && x != shuffledCornerPieces[1]);

        cube.move(generateParityAlg("UF", "UR", "UFR", t1));
        cube.move(generate3BLDCorner3CycleAlg("UFR", t2, t1));
        console.log("Floating 2C: " + t1 + " " + t2);
        debugString += "Floating 2C: " + t1 + " " + t2 + "\n";
    }

    let cornerComms = generateCommTargets(cornerPieces, "c", solveCornerIfOdd);
    console.log("Corner comms: " + (cornerComms.length ? cornerComms.join(" ") : "None") + " (" + cornerComms.length + ")");
    debugString += "Corner comms: " + (cornerComms.length ? cornerComms.join(" ") : "None") + " (" + cornerComms.length + ")" + "\n";
    for (let i = cornerComms.length - 1; i > 0; i -= 2) {
        cube.move(generate3BLDCorner3CycleAlg("UFR", cornerComms[i], cornerComms[i-1]));
    }

    if (edgeScrambleType == "Solved") {
        edgePieces = [];
    }
    else if (edgeScrambleType == "UF 2F") {
        let flipI = Math.floor(Math.random() * edgePieces.length);
        let flipPiece = EDGES[edgePieces[flipI]];
        let flip = flipPiece[0];
        edgePieces.splice(flipI, 1);

        cube.move(generateEOAlg([flip]));
        console.log("UF 2-flip: " + flip);
        debugString += "UF 2-flip: " + flip + "\n";
    }
    else if (edgeScrambleType == "Floating 2F") {
        let shuffledEdgePieces = shuffleArray(edgePieces);
        let piece1 = EDGES[shuffledEdgePieces[0]];
        let piece2 = EDGES[shuffledEdgePieces[1]];
        let flip1 = piece1[0];
        let flip2 = piece2[0];
        edgePieces = edgePieces.filter(x => x != shuffledEdgePieces[0] && x != shuffledEdgePieces[1]);

        cube.move(generateEOAlg([flip1]));
        cube.move(generateEOAlg([flip2]));
        console.log("Floating 2-flip: " + flip1 + " " + flip2);
        debugString += "Floating 2-flip: " + flip1 + " " + flip2 + "\n";
    }
    else if (edgeScrambleType == "LTEF") {
        // do not include comms from UR
        edgePieces.splice(1, 1);
        let shuffledEdgePieces = shuffleArray(edgePieces);
        let piece1 = EDGES[shuffledEdgePieces[0]];
        let piece2 = EDGES[shuffledEdgePieces[1]];
        let ori = Math.floor(Math.random() * 2); // random int 0 or 1
        let lt = piece1[ori];
        let ef = piece2[0];
        let ef_ = piece2[1];
        edgePieces = edgePieces.filter(x => x != shuffledEdgePieces[0] && x != shuffledEdgePieces[1]);

        cube.move(generate3BLDEdge3CycleAlg("UF", "UR", ef));
        cube.move(generate3BLDEdge3CycleAlg("UF", ef_, lt));
        console.log("LTEF: " + lt + "[" + ef + "]");
        debugString += "LTEF: " + lt + "[" + ef + "]" + "\n";
    }
    else if (edgeScrambleType == "F2E") {
        // do not include comms from UR
        edgePieces.splice(1, 1);
        let shuffledEdgePieces = shuffleArray(edgePieces);
        let piece1 = EDGES[shuffledEdgePieces[0]];
        let piece2 = EDGES[shuffledEdgePieces[1]];
        let t1 = piece1[0];
        let ori = Math.floor(Math.random() * 2); // random int 0 or 1
        let t2 = piece2[ori];
        let t3 = piece1[1];
        edgePieces = edgePieces.filter(x => x != shuffledEdgePieces[0] && x != shuffledEdgePieces[1]);

        cube.move(generate3BLDEdge3CycleAlg("UF", "UR", t3));
        cube.move(generate3BLDEdge3CycleAlg("UF", t2, t1));
        console.log("F2E: " + t1 + " " + t2 + " " + t3);
        debugString += "F2E: " + t1 + " " + t2 + " " + t3 + "\n";
    }
    else if (edgeScrambleType == "Floating 2E") {
        // do not include comms from UR
        edgePieces.splice(1, 1);
        let shuffledEdgePieces = shuffleArray(edgePieces);
        let piece1 = EDGES[shuffledEdgePieces[0]];
        let piece2 = EDGES[shuffledEdgePieces[1]];
        let t1 = piece1[0];
        let ori = Math.floor(Math.random() * 2); // random int 0 or 1
        let t2 = piece2[ori];
        edgePieces = edgePieces.filter(x => x != shuffledEdgePieces[0] && x != shuffledEdgePieces[1]);

        cube.move(generate3BLDEdge3CycleAlg("UF", "UR", t1));
        cube.move(generate3BLDEdge3CycleAlg("UF", t2, t1));
        console.log("Floating 2E: " + t1 + " " + t2);
        debugString += "Floating 2E: " + t1 + " " + t2 + "\n";
    }

    let edgeComms = generateCommTargets(edgePieces, "e", solveEdgeIfOdd);
    console.log("Edge comms: " + (edgeComms.length ? edgeComms.join(" ") : "None") + " (" + edgeComms.length + ")");
    debugString += "Edge comms: " + (edgeComms.length ? edgeComms.join(" ") : "None") + " (" + edgeComms.length + ")" + "\n";
    for (let i = edgeComms.length - 1; i > 0; i -= 2) {
        cube.move(generate3BLDEdge3CycleAlg("UF", edgeComms[i], edgeComms[i-1]));
    }

    // get the scramble and do in correct orientation
    let scramble = invertMoves(cube.solve());
    cube.identity();
    cube.move(holdingOrientation.value);
    cube.move(scramble);

    const scrambleText = document.getElementById('scramble');
    scrambleText.textContent = scramble;
    scrambleText.classList.remove('hidden');
    console.log("Scramble: " + scramble);

    vc.cubeString = cube.asString();
    vc.drawCube(ctx);
}

function debug() {
    const debugText = document.getElementById('debugText');
    debugText.textContent = debugString;
    debugText.classList.remove('hidden');
    console.log("Debug on")
}