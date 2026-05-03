import { useState } from 'react';
import {
    useBldHelperConfig,
    getBldSets,
    CORNER_NAMES,
    EDGE_NAMES,
} from '../state/BldHelperConfigContext.jsx';
import { useScrambleConfig } from '../state/ScrambleConfigContext.jsx';
import { useScrambleOutput } from '../state/ScrambleOutputContext.jsx';
import CornerSettingsCard from './bldHelper/CornerSettingsCard.jsx';
import EdgeSettingsCard from './bldHelper/EdgeSettingsCard.jsx';
import GeneralSettingsCard from './bldHelper/GeneralSettingsCard.jsx';
import BulkModal from './bldHelper/BulkModal.jsx';
import CstimerPreviewModal from './bldHelper/CstimerPreviewModal.jsx';

function formatProb(p) {
    return p < 1e-3 ? p.toExponential(3) : `${Math.round(p * 1000000) / 10000}%`;
}

function formatCases(n) {
    return n > 1e8 ? n.toExponential(3) : String(n);
}

function renderCubeFromScramble(scrambleStr) {
    if (typeof window.cubeutil?.getScrambledState !== 'function') return;
    if (typeof window.renderFaceletString !== 'function') return;
    try {
        const facelet = window.cubeutil.getScrambledState(['333', scrambleStr], true);
        window.renderFaceletString(facelet);
    } catch (e) {
        console.warn('Failed to render BLD Helper cube:', e);
    }
}

export default function BldHelperTab() {
    const { config, updateField, reset } = useBldHelperConfig();
    const { config: scrambleConfig } = useScrambleConfig();
    const out = useScrambleOutput();

    const [lastResult, setLastResult] = useState(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkScrambles, setBulkScrambles] = useState([]);
    const [bulkProgress, setBulkProgress] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    const generateOnce = () => {
        if (typeof window.getBLDInfo !== 'function') {
            throw new Error('BLD Helper engine not loaded (getBLDInfo missing).');
        }
        // Pull buffers and BLD orientation from the shared scramble config.
        const cbuffPiece = Math.max(0, CORNER_NAMES.indexOf(scrambleConfig.cornerBufferOrder[0]));
        const ebuffPiece = Math.max(0, EDGE_NAMES.indexOf(scrambleConfig.edgeBufferOrder[0]));
        const merged = {
            ...config,
            cbuffPiece,
            ebuffPiece,
            bldOrientation: scrambleConfig.holdingOrientation,
        };
        return window.getBLDInfo(getBldSets(merged));
    };

    const onGenerate = () => {
        try {
            out.clear();
            const result = generateOnce();
            setLastResult(result);
            const text = `Scramble: ${result.scramble}\n\n${result.code}\n\nProbability: ${formatProb(result.prob)}\nTotal Cases: ${formatCases(result.caseNum)}`;
            out.setScrambleText(text);
            renderCubeFromScramble(result.scramble);
        } catch (e) {
            out.setError(e.message);
        }
    };

    const onBulk = () => {
        const count = Math.max(1, parseInt(config.bulkCount) || 1);
        setBulkScrambles([]);
        setBulkProgress({ done: 0, total: count });
        setBulkOpen(true);

        const next = (i, acc) => {
            if (i >= count) {
                setBulkScrambles(acc);
                setBulkProgress(null);
                return;
            }
            try {
                const result = generateOnce();
                acc = [...acc, { scramble: result.scramble }];
            } catch (e) {
                acc = [...acc, { error: e.message }];
            }
            setBulkScrambles(acc);
            setBulkProgress({ done: i + 1, total: count });
            setTimeout(() => next(i + 1, acc), 0);
        };
        setTimeout(() => next(0, []), 50);
    };

    const onReset = () => {
        if (!confirm('Reset BLD Helper settings to defaults?')) return;
        reset();
        out.clear();
        setLastResult(null);
    };

    return (
        <>
            <CornerSettingsCard />
            <EdgeSettingsCard />
            <GeneralSettingsCard />

            <div className="card">
                <div className="card-header">
                    <span className="card-title">Actions</span>
                </div>
                <div className="card-body">
                    <div className="action-row">
                        <button type="button" className="btn btn-primary" onClick={onGenerate}>Generate scramble</button>
                        <button type="button" className="btn" onClick={onReset}>Reset to defaults</button>
                        <button type="button" className="btn btn-ghost" onClick={() => setPreviewOpen(true)}>Preview in csTimer</button>
                    </div>
                    <div className="row-flex" style={{ marginTop: 12 }}>
                        <span className="row-label" style={{ marginBottom: 0 }}>Generate bulk</span>
                        <input
                            className="input input-num"
                            type="number"
                            min="1"
                            value={config.bulkCount}
                            onChange={(e) => updateField('bulkCount')(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <button type="button" className="btn" onClick={onBulk}>Generate</button>
                    </div>
                </div>
            </div>

            <BulkModal
                open={bulkOpen}
                scrambles={bulkScrambles}
                progress={bulkProgress}
                onClose={() => setBulkOpen(false)}
            />
            <CstimerPreviewModal
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                lastResult={lastResult}
            />
        </>
    );
}
