// Both-Floating-odd correction test. When corner and edge sides both run a
// Floating chain with odd N, each chain leaks a stray Jb-half (UF↔UR on
// edges from corner side, UFR↔UBR on corners from edge side). Together
// those two leftovers form one Jb perm. The engine appends Jb_PERM at the
// end of construction to cancel them.
//
// What this test checks:
//   1. The intended (N+1)-cycle exists on each side.
//   2. NO stray UFR↔UBR cycle on corners (the edge side's leftover got cancelled).
//   3. NO stray UF↔UR cycle on edges (the corner side's leftover got cancelled).
//   4. Cube is solvable (corner parity == edge parity).

import { loadGen } from './loadGen.js';
import { Tracer } from './loadDlin.js';
import {
    DEFAULT_CORNER_BUFFER_ORDER,
    DEFAULT_EDGE_BUFFER_ORDER,
    F2E_FIRST_PIECES,
    getTargetsExcludingBuffer,
    getEdgeParityTargets,
    getFlipTargets,
    getFlipParityTargets,
    getUDStickerTargets,
} from '../src/constants.js';

const K = 50;

function baseConfig() {
    return {
        cornerBufferOrder: [...DEFAULT_CORNER_BUFFER_ORDER],
        edgeBufferOrder: [...DEFAULT_EDGE_BUFFER_ORDER],
        cornerBuffer: 'UFR', edgeBuffer: 'UF',
        holdingOrientation: 'wg',
        cornerScrambleType: 'Solved', edgeScrambleType: 'Solved',
        cornerRandomParity: 'any', edgeRandomParity: 'any',
        cornerTargetCount: 8,
        parityTargets: getTargetsExcludingBuffer('UFR'),
        cornerTwistCount: 2, cornerTwistExtraCount: 0, cornerTwistDirection: 'mixed',
        cornerTwistTargets: getUDStickerTargets('UFR'),
        twoSwapMode: 'unoriented',
        t2cFirstPieces: [...DEFAULT_CORNER_BUFFER_ORDER].slice(1, -1),
        t2cOnlyLaterBuffers: false, t2cExtraCount: 6,
        edgeTargetCount: 12,
        floatingTargetCount: 4, floatingBuffers: [], floatingDistribution: 'equal',
        floatingCornerTargetCount: 4, floatingCornerBuffers: [], floatingCornerDistribution: 'equal',
        edgeParityTargets: getEdgeParityTargets('UF'),
        flipExtraCount: 0, flipCustomCount: 2,
        flipTargets: getFlipTargets('UF'), flipParityTargets: getFlipParityTargets('UF'),
        edgeTwoSwapMode: 'unoriented',
        f2eFirstPieces: [...F2E_FIRST_PIECES], f2eOnlyLaterBuffers: false, f2eExtraCount: 6,
    };
}

function trace(scramble, cornerOrder, edgeOrder) {
    const tracer = new Tracer({ corner: cornerOrder, edge: edgeOrder }, 'both');
    tracer.scrambleFromString(scramble);
    tracer.traceCube();
    return tracer.tracing;
}

function permParity(cycles) {
    let total = 0;
    for (const c of cycles) {
        if (c.type === 'cycle') total += c.targets.length;
    }
    return total % 2;
}

// Detect the stray "Jb leftover" cycles in either side's trace. UFR↔UBR on
// corners, UF↔UR on edges — both are 2-cycles between the active buffer
// and a specific neighbour, indicating the leftover wasn't cancelled.
function hasStrayBufferUbrSwap(tracing) {
    return tracing.corner.some((c) =>
        c.type === 'cycle'
        && c.buffer === 'UFR'
        && c.targets.length === 1
        && (c.targets[0] === 'UBR' || c.targets[0] === 'BUR' || c.targets[0] === 'RUB'),
    );
}
function hasStrayBufferUrSwap(tracing) {
    return tracing.edge.some((c) =>
        c.type === 'cycle'
        && c.buffer === 'UF'
        && c.targets.length === 1
        && (c.targets[0] === 'UR' || c.targets[0] === 'RU'),
    );
}

function main() {
    const { generateScramble } = loadGen();
    const cornerOrder = [...DEFAULT_CORNER_BUFFER_ORDER];
    const edgeOrder = [...DEFAULT_EDGE_BUFFER_ORDER];

    const scenarios = [
        // Each pairs corner-Floating-odd-N with edge-Floating-odd-N.
        { label: 'corner UBR N=1 + edge UR N=1', cornerBuf: 'UBR', cornerN: 1, edgeBuf: 'UR', edgeN: 1 },
        { label: 'corner UFL N=3 + edge UB N=3', cornerBuf: 'UFL', cornerN: 3, edgeBuf: 'UB', edgeN: 3 },
        { label: 'corner UBL N=1 + edge UL N=5', cornerBuf: 'UBL', cornerN: 1, edgeBuf: 'UL', edgeN: 5 },
        // Sanity: even+even should also stay clean (no Jb appended).
        { label: 'corner UFL N=2 + edge UR N=2', cornerBuf: 'UFL', cornerN: 2, edgeBuf: 'UR', edgeN: 2 },
    ];

    let totalPass = 0, totalFail = 0;

    for (const s of scenarios) {
        let pass = 0, fail = 0;
        const samples = [];
        for (let i = 0; i < K; i++) {
            const cfg = baseConfig();
            cfg.cornerScrambleType = 'Floating';
            cfg.floatingCornerBuffers = [s.cornerBuf];
            cfg.floatingCornerTargetCount = s.cornerN;
            cfg.edgeScrambleType = 'Floating';
            cfg.floatingBuffers = [s.edgeBuf];
            cfg.floatingTargetCount = s.edgeN;

            const scramble = generateScramble({ config: cfg });
            const tracing = trace(scramble, cornerOrder, edgeOrder);
            const cParity = permParity(tracing.corner);
            const eParity = permParity(tracing.edge);
            const failures = [];
            if (cParity !== eParity) {
                failures.push(`unsolvable: corner parity ${cParity} != edge parity ${eParity}`);
            }
            if (hasStrayBufferUbrSwap(tracing)) {
                failures.push(`stray UFR↔UBR cycle on corners (Jb leftover not cancelled)`);
            }
            if (hasStrayBufferUrSwap(tracing)) {
                failures.push(`stray UF↔UR cycle on edges (Jb leftover not cancelled)`);
            }
            if (failures.length === 0) pass += 1;
            else {
                fail += 1;
                if (samples.length < 2) samples.push({ scramble, tracing, failures });
            }
        }
        const status = fail === 0 ? 'PASS' : 'FAIL';
        console.log(`[${status}] ${s.label}  ${pass}/${K}`);
        for (const sm of samples) {
            console.log(`  scramble: ${sm.scramble}`);
            for (const f of sm.failures) console.log(`    - ${f}`);
        }
        totalPass += pass;
        totalFail += fail;
    }

    console.log(`\n=== TOTAL ${totalPass} pass, ${totalFail} fail ===`);
    if (totalFail > 0) process.exitCode = 1;
}

main();
