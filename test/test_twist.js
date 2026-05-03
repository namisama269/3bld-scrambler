// End-to-end Twist-mode contract test for corners.
//
// Side under test = corners 'Twist', edges 'Solved'. Per-run assertions:
//   - getMisoriented(corner cycles) filtered to exclude main buffer UFR has length === N
//   - tracing.corner has no cycles in pure-twist (extras=0) runs
//   - tracing.edge fully empty (no cycles, no flips) in pure-twist runs
//   - direction shape: 'same' → all N share same physical direction;
//     'mixed' → both directions present
//
// Physical direction conversion: dlin reports orientation in {-1, 0, +1} but
// flips the sign for the four special corners (UFR/UBL/DBR/DFL). Convert via
//     physicalDir(piece, ori) = isSpecialCorner(piece) ? -ori : ori
// so 'same' / 'mixed' can be checked uniformly across the cube.

import { loadGen } from './loadGen.js';
import { Tracer } from './loadDlin.js';
import { getMisoriented, getTargets, isSpecialCorner } from './dlinHelpers.js';
import {
    DEFAULT_CORNER_BUFFER_ORDER,
    DEFAULT_EDGE_BUFFER_ORDER,
    T2C_FIRST_PIECES,
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
        paritySpecialTargets: [],
        cornerTwistCount: 2,
        cornerTwistExtraCount: 0,
        cornerTwistDirection: 'mixed',
        cornerTwistTargets: getUDStickerTargets(CORNER_BUFFER),
        ltctMode: 'pieces',
        ltctCount: 7,
        ltctParityTargets: [],
        ltctTwistTargets: [],
        ltct2ParityTargets: [],
        ltct2TwistTargets: [],
        twoSwapMode: 'unoriented',
        t2cFirstPieces: [...T2C_FIRST_PIECES],
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

// For in-place twists dlin's findTwists reports an ori value that's already
// uniform across all 8 corners — engine ori 1 maps to dlin ori -1 everywhere,
// engine ori 2 maps to dlin ori +1 everywhere. The special-corner sign flip
// exists in dlin's logic for cycle-closing labels (cornerCycleOri), not for
// in-place twist direction. So 'same'/'mixed' can compare m.orientation
// directly without conversion.
function physicalDir(piece, ori) {
    return ori;
}

function checkPureTwist({ N, direction, tracing, allowedTargets }) {
    const failures = [];
    const corner = tracing.corner;
    const edge = tracing.edge;

    const miso = getMisoriented(corner).filter((m) => m.piece !== CORNER_BUFFER);
    if (miso.length !== N) {
        failures.push(`misoriented count ${miso.length}, expected ${N} (got: ${JSON.stringify(miso)})`);
    }

    const cycles = corner.filter((c) => c.type === 'cycle');
    if (cycles.length !== 0) failures.push(`unexpected corner cycles: ${cycles.length}`);

    if (edge.length !== 0) {
        failures.push(`edge not empty: ${edge.length} entries`);
    }

    if (allowedTargets && miso.length > 0) {
        const allowedSet = new Set(allowedTargets);
        const offenders = miso.map((m) => m.piece).filter((p) => !allowedSet.has(p));
        if (offenders.length > 0) {
            failures.push(`miso pieces outside allowed set: ${JSON.stringify(offenders)}`);
        }
    }

    if (miso.length >= 2 && (direction === 'same' || direction === 'mixed')) {
        const dirs = miso.map((m) => physicalDir(m.piece, m.orientation));
        if (direction === 'same') {
            const uniq = new Set(dirs);
            if (uniq.size !== 1) {
                failures.push(`'same' direction violated: physicalDirs=${JSON.stringify(dirs)} pieces=${JSON.stringify(miso.map((m) => m.piece))}`);
            }
        } else {
            // mixed
            if (!dirs.includes(1) || !dirs.includes(-1)) {
                failures.push(`'mixed' direction violated (need both signs): physicalDirs=${JSON.stringify(dirs)} pieces=${JSON.stringify(miso.map((m) => m.piece))}`);
            }
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

function runDistributionTwist({ label, N, K: localK, configMutator, gen, cornerOrder, edgeOrder }) {
    // For 'mixed' direction sanity: count occurrences of all-CW, all-CCW,
    // and mixed-pattern outcomes across runs.
    let allPos = 0, allNeg = 0, mixed = 0, other = 0;
    for (let i = 0; i < localK; i++) {
        const config = baseConfig();
        configMutator(config);
        const scramble = gen({ config });
        const tracing = traceScramble(scramble, cornerOrder, edgeOrder);
        const miso = getMisoriented(tracing.corner).filter((m) => m.piece !== CORNER_BUFFER);
        if (miso.length !== N) { other += 1; continue; }
        const dirs = miso.map((m) => physicalDir(m.piece, m.orientation));
        const hasPos = dirs.includes(1);
        const hasNeg = dirs.includes(-1);
        if (hasPos && hasNeg) mixed += 1;
        else if (hasPos) allPos += 1;
        else allNeg += 1;
    }
    console.log(`[INFO] ${label}  allCW=${allPos}, allCCW=${allNeg}, mixed=${mixed}, other=${other} (of ${localK})`);
}

function main() {
    const { generateScramble } = loadGen();
    const cornerOrder = [...DEFAULT_CORNER_BUFFER_ORDER];
    const edgeOrder = [...DEFAULT_EDGE_BUFFER_ORDER];

    let totalPass = 0;
    let totalFail = 0;

    console.log('--- A. Pure Twist sweep (extraCount=0) ---');
    for (let N = 1; N <= 7; N++) {
        const directions = N === 1 ? ['random'] : ['same', 'mixed'];
        for (const direction of directions) {
            const r = runScenario({
                label: `corners Twist N=${N} dir=${direction}`,
                configMutator: (c) => {
                    c.cornerScrambleType = 'Twist';
                    c.edgeScrambleType = 'Solved';
                    c.cornerTwistCount = N;
                    c.cornerTwistExtraCount = 0;
                    c.cornerTwistDirection = direction === 'random' ? 'mixed' : direction;
                },
                checkFn: (tracing) => checkPureTwist({ N, direction, tracing }),
                gen: generateScramble,
                cornerOrder,
                edgeOrder,
            });
            totalPass += r.pass;
            totalFail += r.fail;
        }
    }

    console.log('\n--- C. Twist target restriction ---');
    {
        const r = runScenario({
            label: `corners Twist N=2 targets=[UFL,UBR]`,
            configMutator: (c) => {
                c.cornerScrambleType = 'Twist';
                c.edgeScrambleType = 'Solved';
                c.cornerTwistCount = 2;
                c.cornerTwistExtraCount = 0;
                c.cornerTwistDirection = 'mixed';
                c.cornerTwistTargets = ['UFL', 'UBR'];
            },
            checkFn: (tracing) => checkPureTwist({ N: 2, direction: 'mixed', tracing, allowedTargets: ['UFL', 'UBR'] }),
            gen: generateScramble,
            cornerOrder,
            edgeOrder,
        });
        totalPass += r.pass;
        totalFail += r.fail;
    }
    {
        const r = runScenario({
            label: `corners Twist N=1 targets=[UFL]`,
            configMutator: (c) => {
                c.cornerScrambleType = 'Twist';
                c.edgeScrambleType = 'Solved';
                c.cornerTwistCount = 1;
                c.cornerTwistExtraCount = 0;
                c.cornerTwistDirection = 'mixed';
                c.cornerTwistTargets = ['UFL'];
            },
            checkFn: (tracing) => checkPureTwist({ N: 1, direction: 'random', tracing, allowedTargets: ['UFL'] }),
            gen: generateScramble,
            cornerOrder,
            edgeOrder,
        });
        totalPass += r.pass;
        totalFail += r.fail;
    }

    console.log('\n--- E. Distribution sanity (mixed should produce both signs) ---');
    runDistributionTwist({
        label: 'corners Twist N=2 dir=mixed',
        N: 2,
        K: 500,
        configMutator: (c) => {
            c.cornerScrambleType = 'Twist';
            c.edgeScrambleType = 'Solved';
            c.cornerTwistCount = 2;
            c.cornerTwistDirection = 'mixed';
        },
        gen: generateScramble,
        cornerOrder,
        edgeOrder,
    });
    runDistributionTwist({
        label: 'corners Twist N=2 dir=same ',
        N: 2,
        K: 500,
        configMutator: (c) => {
            c.cornerScrambleType = 'Twist';
            c.edgeScrambleType = 'Solved';
            c.cornerTwistCount = 2;
            c.cornerTwistDirection = 'same';
        },
        gen: generateScramble,
        cornerOrder,
        edgeOrder,
    });

    console.log('\n--- D. With extras (informational, contract assertions only on misoriented count) ---');
    const extrasSamples = [
        { N: 1, ext: 2 }, { N: 1, ext: 6 },
        { N: 3, ext: 4 }, { N: 5, ext: 2 },
        { N: 1, ext: 7 }, { N: 3, ext: 5 }, { N: 5, ext: 3 },
    ];
    for (const { N, ext } of extrasSamples) {
        const r = runScenario({
            label: `corners Twist N=${N} extras=${ext}`,
            configMutator: (c) => {
                c.cornerScrambleType = 'Twist';
                c.edgeScrambleType = 'Solved';
                c.cornerTwistCount = N;
                c.cornerTwistExtraCount = ext;
                c.cornerTwistDirection = 'mixed';
            },
            checkFn: (tracing) => {
                const failures = [];
                const miso = getMisoriented(tracing.corner).filter((m) => m.piece !== CORNER_BUFFER);
                // Loose: allow miso to be N or N+something (extras may add twists too).
                // Tight: must include at least N pieces from the twist branch.
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
