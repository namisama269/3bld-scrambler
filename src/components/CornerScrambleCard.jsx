import { useEffect } from 'react';
import { useScrambleConfig } from '../state/ScrambleConfigContext.jsx';
import {
    CORNER_SCRAMBLE_TYPES,
    CORNER_WEIGHTS,
    getTargetsExcludingBuffer,
    getUDStickerTargets,
    orderTargets,
} from '../constants.js';
import MultiselectCard from './MultiselectCard.jsx';
import PresetToolbar from './PresetToolbar.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

function TwistControls({ twistCount, extraCount, direction, onTwistCount, onExtraCount, onDirection }) {
    // Pool after N twists shrinks to (7 − N) non-buffer corners. Extras can
    // cycle on those, so the max is the pool remainder.
    const extrasMax = Math.max(0, 7 - twistCount);
    useEffect(() => {
        if (extraCount > extrasMax) onExtraCount(extrasMax);
    }, [extrasMax, extraCount, onExtraCount]);
    return (
        <>
            <div className="row">
                <span className="row-label">Number of non-buffer twists</span>
                <Segmented
                    value={twistCount}
                    onChange={onTwistCount}
                    options={Array.from({ length: 7 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                />
            </div>
            {twistCount >= 2 && (
                <div className="row">
                    <span className="row-label">Twist directions</span>
                    <Segmented
                        value={direction}
                        onChange={onDirection}
                        options={[
                            { value: 'random', label: 'Random' },
                            { value: 'same', label: 'Same' },
                            { value: 'mixed', label: 'Mixed' },
                        ]}
                    />
                </div>
            )}
            <div className="row">
                <span className="row-label">Extra targets</span>
                <Segmented
                    value={extraCount}
                    onChange={onExtraCount}
                    options={Array.from({ length: extrasMax + 1 }, (_, i) => ({ value: i, label: String(i) }))}
                />
            </div>
        </>
    );
}

function Segmented({ value, onChange, options }) {
    return (
        <div className="segmented" role="radiogroup">
            {options.map((o) => (
                <button
                    key={String(o.value)}
                    type="button"
                    role="radio"
                    aria-checked={value === o.value}
                    className={`seg ${value === o.value ? 'active' : ''}`}
                    onClick={() => onChange(o.value)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export default function CornerScrambleCard() {
    const { config, updateField } = useScrambleConfig();
    const type = config.cornerScrambleType;
    const cornerBuffer = config.cornerBufferOrder[0];

    const order = config.targetOrder || 'piece';
    const allTargets = orderTargets(getTargetsExcludingBuffer(cornerBuffer), order);
    const udStickerTargets = orderTargets(getUDStickerTargets(cornerBuffer), order);
    // T2C first-piece pool follows the user's corner buffer order, excluding
    // only the active buffer. When "Only select later buffers" is on, the
    // LAST piece is also hidden — picking it as first-piece would leave no
    // valid second-piece. Mirrors the edge F2E behaviour.
    const t2cPieceOrderAll = config.cornerBufferOrder.filter((p) => p !== cornerBuffer);
    const t2cFirstPieces = config.t2cOnlyLaterBuffers
        ? t2cPieceOrderAll.slice(0, -1)
        : t2cPieceOrderAll;
    const oddTwistExtras = config.cornerTwistExtraCount % 2 === 1;
    const [twistAdvancedOpen, setTwistAdvancedOpen] = useLocalStorage('cornerTwistTargetsDisclosure', false);
    const [targetsAdvancedOpen, setTargetsAdvancedOpen] = useLocalStorage('cornerTargetsParityDisclosure', false);
    const [t2cAdvancedOpen, setT2cAdvancedOpen] = useLocalStorage('cornerT2cTargetsDisclosure', false);

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">Corner scramble</span>
                <PresetToolbar side="corner" />
            </div>
            <div className="card-body">
                <div className="row">
                    <label className="row-label" htmlFor="corner-type">Type</label>
                    <select
                        id="corner-type"
                        className="select"
                        value={type}
                        onChange={(e) => updateField('cornerScrambleType')(e.target.value)}
                    >
                        {CORNER_SCRAMBLE_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                {type === 'Random' && (
                    <div className="row">
                        <span className="row-label">Parity</span>
                        <Segmented
                            value={config.cornerRandomParity}
                            onChange={updateField('cornerRandomParity')}
                            options={[
                                { value: 'any', label: 'Any' },
                                { value: 'even', label: 'Even' },
                                { value: 'odd', label: 'Odd' },
                            ]}
                        />
                    </div>
                )}

                {type === 'Targets' && (
                    <>
                        <div className="row">
                            <span className="row-label">Target count</span>
                            <Segmented
                                value={config.cornerTargetCount}
                                onChange={updateField('cornerTargetCount')}
                                options={Array.from({ length: 8 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                            />
                        </div>
                        {config.cornerTargetCount % 2 === 1 && (
                            <details
                                className="disclosure"
                                open={!!targetsAdvancedOpen}
                                onToggle={(e) => setTargetsAdvancedOpen(e.currentTarget.open)}
                            >
                                <summary>Advanced target settings</summary>
                                <div className="disclosure-body">
                                    <MultiselectCard
                                        title="Parity targets"
                                        allPieces={allTargets}
                                        value={config.parityTargets}
                                        onChange={updateField('parityTargets')}
                                    />
                                </div>
                            </details>
                        )}
                    </>
                )}

                {type === 'Floating' && (() => {
                    // Hide position 0 (main buffer) and the last 2 (zero
                    // weight). Weights stay indexed by absolute position.
                    const floatingPool = config.cornerBufferOrder.slice(1, -2);
                    const selected = (config.floatingCornerBuffers || []).filter((p) => floatingPool.includes(p));
                    const showTargetCount = selected.length === 1;
                    const showDistribution = selected.length > 1;
                    const onlyIdx = showTargetCount ? config.cornerBufferOrder.indexOf(selected[0]) : -1;
                    const baseMaxN = showTargetCount
                        ? Math.max(1, config.cornerBufferOrder.length - 1 - onlyIdx)
                        : 1;
                    // "Add twisted corner" steals one piece from the cycle pool,
                    // so the available target count drops by 1.
                    const maxN = (showTargetCount && config.floatingCornerAddTwist)
                        ? Math.max(1, baseMaxN - 1)
                        : baseMaxN;
                    const N = Math.min(config.floatingCornerTargetCount, maxN);
                    return (
                        <>
                            <MultiselectCard
                                title="Floating buffers"
                                allPieces={floatingPool}
                                value={config.floatingCornerBuffers}
                                onChange={updateField('floatingCornerBuffers')}
                            />
                            {showDistribution && (
                                <>
                                    <div className="row">
                                        <span className="row-label">Distribution</span>
                                        <Segmented
                                            value={config.floatingCornerDistribution}
                                            onChange={updateField('floatingCornerDistribution')}
                                            options={[
                                                { value: 'equal', label: 'Equal' },
                                                { value: 'weighted', label: 'Weighted' },
                                            ]}
                                        />
                                    </div>
                                    {config.floatingCornerDistribution === 'weighted' && (() => {
                                        const entries = selected
                                            .map((p) => {
                                                const idx = config.cornerBufferOrder.indexOf(p);
                                                return { piece: p, idx, weight: CORNER_WEIGHTS[idx] ?? 0 };
                                            })
                                            .sort((a, b) => a.idx - b.idx);
                                        const total = entries.reduce((s, e) => s + e.weight, 0);
                                        return (
                                            <div className="row">
                                                <span className="row-label">Pick rates</span>
                                                <span className="muted-pill muted-pill-inline" style={{ flexWrap: 'wrap' }}>
                                                    {entries.map((e, i) => {
                                                        const pct = total > 0 ? ((e.weight / total) * 100).toFixed(1) : '0.0';
                                                        return (
                                                            <span key={e.piece} style={{ marginRight: i === entries.length - 1 ? 0 : 8 }}>
                                                                {e.piece} {pct}%
                                                            </span>
                                                        );
                                                    })}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </>
                            )}
                            {showTargetCount && (
                                <div className="row">
                                    <span className="row-label">Target count</span>
                                    <Segmented
                                        value={N}
                                        onChange={updateField('floatingCornerTargetCount')}
                                        options={Array.from({ length: maxN }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                                    />
                                </div>
                            )}
                            {showTargetCount && (
                                <div className="row">
                                    <span className="row-label">Add twisted corner</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={!!config.floatingCornerAddTwist}
                                            onChange={(e) => updateField('floatingCornerAddTwist')(e.target.checked)}
                                        />
                                        <span className="toggle-switch"></span>
                                    </label>
                                </div>
                            )}
                            {showTargetCount && N % 2 === 1 && (
                                <div className="row">
                                    <span className="row-label">Parity swap</span>
                                    <Segmented
                                        value={config.floatingCornerParitySwap || 'corner'}
                                        onChange={updateField('floatingCornerParitySwap')}
                                        options={[
                                            { value: 'edge', label: 'Edge (UF/UR)' },
                                            { value: 'corner', label: 'Corner (UFR/UBR)' },
                                        ]}
                                    />
                                </div>
                            )}
                        </>
                    );
                })()}

                {type === 'Twist' && (
                    <>
                        <TwistControls
                            twistCount={config.cornerTwistCount}
                            extraCount={config.cornerTwistExtraCount}
                            direction={config.cornerTwistDirection}
                            onTwistCount={updateField('cornerTwistCount')}
                            onExtraCount={updateField('cornerTwistExtraCount')}
                            onDirection={updateField('cornerTwistDirection')}
                        />
                        <details
                            className="disclosure"
                            open={!!twistAdvancedOpen}
                            onToggle={(e) => setTwistAdvancedOpen(e.currentTarget.open)}
                        >
                            <summary>Advanced target settings</summary>
                            <div className="disclosure-body">
                                <MultiselectCard
                                    title="Twist targets"
                                    allPieces={udStickerTargets}
                                    value={config.cornerTwistTargets}
                                    onChange={updateField('cornerTwistTargets')}
                                />
                                {oddTwistExtras && (
                                    <MultiselectCard
                                        title="Parity targets"
                                        allPieces={allTargets}
                                        value={config.parityTargets}
                                        onChange={updateField('parityTargets')}
                                    />
                                )}
                            </div>
                        </details>
                    </>
                )}

                {type === '2-Swap' && (
                    <>
                        <div className="row">
                            <span className="row-label">Mode</span>
                            <Segmented
                                value={config.twoSwapMode}
                                onChange={updateField('twoSwapMode')}
                                options={[
                                    { value: 'unoriented', label: 'Unoriented (T2C)' },
                                    { value: 'oriented', label: 'Oriented' },
                                ]}
                            />
                        </div>
                        <div className="row">
                            <span className="row-label">Extra targets</span>
                            <Segmented
                                value={config.t2cExtraCount}
                                onChange={updateField('t2cExtraCount')}
                                options={[0, 2, 4, 6].map((n) => ({ value: n, label: String(n) }))}
                            />
                        </div>
                        <details
                            className="disclosure"
                            open={!!t2cAdvancedOpen}
                            onToggle={(e) => setT2cAdvancedOpen(e.currentTarget.open)}
                        >
                            <summary>Advanced target settings</summary>
                            <div className="disclosure-body">
                                <MultiselectCard
                                    title="First piece selection"
                                    allPieces={t2cFirstPieces}
                                    value={config.t2cFirstPieces}
                                    onChange={updateField('t2cFirstPieces')}
                                />
                                <label className="check">
                                    <input
                                        type="checkbox"
                                        checked={config.t2cOnlyLaterBuffers}
                                        onChange={(e) => updateField('t2cOnlyLaterBuffers')(e.target.checked)}
                                    />
                                    <span className="check-box"></span>
                                    <span>Only select later buffers</span>
                                </label>
                            </div>
                        </details>
                    </>
                )}
            </div>
        </div>
    );
}
