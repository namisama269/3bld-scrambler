import { createContext, useContext, useMemo, useState } from 'react';

// Shared output state used by the OutputColumn (sticky right pane).
// Both tabs (Scrambler + BLD Helper) write into this when their respective
// "Generate" actions fire.
const Ctx = createContext(null);

export function ScrambleOutputProvider({ children }) {
    const [scrambleText, setScrambleText] = useState('');
    const [scrambleList, setScrambleList] = useState(null);
    const [debugText, setDebugText] = useState('');
    const [error, setError] = useState(null);

    const value = useMemo(() => ({
        scrambleText, setScrambleText,
        scrambleList, setScrambleList,
        debugText, setDebugText,
        error, setError,
        clear: () => {
            setScrambleText('');
            setScrambleList(null);
            setDebugText('');
            setError(null);
        },
    }), [scrambleText, scrambleList, debugText, error]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScrambleOutput() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useScrambleOutput must be used within ScrambleOutputProvider');
    return ctx;
}
