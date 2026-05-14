// Field sets — single source of truth for which config keys belong to each side.
export const CORNER_FIELDS = new Set([
    'cornerScrambleType',
    'cornerRandomParity',
    'cornerTargetCount',
    'parityTargets',
    'floatingCornerBuffers',
    'floatingCornerTargetCount',
    'floatingCornerDistribution',
    'floatingCornerAddTwist',
    'floatingCornerParitySwap',
    'cornerTwistCount',
    'cornerTwistExtraCount',
    'cornerTwistDirection',
    'cornerTwistTargets',
    'twoSwapMode',
    't2cFirstPieces',
    't2cOnlyLaterBuffers',
    't2cExtraCount',
]);

export const EDGE_FIELDS = new Set([
    'edgeScrambleType',
    'edgeRandomParity',
    'edgeTargetCount',
    'edgeParityTargets',
    'floatingBuffers',
    'floatingTargetCount',
    'floatingDistribution',
    'floatingAddFlip',
    'floatingParitySwap',
    'flipCustomCount',
    'flipExtraCount',
    'flipTargets',
    'flipParityTargets',
    'edgeTwoSwapMode',
    'f2eFirstPieces',
    'f2eOnlyLaterBuffers',
    'f2eExtraCount',
]);

// Per-type field subsets — only these fields are serialized for each scramble type.
// The type field itself is always included.
const CORNER_TYPE_FIELDS = {
    Solved:   [],
    Random:   ['cornerRandomParity'],
    Targets:  ['cornerTargetCount', 'parityTargets'],
    Floating: ['floatingCornerBuffers', 'floatingCornerTargetCount', 'floatingCornerDistribution', 'floatingCornerAddTwist', 'floatingCornerParitySwap'],
    Twist:    ['cornerTwistCount', 'cornerTwistExtraCount', 'cornerTwistDirection', 'cornerTwistTargets'],
    '2-Swap': ['twoSwapMode', 't2cFirstPieces', 't2cOnlyLaterBuffers', 't2cExtraCount'],
};

const EDGE_TYPE_FIELDS = {
    Solved:   [],
    Random:   ['edgeRandomParity'],
    Targets:  ['edgeTargetCount', 'edgeParityTargets'],
    Floating: ['floatingBuffers', 'floatingTargetCount', 'floatingDistribution', 'floatingAddFlip', 'floatingParitySwap'],
    Flips:    ['flipCustomCount', 'flipExtraCount', 'flipTargets', 'flipParityTargets'],
    '2-Swap': ['edgeTwoSwapMode', 'f2eFirstPieces', 'f2eOnlyLaterBuffers', 'f2eExtraCount'],
};

const FIELDS_BY_SIDE = { corner: CORNER_FIELDS, edge: EDGE_FIELDS };
const TYPE_FIELDS_BY_SIDE = { corner: CORNER_TYPE_FIELDS, edge: EDGE_TYPE_FIELDS };
const TYPE_KEY_BY_SIDE = { corner: 'cornerScrambleType', edge: 'edgeScrambleType' };
const CURRENT_VERSION = 1;
const PREFIX = '3bld';

export function serializeSide(config, side) {
    const allFields = FIELDS_BY_SIDE[side];
    if (!allFields) throw new Error(`Unknown side: ${side}`);

    const typeKey = TYPE_KEY_BY_SIDE[side];
    const type = config[typeKey] || 'Solved';
    const typeFields = TYPE_FIELDS_BY_SIDE[side][type] || [];

    // Always include the type field + only the fields for that type.
    const activeKeys = new Set([typeKey, ...typeFields]);
    const subset = {};
    for (const key of activeKeys) {
        if (key in config) subset[key] = config[key];
    }
    const json = JSON.stringify(subset);
    return `${PREFIX}:${side}:${CURRENT_VERSION}:${btoa(json)}`;
}

export function deserializeSide(str) {
    if (typeof str !== 'string' || !str.startsWith(PREFIX + ':')) {
        throw new Error('Not a valid preset string.');
    }
    const parts = str.split(':');
    if (parts.length !== 4) throw new Error('Malformed preset string.');
    const [, side, versionStr, payload] = parts;
    if (side !== 'corner' && side !== 'edge') {
        throw new Error(`Unknown side "${side}" in preset string.`);
    }
    const version = parseInt(versionStr, 10);
    if (isNaN(version) || version < 1) {
        throw new Error('Invalid version in preset string.');
    }
    if (version > CURRENT_VERSION) {
        throw new Error(`Preset version ${version} is newer than supported (${CURRENT_VERSION}). Update the app.`);
    }
    let parsed;
    try {
        parsed = JSON.parse(atob(payload));
    } catch {
        throw new Error('Failed to decode preset data.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid preset data.');
    }
    // Only allow fields that belong to this side.
    const allowed = FIELDS_BY_SIDE[side];
    const fields = {};
    for (const key of Object.keys(parsed)) {
        if (allowed.has(key)) fields[key] = parsed[key];
    }
    return { side, version, fields };
}

export function applySidePreset(currentConfig, fields, side) {
    const allowed = FIELDS_BY_SIDE[side];
    if (!allowed) throw new Error(`Unknown side: ${side}`);
    const patch = {};
    for (const [key, value] of Object.entries(fields)) {
        if (allowed.has(key)) patch[key] = value;
    }
    return { ...currentConfig, ...patch };
}
