// BLD Helper tab — UI logic ported from cstimer-bldhelper. Handlers are
// renamed (generateBldHelperScramble, bulkGenerateBldHelper,
// resetBldHelperSettings, saveBldHelperSettings) to avoid colliding with
// 3bld-scrambler's existing scrambler globals.

(function () {
    const ChiChu = "JLK ABC DFE GHI XYZ WNM OPQ RTS GH AB CD EF OP IJ KL MN QR ST WX YZ";
    const Speffz = "CJM DIF ARE BQN VKP ULG XSH WTO BM CI DE AQ VO UK XG WS JP LF RH TN";
    const OrdUDE = "012345670123456789ab";

    const STORAGE_KEY = 'bldhelper-settings';

    // Bail out cleanly if the BLD Helper DOM isn't on this page.
    if (!document.getElementById('cbuff-piece')) return;

    function $(id) { return document.getElementById(id); }

    function updateSchemeDisplay() {
        const sel = $('scheme').value;
        const input = $('custom-scheme');
        if (sel === 'speffz') {
            input.value = Speffz;
            input.readOnly = true;
            input.disabled = true;
        } else if (sel === 'chichu') {
            input.value = ChiChu;
            input.readOnly = true;
            input.disabled = true;
        } else {
            input.readOnly = false;
            input.disabled = false;
        }
    }

    function orderToLetters(order, scheme) {
        let result = '';
        for (let i = 0; i < 20; i++) {
            const ord = parseInt(order[i], 24);
            if (i < 8) {
                result += scheme[ord % 8 * 4 + ~~(ord / 8)];
            } else {
                result += scheme[32 + ord % 12 * 3 + ~~(ord / 12)];
            }
        }
        return result.slice(0, 8) + ' ' + result.slice(8);
    }

    function lettersToOrder(letters, scheme) {
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

    function updateOrderDisplay() {
        const sel = $('order').value;
        const input = $('custom-order');
        const scheme = $('custom-scheme').value;
        if (sel === 'ordude') {
            input.value = orderToLetters(OrdUDE, scheme);
            input.readOnly = true;
            input.disabled = true;
        } else {
            input.readOnly = false;
            input.disabled = false;
        }
    }

    function getFixedString(solvId, twistId) {
        const parts = [];
        document.querySelectorAll('#' + solvId + ' input:checked').forEach(function (cb) {
            parts.push(cb.dataset.piece);
        });
        document.querySelectorAll('#' + twistId + ' input:checked').forEach(function (cb) {
            parts.push(cb.dataset.piece + '+');
        });
        return parts.join(' ');
    }

    function setFixedFromString(solvId, twistId, str) {
        document.querySelectorAll('#' + solvId + ' input, #' + twistId + ' input').forEach(function (cb) {
            cb.checked = false;
            cb.disabled = false;
        });
        if (!str) return;
        str.trim().split(/\s+/).forEach(function (token) {
            const m = token.match(/^(\w+?)(\+?)$/);
            if (!m) return;
            const piece = m[1].toUpperCase();
            const targetId = m[2] ? twistId : solvId;
            const otherId = m[2] ? solvId : twistId;
            const cb = document.querySelector('#' + targetId + ' input[data-piece="' + piece + '"]');
            if (cb) {
                cb.checked = true;
                const other = document.querySelector('#' + otherId + ' input[data-piece="' + piece + '"]');
                if (other) other.disabled = true;
            }
        });
    }

    function setupFixedExclusion(solvId, twistId) {
        [solvId, twistId].forEach(function (id) {
            const otherId = (id === solvId) ? twistId : solvId;
            document.querySelectorAll('#' + id + ' input').forEach(function (cb) {
                cb.addEventListener('change', function () {
                    const other = document.querySelector('#' + otherId + ' input[data-piece="' + this.dataset.piece + '"]');
                    if (other) {
                        other.disabled = this.checked;
                        if (this.checked) other.checked = false;
                    }
                });
            });
        });
    }

    function updateBufferExclusion(buffId, solvId, twistId) {
        const sel = $(buffId);
        const buffPiece = sel.options[sel.selectedIndex].text;
        [solvId, twistId].forEach(function (gridId) {
            document.querySelectorAll('#' + gridId + ' label').forEach(function (lbl) {
                const cb = lbl.querySelector('input');
                if (cb.dataset.piece === buffPiece) {
                    lbl.style.display = 'none';
                    cb.checked = false;
                    cb.disabled = false;
                } else {
                    lbl.style.display = '';
                }
            });
        });
    }

    function onBufferChange(buffId, solvId, twistId) {
        setFixedFromString(solvId, twistId, '');
        updateBufferExclusion(buffId, solvId, twistId);
        saveBldHelperSettings();
    }

    function setupRangeValidation(minId, maxId) {
        const minInput = $(minId);
        const maxInput = $(maxId);
        minInput.addEventListener('change', function () {
            const minVal = parseInt(this.value);
            const maxVal = parseInt(maxInput.value);
            if (minVal > maxVal) maxInput.value = minVal;
        });
        maxInput.addEventListener('change', function () {
            const minVal = parseInt(minInput.value);
            const maxVal = parseInt(this.value);
            if (maxVal < minVal) minInput.value = maxVal;
        });
    }

    function saveBldHelperSettings() {
        const settings = {
            cbuffPiece: $('cbuff-piece').value,
            cbuffStatus: $('cbuff-status').value,
            cfix: getFixedString('csolv-checks', 'ctwist-checks'),
            cnerrLRMin: $('cnerrLR-min').value,
            cnerrLRMax: $('cnerrLR-max').value,
            cscycLRMin: $('cscycLR-min').value,
            cscycLRMax: $('cscycLR-max').value,
            cncodeLRMin: $('cncodeLR-min').value,
            cncodeLRMax: $('cncodeLR-max').value,
            ebuffPiece: $('ebuff-piece').value,
            ebuffStatus: $('ebuff-status').value,
            efix: getFixedString('esolv-checks', 'eflip-checks'),
            enerrLRMin: $('enerrLR-min').value,
            enerrLRMax: $('enerrLR-max').value,
            escycLRMin: $('escycLR-min').value,
            escycLRMax: $('escycLR-max').value,
            encodeLRMin: $('encodeLR-min').value,
            encodeLRMax: $('encodeLR-max').value,
            ceparity: $('ceparity').value,
            bldOrientation: $('bld-orientation').value,
            ceori: $('ceori').value === '1',
            scheme: $('scheme').value,
            customScheme: $('custom-scheme').value,
            order: $('order').value,
            customOrder: (function () {
                const orderSel = $('order').value;
                if (orderSel === 'ordude') return OrdUDE;
                const schemeStr = $('custom-scheme').value;
                return lettersToOrder($('custom-order').value, schemeStr) || OrdUDE;
            })()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    function loadBldHelperSettings() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        try {
            const settings = JSON.parse(saved);
            if (settings.cbuffPiece !== undefined) $('cbuff-piece').value = settings.cbuffPiece;
            if (settings.cbuffStatus !== undefined) $('cbuff-status').value = settings.cbuffStatus;
            if (settings.cfix !== undefined) setFixedFromString('csolv-checks', 'ctwist-checks', settings.cfix);
            updateBufferExclusion('cbuff-piece', 'csolv-checks', 'ctwist-checks');
            if (settings.cnerrLRMin !== undefined) $('cnerrLR-min').value = settings.cnerrLRMin;
            if (settings.cnerrLRMax !== undefined) $('cnerrLR-max').value = settings.cnerrLRMax;
            if (settings.cscycLRMin !== undefined) $('cscycLR-min').value = settings.cscycLRMin;
            if (settings.cscycLRMax !== undefined) $('cscycLR-max').value = settings.cscycLRMax;
            if (settings.cncodeLRMin !== undefined) $('cncodeLR-min').value = settings.cncodeLRMin;
            if (settings.cncodeLRMax !== undefined) $('cncodeLR-max').value = settings.cncodeLRMax;
            if (settings.ebuffPiece !== undefined) $('ebuff-piece').value = settings.ebuffPiece;
            if (settings.ebuffStatus !== undefined) $('ebuff-status').value = settings.ebuffStatus;
            if (settings.efix !== undefined) setFixedFromString('esolv-checks', 'eflip-checks', settings.efix);
            updateBufferExclusion('ebuff-piece', 'esolv-checks', 'eflip-checks');
            if (settings.enerrLRMin !== undefined) $('enerrLR-min').value = settings.enerrLRMin;
            if (settings.enerrLRMax !== undefined) $('enerrLR-max').value = settings.enerrLRMax;
            if (settings.escycLRMin !== undefined) $('escycLR-min').value = settings.escycLRMin;
            if (settings.escycLRMax !== undefined) $('escycLR-max').value = settings.escycLRMax;
            if (settings.encodeLRMin !== undefined) $('encodeLR-min').value = settings.encodeLRMin;
            if (settings.encodeLRMax !== undefined) $('encodeLR-max').value = settings.encodeLRMax;
            if (settings.ceparity !== undefined) $('ceparity').value = settings.ceparity;
            if (settings.bldOrientation !== undefined) $('bld-orientation').value = settings.bldOrientation;
            if (settings.ceori !== undefined) $('ceori').value = settings.ceori ? '1' : '0';
            if (settings.scheme !== undefined) $('scheme').value = settings.scheme;
            if (settings.customScheme !== undefined) $('custom-scheme').value = settings.customScheme;
            updateSchemeDisplay();
            if (settings.order !== undefined) $('order').value = settings.order;
            if (settings.customOrder !== undefined && settings.order === 'custom') {
                const schemeStr = $('custom-scheme').value;
                $('custom-order').value = orderToLetters(settings.customOrder, schemeStr);
            }
            updateOrderDisplay();
        } catch (e) {
            console.error('Failed to load BLD Helper settings:', e);
        }
    }

    function setupAutoSave() {
        const inputs = [
            'cbuff-piece', 'cbuff-status',
            'cnerrLR-min', 'cnerrLR-max', 'cscycLR-min', 'cscycLR-max',
            'cncodeLR-min', 'cncodeLR-max',
            'ebuff-piece', 'ebuff-status',
            'enerrLR-min', 'enerrLR-max', 'escycLR-min', 'escycLR-max',
            'encodeLR-min', 'encodeLR-max',
            'ceparity', 'bld-orientation', 'ceori', 'scheme', 'custom-scheme', 'order', 'custom-order'
        ];
        inputs.forEach(function (id) {
            const el = $(id);
            if (!el) return;
            el.addEventListener('change', saveBldHelperSettings);
            if (el.type === 'text') el.addEventListener('input', saveBldHelperSettings);
        });
        document.querySelectorAll('#csolv-checks input, #ctwist-checks input, #esolv-checks input, #eflip-checks input').forEach(function (cb) {
            cb.addEventListener('change', saveBldHelperSettings);
        });
    }

    function getBldSets() {
        let scheme;
        const schemeSelect = $('scheme').value;
        if (schemeSelect === 'speffz') scheme = Speffz;
        else if (schemeSelect === 'chichu') scheme = ChiChu;
        else scheme = $('custom-scheme').value || Speffz;

        let order;
        const orderSelect = $('order').value;
        if (orderSelect === 'ordude') {
            order = OrdUDE;
        } else {
            const letters = $('custom-order').value;
            order = lettersToOrder(letters, scheme) || OrdUDE;
        }

        return {
            cbuff: [parseInt($('cbuff-piece').value), parseInt($('cbuff-status').value)],
            cfix: getFixedString('csolv-checks', 'ctwist-checks'),
            cnerrLR: [parseInt($('cnerrLR-min').value), parseInt($('cnerrLR-max').value)],
            cscycLR: [parseInt($('cscycLR-min').value), parseInt($('cscycLR-max').value)],
            cncodeLR: [parseInt($('cncodeLR-min').value), parseInt($('cncodeLR-max').value)],
            ebuff: [parseInt($('ebuff-piece').value), parseInt($('ebuff-status').value)],
            efix: getFixedString('esolv-checks', 'eflip-checks'),
            enerrLR: [parseInt($('enerrLR-min').value), parseInt($('enerrLR-max').value)],
            escycLR: [parseInt($('escycLR-min').value), parseInt($('escycLR-max').value)],
            encodeLR: [parseInt($('encodeLR-min').value), parseInt($('encodeLR-max').value)],
            ceparity: parseInt($('ceparity').value),
            ceori: $('ceori').value === '1',
            scheme: scheme,
            order: order
        };
    }

    let lastBldHelperResult = null;

    function renderBldHelperCube(scrambleStr) {
        const canvas = document.getElementById('cubeCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        // cstimer's cubeutil emits a 54-char URFDLB facelet string — directly
        // compatible with 3bld-scrambler's VisualCube.cubeString.
        const facelet = cubeutil.getScrambledState(["333", scrambleStr], true);
        vc.cubeString = facelet;
        vc.drawCube(ctx);
    }

    function generateBldHelperScramble() {
        const bldSets = getBldSets();
        const scrambleAlert = document.getElementById('scramble');
        try {
            const result = getBLDInfo(bldSets);
            lastBldHelperResult = result;

            const probStr = result.prob < 1e-3
                ? result.prob.toExponential(3)
                : (Math.round(result.prob * 1000000) / 10000 + '%');
            const caseStr = result.caseNum > 1e8 ? result.caseNum.toExponential(3) : result.caseNum;

            const out =
                'Scramble: ' + result.scramble + '\n\n' +
                result.code + '\n\n' +
                'Probability: ' + probStr + '\n' +
                'Total Cases: ' + caseStr;

            if (scrambleAlert) {
                scrambleAlert.textContent = out;
                scrambleAlert.classList.remove('hidden');
                scrambleAlert.style.whiteSpace = 'pre-wrap';
            }
            // Hide the regular scramble list when BLD Helper takes over.
            const list = document.getElementById('scrambleList');
            if (list) list.classList.add('hidden');
            const debugPre = document.getElementById('debugText');
            if (debugPre) debugPre.classList.add('hidden');

            renderBldHelperCube(result.scramble);
        } catch (error) {
            if (scrambleAlert) {
                scrambleAlert.textContent = 'Error: ' + error.message;
                scrambleAlert.classList.remove('hidden');
            }
            console.error(error);
        }
    }

    let bulkAbort = false;

    function closeBulkModal() {
        bulkAbort = true;
        document.getElementById('bulk-modal').classList.remove('active');
    }

    function copyBulkScrambles() {
        const list = document.getElementById('scramble-list');
        const entries = list.querySelectorAll('.scramble-entry');
        let text = '';
        entries.forEach(function (entry) { text += entry.dataset.scramble + '\n'; });
        navigator.clipboard.writeText(text.trim()).then(function () {
            const btn = document.querySelector('#bulk-modal .copy-btn');
            if (!btn) return;
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(function () { btn.textContent = original; }, 1500);
        });
    }

    function bulkGenerateBldHelper() {
        const count = parseInt(document.getElementById('bulk-count').value) || 12;
        if (count < 1) return;

        const bldSets = getBldSets();
        bulkAbort = false;

        const modal = document.getElementById('bulk-modal');
        const list = document.getElementById('scramble-list');
        const fill = document.getElementById('progress-fill');
        const text = document.getElementById('progress-text');
        const progressContainer = document.getElementById('progress-container');

        modal.classList.add('active');
        list.innerHTML = '';
        fill.style.width = '0%';
        text.textContent = '0 / ' + count;
        progressContainer.style.display = 'block';

        let generated = 0;

        function generateNext() {
            if (bulkAbort || generated >= count) {
                if (!bulkAbort) progressContainer.style.display = 'none';
                return;
            }
            try {
                const result = getBLDInfo(bldSets);
                generated++;
                fill.style.width = (generated / count * 100).toFixed(1) + '%';
                text.textContent = generated + ' / ' + count;

                const entry = document.createElement('div');
                entry.className = 'scramble-entry';
                entry.dataset.scramble = result.scramble;
                const numSpan = document.createElement('span');
                numSpan.className = 'scramble-num';
                numSpan.textContent = generated + '.';
                entry.appendChild(numSpan);
                entry.appendChild(document.createTextNode(' ' + result.scramble));
                list.appendChild(entry);
                list.scrollTop = list.scrollHeight;
                setTimeout(generateNext, 0);
            } catch (error) {
                generated++;
                fill.style.width = (generated / count * 100).toFixed(1) + '%';
                text.textContent = generated + ' / ' + count;
                const entry = document.createElement('div');
                entry.className = 'scramble-entry scramble-entry-error';
                entry.textContent = generated + '. Error: ' + error.message;
                list.appendChild(entry);
                setTimeout(generateNext, 0);
            }
        }
        setTimeout(generateNext, 50);
    }

    function resetBldHelperSettings() {
        if (!confirm('Reset all BLD Helper settings to defaults?')) return;
        const savedOri = $('bld-orientation').value;
        localStorage.removeItem(STORAGE_KEY);

        $('cbuff-piece').value = '0';
        $('cbuff-status').value = '7';
        setFixedFromString('csolv-checks', 'ctwist-checks', '');
        $('cnerrLR-min').value = '0';
        $('cnerrLR-max').value = '7';
        $('cscycLR-min').value = '0';
        $('cscycLR-max').value = '3';
        $('cncodeLR-min').value = '0';
        $('cncodeLR-max').value = '10';
        $('ebuff-piece').value = '1';
        $('ebuff-status').value = '7';
        setFixedFromString('esolv-checks', 'eflip-checks', '');
        $('enerrLR-min').value = '0';
        $('enerrLR-max').value = '11';
        $('escycLR-min').value = '0';
        $('escycLR-max').value = '5';
        $('encodeLR-min').value = '0';
        $('encodeLR-max').value = '16';
        $('ceparity').value = '3';
        $('bld-orientation').value = savedOri;
        $('ceori').value = '1';
        $('scheme').value = 'speffz';
        $('custom-scheme').value = '';
        $('order').value = 'ordude';
        $('custom-order').value = '';
        updateSchemeDisplay();
        updateOrderDisplay();
        updateBufferExclusion('cbuff-piece', 'csolv-checks', 'ctwist-checks');
        updateBufferExclusion('ebuff-piece', 'esolv-checks', 'eflip-checks');
        saveBldHelperSettings();
    }

    // csTimer preview
    const cornerNames = ['UFR', 'UFL', 'UBL', 'UBR', 'DFR', 'DFL', 'DBL', 'DBR'];
    const edgeNames = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
    const statusLabels = { 1: 'ok', 2: 'flip', 3: 'ok/flip', 4: 'move', 5: 'ok/move', 6: 'not ok', 7: 'any' };
    const parityLabels = { 1: 'even', 2: 'odd', 3: 'parity' };

    function getBufferLetter(pieceIdx, isEdge) {
        const scheme = getBldSets().scheme;
        const parts = scheme.split(/\s+/);
        if (isEdge) {
            const edgePart = parts[8 + pieceIdx];
            return edgePart ? edgePart.charAt(0) : '?';
        } else {
            const cornPart = parts[pieceIdx];
            return cornPart ? cornPart.charAt(0) : '?';
        }
    }

    function setSelectValue(id, text) {
        const el = $(id);
        el.innerHTML = '';
        const opt = document.createElement('option');
        opt.textContent = text;
        el.appendChild(opt);
    }

    function showCstimerPreview() {
        const cbuffPiece = parseInt($('cbuff-piece').value);
        const cbuffStatus = parseInt($('cbuff-status').value);
        const ebuffPiece = parseInt($('ebuff-piece').value);
        const ebuffStatus = parseInt($('ebuff-status').value);
        const parity = parseInt($('ceparity').value);
        const schemeVal = $('scheme').value;

        const schemeLabel = schemeVal === 'speffz' ? 'Speffz' : schemeVal === 'chichu' ? 'ChiChu' : 'Custom';
        setSelectValue('cst-scheme', schemeLabel);
        const orderVal = $('order').value;
        const orderLabel = orderVal === 'ordude' ? 'U>D>E' : 'Custom';
        setSelectValue('cst-order', orderLabel);

        $('cst-ori').checked = $('ceori').value === '1';
        setSelectValue('cst-parity', parityLabels[parity] || 'parity');

        const cLetter = getBufferLetter(cbuffPiece, false);
        setSelectValue('cst-cbuff0', cornerNames[cbuffPiece] + ' [' + cLetter + ']');
        setSelectValue('cst-cbuff1', statusLabels[cbuffStatus] || 'any');

        const eLetter = getBufferLetter(ebuffPiece, true);
        setSelectValue('cst-ebuff0', edgeNames[ebuffPiece] + ' [' + eLetter + ']');
        setSelectValue('cst-ebuff1', statusLabels[ebuffStatus] || 'any');

        $('cst-cfix').textContent = getFixedString('csolv-checks', 'ctwist-checks');
        $('cst-efix').textContent = getFixedString('esolv-checks', 'eflip-checks');

        $('cst-cnerr').value = $('cnerrLR-min').value + '-' + $('cnerrLR-max').value;
        $('cst-enerr').value = $('enerrLR-min').value + '-' + $('enerrLR-max').value;
        $('cst-cscyc').value = $('cscycLR-min').value + '-' + $('cscycLR-max').value;
        $('cst-escyc').value = $('escycLR-min').value + '-' + $('escycLR-max').value;
        $('cst-cncode').value = $('cncodeLR-min').value + '-' + $('cncodeLR-max').value;
        $('cst-encode').value = $('encodeLR-min').value + '-' + $('encodeLR-max').value;

        if (lastBldHelperResult) {
            const codeMatch = lastBldHelperResult.code.match(/Corners:.*\nEdges:.*/);
            $('cst-code').textContent = codeMatch ? codeMatch[0] : lastBldHelperResult.code;
            const probStr = lastBldHelperResult.prob < 1e-3
                ? lastBldHelperResult.prob.toExponential(3)
                : (Math.round(lastBldHelperResult.prob * 1000000) / 10000 + '%');
            $('cst-probs').textContent = probStr;
        } else {
            $('cst-code').textContent = '—';
            $('cst-probs').textContent = '—';
        }

        document.getElementById('cst-preview-modal').classList.add('active');
    }

    function closeCstimerPreview() {
        document.getElementById('cst-preview-modal').classList.remove('active');
    }

    // Wire up
    setupFixedExclusion('csolv-checks', 'ctwist-checks');
    setupFixedExclusion('esolv-checks', 'eflip-checks');
    updateBufferExclusion('cbuff-piece', 'csolv-checks', 'ctwist-checks');
    updateBufferExclusion('ebuff-piece', 'esolv-checks', 'eflip-checks');
    setupRangeValidation('cnerrLR-min', 'cnerrLR-max');
    setupRangeValidation('cscycLR-min', 'cscycLR-max');
    setupRangeValidation('cncodeLR-min', 'cncodeLR-max');
    setupRangeValidation('enerrLR-min', 'enerrLR-max');
    setupRangeValidation('escycLR-min', 'escycLR-max');
    setupRangeValidation('encodeLR-min', 'encodeLR-max');

    $('scheme').addEventListener('change', function () { updateSchemeDisplay(); updateOrderDisplay(); });
    $('order').addEventListener('change', updateOrderDisplay);
    $('cbuff-piece').addEventListener('change', function () { onBufferChange('cbuff-piece', 'csolv-checks', 'ctwist-checks'); });
    $('ebuff-piece').addEventListener('change', function () { onBufferChange('ebuff-piece', 'esolv-checks', 'eflip-checks'); });

    updateSchemeDisplay();
    updateOrderDisplay();
    loadBldHelperSettings();
    setupAutoSave();

    // Expose handlers used by inline onclick attributes.
    window.generateBldHelperScramble = generateBldHelperScramble;
    window.bulkGenerateBldHelper = bulkGenerateBldHelper;
    window.resetBldHelperSettings = resetBldHelperSettings;
    window.showCstimerPreview = showCstimerPreview;
    window.closeCstimerPreview = closeCstimerPreview;
    window.closeBulkModal = closeBulkModal;
    window.copyBulkScrambles = copyBulkScrambles;
    window.setFixedFromString = setFixedFromString;
    window.saveBldHelperSettings = saveBldHelperSettings;
})();
