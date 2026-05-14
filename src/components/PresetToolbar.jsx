import { useState } from 'react';
import { useScrambleConfig } from '../state/ScrambleConfigContext.jsx';
import { serializeSide, deserializeSide, applySidePreset } from '../state/presets.js';

const ICONS = {
    copy: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
            <path d="M10.5 5.5V3.5a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5h2" />
        </svg>
    ),
    check: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 8.5 6.5 12 13 4" />
        </svg>
    ),
    paste: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="10" height="10" rx="1.5" />
            <path d="M6 4V2.5A.5.5 0 0 1 6.5 2h3a.5.5 0 0 1 .5.5V4" />
        </svg>
    ),
};

export default function PresetToolbar({ side }) {
    const { config, update } = useScrambleConfig();
    const [copyFeedback, setCopyFeedback] = useState(false);
    const [error, setError] = useState(null);

    const onCopy = async () => {
        try {
            const str = serializeSide(config, side);
            await navigator.clipboard.writeText(str);
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 1500);
        } catch (e) {
            setError('Copy failed: ' + e.message);
            setTimeout(() => setError(null), 3000);
        }
    };

    const onPaste = async () => {
        setError(null);
        try {
            const str = await navigator.clipboard.readText();
            const { side: parsedSide, fields } = deserializeSide(str);
            if (parsedSide !== side) {
                setError(`This is a ${parsedSide} preset — paste it into the ${parsedSide === 'corner' ? 'Corner' : 'Edge'} scramble card.`);
                setTimeout(() => setError(null), 4000);
                return;
            }
            const newConfig = applySidePreset(config, fields, side);
            update(newConfig);
        } catch (e) {
            setError(e.message);
            setTimeout(() => setError(null), 3000);
        }
    };

    return (
        <>
            <span style={{ flex: 1 }} />
            <button
                type="button"
                className="icon-btn"
                onClick={onCopy}
                aria-label={`Copy ${side} settings`}
                title={`Copy ${side} settings`}
            >
                {copyFeedback ? ICONS.check : ICONS.copy}
            </button>
            <button
                type="button"
                className="icon-btn"
                onClick={onPaste}
                aria-label={`Paste ${side} settings`}
                title={`Paste ${side} settings`}
            >
                {ICONS.paste}
            </button>
            {error && (
                <span className="preset-error">{error}</span>
            )}
        </>
    );
}
