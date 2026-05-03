import { useCallback, useEffect, useState } from 'react';

function readKey(key, defaultValue) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        // Stored values are JSON-encoded; fall back to raw string for legacy entries.
        try {
            return JSON.parse(raw);
        } catch {
            return raw;
        }
    } catch {
        return defaultValue;
    }
}

export function useLocalStorage(key, defaultValue) {
    const [value, setValue] = useState(() => readKey(key, defaultValue));

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // ignore quota errors
        }
    }, [key, value]);

    const reset = useCallback(() => setValue(defaultValue), [defaultValue]);

    return [value, setValue, reset];
}
