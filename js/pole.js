/* 北極星の移り変わりシミュレーター */
(function () {
  'use strict';
  const D = Math.PI / 180;
  const DATA = window.SKY_DATA;
  const P = window.Precession;
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const FONT = 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif';

  const YMIN = -4000, YMAX = 22000;
  const GREEK = [-799, 200]; // 古代ギリシャ時代（紀元前8世紀〜後2世紀）
  const CAND_MAG = 3.7;      // 「北極星候補」とみなす明るさ
  const NEAR_DEG = 5;        // 年表で色を付ける極からの距離

  // ---------- 星データ ----------
  const NS = DATA.stars.length;
  const sv = new Float64Array(NS * 3);
  const smag = new Float64Array(NS);
  const scol = new Array(NS);
  function bvToRGB(bv) {
    const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
    const t = clamp(T, 1500, 40000) / 100;
    const r = t <= 66 ? 255 : clamp(329.7 * Math.pow(t - 60, -0.1332), 0, 255);
    const g = t <= 66 ? clamp(99.47 * Math.log(t) - 161.12, 0, 255) : clamp(288.12 * Math.pow(t - 60, -0.0755), 0, 255);
    const b = t >= 66 ? 255 : t <= 19 ? 0 : clamp(138.52 * Math.log(t - 10) - 305.04, 0, 255);
    const w = 0.55;
    return `rgb(${Math.round(lerp(r, 255, w))},${Math.round(lerp(g, 255, w))},${Math.round(lerp(b, 255, w))})`;
  }
  DATA.stars.forEach((s, i) => {
    const c = Math.cos(s[1] * D);
    sv[i * 3] = c * Math.cos(s[0] * D); sv[i * 3 + 1] = c * Math.sin(s[0] * D); sv[i * 3 + 2] = Math.sin(s[1] * D);
    smag[i] = s[2];
    scol[i] = bvToRGB(s[3]);
  });

  const CONS = DATA.constellations.map((c) => ({
    id: c.id, ja: c.ja,
    segs: c.l.map((s) => s.map((p) => { const cc = Math.cos(p[1] * D); return [cc * Math.cos(p[0] * D), cc * Math.sin(p[0] * D), Math.sin(p[1] * D)]; })),
  }));
  const CONJA = {};
  for (const c of CONS) CONJA[c.id] = c.ja;
  const INFO = new Map(DATA.info.map((i) => [i[0], { ja: i[1], en: i[2], bayer: i[3], con: i[4] }]));
  const EN_JA = { Errai: 'エライ', Fawaris: 'ファワリス' };

  function starName(i) {
    const f = INFO.get(i);
    if (f) {
      if (f.ja) return f.ja;
      if (EN_JA[f.en]) return EN_JA[f.en];
      if (f.bayer && f.con) return (CONJA[f.con] || f.con) + f.bayer + '星';
      if (f.en) return f.en;
    }
    return smag[i].toFixed(1) + '等星';
  }

  // 北極星候補（北天の明るい星）
  const CAND = [];
  for (let i = 0; i < NS; i++) if (smag[i] <= CAND_MAG && DATA.stars[i][1] > 0) CAND.push(i);

  const dot3 = (a, i, p) => a[i * 3] * p[0] + a[i * 3 + 1] * p[1] + a[i * 3 + 2] * p[2];
  const angDeg = (c) => Math.acos(clamp(c, -1, 1)) / D;

  function nearestCand(pole, n) {
    const arr = [];
    for (const i of CAND) arr.push({ i, d: angDeg(dot3(sv, i, pole)) });
    arr.sort((a, b) => a.d - b.d);
    return arr.slice(0, n);
  }

  // ---------- 年表・最接近の事前計算 ----------
  const TL_STEP = 20;
  const timeline = [];
  for (let y = YMIN; y <= YMAX; y += TL_STEP) {
    const pole = P.poleVec(y);
    let bi = -1, bd = 1e9;
    for (const i of CAND) { const d = angDeg(dot3(sv, i, pole)); if (d < bd) { bd = d; bi = i; } }
    timeline.push({ y, i: bi, d: bd });
  }
  const approach = (() => {
    const best = new Map();
    for (let y = YMIN; y <= YMAX; y += 10) {
      const pole = P.poleVec(y);
      for (const i of CAND) {
        const d = angDeg(dot3(sv, i, pole));
        const b = best.get(i);
        if (!b || d < b.d) best.set(i, { i, y, d });
      }
    }
    return [...best.values()].filter((b) => b.d < 7).sort((a, b) => a.y - b.y);
  })();
  const labelStars = new Set(approach.map((a) => a.i));
  const hueOf = new Map();
  [...labelStars].forEach((i, k) => hueOf.set(i, (k * 47 + 20) % 360));
  const starColor = (i) => `hsl(${hueOf.get(i) ?? 0} 70% 62%)`;

  // ---------- 年の表示 ----------
  const fmtYear = (y) => (y <= 0 ? `紀元前${1 - y}年` : `西暦${y}年`);
  const fmtDeg = (d) => (d < 1 ? d.toFixed(2) : d.toFixed(1)) + '°';
  const fmtTick = (y) => (y < 0 ? `前${-y}` : String(y));

  // ---------- 状態 ----------
  const state = { y: 2026, playing: false, speed: 800, lat: 37.98 };
  let dirty = true;

  // ---------- キャンバス ----------
  function setupCanvas(c) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth, h = c.clientHeight;
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  const cvA = $('cvA'), cvB = $('cvB'), cvT = $('cvT');

  function starRadius(m, k) { return clamp(0.5 + (5.4 - m) * 0.42, 0.5, 4.8) * k; }

  function drawGlowStar(ctx, x, y, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }

  // ---- ① 星空固定: 黄道北極を中心にした図 ----
  const C0 = (() => { const d = 90 - 23.4393; const c = Math.cos(d * D); return [c * Math.cos(270 * D), c * Math.sin(270 * D), Math.sin(d * D)]; })();
  const EAST = (() => { const e = [-C0[1], C0[0], 0]; const n = Math.hypot(e[0], e[1]); return [e[0] / n, e[1] / n, 0]; })();
  const NORTH = [C0[1] * EAST[2] - C0[2] * EAST[1], C0[2] * EAST[0] - C0[0] * EAST[2], C0[0] * EAST[1] - C0[1] * EAST[0]];
  const A_MAX = 56;

  function drawA() {
    const { ctx, w, h } = setupCanvas(cvA);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 6;
    const proj = (v) => {
      const th = angDeg(v[0] * C0[0] + v[1] * C0[1] + v[2] * C0[2]);
      const x = v[0] * EAST[0] + v[1] * EAST[1] + v[2] * EAST[2];
      const y = v[0] * NORTH[0] + v[1] * NORTH[1] + v[2] * NORTH[2];
      const hh = Math.hypot(x, y) || 1;
      const r = (th / A_MAX) * R;
      return { x: cx - (r * x) / hh, y: cy - (r * y) / hh, th };
    };
    ctx.fillStyle = '#060b1c'; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip();

    // 同心円（黄道北極からの距離）
    ctx.strokeStyle = 'rgba(140,170,255,0.12)'; ctx.lineWidth = 1;
    for (const r of [20, 40]) { ctx.beginPath(); ctx.arc(cx, cy, (r / A_MAX) * R, 0, 6.2832); ctx.stroke(); }

    // 星座線
    ctx.strokeStyle = 'rgba(110,160,255,0.3)';
    ctx.beginPath();
    for (const c of CONS) for (const s of c.segs) {
      const a = s.map(proj);
      if (a.every((p) => p.th > A_MAX + 4)) continue;
      ctx.moveTo(a[0].x, a[0].y);
      for (let k = 1; k < a.length; k++) ctx.lineTo(a[k].x, a[k].y);
    }
    ctx.stroke();

    // 星
    const sc = clamp(Math.min(w, h) / 560, 0.8, 1.4);
    const v = [0, 0, 0];
    for (let i = 0; i < NS; i++) {
      if (smag[i] > 5.0) continue;
      v[0] = sv[i * 3]; v[1] = sv[i * 3 + 1]; v[2] = sv[i * 3 + 2];
      const p = proj(v);
      if (p.th > A_MAX) continue;
      drawGlowStar(ctx, p.x, p.y, starRadius(smag[i], sc) * 0.9, scol[i]);
    }

    // 天の北極の道すじ
    const pts = [];
    for (let y = YMIN; y <= YMAX; y += 25) pts.push({ y, p: proj(P.poleVec(y)) });
    const strokeRange = (y0, y1) => {
      ctx.beginPath();
      let started = false;
      for (const q of pts) {
        if (q.y < y0 || q.y > y1) continue;
        if (!started) { ctx.moveTo(q.p.x, q.p.y); started = true; } else ctx.lineTo(q.p.x, q.p.y);
      }
      ctx.stroke();
    };
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(246,210,122,0.28)'; ctx.lineWidth = 1.5; strokeRange(YMIN, YMAX);
    ctx.strokeStyle = 'rgba(246,210,122,0.95)'; ctx.lineWidth = 4; strokeRange(GREEK[0], GREEK[1]);
    ctx.strokeStyle = 'rgba(255,236,170,0.9)'; ctx.lineWidth = 2; strokeRange(YMIN, state.y);

    // 目盛り（1000年ごと）
    ctx.font = `${Math.round(11 * sc)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let y = -4000; y <= YMAX; y += 1000) {
      const p = proj(P.poleVec(y));
      ctx.fillStyle = 'rgba(246,210,122,0.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y, y % 2000 === 0 ? 2.6 : 1.7, 0, 6.2832); ctx.fill();
      if (y % 2000 === 0) {
        const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
        ctx.fillStyle = 'rgba(246,222,160,0.95)';
        ctx.fillText(fmtTick(y), p.x + (dx / d) * 18, p.y + (dy / d) * 11);
      }
    }

    // 北極星候補の名前
    ctx.font = `${Math.round(11.5 * sc)}px ${FONT}`; ctx.textAlign = 'left';
    for (const a of approach) {
      v[0] = sv[a.i * 3]; v[1] = sv[a.i * 3 + 1]; v[2] = sv[a.i * 3 + 2];
      const p = proj(v);
      ctx.strokeStyle = starColor(a.i); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = starColor(a.i);
      ctx.fillText(starName(a.i), p.x + 9, p.y - 7);
    }

    // 現在の天の北極
    const cur = proj(P.poleVec(state.y));
    ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cur.x, cur.y, 8, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cur.x - 13, cur.y); ctx.lineTo(cur.x + 13, cur.y); ctx.moveTo(cur.x, cur.y - 13); ctx.lineTo(cur.x, cur.y + 13); ctx.stroke();
    ctx.restore();

    // 凡例
    ctx.font = `${Math.round(12 * sc)}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(232,237,255,0.85)';
    ctx.fillText('図の中心: 黄道の北極（りゅう座）', 10, h - 14);
    ctx.fillStyle = 'rgba(246,210,122,0.95)'; ctx.fillRect(10, 14, 22, 4);
    ctx.fillStyle = 'rgba(232,237,255,0.85)'; ctx.fillText('古代ギリシャ時代', 38, 16);
  }

  // ---- ② その年の北の空（天の北極が中心） ----
  const B_MAX = 55;
  function drawB() {
    const { ctx, w, h } = setupCanvas(cvB);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 8;
    const M = P.matrix(state.y);
    const out = { x: 0, y: 0, d: 0 };
    const proj = (v) => {
      const x = M[0] * v[0] + M[1] * v[1] + M[2] * v[2];
      const y = M[3] * v[0] + M[4] * v[1] + M[5] * v[2];
      const z = M[6] * v[0] + M[7] * v[1] + M[8] * v[2];
      const d = angDeg(z); // 天の北極からの距離
      const ra = Math.atan2(y, x);
      const r = (d / B_MAX) * R;
      out.x = cx - r * Math.sin(ra); out.y = cy - r * Math.cos(ra); out.d = d;
      return out;
    };
    ctx.fillStyle = '#060b1c'; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip();

    // 沈まない星の範囲
    const lat = state.lat;
    ctx.fillStyle = 'rgba(120,150,255,0.07)';
    ctx.beginPath(); ctx.arc(cx, cy, (lat / B_MAX) * R, 0, 6.2832); ctx.fill();

    // 赤緯の円・赤経の放射線
    ctx.strokeStyle = 'rgba(140,170,255,0.14)'; ctx.lineWidth = 1;
    ctx.font = '11px ' + FONT; ctx.fillStyle = 'rgba(160,180,230,0.7)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (let d = 10; d <= 50; d += 10) {
      ctx.beginPath(); ctx.arc(cx, cy, (d / B_MAX) * R, 0, 6.2832); ctx.stroke();
      ctx.fillText(`赤緯${90 - d}°`, cx + 4, cy - (d / B_MAX) * R + 8);
    }
    for (let hr = 0; hr < 24; hr += 3) {
      const a = hr * 15 * D;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - R * Math.sin(a), cy - R * Math.cos(a)); ctx.stroke();
    }
    ctx.textAlign = 'center';
    for (const hr of [0, 6, 12, 18]) {
      const a = hr * 15 * D, rr = R - 12;
      ctx.fillText(`${hr}h`, cx - rr * Math.sin(a), cy - rr * Math.cos(a));
    }

    // 沈まない星の境界
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(150,190,255,0.7)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(cx, cy, (lat / B_MAX) * R, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);

    // 星座線
    ctx.strokeStyle = 'rgba(110,160,255,0.34)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const c of CONS) for (const s of c.segs) {
      const a = s.map((p) => { const q = proj(p); return { x: q.x, y: q.y, d: q.d }; });
      if (a.every((p) => p.d > B_MAX + 6)) continue;
      ctx.moveTo(a[0].x, a[0].y);
      for (let k = 1; k < a.length; k++) ctx.lineTo(a[k].x, a[k].y);
    }
    ctx.stroke();

    // 星
    const sc = clamp(Math.min(w, h) / 560, 0.8, 1.4);
    const v = [0, 0, 0];
    const named = [];
    for (let i = 0; i < NS; i++) {
      if (smag[i] > 5.3) continue;
      v[0] = sv[i * 3]; v[1] = sv[i * 3 + 1]; v[2] = sv[i * 3 + 2];
      const p = proj(v);
      if (p.d > B_MAX) continue;
      drawGlowStar(ctx, p.x, p.y, starRadius(smag[i], sc), scol[i]);
      if (smag[i] <= 3.3) named.push({ i, x: p.x, y: p.y });
    }
    ctx.font = `${Math.round(11.5 * sc)}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(215,225,255,0.8)';
    for (const n of named) ctx.fillText(starName(n.i), n.x + 6, n.y - 6);

    // 北極星候補の強調
    const pole = P.poleVec(state.y);
    const near = nearestCand(pole, 1)[0];
    v[0] = sv[near.i * 3]; v[1] = sv[near.i * 3 + 1]; v[2] = sv[near.i * 3 + 2];
    const np = proj(v);
    ctx.strokeStyle = 'rgba(246,210,122,0.9)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(np.x, np.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(np.x, np.y, 9, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = '#ffe9a8'; ctx.font = `bold ${Math.round(13 * sc)}px ${FONT}`;
    const right = np.x < cx + R * 0.5;
    ctx.textAlign = right ? 'left' : 'right';
    ctx.fillText(`${starName(near.i)}（${fmtDeg(near.d)}）`, np.x + (right ? 13 : -13), np.y + 14);

    // 天の北極
    ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 6.2832); ctx.stroke();
    ctx.restore();

    ctx.font = `${Math.round(12 * sc)}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(232,237,255,0.85)';
    ctx.fillText(fmtYear(state.y) + 'の北の空', 10, 16);
    ctx.fillStyle = 'rgba(150,190,255,0.9)';
    ctx.fillText(`破線 = 北緯${lat.toFixed(0)}°で沈まない範囲`, 10, h - 14);
  }

  // ---- 年表バー ----
  function drawT() {
    const { ctx, w, h } = setupCanvas(cvT);
    const padL = 10, padR = 10, barY = 18, barH = 30;
    const x0 = padL, x1 = w - padR;
    const X = (y) => lerp(x0, x1, (y - YMIN) / (YMAX - YMIN));
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x0, barY, x1 - x0, barH);
    // 古代ギリシャ時代
    ctx.fillStyle = 'rgba(246,210,122,0.16)'; ctx.fillRect(X(GREEK[0]), barY - 8, X(GREEK[1]) - X(GREEK[0]), barH + 16);
    // 星ごとの区間
    let seg = null;
    const flush = (end) => {
      if (!seg) return;
      const a = X(seg.start), b = X(end);
      ctx.fillStyle = starColor(seg.i); ctx.globalAlpha = 0.9; ctx.fillRect(a, barY, Math.max(1, b - a), barH); ctx.globalAlpha = 1;
      if (b - a > 44) {
        ctx.fillStyle = '#10142a'; ctx.font = `600 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(starName(seg.i), (a + b) / 2, barY + barH / 2, b - a - 4);
      }
      seg = null;
    };
    for (const t of timeline) {
      const ok = t.d <= NEAR_DEG;
      if (ok && seg && seg.i === t.i) continue;
      flush(t.y);
      if (ok) seg = { i: t.i, start: t.y };
    }
    flush(YMAX);
    // 目盛り
    ctx.font = `11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(160,180,230,0.85)'; ctx.strokeStyle = 'rgba(160,180,230,0.5)';
    for (let y = -4000; y <= YMAX; y += 2000) {
      const x = X(y);
      ctx.beginPath(); ctx.moveTo(x, barY + barH); ctx.lineTo(x, barY + barH + 5); ctx.stroke();
      ctx.fillText(fmtTick(y), clamp(x, 14, w - 14), barY + barH + 7);
    }
    ctx.fillStyle = 'rgba(246,210,122,0.95)'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.font = `11px ${FONT}`;
    ctx.fillText('古代ギリシャ', clamp((X(GREEK[0]) + X(GREEK[1])) / 2, 36, w - 36), barY - 9 + 6);
    // 現在位置
    const cxp = X(state.y);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cxp, barY - 8); ctx.lineTo(cxp, barY + barH + 6); ctx.stroke();
  }

  // ---------- 文章・一覧 ----------
  function updateReadout() {
    const pole = P.poleVec(state.y);
    const top = nearestCand(pole, 3);
    const n = top[0];
    const name = starName(n.i);
    let v;
    if (n.d <= 1.5) v = `${name}がほぼ真北にあります（極から${fmtDeg(n.d)}）。北極星として使えます。`;
    else if (n.d <= 5) v = `${name}が極の比較的近くにあります（${fmtDeg(n.d)}）。北極星の候補です。`;
    else {
      v = `極のそばに明るい星はありません。最も近い明るい星は${name}（${fmtDeg(n.d)}）です。`;
      const f = INFO.get(n.i);
      if (f && f.en === 'Kochab') v += ' こぐま座のコカブとフェルカドは「極の番人」とも呼ばれます。';
    }
    $('verdict').textContent = v;
    $('yearLabel').textContent = fmtYear(state.y);
    $('nearList').innerHTML = top.map((t, k) => {
      const m = smag[t.i].toFixed(1);
      return `<li><span class="rank">${k + 1}</span><span>${starName(t.i)} <small>${m}等</small></span><span class="d">${fmtDeg(t.d)}</span></li>`;
    }).join('');
    const ra = ((Math.atan2(pole[1], pole[0]) / D) + 360) % 360;
    const dec = Math.asin(pole[2]) / D;
    $('poleCoord').textContent = `この年の天の北極（2000年の星空の座標で）: 赤経 ${(ra / 15).toFixed(2)}時 ／ 赤緯 ${dec >= 0 ? '+' : ''}${dec.toFixed(2)}°`;
    document.querySelectorAll('.events button').forEach((b) => b.setAttribute('aria-current', String(Math.abs(Number(b.dataset.y) - state.y) < 15)));
  }

  const EVENTS = [
    [-2789, 'ツバン（りゅう座α星）が天の北極に最接近します（0.1°以内）。エジプトでピラミッドが盛んに築かれた頃の北極星です。'],
    [-749, '古代ギリシャの初期。ホメロスやヘシオドスの頃です。極のそばに明るい星はなく、一番近い明るい星はこぐま座のコカブ（約7°）です。'],
    [-319, '探検家ピュテアスが、天の北極に目印となる星がないと記したと伝えられる頃です。コカブは約7°離れています。'],
    [-129, 'ヒッパルコスが、星の位置を昔の記録と比べて歳差（天の北極が少しずつ動くこと）に気づいた頃です。'],
    [150, 'プトレマイオスが『アルマゲスト』で48の星座と1,022個の星をまとめた頃です。コカブは約9°離れています。'],
    [2026, '現在。ポラリス（こぐま座α星）が極から約0.6°にあり、ほぼ真北を示します。'],
    [2100, 'ポラリスが天の北極に最も近づきます（約0.46°）。この後は少しずつ離れていきます。'],
    [4150, 'ケフェウス座γ星エライが極に近づきます（約1.9°）。'],
    [7580, 'ケフェウス座α星アルデラミンが極に近づきます（約2°）。'],
    [11570, 'はくちょう座δ星ファワリスが極に近づきます（約3.3°）。'],
    [13700, '0等星のベガが極から6〜7°まで近づきます。北極星の候補の中で最も明るい星です。'],
  ];
  const evBox = $('events');
  for (const [y, text] of EVENTS) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.y = String(y);
    b.innerHTML = `<span class="y">${y === 2026 ? '現在（2026年）' : fmtYear(y) + '頃'}</span><span>${text}</span>`;
    b.addEventListener('click', () => { setYear(y); });
    li.appendChild(b); evBox.appendChild(li);
  }
  $('approach').innerHTML = approach.map((a) => {
    const yr = a.y;
    return `<tr data-y="${yr}"><td>${starName(a.i)}</td><td>${fmtYear(yr)}頃</td><td>${fmtDeg(a.d)}</td><td>${smag[a.i].toFixed(1)}</td></tr>`;
  }).join('');
  document.querySelectorAll('#approach tr').forEach((tr) => tr.addEventListener('click', () => setYear(Number(tr.dataset.y))));

  // ---------- 操作 ----------
  const slider = $('year');
  function setYear(y, keepPlay) {
    state.y = clamp(Math.round(y), YMIN, YMAX);
    if (!keepPlay) stopPlay();
    slider.value = String(state.y);
    dirty = true;
    updateReadout();
  }
  slider.addEventListener('input', () => setYear(Number(slider.value)));
  document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => setYear(state.y + Number(b.dataset.step))));
  $('lat').addEventListener('change', (e) => { state.lat = Number(e.target.value); dirty = true; });
  $('speed').addEventListener('change', (e) => { state.speed = Number(e.target.value); });

  let acc = state.y;
  function stopPlay() { state.playing = false; $('btnPlay').setAttribute('aria-pressed', 'false'); $('btnPlay').textContent = '▶ 再生'; }
  $('btnPlay').addEventListener('click', () => {
    if (state.playing) { stopPlay(); return; }
    state.playing = true; acc = state.y >= YMAX ? YMIN : state.y;
    $('btnPlay').setAttribute('aria-pressed', 'true'); $('btnPlay').textContent = '⏸ 一時停止';
  });

  // 年表バーのクリック・ドラッグ
  let dragT = false;
  const tYear = (e) => {
    const r = cvT.getBoundingClientRect();
    return YMIN + ((e.clientX - r.left - 10) / (r.width - 20)) * (YMAX - YMIN);
  };
  cvT.addEventListener('pointerdown', (e) => { dragT = true; cvT.setPointerCapture(e.pointerId); setYear(tYear(e)); });
  cvT.addEventListener('pointermove', (e) => { if (dragT) setYear(tYear(e)); });
  cvT.addEventListener('pointerup', () => { dragT = false; });
  cvT.addEventListener('pointercancel', () => { dragT = false; });

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (state.playing) {
      acc += dt * state.speed;
      if (acc > YMAX) { acc = YMAX; state.y = YMAX; stopPlay(); } else state.y = Math.round(acc / 10) * 10;
      slider.value = String(state.y);
      dirty = true;
      updateReadout();
    }
    if (dirty) { drawA(); drawB(); drawT(); dirty = false; }
    requestAnimationFrame(loop);
  }
  window.addEventListener('resize', () => { dirty = true; });
  if (window.ResizeObserver) new ResizeObserver(() => { dirty = true; }).observe(document.body);

  // 初期年: URL の ?y=年 を受け付ける
  const q = new URLSearchParams(location.search).get('y');
  if (q !== null && q !== '' && Number.isFinite(Number(q))) state.y = clamp(Math.round(Number(q)), YMIN, YMAX);
  slider.value = String(state.y);
  updateReadout();
  requestAnimationFrame(loop);
  window.__pole = { state, setYear, approach, timeline };
})();
