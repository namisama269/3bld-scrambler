// End-to-end Flips-mode contract test for edges.
//
// Side under test = edges 'Flips', corners 'Solved'. Per-run assertions:
//   - getMisoriented(edge cycles) filtered to exclude main buffer UF has length === N
//   - tracing.edge has no cycles in pure-flip (extras=0) runs
//   - tracing.corner fully empty (no cycles, no twists) in pure-flip runs
//
// Buffer behavior: each generateEOAlg call flips the target + toggles the
// buffer. Even N → buffer ends solved, odd N → buffer ends flipped. Same
// "ignore main-buffer misoriented" filter as the Targets/Twist tests handles
// that uniformly across N.

import { loadGen } from './loadGen.js';
import { Tracer } from './loadDlin.js';
import { getMisoriented } from './dlinHelpers.js';
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

function checkPureFlip({ N, tracing, allowedTargets }) {
    const failures = [];
    const corner = tracing.corner;
    const edge = tracing.edge;

    const miso = getMisoriented(edge).filter((m) => m.piece !== EDGE_BUFFER);
    if (miso.length !== N) {
        failures.push(`misoriented count ${miso.length}, expected ${N} (got: ${JSON.stringify(miso)})`);
    }

    const cycles = edge.filter((c) => c.type === 'cycle');
    if (cycles.length !== 0) failures.push(`unexpected edge cycles: ${cycles.length}`);

    if (corner.length !== 0) {
        failures.push(`corner not empty: ${corner.length} entries`);
    }

    if (allowedTargets && miso.length > 0) {
        const allowedSet = new Set(allowedTargets);
        const offenders = miso.map((m) => m.piece).filter((p) => !allowedSet.has(p));
        if (offenders.length > 0) {
            failures.push(`miso pieces outside allowed set: ${JSON.stringify(offenders)}`);
        }
    }

    return failures;
}

function runScenario({ label, configMutator, checkFn, gen, cornerOrder, edgeOrder, K: localK = K, maxFailureSamples = 3 }) {
    let pass = 0;
    let fail = 0;
    const samples = [];
    for (let i = 0; i < localK; i++) {
        const config = baseConfig();
        configMutator(config);
        const scramble = gen({ config });
        const tracing = traceScramble(scramble, cornerOrder, edgeOrder);
        const failures = checkFn(tracing);
        if (failures.length === 0) pass += 1;
        else {
            fail += 1;
            if (samples.length < maxFailureSamples) samples.push({ scramble, tracing, failures });
        }
    }
    const status = fail === 0 ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${label}  ${pass}/${localK}`);
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

    console.log('--- A. Pure Flips sweep (extraCount=0) ---');
    for (let N = 1; N <= 10; N++) {
        const r = runScenario({
            label: `edges Flips N=${N}`,
            configMutator: (c) => {
                c.edgeScrambleType = 'Flips';
                c.cornerScrambleType = 'Solved';
                c.flipCustomCount = N;
                c.flipExtraCount = 0;
            },
            checkFn: (tracing) => checkPureFlip({ N, tracing }),
            gen: generateScramble,
            cornerOrder,
            edgeOrder,
        });
        totalPass += r.pass;
        totalFail += r.fail;
    }

    console.log('\n--- C. Flip target restriction ---');
    {
        const r = runScenario({
            label: `edges Flips N=2 targets=[UB,UL]`,
            configMutator: (c) => {
                c.edgeScrambleType = 'Flips';
                c.cornerScrambleType = 'Solved';
                c.flipCustomCount = 2;
                c.flipExtraCount = 0;
                c.flipTargets = ['UB', 'UL'];
            },
            checkFn: (tracing) => checkPureFlip({ N: 2, tracing, allowedTargets: ['UB', 'UL'] }),
            gen: generateScramble,
            cornerOrder,
            edgeOrder,
        });
        totalPass += r.pass;
        totalFail += r.fail;
    }
    {
        const r = runScenario({
            label: `edges Flips N=1 targets=[UB]`,
            configMutator: (c) => {
                c.edgeScrambleType = 'Flips';
                c.cornerScrambleType = 'Solved';
                c.flipCustomCount = 1;
                c.flipExtraCount = 0;
                c.flipTargets = ['UB'];
            },
            checkFn: (tracing) => checkPureFlip({ N: 1, tracing, allowedTargets: ['UB'] }),
            gen: generateScramble,
            cornerOrder,
            edgeOrder,
        });
        totalPass += r.pass;
        totalFail += r.fail;
    }

    console.log('\n--- D. With extras (loose: miso filtered to non-buffer must be ≥ N) ---');
    const extrasSamples = [
        { N: 1, ext: 2 }, { N: 1, ext: 4 }, { N: 1, ext: 6 },
        { N: 3, ext: 2 }, { N: 3, ext: 4 },
        { N: 5, ext: 2 }, { N: 5, ext: 4 },
        { N: 1, ext: 1 }, { N: 1, ext: 3 }, { N: 3, ext: 1 },
    ];
    for (const { N, ext } of extrasSamples) {
        const r = runScenario({
            label: `edges Flips N=${N} extras=${ext}`,
            configMutator: (c) => {
                c.edgeScrambleType = 'Flips';
                c.cornerScrambleType = 'Solved';
                c.flipCustomCount = N;
                c.flipExtraCount = ext;
            },
            checkFn: (tracing) => {
                const failures = [];
                const miso = getMisoriented(tracing.edge).filter((m) => m.piece !== EDGE_BUFFER);
                if (miso.length < N) failures.push(`miso ${miso.length} < N=${N}`);
                return failures;
            },
            gen: generateScramble,
            cornerOrder,
            edgeOrder,
            maxFailureSamples: 1,
        });
        totalPass += r.pass;
        totalFail += r.fail;
    }

    console.log(`\n=== TOTAL ${totalPass} pass, ${totalFail} fail ===`);
    if (totalFail > 0) process.exitCode = 1;
}

main();
