import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
    DEFAULT_CORNER_BUFFER_ORDER,
    DEFAULT_EDGE_BUFFER_ORDER,
    F2E_FIRST_PIECES,
    getTargetsExcludingBuffer,
    getUDStickerTargets,
} from '../constants.js';

const STORAGE_KEY = 'scrambleConfig.v1';

const initialConfig = {
    cornerBufferOrder: [...DEFAULT_CORNER_BUFFER_ORDER],
    edgeBufferOrder: [...DEFAULT_EDGE_BUFFER_ORDER],
    holdingOrientation: 'wg',
    targetOrder: 'piece',
    showCube: true,
    cornerScrambleType: 'Solved',
    edgeScrambleType: 'Solved',
    cornerRandomParity: 'any',
    edgeRandomParity: 'any',
    cornerTargetCount: 8,
    parityTargets: getTargetsExcludingBuffer('UFR'),
    floatingCornerTargetCount: 4,
    floatingCornerBuffers: [DEFAULT_CORNER_BUFFER_ORDER[1]],
    floatingCornerDistribution: 'equal',
    floatingCornerAddTwist: false,
    cornerTwistCount: 2,
    cornerTwistExtraCount: 0,
    cornerTwistDirection: 'mixed',
    cornerTwistTargets: getUDStickerTargets('UFR'),
    twoSwapMode: 'unoriented',
    // Match the T2C UI's pool: cornerBufferOrder excluding active buffer + last.
    t2cFirstPieces: DEFAULT_CORNER_BUFFER_ORDER.slice(1, -1),
    t2cOnlyLaterBuffers: false,
    t2cExtraCount: 6,
    edgeTargetCount: 12,
    floatingTargetCount: 4,
    floatingBuffers: [DEFAULT_EDGE_BUFFER_ORDER[1]],
    floatingDistribution: 'equal',
    floatingAddFlip: false,
    edgeParityTargets: [],
    flipExtraCount: 0,
    flipCustomCount: 2,
    flipTargets: [],
    flipParityTargets: [],
    edgeTwoSwapMode: 'unoriented',
    f2eFirstPieces: [...F2E_FIRST_PIECES],
    f2eOnlyLaterBuffers: false,
    f2eExtraCount: 6,
    numScrambles: 1,
};

function readConfig() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return initialConfig;
        const parsed = JSON.parse(raw);
        return { ...initialConfig, ...parsed };
    } catch {
        return initialConfig;
    }
}

const ScrambleConfigContext = createContext(null);

export function ScrambleConfigProvider({ children }) {
    const [config, setConfig] = useState(readConfig);

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* noop */ }
    }, [config]);

    const value = useMemo(() => {
        const update = (patch) => setConfig((prev) => ({ ...prev, ...patch }));
        const updateField = (key) => (val) => setConfig((prev) => ({ ...prev, [key]: val }));
        return { config, update, updateField, setConfig };
    }, [config]);

    return <ScrambleConfigContext.Provider value={value}>{children}</ScrambleConfigContext.Provider>;
}

export function useScrambleConfig() {
    const ctx = useContext(ScrambleConfigContext);
    if (!ctx) throw new Error('useScrambleConfig must be used within ScrambleConfigProvider');
    return ctx;
}

// Build the engine-facing config object (active buffer is order[0]).
export function toEngineConfig(config) {
    const activeBuffer = config.edgeBufferOrder[0];
    const f2eBufferOrder = config.edgeBufferOrder.filter((p) => p !== activeBuffer);
    // When "Only later buffers" is on, the last piece in the buffer order
    // can't be a first-piece (no valid second-piece would exist). Drop it
    // from any selection that leaks through from a previous state.
    const f2eVisible = config.f2eOnlyLaterBuffers ? f2eBufferOrder.slice(0, -1) : f2eBufferOrder;
    const f2eFirstPieces = (config.f2eFirstPieces || []).filter((p) => f2eVisible.includes(p));
    // Floating mode: user multi-selects buffers from positions 1..last-2.
    // Position 0 (active buffer) is hidden — Floating implies "not the main
    // buffer" — and the last 2 positions have zero weight + trivial cycles.
    // Weights stay indexed by absolute position; only the visibility shrinks.
    const floatingPool = config.edgeBufferOrder.slice(1, -2);
    const floatingBuffers = (config.floatingBuffers || []).filter((p) =>
        floatingPool.includes(p)
    );
    const cornerFloatingPool = config.cornerBufferOrder.slice(1, -2);
    const floatingCornerBuffers = (config.floatingCornerBuffers || []).filter((p) =>
        cornerFloatingPool.includes(p)
    );

    return {
        ...config,
        cornerBuffer: config.cornerBufferOrder[0],
        edgeBuffer: activeBuffer,
        f2eBufferOrder,
        f2eFirstPieces,
        floatingBuffers,
        floatingCornerBuffers,
    };
}
