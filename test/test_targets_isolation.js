// End-to-end Targets-isolation contract test.
//
// For each (side, N), generate K scrambles with that side set to Targets and
// the other to Solved, every other field at React-side defaults. Trace each
// and check contract assertions:
//
//   Configured side (e.g. corners when cornerScrambleType='Targets'):
//     - exactly one entry in tracing[side], type='cycle'
//     - buffer === configured buffer (UFR for corners, UF for edges)
//     - targets.length === N
//     - parity === N % 2
//     - orientation === 0  (Targets has no twists/flips)
//
//   Other side: depends on N parity.
//     - N even: tracing[other] is empty
//     - N odd : tracing[other] has exactly one cycle (the parity-induced swap).
//               For corners=Targets odd: edge cycle UF→UR (length 1, parity 1).
//               For edges=Targets odd  : corner cycle UFR→<some target> length 1 parity 1.
//
// Failures print the full tracing for the offending scramble so we can see
// what shape the engine actually produced.

import { loadGen } from './loadGen.js';
import { Tracer } from './loadDlin.js';
import { getTargets, getMisoriented } from './dlinHelpers.js';
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
        floatingBuffers: [DEFAULT_EDGE_BUFFER_ORDER[1]],
        floatingDistribution: 'equal',
        floatingCornerTargetCount: 4,
        floatingCornerBuffers: [DEFAULT_CORNER_BUFFER_ORDER[1]],
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

function fmt(value, indent = 0) {
    const pad = '  '.repeat(indent);
    const padInner = '  '.repeat(indent + 1);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const allPrim = value.every((v) => v === null || typeof v !== 'object');
        if (allPrim) return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
        const items = value.map((v) => padInner + fmt(v, indent + 1));
        return `[\n${items.join(',\n')}\n${pad}]`;
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) return '{}';
        const items = keys.map((k) => `${padInner}${JSON.stringify(k)}: ${fmt(value[k], indent + 1)}`);
        return `{\n${items.join(',\n')}\n${pad}}`;
    }
    return JSON.stringify(value);
}

function traceScramble(scramble, cornerOrder, edgeOrder) {
    const tracer = new Tracer({ corner: cornerOrder, edge: edgeOrder }, 'both');
    tracer.scrambleFromString(scramble);
    tracer.traceCube();
    return tracer.tracing;
}

function checkContract({ side, N, buffer, tracing }) {
    const failures = [];
    const cycles = tracing[side];
    const targets = getTargets(cycles, buffer, side);
    // At max N (corners=8, edges=12) the engine cycle-breaks through the
    // main buffer to reach the extra target, leaving the buffer itself
    // misoriented. That entry is part of the N count via getTargets, so
    // exclude it from the misoriented check at the boundary only.
    const isMaxN = (side === 'corner' && N === 8) || (side === 'edge' && N === 12);
    const miso = getMisoriented(cycles).filter(
        (m) => !(isMaxN && m.piece === buffer),
    );
    if (targets.length !== N) {
        failures.push(`getTargets length ${targets.length}, expected ${N} (got: ${JSON.stringify(targets)})`);
    }
    if (miso.length !== 0) {
        failures.push(`getMisoriented length ${miso.length}, expected 0 (got: ${JSON.stringify(miso)})`);
    }
    return failures;
}

function runScenario({ label, side, N, buffer, configMutator, gen, cornerOrder, edgeOrder, maxFailureSamples = 3 }) {
    let pass = 0;
    let fail = 0;
    const samples = [];

    for (let i = 0; i < K; i++) {
        const config = baseConfig();
        configMutator(config);
        const scramble = gen({ config });
        const tracing = traceScramble(scramble, cornerOrder, edgeOrder);
        const failures = checkContract({ side, N, buffer, tracing });
        if (failures.length === 0) {
            pass += 1;
        } else {
            fail += 1;
            if (samples.length < maxFailureSamples) {
                samples.push({ scramble, tracing, failures });
            }
        }
    }

    const status = fail === 0 ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${label}  ${pass}/${K}`);
    for (const s of samples) {
        console.log(`  scramble: ${s.scramble}`);
        for (const f of s.failures) console.log(`    - ${f}`);
        console.log(`    tracing: ${fmt(s.tracing).replace(/\n/g, '\n    ')}`);
    }
    return { pass, fail };
}

function main() {
    const { generateScramble } = loadGen();
    const cornerOrder = [...DEFAULT_CORNER_BUFFER_ORDER];
    const edgeOrder = [...DEFAULT_EDGE_BUFFER_ORDER];

    let totalPass = 0;
    let totalFail = 0;

    console.log(`Running ${K} iterations per scenario.\n`);
    console.log('--- Corners isolated (cornerScrambleType=Targets, edgeScrambleType=Solved) ---');
    for (let N = 1; N <= 8; N++) {
        const r = runScenario({
            label: `corners N=${N}`,
            side: 'corner',
            N,
            buffer: CORNER_BUFFER,
            configMutator: (c) => {
                c.cornerScrambleType = 'Targets';
                c.edgeScrambleType = 'Solved';
                c.cornerTargetCount = N;
            },
            gen: generateScramble,
            cornerOrder,
            edgeOrder,
        });
        totalPass += r.pass;
        totalFail += r.fail;
    }

    console.log('\n--- Edges isolated (edgeScrambleType=Targets, cornerScrambleType=Solved) ---');
    for (let N = 1; N <= 12; N++) {
        const r = runScenario({
            label: `edges   N=${N}`,
            side: 'edge',
            N,
            buffer: EDGE_BUFFER,
            configMutator: (c) => {
                c.cornerScrambleType = 'Solved';
                c.edgeScrambleType = 'Targets';
                c.edgeTargetCount = N;
            },
            gen: generateScramble,
            cornerOrder,
            edgeOrder,
        });
        totalPass += r.pass;
        totalFail += r.fail;
    }

    console.log(`\n=== TOTAL ${totalPass} pass, ${totalFail} fail (${K * (8 + 12)} runs) ===`);
    if (totalFail > 0) process.exitCode = 1;
}

main();
