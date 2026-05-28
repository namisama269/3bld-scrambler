import { useMemo } from 'react';
import { useBldHelperConfig, getBldSets, CORNER_NAMES, EDGE_NAMES } from '../state/BldHelperConfigContext.jsx';
import { useScrambleConfig } from '../state/ScrambleConfigContext.jsx';
import CornerSettingsCard from './bldHelper/CornerSettingsCard.jsx';
import EdgeSettingsCard from './bldHelper/EdgeSettingsCard.jsx';

function formatProb(p) {
    if (p === 0) return '0';
    return p < 1e-3 ? p.toExponential(3) : `${Math.round(p * 1000000) / 10000}%`;
}

function formatCases(n) {
    return n > 1e8 ? n.toExponential(3) : String(n);
}

export default function BldHelperTab() {
    const { config: bldConfig } = useBldHelperConfig();
    const { config: scrambleConfig } = useScrambleConfig();

    const stats = useMemo(() => {
        if (typeof window.getBLDStats !== 'function') return null;
        try {
            const cbuffPiece = Math.max(0, CORNER_NAMES.indexOf(scrambleConfig.cornerBufferOrder[0]));
            const ebuffPiece = Math.max(0, EDGE_NAMES.indexOf(scrambleConfig.edgeBufferOrder[0]));
            const merged = {
                ...bldConfig,
                cbuffPiece,
                ebuffPiece,
            };
            return window.getBLDStats(getBldSets(merged));
        } catch {
            return null;
        }
    }, [bldConfig, scrambleConfig]);

    return (
        <>
            {stats && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">BLD Helper</span>
                    </div>
                    <div className="card-body" style={{ padding: '10px 14px' }}>
                        <div className="row" style={{ fontSize: 12 }}>
                            <span className="row-label">Probability</span>
                            <span style={{ fontFamily: 'var(--font-mono)' }}>{formatProb(stats.prob)}</span>
                        </div>
                        <div className="row" style={{ fontSize: 12 }}>
                            <span className="row-label">Total cases</span>
                            <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCases(stats.caseNum)}</span>
                        </div>
                    </div>
                </div>
            )}
            <CornerSettingsCard />
            <EdgeSettingsCard />
        </>
    );
}
