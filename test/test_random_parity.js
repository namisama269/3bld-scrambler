// Smoke test for the cornerRandomParity / edgeRandomParity setting on the
// Random scramble type. Generates K scrambles per (side, parity) and uses
// dlin's tracer to check that the resulting permutation parity on that side
// matches the requested 'even' or 'odd'.

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
        edgeTargetCount: 12,
        floatingTargetCount: 4,
        floatingBuffers: [],
        floatingDistribution: 'equal',
        floatingCornerTargetCount: 4,
        floatingCornerBuffers: [],
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

// Permutation parity from a dlin trace. Each cycle entry's targets.length is
// the number of transpositions that cycle contributes (an (N+1)-cycle = N
// transpositions, and a 2-swap appears as targets.length=1 with parity=1).
// Misoriented entries are pure in-place orientation, no permutation.
function parityFromTrace(cycles) {
    let total = 0;
    for (const c of cycles) {
        if (c.type === 'cycle') total += c.targets.length;
    }
    return total % 2;
}

function traceScramble(scramble, cornerOrder, edgeOrder) {
    const tracer = new Tracer({ corner: cornerOrder, edge: edgeOrder }, 'both');
    tracer.scrambleFromString(scramble);
    tracer.traceCube();
    return tracer.tracing;
}

function runScenario({ label, side, parity, configMutator, gen, cornerOrder, edgeOrder }) {
    const want = parity === 'odd' ? 1 : 0;
    let pass = 0;
    let fail = 0;
    const samples = [];
    for (let i = 0; i < K; i++) {
        const config = baseConfig();
        configMutator(config);
        const scramble = gen({ config });
        const tracing = traceScramble(scramble, cornerOrder, edgeOrder);
        const got = parityFromTrace(tracing[side]);
        if (got === want) pass += 1;
        else {
            fail += 1;
            if (samples.length < 3) samples.push({ scramble, tracing, got });
        }
    }
    const status = fail === 0 ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${label}  ${pass}/${K}`);
    for (const s of samples) {
        console.log(`  scramble: ${s.scramble}  got parity=${s.got}, want=${want}`);
    }
    return { pass, fail };
}

function main() {
    const { generateScramble } = loadGen();
    const cornerOrder = [...DEFAULT_CORNER_BUFFER_ORDER];
    const edgeOrder = [...DEFAULT_EDGE_BUFFER_ORDER];

    let totalPass = 0;
    let totalFail = 0;

    for (const parity of ['even', 'odd']) {
        const r = runScenario({
            label: `corners Random parity=${parity}`,
            side: 'corner',
            parity,
            configMutator: (c) => {
                c.cornerScrambleType = 'Random';
                c.edgeScrambleType = 'Solved';
                c.cornerRandomParity = parity;
            },
            gen: generateScramble, cornerOrder, edgeOrder,
        });
        totalPass += r.pass; totalFail += r.fail;
    }

    for (const parity of ['even', 'odd']) {
        const r = runScenario({
            label: `edges   Random parity=${parity}`,
            side: 'edge',
            parity,
            configMutator: (c) => {
                c.cornerScrambleType = 'Solved';
                c.edgeScrambleType = 'Random';
                c.edgeRandomParity = parity;
            },
            gen: generateScramble, cornerOrder, edgeOrder,
        });
        totalPass += r.pass; totalFail += r.fail;
    }

    console.log(`\n=== TOTAL ${totalPass} pass, ${totalFail} fail ===`);
    if (totalFail > 0) process.exitCode = 1;
}

main();
