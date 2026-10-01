/* 太陽の動きとアナレンマ */
(function () {
  'use strict';
  const A = window.Astro;
  const D = Math.PI / 180;
  const $ = (id) => document.getElementById(id);
  const JST = 9 * 3600000, DAY = 86400000;
  const pad = (n) => String(n).padStart(2, '0');
  const FONT = 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif';
  const state = { lat: 35.6895, lon: 139.6917, place: '東京', ms: Date.UTC(2026, 0, 1), atime: 12 };
  const COL = { summer: '#ff9c6a', equinox: '#8fe3a0', winter: '#7fb4ff', sel: '#f6d27a' };

  const dayStartOf = (ms) => Math.floor((ms + JST) / DAY) * DAY - JST;
  const parts = (ms) => { const d = new Date(ms + JST); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), w: d.getUTCDay() }; };
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const hm = (min) => { const t = Math.round(min); const h = Math.floor(t / 60), m = t - h * 60; return `${pad(((h % 24) + 24) % 24)}:${pad(m)}`; };
  const hmDur = (min) => `${Math.floor(min / 60)}時間${pad(Math.round(min % 60))}分`;

  /** その日(JST)の太陽: 赤緯・均時差・日の出入り・南中（時計の分, JST 0:00 からの分） */
  function sunDay(dayStart) {
    const mid = dayStart + 12 * 3600000;
    const sp = A.sunPos(mid), eot = A.equationOfTime(mid);
    const lat = state.lat, lon = state.lon;
    const noon = 720 - 4 * (lon - 135) - eot;
    const cosH = (Math.sin(-0.833 * D) - Math.sin(lat * D) * Math.sin(sp.dec * D)) / (Math.cos(lat * D) * Math.cos(sp.dec * D));
    let H = null;
    if (cosH <= -1) H = 180; else if (cosH < 1) H = Math.acos(cosH) / D;
    const alt = 90 - Math.abs(lat - sp.dec);
    return {
      dec: sp.dec, eot, noon, alt, H,
      rise: H !== null && H < 180 ? noon - 4 * H : null,
      set: H !== null && H < 180 ? noon + 4 * H : null,
      len: H === null ? 0 : 8 * H,
    };
  }

  // ---- 図の共通 ----
  function setup(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#060b1c'; ctx.fillRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function axes(ctx, box, xr, yr, xt, yt, xLabel) {
    const [x0, y0, x1, y1] = box;
    const X = (v) => x0 + ((v - xr[0]) / (xr[1] - xr[0])) * (x1 - x0);
    const Y = (v) => y1 - ((v - yr[0]) / (yr[1] - yr[0])) * (y1 - y0);
    ctx.font = `11px ${FONT}`; ctx.lineWidth = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const [v, l] of xt) { ctx.strokeStyle = 'rgba(140,170,255,0.12)'; ctx.beginPath(); ctx.moveTo(X(v), y0); ctx.lineTo(X(v), y1); ctx.stroke(); ctx.fillStyle = 'rgba(160,180,230,0.85)'; ctx.fillText(l, X(v), y1 + 4); }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const [v, l] of yt) { ctx.strokeStyle = 'rgba(140,170,255,0.12)'; ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke(); ctx.fillStyle = 'rgba(160,180,230,0.85)'; ctx.fillText(l, x0 - 5, Y(v)); }
    ctx.strokeStyle = 'rgba(160,180,230,0.5)'; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    if (xLabel) { ctx.fillStyle = 'rgba(160,180,230,0.7)'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(xLabel, x1, y1 + 30); }
    return { X, Y };
  }
  const bounds = (w, h, l = 38, r = 12, t = 12, b = 30) => [l, t, w - r, h - b];

  // ---- 太陽の通り道 ----
  function drawPath() {
    const { ctx, w, h } = setup($('cvPath'));
    const mode = $('axis').value;
    const box = bounds(w, h, 36, 12, 12, 30);
    const xr = mode === 'time' ? [0, 24] : [0, 360];
    const xt = mode === 'time' ? [0, 3, 6, 9, 12, 15, 18, 21, 24].map((v) => [v, v + '時']) : [[0, '北'], [90, '東'], [180, '南'], [270, '西'], [360, '北']];
    const yr = [-10, 90];
    const { X, Y } = axes(ctx, box, xr, yr, xt, [0, 30, 60, 90].map((v) => [v, v + '°']));
    // 地平線の下
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(box[0], Y(0), box[2] - box[0], box[3] - Y(0));
    ctx.strokeStyle = 'rgba(160,190,255,0.5)'; ctx.beginPath(); ctx.moveTo(box[0], Y(0)); ctx.lineTo(box[2], Y(0)); ctx.stroke();
    const y = parts(state.ms).y;
    const terms = { summer: A.solarTerm(y, 90), equinox: A.solarTerm(y, 0), winter: A.solarTerm(y, 270) };
    const curves = [['summer', dayStartOf(terms.summer)], ['equinox', dayStartOf(terms.equinox)], ['winter', dayStartOf(terms.winter)], ['sel', dayStartOf(state.ms)]];
    for (const [k, ds] of curves) {
      ctx.strokeStyle = COL[k]; ctx.lineWidth = k === 'sel' ? 3 : 1.8;
      ctx.beginPath(); let down = false, prevAz = null;
      for (let m = 0; m <= 1440; m += 6) {
        const s = A.sunAltAz(ds + m * 60000, state.lat, state.lon);
        if (s.alt < -10) { down = false; prevAz = null; continue; }
        const xv = mode === 'time' ? m / 60 : s.az;
        if (mode === 'az' && prevAz !== null && Math.abs(s.az - prevAz) > 180) down = false;
        prevAz = s.az;
        if (!down) { ctx.moveTo(X(xv), Y(s.alt)); down = true; } else ctx.lineTo(X(xv), Y(s.alt));
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    $('legPath').innerHTML = `<span><i style="background:${COL.summer}"></i>夏至</span><span><i style="background:${COL.equinox}"></i>春分・秋分</span><span><i style="background:${COL.winter}"></i>冬至</span><span><i style="background:${COL.sel}"></i>選んだ日</span>`;
  }

  // ---- アナレンマ ----
  function drawAna() {
    const { ctx, w, h } = setup($('cvAna'));
    const y = parts(state.ms).y;
    const pts = [];
    for (let d = 0; d < 366; d++) {
      const ds = Date.UTC(y, 0, 1 + d) - JST;
      if (parts(ds).y !== y) break;
      const s = A.sunAltAz(ds + state.atime * 3600000, state.lat, state.lon);
      pts.push({ d, ds, az: s.az > 180 + 180 ? s.az - 360 : s.az, alt: s.alt });
    }
    // 方位の連続化（北緯30°台では南中付近のみなので折返しは起きにくい）
    let amin = Infinity, amax = -Infinity, lmin = Infinity, lmax = -Infinity;
    for (const p of pts) { amin = Math.min(amin, p.az); amax = Math.max(amax, p.az); lmin = Math.min(lmin, p.alt); lmax = Math.max(lmax, p.alt); }
    const box = bounds(w, h, 40, 14, 14, 28);
    // 度/ピクセルを縦横で等しくする
    const pw = box[2] - box[0], ph = box[3] - box[1];
    const spanA = Math.max(1, amax - amin), spanL = Math.max(1, lmax - lmin);
    const sc = Math.min(pw / (spanA * 1.25), ph / (spanL * 1.18));
    const cA = (amin + amax) / 2, cL = (lmin + lmax) / 2;
    const X = (v) => (box[0] + box[2]) / 2 + (v - cA) * sc;
    const Y = (v) => (box[1] + box[3]) / 2 - (v - cL) * sc;
    ctx.font = `11px ${FONT}`;
    // 目盛り
    ctx.strokeStyle = 'rgba(140,170,255,0.12)'; ctx.fillStyle = 'rgba(160,180,230,0.85)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let v = Math.ceil(lmin / 5) * 5; v <= lmax + 4; v += 5) { if (Y(v) < box[1] || Y(v) > box[3]) continue; ctx.beginPath(); ctx.moveTo(box[0], Y(v)); ctx.lineTo(box[2], Y(v)); ctx.stroke(); ctx.fillText(v + '°', box[0] - 5, Y(v)); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const stepX = pw / sc > 60 ? 10 : 5;
    for (let v = Math.ceil((cA - pw / sc / 2) / stepX) * stepX; v <= cA + pw / sc / 2; v += stepX) { if (X(v) < box[0] || X(v) > box[2]) continue; ctx.beginPath(); ctx.moveTo(X(v), box[1]); ctx.lineTo(X(v), box[3]); ctx.stroke(); ctx.fillText(v + '°', X(v), box[3] + 4); }
    ctx.strokeStyle = 'rgba(160,180,230,0.5)'; ctx.strokeRect(box[0], box[1], pw, ph);
    ctx.fillStyle = 'rgba(160,180,230,0.7)'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('横軸: 方位（180°=真南）', box[2] - 6, box[1] + 4);
    // 曲線
    ctx.strokeStyle = 'rgba(246,210,122,0.75)'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(X(p.az), Y(p.alt)) : ctx.moveTo(X(p.az), Y(p.alt))));
    ctx.stroke();
    // 月初の目印
    ctx.font = `11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let mo = 0; mo < 12; mo++) {
      const p = pts[Math.round((Date.UTC(y, mo, 1) - Date.UTC(y, 0, 1)) / DAY)];
      if (!p) continue;
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(X(p.az), Y(p.alt), 3, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(232,237,255,0.9)';
      const dx = X(p.az) > (box[0] + box[2]) / 2 ? 12 : -12;
      ctx.textAlign = dx > 0 ? 'left' : 'right';
      ctx.fillText(`${mo + 1}/1`, X(p.az) + dx * 0.7, Y(p.alt));
    }
    // 選んだ日
    const di = Math.round((dayStartOf(state.ms) - (Date.UTC(y, 0, 1) - JST)) / DAY);
    const sp = pts[clampI(di, 0, pts.length - 1)];
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.fillStyle = '#f6d27a';
    ctx.beginPath(); ctx.arc(X(sp.az), Y(sp.alt), 6, 0, 6.2832); ctx.fill(); ctx.stroke();
  }
  const clampI = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- 1年の折れ線 ----
  function drawYear() {
    const y = parts(state.ms).y;
    const days = [];
    for (let d = 0; d < 366; d++) { const ds = Date.UTC(y, 0, 1 + d) - JST; if (parts(ds).y !== y) break; days.push({ ds, ...sunDay(ds) }); }
    const di = clampI(Math.round((dayStartOf(state.ms) - (Date.UTC(y, 0, 1) - JST)) / DAY), 0, days.length - 1);
    const mt = [0, 3, 6, 9].concat([]).map(() => 0);
    void mt;
    const xt = [...Array(12).keys()].map((m) => [Math.round((Date.UTC(y, m, 1) - Date.UTC(y, 0, 1)) / DAY), `${m + 1}月`]);
    const line = (id, get, yr, yt, color, fmt) => {
      const { ctx, w, h } = setup($(id));
      const box = bounds(w, h, 36, 10, 10, 24);
      const { X, Y } = axes(ctx, box, [0, days.length - 1], yr, xt.filter((_, i) => i % 2 === 0), yt);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      days.forEach((d, i) => (i ? ctx.lineTo(X(i), Y(get(d))) : ctx.moveTo(X(i), Y(get(d)))));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(di), box[1]); ctx.lineTo(X(di), box[3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#f6d27a'; ctx.beginPath(); ctx.arc(X(di), Y(get(days[di])), 4.5, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#ffe9a8'; ctx.font = `bold 11px ${FONT}`; ctx.textAlign = X(di) > w / 2 ? 'right' : 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(fmt(get(days[di])), X(di) + (X(di) > w / 2 ? -7 : 7), Y(get(days[di])) - 6);
    };
    const alts = days.map((d) => d.alt), lens = days.map((d) => d.len / 60);
    const rng = (a, pad2) => [Math.floor(Math.min(...a) / pad2) * pad2, Math.ceil(Math.max(...a) / pad2) * pad2];
    const ar = rng(alts, 10), lr = rng(lens, 2);
    const ticks = (r, step) => { const t = []; for (let v = r[0]; v <= r[1]; v += step) t.push([v, String(v)]); return t; };
    line('cvAlt', (d) => d.alt, ar, ticks(ar, 10), COL.summer, (v) => v.toFixed(1) + '°');
    line('cvLen', (d) => d.len / 60, lr, ticks(lr, 2), COL.equinox, (v) => v.toFixed(1) + '時間');
    line('cvEot', (d) => d.eot, [-20, 20], ticks([-20, 20], 10), COL.winter, (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '分');
    return days;
  }

  // ---- 数値表示 ----
  function info(days) {
    const ds = dayStartOf(state.ms), sd = sunDay(ds);
    const p = parts(state.ms);
    $('title').textContent = `${p.y}年${p.mo}月${p.d}日（${WD[p.w]}）`;
    $('sub').textContent = `${state.place}（北緯${state.lat.toFixed(1)}° 東経${state.lon.toFixed(1)}°）`;
    const azAt = (min) => A.sunAltAz(ds + min * 60000, state.lat, state.lon).az;
    const dirName = (az) => ['北', '北東', '東', '南東', '南', '南西', '西', '北西'][Math.round(az / 45) % 8];
    let rows;
    if (sd.rise === null) {
      rows = [['昼の長さ', sd.len > 0 ? '白夜（沈まない）' : '極夜（昇らない）']];
    } else {
      rows = [
        ['日の出', `${hm(sd.rise)}（${dirName(azAt(sd.rise))} ${azAt(sd.rise).toFixed(0)}°）`],
        ['南中', `${hm(sd.noon)}（高度 ${sd.alt.toFixed(1)}°）`],
        ['日の入り', `${hm(sd.set)}（${dirName(azAt(sd.set))} ${azAt(sd.set).toFixed(0)}°）`],
        ['昼の長さ', hmDur(sd.len)],
      ];
    }
    rows.push(['太陽の赤緯', `${sd.dec >= 0 ? '+' : ''}${sd.dec.toFixed(1)}°`], ['均時差', `${sd.eot >= 0 ? '+' : ''}${sd.eot.toFixed(1)}分`]);
    $('kv').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

    // 日の出入りの極値の日
    const ok = days.filter((d) => d.rise !== null);
    if (ok.length) {
      const by = (f, dir) => ok.reduce((a, b) => (dir * f(b) > dir * f(a) ? b : a));
      const md = (d) => { const q = parts(d.ds); return `${q.mo}月${q.d}日`; };
      const es = by((d) => d.set, -1), ls = by((d) => d.set, 1), er = by((d) => d.rise, -1), lr = by((d) => d.rise, 1);
      const sol = days.reduce((a, b) => (b.len > a.len ? b : a)), win = days.reduce((a, b) => (b.len < a.len ? b : a));
      $('insight').innerHTML = [
        `<li style="grid-template-columns:1fr"><span>昼がいちばん長い日は <b>${md(sol)}</b>（${hmDur(sol.len)}）、短い日は <b>${md(win)}</b>（${hmDur(win.len)}）です。</span></li>`,
        `<li style="grid-template-columns:1fr"><span>日の入りが最も<b>早い</b>日は <b>${md(es)}</b>（${hm(es.set)}）。冬至ではなく、冬至の少し前です。</span></li>`,
        `<li style="grid-template-columns:1fr"><span>日の出が最も<b>遅い</b>日は <b>${md(lr)}</b>（${hm(lr.rise)}）。冬至の少し後になります。</span></li>`,
        `<li style="grid-template-columns:1fr"><span>日の出が最も早い日は ${md(er)}（${hm(er.rise)}）、日の入りが最も遅い日は ${md(ls)}（${hm(ls.set)}）です。</span></li>`,
        `<li style="grid-template-columns:1fr"><span class="note">これは「均時差」のため。太陽が南中する時刻が、季節によって最大16分ほど前後するからです。</span></li>`,
      ].join('');
    } else $('insight').innerHTML = '';

    // 二至二分
    const y = p.y;
    const T = [['春分', 0], ['夏至', 90], ['秋分', 180], ['冬至', 270]].map(([n, t]) => [n, A.solarTerm(y, t)]);
    $('terms').innerHTML = T.map(([n, ms]) => {
      const q = parts(ms), s = sunDay(dayStartOf(ms));
      return `<tr data-ms="${dayStartOf(ms)}"><td>${n}</td><td>${q.mo}月${q.d}日 ${pad(q.h)}:${pad(q.mi)} 頃</td><td class="num">${s.rise === null ? '—' : hmDur(s.len)}</td><td class="num">${s.alt.toFixed(1)}°</td></tr>`;
    }).join('');
    document.querySelectorAll('#terms tr').forEach((tr) => tr.addEventListener('click', () => { state.ms = Number(tr.dataset.ms); update(); }));
  }

  function update() {
    const p = parts(state.ms);
    $('date').value = `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
    drawPath(); drawAna();
    info(drawYear());
  }

  // ---- 操作 ----
  for (let h = 8; h <= 16; h++) { const o = document.createElement('option'); o.value = h; o.textContent = `時刻: ${h}時（日本時間）`; if (h === 12) o.selected = true; $('atime').appendChild(o); }
  $('atime').addEventListener('change', (e) => { state.atime = Number(e.target.value); drawAna(); });
  $('axis').addEventListener('change', drawPath);
  $('place').addEventListener('change', (e) => { const [la, lo, nm] = e.target.value.split(','); state.lat = Number(la); state.lon = Number(lo); state.place = nm; update(); });
  $('date').addEventListener('change', (e) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.target.value); if (m) { state.ms = Date.UTC(+m[1], +m[2] - 1, +m[3]) - JST; update(); } });
  $('today').addEventListener('click', () => { state.ms = dayStartOf(Date.now()); update(); });
  document.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => {
    const y = parts(state.ms).y;
    const t = { 'solstice-s': 90, 'solstice-w': 270, 'equinox-s': 0, 'equinox-a': 180 }[b.dataset.d];
    state.ms = dayStartOf(A.solarTerm(y, t)); update();
  }));
  window.addEventListener('resize', () => update());
  const q = new URLSearchParams(location.search).get('d');
  state.ms = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? Date.UTC(+q.slice(0, 4), +q.slice(5, 7) - 1, +q.slice(8, 10)) - JST : dayStartOf(Date.now());
  update();
  window.__sun = { state, sunDay };
})();
