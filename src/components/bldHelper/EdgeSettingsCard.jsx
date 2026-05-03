import { useEffect, useRef } from 'react';
import { useBldHelperConfig, EDGE_NAMES } from '../../state/BldHelperConfigContext.jsx';
import { useScrambleConfig } from '../../state/ScrambleConfigContext.jsx';
import PieceFixGrid from './PieceFixGrid.jsx';
import RangeRow from './RangeRow.jsx';

const STATUS_OPTS = [
    { value: 1, label: 'Solved' },
    { value: 2, label: 'Flipped' },
    { value: 3, label: 'Solved/Flipped' },
    { value: 4, label: 'Unsolved' },
    { value: 5, label: 'Solved/Unsolved' },
    { value: 6, label: 'Flipped/Unsolved' },
    { value: 7, label: 'Any' },
];

export default function EdgeSettingsCard() {
    const { config, updateField } = useBldHelperConfig();
    const { config: scrambleConfig } = useScrambleConfig();
    const sharedBuffer = scrambleConfig.edgeBufferOrder[0];
    const bufferName = EDGE_NAMES.includes(sharedBuffer) ? sharedBuffer : EDGE_NAMES[1];

    const prevBufferRef = useRef(sharedBuffer);
    useEffect(() => {
        if (prevBufferRef.current === sharedBuffer) return;
        prevBufferRef.current = sharedBuffer;
        updateField('edgeSolved')([]);
        updateField('edgeFlipped')([]);
    }, [sharedBuffer, updateField]);

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">Edge Settings</span>
            </div>
            <div className="card-body">
                <div className="row">
                    <label className="row-label" htmlFor="ebuff-status">Buffer status</label>
                    <select
                        id="ebuff-status"
                        className="select"
                        value={config.ebuffStatus}
                        onChange={(e) => updateField('ebuffStatus')(Number(e.target.value))}
                    >
                        {STATUS_OPTS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <span className="row-label" style={{ display: 'block', marginBottom: 6 }}>Solved edges</span>
                    <PieceFixGrid
                        pieces={EDGE_NAMES}
                        hidePiece={bufferName}
                        value={config.edgeSolved}
                        otherValue={config.edgeFlipped}
                        onChange={updateField('edgeSolved')}
                    />
                </div>

                <div>
                    <div className="row-flex" style={{ marginBottom: 6 }}>
                        <span className="row-label" style={{ marginBottom: 0 }}>Flipped edges</span>
                        <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => {
                                updateField('edgeSolved')([]);
                                updateField('edgeFlipped')([]);
                            }}
                        >
                            Clear
                        </button>
                    </div>
                    <PieceFixGrid
                        pieces={EDGE_NAMES}
                        hidePiece={bufferName}
                        value={config.edgeFlipped}
                        otherValue={config.edgeSolved}
                        onChange={updateField('edgeFlipped')}
                    />
                </div>

                <RangeRow
                    label="Number of flips"
                    min={0} max={11}
                    valueMin={config.enerrLRMin} valueMax={config.enerrLRMax}
                    onMinChange={updateField('enerrLRMin')} onMaxChange={updateField('enerrLRMax')}
                />
                <RangeRow
                    label="External cycles"
                    min={0} max={11}
                    valueMin={config.escycLRMin} valueMax={config.escycLRMax}
                    onMinChange={updateField('escycLRMin')} onMaxChange={updateField('escycLRMax')}
                />
                <RangeRow
                    label="Memo length"
                    min={0} max={30}
                    valueMin={config.encodeLRMin} valueMax={config.encodeLRMax}
                    onMinChange={updateField('encodeLRMin')} onMaxChange={updateField('encodeLRMax')}
                />
            </div>
        </div>
    );
}
