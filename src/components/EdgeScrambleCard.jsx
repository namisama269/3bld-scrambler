import { useEffect } from 'react';
import { useScrambleConfig } from '../state/ScrambleConfigContext.jsx';
import {
    EDGE_SCRAMBLE_TYPES,
    EDGE_WEIGHTS,
    getEdgeParityTargets,
    getFlipTargets,
    getFlipParityTargets,
    orderTargets,
} from '../constants.js';
import MultiselectCard from './MultiselectCard.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

function FlipExtras({ flipCustomCount, flipExtraCount, onChange }) {
    // Edges available after the flips are picked: 11 (non-buffer) − N. That's
    // the safe maximum for the cycle pool — engine permits one more (n+1)
    // only on the 2-cycle split path, but only with odd extras counts, which
    // would expose an unreachable max for even values. Capping at n keeps
    // every shown option valid.
    const extrasMax = Math.max(0, 11 - flipCustomCount);

    useEffect(() => {
        if (flipExtraCount > extrasMax) onChange(extrasMax);
    }, [extrasMax, flipExtraCount, onChange]);

    const options = Array.from({ length: extrasMax + 1 }, (_, i) => ({ value: i, label: String(i) }));

    return (
        <div className="row">
            <span className="row-label">Extra targets</span>
            <Segmented value={flipExtraCount} onChange={onChange} options={options} />
        </div>
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

export default function EdgeScrambleCard() {
    const { config, updateField } = useScrambleConfig();
    const type = config.edgeScrambleType;
    const edgeBuffer = config.edgeBufferOrder[0];

    const order = config.targetOrder || 'piece';
    const edgeParityTargetList = orderTargets(getEdgeParityTargets(edgeBuffer), order);
    const flipTargetList = orderTargets(getFlipTargets(edgeBuffer), order);
    const flipParityTargetList = orderTargets(getFlipParityTargets(edgeBuffer), order);
    const oddExtras = config.flipExtraCount % 2 === 1;
    // F2E first-piece order follows the user's edge buffer order, excluding
    // only the active buffer (so the parity-edge / "second buffer" is still
    // a valid first-piece candidate). When "Only select later buffers" is
    // on, the LAST piece in the order is hidden — picking it as first-piece
    // would leave no valid second-piece.
    const f2ePieceOrderAll = config.edgeBufferOrder.filter((p) => p !== edgeBuffer);
    const f2ePieceOrder = config.f2eOnlyLaterBuffers
        ? f2ePieceOrderAll.slice(0, -1)
        : f2ePieceOrderAll;

    const [flipsAdvancedOpen, setFlipsAdvancedOpen] = useLocalStorage('edgeFlipsTargetsDisclosure', false);
    const [f2eAdvancedOpen, setF2eAdvancedOpen] = useLocalStorage('edgeF2eTargetsDisclosure', false);
    const [targetsAdvancedOpen, setTargetsAdvancedOpen] = useLocalStorage('edgeTargetsParityDisclosure', false);

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">Edge scramble</span>
            </div>
            <div className="card-body">
                <div className="row">
                    <label className="row-label" htmlFor="edge-type">Type</label>
                    <select
                        id="edge-type"
                        className="select"
                        value={type}
                        onChange={(e) => updateField('edgeScrambleType')(e.target.value)}
                    >
                        {EDGE_SCRAMBLE_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                {type === 'Random' && (
                    <div className="row">
                        <span className="row-label">Parity</span>
                        <Segmented
                            value={config.edgeRandomParity}
                            onChange={updateField('edgeRandomParity')}
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
                                value={config.edgeTargetCount}
                                onChange={updateField('edgeTargetCount')}
                                options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                            />
                        </div>
                        {config.edgeTargetCount % 2 === 1 && (
                            <details
                                className="disclosure"
                                open={!!targetsAdvancedOpen}
                                onToggle={(e) => setTargetsAdvancedOpen(e.currentTarget.open)}
                            >
                                <summary>Advanced target settings</summary>
                                <div className="disclosure-body">
                                    <MultiselectCard
                                        title="Parity targets"
                                        allPieces={edgeParityTargetList}
                                        value={config.edgeParityTargets}
                                        onChange={updateField('edgeParityTargets')}
                                    />
                                </div>
                            </details>
                        )}
                    </>
                )}

                {type === 'Floating' && (() => {
                    // Hide position 0 (active buffer — not "floating") AND
                    // the last 2 (no weights, trivial cycles). Weights are
                    // still indexed by absolute position in the order, so
                    // the values themselves don't change.
                    const floatingPool = config.edgeBufferOrder.slice(1, -2);
                    const selected = (config.floatingBuffers || []).filter((p) => floatingPool.includes(p));
                    // 0 selected → only multiselect (let validation catch it).
                    // 1 selected → just target count (distribution is moot).
                    // 2+ selected → just distribution (target count = BT default per pick).
                    const showTargetCount = selected.length === 1;
                    const showDistribution = selected.length > 1;
                    const onlyIdx = showTargetCount ? config.edgeBufferOrder.indexOf(selected[0]) : -1;
                    const baseMaxN = showTargetCount
                        ? Math.max(1, config.edgeBufferOrder.length - 1 - onlyIdx)
                        : 1;
                    // "Add flipped edge" steals one piece from the cycle
                    // pool, so the available target count drops by 1.
                    const maxN = (showTargetCount && config.floatingAddFlip)
                        ? Math.max(1, baseMaxN - 1)
                        : baseMaxN;
                    const N = Math.min(config.floatingTargetCount, maxN);
                    return (
                        <>
                            <MultiselectCard
                                title="Floating buffers"
                                allPieces={floatingPool}
                                value={config.floatingBuffers}
                                onChange={updateField('floatingBuffers')}
                            />
                            {showDistribution && (
                                <>
                                    <div className="row">
                                        <span className="row-label">Distribution</span>
                                        <Segmented
                                            value={config.floatingDistribution}
                                            onChange={updateField('floatingDistribution')}
                                            options={[
                                                { value: 'equal', label: 'Equal' },
                                                { value: 'weighted', label: 'Weighted' },
                                            ]}
                                        />
                                    </div>
                                    {config.floatingDistribution === 'weighted' && (() => {
                                        const entries = selected
                                            .map((p) => {
                                                const idx = config.edgeBufferOrder.indexOf(p);
                                                return { piece: p, idx, weight: EDGE_WEIGHTS[idx] ?? 0 };
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
                                        onChange={updateField('floatingTargetCount')}
                                        options={Array.from({ length: maxN }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                                    />
                                </div>
                            )}
                            {showTargetCount && (
                                <div className="row">
                                    <span className="row-label">Add flipped edge</span>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={!!config.floatingAddFlip}
                                            onChange={(e) => updateField('floatingAddFlip')(e.target.checked)}
                                        />
                                        <span className="toggle-switch"></span>
                                    </label>
                                </div>
                            )}
                        </>
                    );
                })()}

                {type === 'Flips' && (
                    <>
                        <div className="row">
                            <span className="row-label">Number of non-buffer flips</span>
                            <Segmented
                                value={config.flipCustomCount}
                                onChange={updateField('flipCustomCount')}
                                options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                            />
                        </div>
                        <FlipExtras
                            flipCustomCount={config.flipCustomCount}
                            flipExtraCount={config.flipExtraCount}
                            onChange={updateField('flipExtraCount')}
                        />

                        <details
                            className="disclosure"
                            open={!!flipsAdvancedOpen}
                            onToggle={(e) => setFlipsAdvancedOpen(e.currentTarget.open)}
                        >
                            <summary>Advanced target settings</summary>
                            <div className="disclosure-body">
                                <MultiselectCard
                                    title="Flip targets"
                                    allPieces={flipTargetList}
                                    value={config.flipTargets}
                                    onChange={updateField('flipTargets')}
                                />
                                {oddExtras && (
                                    <MultiselectCard
                                        title="Parity targets"
                                        allPieces={flipParityTargetList}
                                        value={config.flipParityTargets}
                                        onChange={updateField('flipParityTargets')}
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
                                value={config.edgeTwoSwapMode}
                                onChange={updateField('edgeTwoSwapMode')}
                                options={[
                                    { value: 'unoriented', label: 'Unoriented (F2E)' },
                                    { value: 'oriented', label: 'Oriented' },
                                ]}
                            />
                        </div>
                        <div className="row">
                            <span className="row-label">Extra targets</span>
                            <Segmented
                                value={config.f2eExtraCount}
                                onChange={updateField('f2eExtraCount')}
                                options={[0, 2, 4, 6, 8, 10].map((n) => ({ value: n, label: String(n) }))}
                            />
                        </div>
                        <details
                            className="disclosure"
                            open={!!f2eAdvancedOpen}
                            onToggle={(e) => setF2eAdvancedOpen(e.currentTarget.open)}
                        >
                            <summary>Advanced target settings</summary>
                            <div className="disclosure-body">
                                <MultiselectCard
                                    title="First piece selection"
                                    allPieces={f2ePieceOrder}
                                    value={config.f2eFirstPieces}
                                    onChange={updateField('f2eFirstPieces')}
                                />
                                <label className="check">
                                    <input
                                        type="checkbox"
                                        checked={config.f2eOnlyLaterBuffers}
                                        onChange={(e) => updateField('f2eOnlyLaterBuffers')(e.target.checked)}
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
