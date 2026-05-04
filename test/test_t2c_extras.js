// Corner 2-Swap (T2C) extras count smoke test.
//   - 0 / 2 / 4: simple single-cycle path (new)
//   - 6: legacy cycle-split path
// All values must keep corner perm parity = odd (1 swap from the 2-Swap
// itself; extras are even so they don't flip parity).

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
const CORNER_BUFFER = 'UFR';
const EDGE_BUFFER = 'UF';

function baseConfig() {
    return {
        cornerBufferOrder: [...DEFAULT_CORNER_BUFFER_ORDER],
        edgeBufferOrder: [...DEFAULT_EDGE_BUFFER_ORDER],
        cornerBuffer: CORNER_BUFFER,
        edgeBuffer: EDGE_BUFFER,
        holdingOrientation: 'wg',
        cornerScrambleType: 'Solved',
        edgeScrambleType: 'Solved',
        cornerRandomParity: 'any',
        edgeRandomParity: 'any',
        cornerTargetCount: 8,
        parityTargets: getTargetsExcludingBuffer(CORNER_BUFFER),
        cornerTwistCount: 2,
        cornerTwistExtraCount: 0,
        cornerTwistDirection: 'mixed',
        cornerTwistTargets: getUDStickerTargets(CORNER_BUFFER),
        twoSwapMode: 'unoriented',
        t2cFirstPieces: [...DEFAULT_CORNER_BUFFER_ORDER].slice(1, -1),
        t2cOnlyLaterBuffers: false,
        t2cExtraCount: 6,
        edgeTargetCount: 12,
        floatingTargetCount: 4, floatingBuffers: [],
        floatingDistribution: 'equal',
        floatingCornerTargetCount: 4, floatingCornerBuffers: [],
        floatingCornerDistribution: 'equal',
        edgeParityTargets: getEdgeParityTargets(EDGE_BUFFER),
        flipExtraCount: 0,
        flipCustomCount: 2,
        flipTargets: getFlipTargets(EDGE_BUFFER),
        flipParityTargets: getFlipParityTargets(EDGE_BUFFER),
        edgeTwoSwapMode: 'unoriented',
        f2eFirstPieces: [...F2E_FIRST_PIECES],
        f2eOnlyLaterBuffers: false,
        f2eExtraCount: 6,
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

function main() {
    const { generateScramble } = loadGen();
    const cornerOrder = [...DEFAULT_CORNER_BUFFER_ORDER];
    const edgeOrder = [...DEFAULT_EDGE_BUFFER_ORDER];

    let totalPass = 0, totalFail = 0;

    // Pair T2C with edge=Solved so the only edge moves come from T2C's
    // own UF↔UR setup swaps. T2C alone contributes ODD parity on each
    // side, so a solvable scramble has corner perm parity = edge perm
    // parity = 1 (odd).
    for (const extras of [0, 2, 4, 6]) {
        let pass = 0, fail = 0;
        const samples = [];
        for (let i = 0; i < K; i++) {
            const config = baseConfig();
            config.cornerScrambleType = '2-Swap';
            config.t2cExtraCount = extras;
            config.edgeScrambleType = 'Solved';

            const scramble = generateScramble({ config });
            const tracing = trace(scramble, cornerOrder, edgeOrder);
            const cParity = permParity(tracing.corner);
            const eParity = permParity(tracing.edge);
            const failures = [];
            if (cParity !== eParity) failures.push(`corner parity ${cParity} != edge parity ${eParity} (cube unsolvable)`);
            if (cParity !== 1) failures.push(`corner perm parity ${cParity}, expected 1 (odd) — T2C contributes 1 swap`);
            if (failures.length === 0) pass += 1;
            else {
                fail += 1;
                if (samples.length < 2) samples.push({ scramble, tracing, failures });
            }
        }
        const status = fail === 0 ? 'PASS' : 'FAIL';
        console.log(`[${status}] T2C extras=${extras}  ${pass}/${K}`);
        for (const s of samples) {
            console.log(`  scramble: ${s.scramble}`);
            for (const f of s.failures) console.log(`    - ${f}`);
            console.log(`    tracing: ${JSON.stringify(s.tracing)}`);
        }
        totalPass += pass; totalFail += fail;
    }

    console.log(`\n=== TOTAL ${totalPass} pass, ${totalFail} fail ===`);
    if (totalFail > 0) process.exitCode = 1;
}

main();
