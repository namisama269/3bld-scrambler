import { useEffect, useRef } from 'react';
import { useBldHelperConfig, CORNER_NAMES } from '../../state/BldHelperConfigContext.jsx';
import { useScrambleConfig } from '../../state/ScrambleConfigContext.jsx';
import PieceFixGrid from './PieceFixGrid.jsx';
import RangeRow from './RangeRow.jsx';

const STATUS_OPTS = [
    { value: 1, label: 'Solved' },
    { value: 2, label: 'Twisted' },
    { value: 3, label: 'Solved/Twisted' },
    { value: 4, label: 'Unsolved' },
    { value: 5, label: 'Solved/Unsolved' },
    { value: 6, label: 'Twisted/Unsolved' },
    { value: 7, label: 'Any' },
];

export default function CornerSettingsCard() {
    const { config, updateField } = useBldHelperConfig();
    const { config: scrambleConfig } = useScrambleConfig();
    const sharedBuffer = scrambleConfig.cornerBufferOrder[0];
    const bufferName = CORNER_NAMES.includes(sharedBuffer) ? sharedBuffer : CORNER_NAMES[0];

    // Clear solved/twisted when the shared corner buffer changes (skip first
    // mount — the stored selections may legitimately exclude the buffer).
    const prevBufferRef = useRef(sharedBuffer);
    useEffect(() => {
        if (prevBufferRef.current === sharedBuffer) return;
        prevBufferRef.current = sharedBuffer;
        updateField('cornerSolved')([]);
        updateField('cornerTwisted')([]);
    }, [sharedBuffer, updateField]);

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">Corner Settings</span>
            </div>
            <div className="card-body">
                <div className="row">
                    <label className="row-label" htmlFor="cbuff-status">Buffer status</label>
                    <select
                        id="cbuff-status"
                        className="select"
                        value={config.cbuffStatus}
                        onChange={(e) => updateField('cbuffStatus')(Number(e.target.value))}
                    >
                        {STATUS_OPTS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <span className="row-label" style={{ display: 'block', marginBottom: 6 }}>Solved corners</span>
                    <PieceFixGrid
                        pieces={CORNER_NAMES}
                        hidePiece={bufferName}
                        value={config.cornerSolved}
                        otherValue={config.cornerTwisted}
                        onChange={updateField('cornerSolved')}
                    />
                </div>

                <div>
                    <div className="row-flex" style={{ marginBottom: 6 }}>
                        <span className="row-label" style={{ marginBottom: 0 }}>Twisted corners</span>
                        <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => {
                                updateField('cornerSolved')([]);
                                updateField('cornerTwisted')([]);
                            }}
                        >
                            Clear
                        </button>
                    </div>
                    <PieceFixGrid
                        pieces={CORNER_NAMES}
                        hidePiece={bufferName}
                        value={config.cornerTwisted}
                        otherValue={config.cornerSolved}
                        onChange={updateField('cornerTwisted')}
                    />
                </div>

                <RangeRow
                    label="Number of twists"
                    min={0} max={7}
                    valueMin={config.cnerrLRMin} valueMax={config.cnerrLRMax}
                    onMinChange={updateField('cnerrLRMin')} onMaxChange={updateField('cnerrLRMax')}
                />
                <RangeRow
                    label="External cycles"
                    min={0} max={7}
                    valueMin={config.cscycLRMin} valueMax={config.cscycLRMax}
                    onMinChange={updateField('cscycLRMin')} onMaxChange={updateField('cscycLRMax')}
                />
                <RangeRow
                    label="Memo length"
                    min={0} max={20}
                    valueMin={config.cncodeLRMin} valueMax={config.cncodeLRMax}
                    onMinChange={updateField('cncodeLRMin')} onMaxChange={updateField('cncodeLRMax')}
                />
            </div>
        </div>
    );
}
