/* 惑星の動きと逆行 */
(function () {
  'use strict';
  const A = window.Astro, DATA = window.SKY_DATA;
  const D = Math.PI / 180;
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const JST = 9 * 3600000, DAY = 86400000;
  const pad = (n) => String(n).padStart(2, '0');
  const FONT = 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif';
  const wrap = (x) => ((x % 360) + 540) % 360 - 180;
  const PL = A.ALL_PLANETS.map((p) => ({ id: p.id, ja: p.ja, color: p.color }));
  const RETRO = '#ff2d55';
  const state = { sel: new Set(['mars']), sys: 'auto', start: 0, days: 730, mode: 'sky', hour: 21, lat: 35.6895, lon: 139.6917, layout: 'sep', focus: 'mars', cur: 0, playing: false };
  const dayStartOf = (ms) => Math.floor((ms + JST) / DAY) * DAY - JST;
  const dateOf = (ms) => { const d = new Date(ms + JST); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
  const fmtD = (ms) => { const q = dateOf(ms); return `${q.y}/${q.m}/${q.d}`; };
  const WD = ['日', '月', '火', '水', '木', '金', '土'];

  // ---- 座標変換（J2000 赤道座標 → J2000 黄道座標） ----
  const EPS = 23.4392911 * D;
  function toEcl(ra, dec) {
    const a = ra * D, d = dec * D;
    const lat = Math.asin(clamp(Math.sin(d) * Math.cos(EPS) - Math.cos(d) * Math.sin(EPS) * Math.sin(a), -1, 1));
    const lon = Math.atan2(Math.sin(a) * Math.cos(EPS) + Math.tan(d) * Math.sin(EPS), Math.cos(a));
    return [((lon / D) + 360) % 360, lat / D];
  }

  // ---- 背景の星・星座 ----
  const STARS = DATA.stars.map((s) => { const e = toEcl(s[0], s[1]); return { ra: s[0], dec: s[1], mag: s[2], elon: e[0], elat: e[1] }; });
  const CONS = DATA.constellations.map((c) => {
    let sx = 0, sy = 0, n = 0, rs = [];
    for (const s of c.l) for (const p of s) { rs.push(p); }
    const r0 = rs[0][0];
    for (const p of rs) { sx += wrap(p[0] - r0); sy += p[1]; n++; }
    const cen = [(r0 + sx / n + 360) % 360, sy / n];
    return { ja: c.ja, segs: c.l, cen, segsE: c.l.map((sg) => sg.map((q) => toEcl(q[0], q[1]))), cenE: toEcl(cen[0], cen[1]) };
  });

  // ---- 計算 ----
  let T = null; // { n, ms[], byId: {id: {ra,dec,lon,elong,az,alt,rE,hx,hy, retro[]}}, earth[], sunLon[], events[] }
  function compute() {
    const n = state.days;
    const T0 = state.start;
    const ms = [], by = {}, earth = [], sunLon = [];
    for (const p of PL) by[p.id] = { ra: [], dec: [], elon: [], elat: [], lon: [], elong: [], az: [], alt: [], rE: [], hx: [], hy: [], rS: [] };
    for (let d = 0; d <= n + 1; d++) {
      const t = T0 + d * DAY + state.hour * 3600000;
      ms.push(t);
      const sp = A.skyPlanets(t, state.lat, state.lon);
      earth.push(sp.earth); sunLon.push(sp.sunLon);
      for (const q of sp.planets) {
        const o = by[q.id];
        o.ra.push(q.ra); o.dec.push(q.dec); { const e = toEcl(q.ra, q.dec); o.elon.push(e[0]); o.elat.push(e[1]); } o.lon.push(q.lonG); o.elong.push(q.elong); o.az.push(q.az); o.alt.push(q.alt);
        o.rE.push(q.rEarth); o.hx.push(q.h[0]); o.hy.push(q.h[1]); o.rS.push(q.rSun);
      }
    }
    const events = [];
    for (const p of PL) {
      const o = by[p.id];
      o.ld = []; // 日ごとの黄経の変化（k→k+1）
      for (let d = 0; d <= n; d++) o.ld.push(wrap(o.lon[d + 1] - o.lon[d]));
      o.retro = o.ld.map((v) => v < 0);
      // 留（黄経の変化の符号が変わる点）
      for (let k = 0; k < n; k++) {
        if ((o.ld[k] < 0) !== (o.ld[k + 1] < 0)) {
          const t = k + 0.5 + o.ld[k] / (o.ld[k] - o.ld[k + 1]);
          events.push({ id: p.id, type: o.ld[k] >= 0 ? 'stat-r' : 'stat-d', t });
        }
      }
      // 衝・合
      for (let k = 0; k < n; k++) {
        const a = wrap(o.lon[k] - sunLon[k]), b = wrap(o.lon[k + 1] - sunLon[k + 1]);
        const inner = p.id === 'mercury' || p.id === 'venus';
        // 太陽との黄経差が 0 を通る（合）
        if (Math.abs(a) < 90 && Math.abs(b) < 90 && (a < 0) !== (b < 0)) {
          const t = k + a / (a - b);
          const type = inner ? (o.rE[k] < 1 ? 'inf' : 'sup') : 'conj';
          events.push({ id: p.id, type, t });
        }
        // 衝（180°を通る）: a, b は ±180 に折り返される
        const aa = wrap(o.lon[k] - sunLon[k] - 180), bb = wrap(o.lon[k + 1] - sunLon[k + 1] - 180);
        if (!inner && Math.abs(aa) < 90 && Math.abs(bb) < 90 && (aa < 0) !== (bb < 0)) events.push({ id: p.id, type: 'opp', t: k + aa / (aa - bb) });
      }
    }
    events.sort((x, y) => x.t - y.t);
    T = { n, ms, by, earth, sunLon, events };
    $('scrub').max = String(n);
  }

  // ---- 描画共通 ----
  function setup(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#060b1c'; ctx.fillRect(0, 0, w, h);
    return { ctx, w, h };
  }
  const niceStep = (span, target) => { const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 20, 30, 45, 60]; for (const s of steps) if (span / s <= target) return s; return 90; };

  // 月ごとの日付ラベル位置
  function labelDays() {
    const n = T.n, out = [];
    const every = n <= 420 ? 1 : n <= 1200 ? 3 : n <= 2000 ? 6 : 12;
    for (let d = 0; d <= n; d++) {
      const q = dateOf(T.ms[d]);
      if (q.d === 1 && (q.m - 1) % every === 0) out.push({ d, label: every >= 6 || n > 1200 ? `${q.y}/${q.m}` : `${q.m}/1` });
    }
    return out;
  }

  /** 惑星 ids の軌跡を描く（mode: sky / alt）。広い範囲は黄道座標（縦を拡大）に自動で切り替える */
  function chartSys(ids) {
    if (state.sys !== 'auto') return state.sys;
    let sx = 0, sy = 0;
    for (const id of ids) for (let d = 0; d <= T.n; d++) { sx += Math.sin(T.by[id].ra[d] * D); sy += Math.cos(T.by[id].ra[d] * D); }
    const raC = (Math.atan2(sx, sy) / D + 360) % 360;
    let rmin = 0, rmax = 0;
    for (const id of ids) for (let d = 0; d <= T.n; d++) { const r = wrap(T.by[id].ra[d] - raC); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); }
    return rmax - rmin > 70 ? 'ec' : 'eq';
  }

  function drawChart(cv, ids) {
    const { ctx, w, h } = setup(cv);
    const alt = state.mode === 'alt';
    const sys = alt ? 'eq' : chartSys(ids);
    const ec = sys === 'ec';
    const U = (o, d) => (ec ? o.elon[d] : o.ra[d]), V = (o, d) => (ec ? o.elat[d] : o.dec[d]);
    const box = [38, 10, w - 10, h - 26];
    const pw = box[2] - box[0], ph = box[3] - box[1];
    let X, Y, view, stretched = false;
    if (!alt) {
      let sx = 0, sy = 0, vmin = 1e9, vmax = -1e9;
      for (const id of ids) for (let d = 0; d <= T.n; d++) { const o = T.by[id]; sx += Math.sin(U(o, d) * D); sy += Math.cos(U(o, d) * D); vmin = Math.min(vmin, V(o, d)); vmax = Math.max(vmax, V(o, d)); }
      const uC = (Math.atan2(sx, sy) / D + 360) % 360;
      let rmin = 0, rmax = 0;
      for (const id of ids) for (let d = 0; d <= T.n; d++) { const r = wrap(U(T.by[id], d) - uC); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); }
      const vC = (vmin + vmax) / 2, cosd = ec ? 1 : Math.max(0.2, Math.cos(vC * D));
      const spanX = Math.max(10, (rmax - rmin) * cosd * 1.12), spanY = Math.max(ec ? 3 : 7, (vmax - vmin) * 1.25);
      let scx, scy;
      stretched = ec && spanX / spanY > (pw / ph) * 2.2;
      if (stretched) { scx = pw / spanX; scy = ph / spanY; } else { scx = scy = Math.min(pw / spanX, ph / spanY); }
      const cX = uC + (rmin + rmax) / 2;
      X = (u) => (box[0] + box[2]) / 2 - wrap(u - cX) * cosd * scx;
      Y = (v) => (box[1] + box[3]) / 2 - (v - vC) * scy;
      view = { uHalf: pw / scx / cosd / 2, vHalf: ph / scy / 2, cX, vC, wide: spanX > 70 };
      ctx.font = `10.5px ${FONT}`; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(160,180,230,0.8)';
      const uStepDeg = ec ? niceStep(view.uHalf * 2, 6) : niceStep(view.uHalf * 2 / 15, 5) * 15;
      const vStep = niceStep(view.vHalf * 2, 5);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let r = Math.floor((cX - view.uHalf) / uStepDeg) * uStepDeg; r <= cX + view.uHalf; r += uStepDeg) {
        const x = X(r); if (x < box[0] || x > box[2]) continue;
        ctx.strokeStyle = 'rgba(140,170,255,0.1)'; ctx.beginPath(); ctx.moveTo(x, box[1]); ctx.lineTo(x, box[3]); ctx.stroke();
        const rr = ((r % 360) + 360) % 360;
        ctx.fillText(ec ? `${rr.toFixed(0)}°` : `${(rr / 15).toFixed(uStepDeg < 15 ? 1 : 0)}h`, x, box[3] + 4);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let dd = Math.floor((vC - view.vHalf) / vStep) * vStep; dd <= vC + view.vHalf; dd += vStep) {
        const y = Y(dd); if (y < box[1] || y > box[3]) continue;
        ctx.strokeStyle = 'rgba(140,170,255,0.1)'; ctx.beginPath(); ctx.moveTo(box[0], y); ctx.lineTo(box[2], y); ctx.stroke();
        ctx.fillText(`${dd > 0 ? '+' : ''}${dd}°`, box[0] - 4, y);
      }
    } else {
      X = (az) => box[0] + (az / 360) * pw; Y = (a) => box[3] - ((a + 10) / 100) * ph;
      ctx.font = `10.5px ${FONT}`; ctx.fillStyle = 'rgba(160,180,230,0.8)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const [v, l] of [[0, '北'], [90, '東'], [180, '南'], [270, '西'], [360, '北']]) { ctx.strokeStyle = 'rgba(140,170,255,0.12)'; ctx.beginPath(); ctx.moveTo(X(v), box[1]); ctx.lineTo(X(v), box[3]); ctx.stroke(); ctx.fillText(l, X(v), box[3] + 4); }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const v of [0, 30, 60, 90]) { ctx.strokeStyle = 'rgba(140,170,255,0.12)'; ctx.beginPath(); ctx.moveTo(box[0], Y(v)); ctx.lineTo(box[2], Y(v)); ctx.stroke(); ctx.fillText(v + '°', box[0] - 4, Y(v)); }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(box[0], Y(0), pw, box[3] - Y(0));
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(box[0], box[1], pw, ph); ctx.clip();
    if (!alt) {
      const lim = view.wide ? 4 : view.uHalf * 2 < 25 ? 6 : 5;
      ctx.strokeStyle = 'rgba(110,160,255,0.22)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const c of (stretched ? [] : CONS)) {
        const segs = ec ? c.segsE : c.segs;
        for (const sg of segs) {
          let prev = null;
          for (const q of sg) {
            const x = X(q[0]), y = Y(q[1]);
            if (prev && Math.abs(wrap(q[0] - prev[0])) < 60) { ctx.moveTo(prev[2], prev[3]); ctx.lineTo(x, y); }
            prev = [q[0], q[1], x, y];
          }
        }
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(235,240,255,0.85)';
      for (const st of STARS) {
        if (st.mag > lim) continue;
        const x = X(ec ? st.elon : st.ra), y = Y(ec ? st.elat : st.dec);
        if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) continue;
        ctx.beginPath(); ctx.arc(x, y, clamp(0.6 + (lim - st.mag) * 0.34, 0.6, 3.2), 0, 6.2832); ctx.fill();
      }
      if (!view.wide) {
        ctx.font = `11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(150,190,255,0.6)';
        for (const c of CONS) { const cc = ec ? c.cenE : c.cen; const x = X(cc[0]), y = Y(cc[1]); if (x > box[0] + 10 && x < box[2] - 10 && y > box[1] + 8 && y < box[3] - 8) ctx.fillText(c.ja, x, y); }
      } else if (ec) {
        // 黄道十二星座の目安: 黄道上の主な星座名を並べる
        ctx.font = `11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(150,190,255,0.75)';
        const ZOD = [['おひつじ座', 'Ari'], ['おうし座', 'Tau'], ['ふたご座', 'Gem'], ['かに座', 'Cnc'], ['しし座', 'Leo'], ['おとめ座', 'Vir'], ['てんびん座', 'Lib'], ['さそり座', 'Sco'], ['いて座', 'Sgr'], ['やぎ座', 'Cap'], ['みずがめ座', 'Aqr'], ['うお座', 'Psc']];
        let lastX = -1e9;
        for (const [ja] of ZOD.slice().sort((p1, p2) => X(CONS.find((q) => q.ja === p1[0]).cenE[0]) - X(CONS.find((q) => q.ja === p2[0]).cenE[0]))) { const c = CONS.find((q) => q.ja === ja); if (!c) continue; const x = X(c.cenE[0]); if (x > box[0] + 14 && x < box[2] - 14 && x - lastX > ctx.measureText(ja).width + 6) { ctx.fillText(ja, x, box[3] - 9); lastX = x; } }
      }
    }
    // 軌跡
    const lab = labelDays();
    for (const id of ids) {
      const o = T.by[id], pl = PL.find((p) => p.id === id);
      const pos = (d) => (alt ? [X(o.az[d]), Y(o.alt[d]), o.alt[d] > -3] : [X(U(o, d)), Y(V(o, d)), true]);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      let shown = 0;
      for (let d = 0; d < T.n; d++) {
        const a = pos(d), b = pos(d + 1);
        if (!a[2] || !b[2]) continue;
        shown++;
        if (alt ? Math.abs(o.az[d + 1] - o.az[d]) > 180 : Math.abs(wrap(U(o, d + 1) - U(o, d))) > 30 || Math.abs(a[0] - b[0]) > pw * 0.5) continue;
        if (o.retro[d]) { ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        ctx.strokeStyle = o.retro[d] ? RETRO : pl.color; ctx.lineWidth = o.retro[d] ? 3.4 : 1.8;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      if (alt && shown < T.n * 0.08) {
        ctx.fillStyle = 'rgba(255,230,160,0.95)'; ctx.font = `12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('この時刻はほとんど地平線の下です', (box[0] + box[2]) / 2, (box[1] + box[3]) / 2 - 8);
        ctx.fillText('観測時刻を変えてみてください', (box[0] + box[2]) / 2, (box[1] + box[3]) / 2 + 10);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const stepDot = T.n <= 220 ? 5 : T.n <= 420 ? 10 : T.n <= 1200 ? 30 : 90;
      for (let d = 0; d <= T.n; d += stepDot) { const a = pos(d); if (a[2]) { ctx.beginPath(); ctx.arc(a[0], a[1], 1.6, 0, 6.2832); ctx.fill(); } }
      ctx.font = `10px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      const placed = [];
      for (const l of lab) {
        const a = pos(l.d); if (!a[2]) continue;
        ctx.beginPath(); ctx.arc(a[0], a[1], 3, 0, 6.2832); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
        if (placed.some((q) => Math.hypot(q[0] - a[0], q[1] - a[1]) < 34)) continue;
        placed.push(a);
        ctx.fillStyle = 'rgba(232,237,255,0.9)'; ctx.fillText(l.label, a[0] + 4, a[1] - 3);
      }
      for (const e of T.events) {
        if (e.id !== id || e.t < 0 || e.t > T.n) continue;
        const k = Math.round(e.t), a = pos(clamp(k, 0, T.n));
        if (!a[2]) continue;
        const txt = { 'stat-r': '留', 'stat-d': '留', opp: '衝', inf: '内合' }[e.type];
        if (!txt) continue;
        ctx.strokeStyle = e.type === 'opp' ? '#ffe9a8' : '#ffb3b3'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(a[0], a[1], 6.5, 0, 6.2832); ctx.stroke();
        ctx.font = `bold 11px ${FONT}`; ctx.fillStyle = e.type === 'opp' ? '#ffe9a8' : '#ffb3b3'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(txt, a[0], a[1] + 8);
      }
      const c = pos(clamp(state.cur, 0, T.n));
      if (c[2]) {
        ctx.fillStyle = pl.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c[0], c[1], 6, 0, 6.2832); ctx.fill(); ctx.stroke();
        ctx.font = `bold 12px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(pl.ja, c[0] + 10, c[1] + 11);
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(160,180,230,0.45)'; ctx.lineWidth = 1; ctx.strokeRect(box[0], box[1], pw, ph);
    if (!alt) {
      ctx.font = `10px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(255,230,160,0.95)';
      ctx.fillText(ec ? `黄道座標（J2000）${stretched ? '・縦を拡大' : ''}` : '赤道座標（J2000）', box[2] - 5, box[1] + 4);
    }
  }

  // ---- 解説図（上から見た図） ----
  function drawTop() {
    const cv = $('cvTop');
    const { ctx, w, h } = setup(cv);
    const id = state.focus, o = T.by[id], pl = PL.find((p) => p.id === id);
    const cx = w / 2, cy = h / 2;
    let rMax = 1.25;
    for (let d = 0; d <= T.n; d++) rMax = Math.max(rMax, o.rS[d]);
    rMax *= 1.12;
    const sc = (Math.min(w, h) / 2 - 14) / rMax;
    const P = (x, y) => [cx + x * sc, cy - y * sc];
    ctx.lineWidth = 1;
    for (const oid of ['earth', id]) {
      const pts = A.orbitPoints(oid, A.jdFromMs(T.ms[clamp(state.cur, 0, T.n)]), 200);
      ctx.strokeStyle = oid === 'earth' ? 'rgba(111,177,255,0.45)' : 'rgba(180,195,235,0.3)';
      ctx.beginPath(); pts.forEach((v, i) => { const p = P(v[0], v[1]); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke();
    }
    // 視線（数日おき）と軌跡
    const step = Math.max(1, Math.round(T.n / 40));
    for (let d = 0; d <= T.n; d += step) {
      const e = T.earth[d], p = [o.hx[d], o.hy[d]];
      const dx = p[0] - e[0], dy = p[1] - e[1], L = Math.hypot(dx, dy);
      const ext = rMax * 2.2;
      const a = P(e[0], e[1]), b = P(e[0] + (dx / L) * ext, e[1] + (dy / L) * ext);
      ctx.strokeStyle = o.retro[d] ? 'rgba(255,107,107,0.22)' : 'rgba(246,210,122,0.14)';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    for (let d = 0; d <= T.n; d++) {
      const pe = P(T.earth[d][0], T.earth[d][1]), pp = P(o.hx[d], o.hy[d]);
      ctx.fillStyle = 'rgba(111,177,255,0.8)'; ctx.fillRect(pe[0] - 1, pe[1] - 1, 2, 2);
      ctx.fillStyle = o.retro[d] ? RETRO : pl.color; ctx.fillRect(pp[0] - 1.3, pp[1] - 1.3, 2.6, 2.6);
    }
    // 太陽
    const sp = P(0, 0);
    ctx.fillStyle = '#ffd978'; ctx.beginPath(); ctx.arc(sp[0], sp[1], 5, 0, 6.2832); ctx.fill();
    // いまの視線
    const c = clamp(state.cur, 0, T.n), e = T.earth[c], p = [o.hx[c], o.hy[c]];
    const dx = p[0] - e[0], dy = p[1] - e[1], L = Math.hypot(dx, dy);
    const a = P(e[0], e[1]), b = P(e[0] + (dx / L) * rMax * 2.2, e[1] + (dy / L) * rMax * 2.2);
    ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    const pp = P(p[0], p[1]);
    ctx.fillStyle = pl.color; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(pp[0], pp[1], 6, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6fb1ff'; ctx.beginPath(); ctx.arc(a[0], a[1], 5, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#cfe4ff'; ctx.fillText('地球', a[0] + 9, a[1] - 8);
    ctx.fillStyle = pl.color; ctx.fillText(pl.ja, pp[0] + 9, pp[1] - 8);
    ctx.fillStyle = '#ffd978'; ctx.fillText('太陽', sp[0] + 8, sp[1] + 12);
    ctx.fillStyle = 'rgba(255,243,196,0.9)'; ctx.font = `11px ${FONT}`; ctx.textAlign = 'right';
    ctx.fillText('視線の先 ＝ 背景の星の方向', w - 8, h - 10);
  }

  // ---- 表示の更新 ----
  function eventText(e, id) {
    const pl = PL.find((p) => p.id === id);
    return { 'stat-r': ['留（逆行の始まり）', '東向きの動きが止まり、西向きに動き始める'], 'stat-d': ['留（逆行の終わり）', '西向きの動きが止まり、また東向きに動き出す'], opp: ['衝', '太陽の反対側。一晩中見え、最も明るく大きく見える'], conj: ['合', '太陽の向こう側。ほぼ見えない'], inf: ['内合', '地球と太陽の間。ほぼ見えない（逆行の中心）'], sup: ['外合', '太陽の向こう側。ほぼ見えない'] }[e.type] || ['', ''];
  }
  function buildTable() {
    const rows = [];
    for (const id of state.sel) {
      const o = T.by[id], pl = PL.find((p) => p.id === id);
      // 逆行区間
      let s = null;
      for (let d = 0; d <= T.n; d++) {
        if (o.retro[d] && s === null) s = d;
        if ((!o.retro[d] || d === T.n) && s !== null) {
          const end = !o.retro[d] ? d : d, dl = Math.abs(wrap(o.lon[end] - o.lon[s]));
          rows.push({ t: s, id, a: '逆行', b: `${fmtD(T.ms[s])} 〜 ${fmtD(T.ms[end])}`, memo: `${end - s}日間 ・ 黄経で約${dl.toFixed(1)}°戻る${s === 0 ? '（期間の前から続いています）' : ''}`, color: RETRO });
          s = null;
        }
      }
      for (const e of T.events) {
        if (e.id !== id || e.t < 0 || e.t > T.n || e.type === 'stat-r' || e.type === 'stat-d') continue;
        if (e.type === 'sup' || e.type === 'conj') continue;
        const [name, memo] = eventText(e, id);
        rows.push({ t: e.t, id, a: name, b: fmtD(T.ms[Math.round(e.t)]), memo });
      }
    }
    rows.sort((x, y) => x.t - y.t);
    $('tbl').querySelector('tbody').innerHTML = rows.map((r) => {
      const pl = PL.find((p) => p.id === r.id);
      return `<tr data-t="${Math.round(r.t)}" style="cursor:pointer"><td><span style="color:${pl.color}">●</span> ${pl.ja}</td><td style="color:${r.color || 'inherit'}">${r.a}</td><td>${r.b}</td><td class="note">${r.memo}</td></tr>`;
    }).join('') || '<tr><td colspan="4" class="note">この期間に該当する出来事はありません。</td></tr>';
    document.querySelectorAll('#tbl tbody tr[data-t]').forEach((tr) => tr.addEventListener('click', () => { state.cur = clamp(Number(tr.dataset.t), 0, T.n); sync(); }));
  }

  function whyText() {
    const id = state.focus;
    const inner = id === 'mercury' || id === 'venus';
    return inner
      ? '内側の惑星は地球より速く公転しています。内合（地球と太陽の間）のころ、惑星は地球を追い越すように動くため、背景の星に対して西向きに戻って見えます。'
      : '外側の惑星は地球よりゆっくり公転しています。衝のころ、地球が内側から惑星を追い越すため、地球から見る視線の向きが逆戻りし、背景の星に対して西向きに戻って見えます。外の惑星ほど逆行は頻繁ですが、動く角度は小さくなります。';
  }

  let rendering = false;
  function render() {
    if (!T) return;
    const ids = PL.map((p) => p.id).filter((id) => state.sel.has(id));
    const box = $('charts');
    const needMulti = state.layout === 'sep' && ids.length > 1;
    box.className = 'charts' + (needMulti ? ' multi' : '');
    const groups = needMulti ? ids.map((id) => [id]) : [ids];
    if (box.children.length !== groups.length || box.dataset.sig !== groups.map((g) => g.join('+')).join('|')) {
      box.textContent = '';
      box.dataset.sig = groups.map((g) => g.join('+')).join('|');
      for (const g of groups) {
        const cell = document.createElement('div'); cell.className = 'cc';
        const title = g.map((id) => PL.find((p) => p.id === id).ja).join('・');
        cell.innerHTML = `<h3>${title || '惑星を選んでください'}</h3><div class="plot" style="aspect-ratio:${needMulti ? '4/3' : '4/3'}"><canvas></canvas></div>`;
        box.appendChild(cell);
      }
    }
    if (ids.length) [...box.querySelectorAll('canvas')].forEach((cv, i) => drawChart(cv, groups[i]));
    drawTop();
    const cur = clamp(state.cur, 0, T.n);
    const q = dateOf(T.ms[cur]), wd = WD[new Date(T.ms[cur] + JST).getUTCDay()];
    $('curLabel').textContent = `${q.y}年${q.m}月${q.d}日（${wd}）`;
    const o = T.by[state.focus], pl = PL.find((p) => p.id === state.focus);
    $('curSub').innerHTML = `${pl.ja}: <b style="color:${o.retro[Math.min(cur, T.n)] ? RETRO : 'inherit'}">${o.retro[Math.min(cur, T.n)] ? '逆行中（西へ戻っている）' : '順行中（東へ進んでいる）'}</b> ／ 地球から ${o.rE[cur].toFixed(2)} AU ／ 太陽からの離角 ${o.elong[cur].toFixed(0)}°`;
    $('scrub').value = String(cur);
    $('why').textContent = whyText();
    $('chartNote').textContent = state.mode === 'sky'
      ? '背景は星座の線と星（J2000.0）。赤い線（白い縁取り）が逆行、白い点は一定日数ごとの位置です。図の上が北、左が東です。「留」は動きの向きが変わる日、「衝」は太陽の反対側になる日、「内合」は水星・金星が地球と太陽の間に来る日です。範囲が広いときは黄道座標（黄道に沿った座標）に自動で切り替えます。'
      : `毎日 ${state.hour}:00（日本時間）に空を見上げたときの、方位と高度です。太陽が動くため、半年かけて空の見える位置も大きく変わります。地平線より下の日は線が途切れます。`;
  }
  function sync() { render(); }

  // ---- 操作 ----
  function rebuild() { compute(); buildTable(); state.cur = clamp(state.cur, 0, T.n); render(); }
  const chips = $('chips');
  for (const p of PL) {
    const l = document.createElement('label'); l.className = 'pchip';
    l.innerHTML = `<input type="checkbox" value="${p.id}"><i style="background:${p.color}"></i>${p.ja}`;
    l.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) state.sel.add(p.id); else state.sel.delete(p.id);
      if (!state.sel.has(state.focus) && state.sel.size) state.focus = [...state.sel][0];
      updateFocusOptions(); buildTable(); render();
    });
    chips.appendChild(l);
  }
  function syncChips() { chips.querySelectorAll('input').forEach((i) => { i.checked = state.sel.has(i.value); }); }
  function updateFocusOptions() {
    const sel = $('focus'); sel.textContent = '';
    for (const id of PL.map((p) => p.id).filter((i) => state.sel.has(i))) { const o = document.createElement('option'); o.value = id; o.textContent = PL.find((p) => p.id === id).ja; sel.appendChild(o); }
    if (!state.sel.size) { const o = document.createElement('option'); o.textContent = '—'; sel.appendChild(o); }
    sel.value = state.focus;
  }
  $('focus').addEventListener('change', (e) => { state.focus = e.target.value; render(); });
  function setStart(ms) { state.start = dayStartOf(ms); $('start').value = `${dateOf(state.start).y}-${pad(dateOf(state.start).m)}-${pad(dateOf(state.start).d)}`; }
  $('start').addEventListener('change', (e) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.target.value); if (m) { state.start = Date.UTC(+m[1], +m[2] - 1, +m[3]) - JST; state.cur = 0; rebuild(); } });
  $('len').addEventListener('change', (e) => { state.days = Number(e.target.value); state.cur = 0; rebuild(); });
  $('mode').addEventListener('change', (e) => { state.mode = e.target.value; $('hourWrap').hidden = $('placeWrap').hidden = state.mode !== 'alt'; rebuild(); });
  $('hour').addEventListener('change', (e) => { state.hour = Number(e.target.value); rebuild(); });
  $('place').addEventListener('change', (e) => { const [la, lo] = e.target.value.split(',').map(Number); state.lat = la; state.lon = lo; rebuild(); });
  $('sys').addEventListener('change', (e) => { state.sys = e.target.value; render(); });
  $('layout').addEventListener('change', (e) => { state.layout = e.target.value; render(); });
  for (let h = 17; h <= 30; h++) { const o = document.createElement('option'); o.value = h; o.textContent = `観測 ${h % 24}時${h >= 24 ? '（翌朝）' : ''}`; if (h === 21) o.selected = true; $('hour').appendChild(o); }

  // 次の逆行開始日を探す
  function nextRetroStart(id, from) {
    let prev = null;
    for (let k = 0; k < 4000; k++) {
      const t = from + k * DAY + 21 * 3600000;
      const a = A.skyPlanets(t, 35.68, 139.69).planets.find((p) => p.id === id).lonG;
      const b = A.skyPlanets(t + DAY, 35.68, 139.69).planets.find((p) => p.id === id).lonG;
      const r = wrap(b - a) < 0;
      if (prev === false && r) return t;
      prev = r;
    }
    return from;
  }
  const PRESETS = {
    'mars-next': () => { const t = nextRetroStart('mars', dayStartOf(Date.now())); return { sel: ['mars'], start: t - 110 * DAY, days: 270 }; },
    'mars-2y': () => ({ sel: ['mars'], start: Date.UTC(dateOf(Date.now()).y, 0, 1) - JST, days: 730 }),
    'inner-1y': () => ({ sel: ['mercury', 'venus'], start: Date.UTC(dateOf(Date.now()).y, 0, 1) - JST, days: 365 }),
    'all-1y': () => ({ sel: PL.map((p) => p.id), start: Date.UTC(dateOf(Date.now()).y, 0, 1) - JST, days: 365 }),
    'jup-12y': () => ({ sel: ['jupiter'], start: Date.UTC(dateOf(Date.now()).y, 0, 1) - JST, days: 4380 }),
  };
  function applyPreset(name) {
    const p = PRESETS[name]();
    state.sel = new Set(p.sel); state.focus = p.sel[0]; state.days = p.days; state.cur = 0;
    $('len').value = String(p.days); setStart(p.start); syncChips(); updateFocusOptions();
    $('layout').value = 'sep'; state.layout = 'sep';
    rebuild();
  }
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { stop(); applyPreset(b.dataset.preset); }));

  $('scrub').addEventListener('input', (e) => { stop(); state.cur = Number(e.target.value); render(); });
  function stop() { state.playing = false; $('play').setAttribute('aria-pressed', 'false'); $('play').textContent = '▶ 日々の動きを再生'; }
  $('play').addEventListener('click', () => {
    if (state.playing) { stop(); return; }
    if (state.cur >= T.n) state.cur = 0;
    state.playing = true; acc = state.cur; $('play').setAttribute('aria-pressed', 'true'); $('play').textContent = '⏸ 一時停止';
  });
  let acc = 0, last = performance.now();
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (state.playing && T) {
      acc += dt * Math.max(8, T.n / 20);
      if (acc >= T.n) { acc = T.n; stop(); }
      state.cur = Math.floor(acc); render();
    }
    requestAnimationFrame(loop);
  }
  window.addEventListener('resize', () => render());

  // 起動
  const q = new URLSearchParams(location.search);
  const pre = q.get('p');
  if (q.get('mode') === 'alt') { state.mode = 'alt'; $('mode').value = 'alt'; $('hourWrap').hidden = $('placeWrap').hidden = false; }
  if (q.get('start') && /^\d{4}-\d{2}-\d{2}$/.test(q.get('start'))) { const s = q.get('start').split('-').map(Number); setStart(Date.UTC(s[0], s[1] - 1, s[2]) - JST); state.sel = new Set((q.get('planets') || 'mars').split(',').filter((x) => PL.some((p) => p.id === x))); state.focus = [...state.sel][0] || 'mars'; if (q.get('days')) { state.days = Number(q.get('days')); $('len').value = String(state.days); } syncChips(); updateFocusOptions(); rebuild(); }
  else applyPreset(pre && PRESETS[pre] ? pre : 'mars-next');
  $('legend').innerHTML = `<span><i style="background:${RETRO};outline:2px solid #fff"></i>逆行（西へ戻る・白い縁取り）</span><span><i style="background:#cfe4ff"></i>惑星の色の細い線は順行（東へ進む）</span><span>○ 留・衝・内合</span>`;
  requestAnimationFrame(loop);
  window.__retro = { state, applyPreset };
})();
