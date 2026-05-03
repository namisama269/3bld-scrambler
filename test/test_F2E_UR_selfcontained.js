// Self-contained F2E_UR test: generates its own scrambles via the headless
// scramble engine, then runs the F2E_UR weak-swap trace assertions against them.
// No external scramble file needed.
//
// Pattern to copy for new scramble-type tests:
//   1. Define a config preset.
//   2. Call generateScramble({ config }) N times.
//   3. Trace each scramble (directly via Tracer or via a helper).
//   4. Assert invariants per scramble; bail on first failure with full context.

import { loadGen } from './loadGen.js';
import { weakswapEdgesUR } from './test_tracer.js';

const N = 1000;

const config = {
    cornerBuffer: 'UFR',
    edgeBuffer: 'UR',
    cornerScrambleType: 'Solved',
    edgeScrambleType: '2-Swap',
    edgeTwoSwapMode: 'unoriented',
    f2eExtraCount: 10,
    f2eFirstPieces: ['UF'],
    f2eBufferOrder: ['UF', 'UL', 'UB', 'FR', 'FL', 'DR', 'DL', 'BR', 'DF', 'DB', 'BL'],
};

function main() {
    const { generateScramble } = loadGen();

    for (let i = 0; i < N; i++) {
        const scram = generateScramble({ config });
        const result = weakswapEdgesUR(scram);
        const targetsCount = result.targets.length;
        const flipsCount = result.flips.length;
        const remainingCycles = result.remaining_cycles_sorted;

        const fail = (msg) => {
            console.log(`FAIL at scramble ${i + 1}: ${scram}`);
            console.log(`Error: ${msg}`);
            console.log(`Targets (${targetsCount}): ${JSON.stringify(result.targets)}`);
            console.log(`Flips (${flipsCount}): ${JSON.stringify(result.flips)}`);
            console.log(`Remaining cycles sorted: ${JSON.stringify(remainingCycles)}`);
            process.exit(1);
        };

        if (targetsCount !== 14) fail(`Expected 14 targets, got ${targetsCount}`);
        if (flipsCount !== 0) fail(`Expected 0 flips, got ${flipsCount}`);
        if (remainingCycles.length > 0) {
            const shortest = remainingCycles[remainingCycles.length - 1];
            if (shortest.targets.length !== 1) fail(`Shortest cycle should have 1 target, got ${shortest.targets.length}`);
            if (shortest.orientation !== 1) fail(`Shortest cycle ori should be 1, got ${shortest.orientation}`);
            if (shortest.parity !== 1) fail(`Shortest cycle parity should be 1, got ${shortest.parity}`);
        }
    }

    console.log(`PASS: ${N} freshly-generated F2E_UR scrambles all match the expected pattern.`);
}

main();
