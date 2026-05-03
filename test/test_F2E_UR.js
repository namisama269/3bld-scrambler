// Port of test/test_F2E_UR.py — assert that every scramble in F2E_UR.txt
// produces the F2E shape: 14 targets, no flips, and a final 1-target cycle
// with orientation=1, parity=1.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { weakswapEdgesUR } from './test_tracer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
    const scramblesFile = path.join(__dirname, 'F2E_UR.txt');
    const scrambles = readFileSync(scramblesFile, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    for (let i = 0; i < scrambles.length; i++) {
        const scram = scrambles[i];
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
            const shortestLen = shortest.targets.length;
            const shortestOri = shortest.orientation;
            const shortestParity = shortest.parity;
            if (shortestLen !== 1) fail(`Expected shortest cycle to have 1 target, got ${shortestLen}`);
            if (shortestOri !== 1) fail(`Expected shortest cycle orientation 1, got ${shortestOri}`);
            if (shortestParity !== 1) fail(`Expected shortest cycle parity 1, got ${shortestParity}`);
        }
    }

    console.log(
        `PASS: All ${scrambles.length} scrambles have 14 targets, 0 flips, and shortest cycle has 1 target with ori=1 parity=1`
    );
}

main();
