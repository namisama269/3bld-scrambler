"use strict";

var min2phase = require('./min2phase.js');
var mathlib = require('./mathlib.js');
var cubeutil = require('./cubeutil.js');

var bldhelper = (function() {
	// bld scramble gen
	function enumCycles(n, k) {
		if (k == undefined) {
			var ret = [];
			for (var i = 0; i < n; i++) {
				var cur = enumCycles(n, i + 1);
				ret.push.apply(ret, cur);
			}
			return ret;
		}
		if (n < k || n < 1 || k < 1) {
			return [];
		} else if (n == k) {
			return [mathlib.valuedArray(n, 1)];
		}
		var rm1 = enumCycles(n - 1, k - 1);
		for (var i = 0; i < rm1.length; i++) {
			rm1[i].push(1);
		}
		var dec1 = enumCycles(n - k, k);
		for (var i = 0; i < dec1.length; i++) {
			var cur = dec1[i];
			for (var j = 0; j < cur.length; j++) {
				cur[j]++;
			}
		}
		return rm1.concat(dec1);
	}

	function cntPerms(cycles) {
		if (cycles.length == 0) {
			return 1;
		}
		var n = cycles[0];
		var curVal = cycles[0];
		var curCnt = 1;
		var remain = [];
		for (var i = 1; i < cycles.length; i++) {
			n += cycles[i];
			if (cycles[i] == curVal) {
				curCnt++;
			} else {
				remain.push(cycles[i]);
			}
		}
		var cur = 1;
		for (var i = 0; i < curCnt; i++) {
			cur *= mathlib.Cnk[n][curVal] * mathlib.fact[curVal - 1];
			cur /= (i + 1);
			n -= curVal;
		}
		return cur * cntPerms(remain);
	}

	function cntOris(n, base, nDone, nErr) {
		if (nDone + nErr > n) {
			return [0, null];
		}
		var cum = 0;
		var ret = [];
		for (var i = nDone; i < n - 1; i++) {
			var skip = (i < nDone + nErr) ? 1 : 0;
			var cur = mathlib.rn(base - skip) + skip;
			ret.push(cur);
			cum += cur;
		}
		if (nDone + nErr < n) { //at least 1 any
			ret.push((base * n - cum) % base);
			return [Math.pow(base - 1, nErr) * Math.pow(base, n - nDone - nErr - 1), mathlib.valuedArray(nDone, 0).concat(ret)];
		}
		var sum = mathlib.valuedArray(base, 0);
		sum[0] = 1;
		for (var i = 0; i < nErr; i++) {
			var sum2 = mathlib.valuedArray(base, 0);
			for (var j = 1; j < base; j++) {
				for (var k = 0; k < base; k++) {
					sum2[(j + k) % base] += sum[k];
				}
			}
			sum = sum2;
		}
		if (sum[0] == 0) {
			return [0, null];
		}
		var last = (base * n - cum) % base;
		while (last == 0 && nErr > 0) {
			cum = 0;
			ret = [];
			for (var i = nDone; i < n - 1; i++) {
				var skip = (i < nDone + nErr) ? 1 : 0;
				var cur = mathlib.rn(base - skip) + skip;
				ret.push(cur);
				cum += cur;
			}
			last = (base * n - cum) % base;
		}
		ret.push(last);
		return [sum[0], mathlib.valuedArray(nDone, 0).concat(ret)];
	}

	// buff: buffer cubie status bitmask (0 - done, 1 - flip, 2 - in cycles)
	// fixdone: num of fix-solved cubies (exclude buffer)
	// fixerr: num of fix-flipped cubies (exclude buffer)
	// nerrLR: total num of flipped cubies (include fixed, exclude buffer)
	// scycle: num of cycles without the buffer cubie
	// ncodeLR: num of encoded words without flips
	// return [cntValid, rndState]
	function getRandState(buff, fixDone, fixErr, nerrLR, scycleLR, ncodeLR, base, cycles, ignoreFlip) {
		var cycCnt = 0;
		var inpCnt = 0;
		var oupCnt = 0;
		for (var i = 0; i < cycles.length; i++) {
			if (cycles[i] == 1) {
				inpCnt++;
			} else {
				oupCnt += cycles[i];
				cycCnt++;
			}
		}
		if (ignoreFlip && (buff & 0x3) == 0x3) {
			buff &= ~2;
		}
		var cntValid = 0;
		var rndState = null;
		for (var i = 0; i < 3; i++) { // enum buff status
			if ((buff >> i & 1) == 0) {
				continue;
			}
			var scycle = cycCnt - (i >> 1);
			var ncode = oupCnt + cycCnt - (i >> 1) * 2;
			if (scycle < scycleLR[0] || scycle > scycleLR[1]
					|| ncode < ncodeLR[0] || ncode > ncodeLR[1]) {
				continue
			}
			var bufErr = i == 1 ? 1 : 0;
			var fixErr1 = fixErr + bufErr;
			var fixInp = fixDone + fixErr + (i < 2 ? 1 : 0);
			if (inpCnt < Math.max(fixInp, nerrLR[0] + bufErr) || fixErr > nerrLR[1]) {
				continue;
			}

			// calc oris
			var anyInp = inpCnt - fixInp;
			var cntFlip = 0;
			var flips = null;
			var anySamp = 0;
			for (var j = Math.max(nerrLR[0] - fixErr, 0); j <= Math.min(nerrLR[1] - fixErr, anyInp); j++) {
				var cur = cntOris(cycCnt + inpCnt, base, inpCnt - fixErr1 - j, fixErr1 + j);
				var curCnt = cur[0] * mathlib.Cnk[anyInp][j];
				cntFlip += curCnt;
				if (mathlib.rndHit(curCnt / cntFlip)) {
					flips = cur[1];
					anySamp = j;
				}
			}
			if (cntFlip == 0 && !ignoreFlip) {
				continue;
			}
			cntFlip *= Math.pow(base, oupCnt - cycCnt);

			// calc perms
			var cyclesR = cycles.slice(0, cycles.length - fixInp);
			var remainCnt = inpCnt + oupCnt - fixInp;
			var mulPerm = 1;
			while (cyclesR.length > 0) {
				var curLen = cyclesR.pop();
				var curCnt = 1;
				mulPerm *= mathlib.Cnk[remainCnt][curLen] * mathlib.fact[curLen - 1];
				remainCnt -= curLen;
				while (cyclesR.at(-1) == curLen) {
					cyclesR.pop();
					curCnt++;
					mulPerm *= mathlib.Cnk[remainCnt][curLen] * mathlib.fact[curLen - 1];
					mulPerm /= curCnt;
					remainCnt -= curLen;
				}
				if (curLen == 1 && i == 2) {
					mulPerm *= oupCnt;
					mulPerm /= inpCnt + oupCnt - fixInp;
				}
			}
			var curValid = (ignoreFlip ? 1 : cntFlip) * mulPerm;
			cntValid += curValid;
			if (!mathlib.rndHit(curValid / cntValid)) { // not sampled
				continue;
			}

			// flip sample
			var flipState = [];
			for (var j = 0; j < cycCnt; j++) {
				var cursum = flips.pop();
				var curLen = cycles[j];
				for (var k = 0; k < curLen - 1; k++) {
					var cur = mathlib.rn(base);
					flipState.push(cur);
					cursum += base - cur;
				}
				flipState.push(cursum % base);
			}
			var rndp = mathlib.rndPerm(anyInp);
			for (var j = 0; j < rndp.length; j++) {
				if (rndp[j] < anySamp) {
					flipState.push(flips.pop());
				} else {
					flipState.push(flips.shift());
				}
			}
			if (i < 2) {
				flipState.unshift(i == 0 ? flips.shift() : flips.pop());
				flipState.splice.apply(flipState, [1, 0].concat(flips));
			} else {
				flipState.splice.apply(flipState, [0, 0].concat(flips));
			}

			// perm sample
			cyclesR = cycles.slice(0, cycles.length - fixInp);
			var permState = [0];
			rndState = [];
			var rmap = [0];
			var k = (i == 2) ? 1 : 0;
			if (k == 0) {
				rndState[0] = [0, flipState.shift()];
			}
			for (var j = 1; j < oupCnt + inpCnt; j++) {
				permState[j] = j;
				if (j >= 1 + fixDone + fixErr) {
					rmap[k] = j;
					k++;
				} else {
					rndState[j] = [j, flipState.shift()];
				}
			}
			remainCnt = inpCnt + oupCnt - fixInp;
			var perm = mathlib.rndPerm(remainCnt);
			if (i == 2 && perm.indexOf(0) >= oupCnt) {
				var offset = (perm.indexOf(0) - mathlib.rn(oupCnt) + remainCnt) % remainCnt;
				perm = perm.slice(offset).concat(perm.slice(0, offset));
			}
			var permCycles = [];
			for (var j = 0; j < cyclesR.length; j++) {
				var cur = perm.slice(0, cyclesR[j]);
				permCycles.push(cur);
				perm = perm.slice(cyclesR[j]);
				for (var l = 0; l < cur.length; l++) {
					permState[rmap[cur[l]]] = rmap[cur[(l + 1) % cur.length]];
					rndState[rmap[cur[l]]] = [rmap[cur[(l + 1) % cur.length]], flipState.shift()];
				}
			}
		}
		return [cntValid, rndState];
	}

	function getParity(cycles) {
		var p = 0;
		for (var i = 0; i < cycles.length; i++) {
			p ^= cycles[i] + 1;
		}
		return p & 1;
	}

	function getBLDcode(c, scheme, cbuf, ebuf, order) {
		var cori = ~~(cbuf / 8);
		cbuf %= 8;
		cori ^= (0xa5 >> cbuf & 0x1) * 3;
		var eori = ~~(ebuf / 12);
		ebuf %= 12;
		var corns = [];
		var corders = [];
		for (var i = 0; i < 8; i++) {
			corns[i] = scheme.slice(i * 4, i * 4 + 3);
			corders[i] = parseInt(order[i], 24);
		}
		var edges = [];
		var eorders = [];
		for (var i = 0; i < 12; i++) {
			edges[i] = scheme.slice(32 + i * 3, 32 + i * 3 + 2);
			eorders[i] = parseInt(order[i + 8], 24);
		}

		var ccode = [];
		var ecode = [];
		var cc = new mathlib.CubieCube();
		cc.init(c.ca, c.ea);

		var done = 1 << cbuf;
		for (var i = 0; i < 8; i++) {
			if (cc.ca[i] == i) {
				done |= 1 << i;
			}
		}
		while (done != 0xff) {
			var target = cc.ca[cbuf] & 0x7;
			if (target == cbuf) { // buffer in place, swap with any unsolved
				var perm = -1;
				while (done >> (corders[++perm] % 8) & 1) {}
				perm = corders[perm];
				var ori = ~~(perm / 8);
				perm = perm % 8;
				ori ^= (0xa5 >> perm & 0x1) * 3;
				mathlib.circle(cc.ca, perm, cbuf);
				cc.ca[perm] = (cc.ca[perm] + ((6 + ori - cori) << 3)) % 24;
				cc.ca[cbuf] = (cc.ca[cbuf] + ((6 - ori + cori) << 3)) % 24;
				ccode.push((6 - ori + cori) % 3 * 8 + perm);
				continue;
			}
			ccode.push(cc.ca[cbuf]);
			cc.ca[cbuf] = (cc.ca[target] + (cc.ca[cbuf] & 0xf8)) % 24;
			cc.ca[target] = target;
			done |= 1 << target;
		}

		done = 1 << ebuf;
		for (var i = 0; i < 12; i++) {
			if (cc.ea[i] == i * 2) {
				done |= 1 << i;
			}
		}
		while (done != 0xfff) {
			var target = cc.ea[ebuf] >> 1;
			if (target == ebuf) { // buffer in place, swap with any unsolved
				var perm = -1;
				while (done >> (eorders[++perm] % 12) & 1) {}
				perm = eorders[perm];
				var ori = ~~(perm / 12) ^ eori;
				perm = perm % 12;
				mathlib.circle(cc.ea, perm, ebuf);
				cc.ea[perm] ^= ori;
				cc.ea[ebuf] ^= ori;
				ecode.push(perm * 2 + ori);
				continue;
			}
			ecode.push(cc.ea[ebuf]);
			cc.ea[ebuf] = cc.ea[target] ^ (cc.ea[ebuf] & 1);
			cc.ea[target] = target << 1;
			done |= 1 << target;
		}
		var ret = [[], []];
		for (var i = 0; i < ccode.length; i++) {
			var val = ccode[i] & 0x7;
			var ori = (6 - (ccode[i] >> 3) + cori) % 3;
			ori ^= (0xa5 >> val & 0x1) * 3;
			ret[0].push(corns[val].charAt(ori % 3));
			if (i % 2 == 1) {
				ret[0].push(' ');
			}
		}
		for (var i = 0; i < ecode.length; i++) {
			var val = ecode[i] ^ eori;
			ret[1].push(edges[val >> 1].charAt(val & 1));
			if (i % 2 == 1) {
				ret[1].push(' ');
			}
		}
		return ret;
	}

	function genBLDRndState(bldSets, doScramble) {
		var cfixs = bldSets['cfix'].split(' ');
		var cfixDones = [];
		var cfixErrs = [];
		var fixRe = /^(UFR|UFL|UBL|UBR|DFR|DFL|DBL|DBR)(\+?)$/i;
		var cubies = pieces.split(' ');
		for (var i = 0; i < cfixs.length; i++) {
			var m = fixRe.exec(cfixs[i]);
			if (!m) {
				continue;
			} else if (m[1] == cubies[bldSets['cbuff'][0] % 8]) { // buffer
				continue;
			} else if (m[2]) {
				cfixErrs.push(cubies.indexOf(m[1]));
			} else {
				cfixDones.push(cubies.indexOf(m[1]));
			}
		}
		var efixs = bldSets['efix'].split(' ');
		var efixDones = [];
		var efixErrs = [];
		fixRe = /^(UR|UF|UL|UB|DR|DF|DL|DB|FR|FL|BL|BR)(\+?)$/i;
		for (var i = 0; i < efixs.length; i++) {
			var m = fixRe.exec(efixs[i]);
			if (!m) {
				continue;
			} else if (m[1] == cubies[bldSets['ebuff'][0] % 12 + 8]) { // buffer
				continue;
			} else if (m[2]) {
				efixErrs.push(cubies.indexOf(m[1]) - 8);
			} else {
				efixDones.push(cubies.indexOf(m[1]) - 8);
			}
		}

		var parityMask = bldSets['ceparity'];
		// corner count, group by parity
		var cvalid = [0, 0];
		var cSample = [null, null];
		var enum8 = enumCycles(8);
		for (var i = 0; i < enum8.length; i++) {
			var parity = getParity(enum8[i]);
			if ((parityMask >> parity & 1) == 0) {
				continue;
			}
			var ret = getRandState(bldSets['cbuff'][1], cfixDones.length, cfixErrs.length,
				bldSets['cnerrLR'], bldSets['cscycLR'], bldSets['cncodeLR'], 3, enum8[i]);
			cvalid[parity] += ret[0];
			if (mathlib.rndHit(ret[0] / cvalid[parity])) {
				cSample[parity] = ret[1];
			}
		}
		// edge count
		var evalid = [0, 0];
		var eSample = [null, null];
		var enum12 = enumCycles(12);
		for (var i = 0; i < enum12.length; i++) {
			var parity = getParity(enum12[i]);
			if ((parityMask >> parity & 1) == 0) {
				continue;
			}
			var ret = getRandState(bldSets['ebuff'][1], efixDones.length, efixErrs.length,
				bldSets['enerrLR'], bldSets['escycLR'], bldSets['encodeLR'], 2, enum12[i]);
			evalid[parity] += ret[0];
			if (mathlib.rndHit(ret[0] / evalid[parity])) {
				eSample[parity] = ret[1];
			}
		}
		var validCnt = cvalid[0] * evalid[0] + cvalid[1] * evalid[1];
		var ret = [validCnt, cSample[1], eSample[1]];
		if (mathlib.rndHit(cvalid[0] * evalid[0] / validCnt)) {
			ret = [validCnt, cSample[0], eSample[0]];
		}
		if (!doScramble) {
			return ret;
		}
		if (ret[0] == 0) {
			return {
				prob: 0,
				caseNum: 0,
				scramble: "N/A",
				code: "",
			};
		}
		var cornMap = [bldSets['cbuff'][0] % 8].concat(cfixDones, cfixErrs);
		var edgeMap = [bldSets['ebuff'][0] % 12].concat(efixDones, efixErrs);
		var cornIMap = [];
		var edgeIMap = [];
		for (var i = 0; i < 8; i++) {
			if (cornMap.indexOf(i) == -1) {
				cornMap.push(i);
			}
			cornIMap[cornMap[i]] = i;
		}
		for (var i = 0; i < 12; i++) {
			if (edgeMap.indexOf(i) == -1) {
				edgeMap.push(i);
			}
			edgeIMap[edgeMap[i]] = i;
		}
		var ca = [];
		var ea = [];
		for (var i = 0; i < 8; i++) {
			ca[cornMap[i]] = cornMap[ret[1][i][0]] | ret[1][i][1] << 3;
		}
		for (var i = 0; i < 12; i++) {
			ea[edgeMap[i]] = edgeMap[ret[2][i][0]] << 1 | ret[2][i][1];
		}
		var cc = new mathlib.CubieCube();
		var rndX = bldSets['ceori'] ? mathlib.rndEl(["", "Rw", "Rw2", "Rw'", "Fw", "Fw'"]) : "";
		var rndY = bldSets['ceori'] ? mathlib.rndEl(["", "Uw", "Uw2", "Uw'"]) : "";
		var move1 = cc.selfMoveStr(rndX);
		var move2 = cc.selfMoveStr(rndY);
		cc.init(ca, ea);
		cc.ori = 0;
		if (cc.isEqual()) {
			return "U U'";
		}
		//state = toGen * rotX * rotY => toGen = state * rotY^-1 * rotX^-1
		if (move2 != null) {
			cc.selfMoveStr("URFDLB".charAt(~~(move2 / 3)) + " 2'".charAt(move2 % 3), true);
		}
		if (move1 != null) {
			cc.selfMoveStr("URFDLB".charAt(~~(move1 / 3)) + " 2'".charAt(move1 % 3), true);
		}
		var facelet = cc.toFaceCube();
		var search = new min2phase.Search();
		var res = search.solution(facelet, 22, 1e9, 50, 2);
		res = (res + ' ' + rndX + ' ' + rndY).replace(/ +/g, ' ') || "U U'";
		res = res.trim();
		
		var prob = ret[0] / 43252003274489856000;
		// var probStr = (ret[0] == 0 ? 0 : prob < 1e-3 ? prob.toExponential(3) : Math.round(prob * 1000000) / 10000 + '%');
		// var caseNum = (ret[0] > 1e8 ? ret[0].toExponential(3) : ret[0]);
		var state = cubeutil.getScrambledState(["333", res]);
		var codes = getBLDcode(state, bldSets['scheme'], bldSets['cbuff'][0], bldSets['ebuff'][0], bldSets['order']);
		var codeStr = 'Corners: ' + codes[0].join('').trim() + '\n' + 'Edges: ' + codes[1].join('').trim();
		return {
			prob: prob,
			caseNum: ret[0],
			scramble: res,
			code: codeStr
		};
	}

	var pieces = 'UFR UFL UBL UBR DFR DFL DBL DBR UR UF UL UB DR DF DL DB FR FL BL BR';
	
	return {
		genBLDRndState
	};
});

function getBLDInfo(bldSets){
	var helper = new bldhelper();
	var res = helper.genBLDRndState(bldSets, true);
	return res;
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
	module.exports = { getBLDInfo };
}
