// Loads public/scramble/dlin.js (a classic browser script that defines
// globals) into a Node sandbox and returns its exports. This avoids forking
// dlin.js into a CommonJS/ESM module while keeping it usable in tests.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DLIN_PATH = path.resolve(__dirname, '../public/scramble/dlin.js');

const src = readFileSync(DLIN_PATH, 'utf8');
const wrapped = src + `
globalThis.BUFFERS = BUFFERS;
globalThis.DlinPiece = DlinPiece;
globalThis.DLIN_FACES = DLIN_FACES;
globalThis.DlinCube = DlinCube;
globalThis.Tracer = Tracer;
`;

const ctx = vm.createContext({});
vm.runInContext(wrapped, ctx, { filename: DLIN_PATH });

export const BUFFERS = ctx.BUFFERS;
export const DlinPiece = ctx.DlinPiece;
export const DLIN_FACES = ctx.DLIN_FACES;
export const DlinCube = ctx.DlinCube;
export const Tracer = ctx.Tracer;
