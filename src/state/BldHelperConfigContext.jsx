import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'bldHelperConfig.v1';

export const CORNER_NAMES = ['UFR', 'UFL', 'UBL', 'UBR', 'DFR', 'DFL', 'DBL', 'DBR'];
export const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];

export const SCHEMES = {
    speffz: 'CJM DIF ARE BQN VKP ULG XSH WTO BM CI DE AQ VO UK XG WS JP LF RH TN',
    chichu: 'JLK ABC DFE GHI XYZ WNM OPQ RTS GH AB CD EF OP IJ KL MN QR ST WX YZ',
};
export const ORD_UDE = '012345670123456789ab';

export const STATUS_LABELS = {
    1: 'Solved', 2: 'Twisted/Flipped', 3: 'Solved/Twisted-Flipped',
    4: 'Unsolved', 5: 'Solved/Unsolved', 6: 'Twisted-Flipped/Unsolved',
    7: 'Any',
};
export const PARITY_LABELS = { 1: 'Even', 2: 'Odd', 3: 'Any' };

const initialConfig = {
    cbuffPiece: 0,           // index into CORNER_NAMES (UFR)
    cbuffStatus: 7,          // 1..7
    cornerSolved: [],        // list of corner piece names that must be solved
    cornerTwisted: [],       // list of corner piece names that must be twisted
    cnerrLRMin: 0, cnerrLRMax: 7,
    cscycLRMin: 0, cscycLRMax: 3,
    cncodeLRMin: 0, cncodeLRMax: 10,

    ebuffPiece: 1,           // index into EDGE_NAMES (UF)
    ebuffStatus: 7,
    edgeSolved: [],
    edgeFlipped: [],
    enerrLRMin: 0, enerrLRMax: 11,
    escycLRMin: 0, escycLRMax: 5,
    encodeLRMin: 0, encodeLRMax: 16,

    ceparity: 3,             // 1=Even 2=Odd 3=Any
    bldOrientation: 'wg',    // unused for now (per user instruction)
    ceori: true,             // Random orientation
    scheme: 'speffz',        // speffz | chichu | custom
    customScheme: '',
    order: 'ordude',         // ordude | custom
    customOrder: '',         // raw 20-char order

    bulkCount: 100,
};

function readConfig() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return initialConfig;
        return { ...initialConfig, ...JSON.parse(raw) };
    } catch {
        return initialConfig;
    }
}

const Ctx = createContext(null);

export function BldHelperConfigProvider({ children }) {
    const [config, setConfig] = useState(readConfig);

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* noop */ }
    }, [config]);

    const value = useMemo(() => {
        const update = (patch) => setConfig((prev) => ({ ...prev, ...patch }));
        const updateField = (key) => (val) => setConfig((prev) => ({ ...prev, [key]: val }));
        const reset = () => setConfig(initialConfig);
        return { config, update, updateField, reset };
    }, [config]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBldHelperConfig() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useBldHelperConfig must be used within BldHelperConfigProvider');
    return ctx;
}

// Convert "UBL UFR DBR+" string ↔ {solved: [], twisted: []}
export function fixToString(solved, twisted) {
    return [...solved, ...twisted.map((p) => p + '+')].join(' ');
}

// Build the BLD-helper bldSets object the engine expects.
// ChiChu and Speffz are taken from SCHEMES; Custom uses the user-provided string.
export function getBldSets(config) {
    let scheme;
    if (config.scheme === 'speffz') scheme = SCHEMES.speffz;
    else if (config.scheme === 'chichu') scheme = SCHEMES.chichu;
    else scheme = config.customScheme || SCHEMES.speffz;

    let order;
    if (config.order === 'ordude') {
        order = ORD_UDE;
    } else {
        order = lettersToOrder(config.customOrder, scheme) || ORD_UDE;
    }

    return {
        cbuff: [Number(config.cbuffPiece), Number(config.cbuffStatus)],
        cfix: fixToString(config.cornerSolved, config.cornerTwisted),
        cnerrLR: [Number(config.cnerrLRMin), Number(config.cnerrLRMax)],
        cscycLR: [Number(config.cscycLRMin), Number(config.cscycLRMax)],
        cncodeLR: [Number(config.cncodeLRMin), Number(config.cncodeLRMax)],
        ebuff: [Number(config.ebuffPiece), Number(config.ebuffStatus)],
        efix: fixToString(config.edgeSolved, config.edgeFlipped),
        enerrLR: [Number(config.enerrLRMin), Number(config.enerrLRMax)],
        escycLR: [Number(config.escycLRMin), Number(config.escycLRMax)],
        encodeLR: [Number(config.encodeLRMin), Number(config.encodeLRMax)],
        ceparity: Number(config.ceparity),
        ceori: !!config.ceori,
        scheme,
        order,
    };
}

// scheme-letter ↔ raw-order helpers (lifted from legacy bldHelperUI.js).
export function orderToLetters(order, scheme) {
    let result = '';
    for (let i = 0; i < 20; i++) {
        const ord = parseInt(order[i], 24);
        if (i < 8) {
            result += scheme[(ord % 8) * 4 + ~~(ord / 8)];
        } else {
            result += scheme[32 + (ord % 12) * 3 + ~~(ord / 12)];
        }
    }
    return result.slice(0, 8) + ' ' + result.slice(8);
}

export function lettersToOrder(letters, scheme) {
    if (!letters) return null;
    const chars = letters.replace(/\s+/g, '');
    if (chars.length !== 20) return null;
    let order = '';
    for (let i = 0; i < 20; i++) {
        const ch = chars[i];
        let found = false;
        if (i < 8) {
            for (let p = 0; p < 24 && !found; p++) {
                const piece = p % 8;
                const ori = ~~(p / 8);
                if (scheme[piece * 4 + ori] === ch) {
                    order += p.toString(24);
                    found = true;
                }
            }
        } else {
            for (let p = 0; p < 24 && !found; p++) {
                const piece = p % 12;
                const ori = ~~(p / 12);
                if (scheme[32 + piece * 3 + ori] === ch) {
                    order += p.toString(24);
                    found = true;
                }
            }
        }
        if (!found) return null;
    }
    return order;
}
