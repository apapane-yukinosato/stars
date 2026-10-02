/* 惑星の位置図 */
(function () {
  'use strict';
  const A = window.Astro;
  const D = Math.PI / 180;
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const FONT = 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif';
  const JST = 9 * 3600000, DAY = 86400000;
  const RANGES = { inner: { max: 1.75, mode: 'lin' }, mid: { max: 10.2, mode: 'sqrt' }, all: { max: 31.5, mode: 'sqrt' } };
  const INNER = new Set(['mercury', 'venus']);
  const state = { ms: jstNoon(Date.now()), playing: false, speed: 15, range: 'inner', rays: true };

  function jstNoon(ms) { return Math.floor((ms + JST) / DAY) * DAY - JST + 12 * 3600000; }
  const pad = (n) => String(n).padStart(2, '0');
  function ymd(ms) { const d = new Date(ms + JST); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
  function fmtDate(ms) { const d = new Date(ms + JST); return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`; }
  const WD = ['日', '月', '火', '水', '木', '金', '土'];

  function fmtLight(au) {
    const s = au * 499.005;
    if (s < 3600) return `${(s / 60).toFixed(1)}分`;
    return `${(s / 3600).toFixed(1)}時間`;
  }

  function whereText(p) {
    if (p.elong < 15) return '太陽に近く、観察は難しい時期';
    if (INNER.has(p.id)) return p.east ? '夕方、日没後の西の空' : '明け方、日の出前の東の空';
    if (p.elong > 150) return '衝の頃。一晩中見える';
    if (p.east) return p.elong >= 90 ? '夕方から夜半の空' : '夕方の西寄りの空';
    return p.elong >= 90 ? '夜半から明け方の空' : '明け方の東寄りの空';
  }

  // ---- 描画 ----
  const cv = $('cv');
  const OBJ = [
    { id: 'sun', ja: '太陽', color: '#ffd978' },
    { id: 'mercury', ja: '水星', color: '#c9b8a8' }, { id: 'venus', ja: '金星', color: '#fff3d0' },
    { id: 'earth', ja: '地球', color: '#6fb1ff' }, { id: 'mars', ja: '火星', color: '#ff8a65' },
    { id: 'jupiter', ja: '木星', color: '#ffe3b3' }, { id: 'saturn', ja: '土星', color: '#f0dca0' },
    { id: 'uranus', ja: '天王星', color: '#a8e6ef' }, { id: 'neptune', ja: '海王星', color: '#7fa0ff' },
  ];
  const colorOf = Object.fromEntries(OBJ.map((o) => [o.id, o.color]));

  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#060b1c'; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 12;
    const rg = RANGES[state.range];
    const mapR = (au) => (rg.mode === 'lin' ? au / rg.max : Math.sqrt(au / rg.max)) * R;
    const jd = A.jdFromMs(state.ms);
    const o = A.orrery(jd);
    const pos = (v) => { const r = Math.hypot(v[0], v[1]); const lon = Math.atan2(v[1], v[0]); const m = mapR(r); return [cx + m * Math.cos(lon), cy - m * Math.sin(lon), r]; };

    // 距離リング
    ctx.lineWidth = 1; ctx.font = `11px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const rings = state.range === 'inner' ? [0.5, 1, 1.5] : state.range === 'mid' ? [1, 2, 5, 10] : [1, 5, 10, 20, 30];
    for (const au of rings) {
      ctx.strokeStyle = 'rgba(140,170,255,0.1)'; ctx.beginPath(); ctx.arc(cx, cy, mapR(au), 0, 6.2832); ctx.stroke();
      ctx.fillStyle = 'rgba(160,180,230,0.5)'; ctx.fillText(`${au}AU`, cx + mapR(au) * 0.707 + 3, cy - mapR(au) * 0.707);
    }
    // 春分点の方向
    ctx.strokeStyle = 'rgba(140,170,255,0.18)'; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R, cy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(160,180,230,0.8)'; ctx.textAlign = 'right'; ctx.fillText('♈ 春分点の方向', cx + R - 2, cy - 9);

    // 軌道
    for (const ob of OBJ) {
      if (ob.id === 'sun') continue;
      const pts = A.orbitPoints(ob.id, jd, 240);
      ctx.strokeStyle = ob.id === 'earth' ? 'rgba(111,177,255,0.55)' : 'rgba(180,195,235,0.22)';
      ctx.lineWidth = ob.id === 'earth' ? 1.4 : 1;
      ctx.beginPath(); let started = false;
      for (const v of pts) { const p = pos(v); if (!started) { ctx.moveTo(p[0], p[1]); started = true; } else ctx.lineTo(p[0], p[1]); }
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    const ep = pos(o.earth);
    // 視線
    if (state.rays) {
      ctx.setLineDash([3, 4]);
      for (const p of o.planets) {
        const pp = pos(p.h);
        if (pp[2] > rg.max) continue;
        ctx.strokeStyle = 'rgba(111,177,255,0.35)';
        ctx.beginPath(); ctx.moveTo(ep[0], ep[1]); ctx.lineTo(pp[0], pp[1]); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // 太陽
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
    g.addColorStop(0, 'rgba(255,217,120,0.9)'); g.addColorStop(1, 'rgba(255,217,120,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 24, cy - 24, 48, 48);
    ctx.fillStyle = colorOf.sun; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 6.2832); ctx.fill();
    ctx.font = `12px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe9a8'; ctx.fillText('太陽', cx + 9, cy + 12);
    // 地球
    ctx.fillStyle = colorOf.earth; ctx.beginPath(); ctx.arc(ep[0], ep[1], 5, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#cfe4ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ep[0], ep[1], 8, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = '#cfe4ff'; ctx.font = `bold 13px ${FONT}`; ctx.fillText('地球', ep[0] + 11, ep[1] - 8);
    // 惑星
    for (const p of o.planets) {
      const pp = pos(p.h);
      if (pp[2] > rg.max) continue;
      const big = p.id === 'jupiter' || p.id === 'saturn';
      ctx.fillStyle = colorOf[p.id]; ctx.beginPath(); ctx.arc(pp[0], pp[1], big ? 5 : p.id === 'uranus' || p.id === 'neptune' ? 4 : 3.4, 0, 6.2832); ctx.fill();
      ctx.font = `12px ${FONT}`; ctx.fillStyle = colorOf[p.id]; ctx.fillText(p.ja, pp[0] + 8, pp[1] - 7);
    }
    updateTable(o);
  }

  function updateTable(o) {
    const tb = $('tbl').querySelector('tbody');
    tb.innerHTML = o.planets.map((p) =>
      `<tr><td><span style="color:${colorOf[p.id]}">●</span> ${p.ja}</td><td class="num">${p.rSun.toFixed(2)} AU</td><td class="num">${p.rEarth.toFixed(2)} AU</td><td class="num">${fmtLight(p.rEarth)}</td><td class="num">${p.elong.toFixed(0)}°${p.elong < 178 ? (p.east ? '東' : '西') : ''}</td></tr>`).join('');
    $('where').innerHTML = o.planets.filter((p) => p.id !== 'uranus' && p.id !== 'neptune')
      .map((p) => `<li><b style="color:${colorOf[p.id]}">${p.ja}</b><span>${whereText(p)}</span></li>`).join('');
  }

  // ---- 見どころ探索 ----
  const eventCache = { key: '', rows: [] };
  function findEvents(startMs) {
    const rows = [];
    const days = 1200;
    const series = [];
    for (let k = 0; k <= days; k++) series.push(A.orrery(A.jdFromMs(startMs + k * DAY)));
    const dlOf = (p, o) => ((p.lonG - o.sunLon) % 360 + 360) % 360;
    const ids = A.ALL_PLANETS.map((p) => p.id);
    for (const id of ids) {
      const get = (o) => o.planets.find((p) => p.id === id);
      if (INNER.has(id)) {
        let found = 0;
        for (let k = 1; k < days && found < 2; k++) {
          const a = get(series[k - 1]).elong, b = get(series[k]).elong, c = get(series[k + 1]).elong;
          if (b >= a && b > c) {
            const p = get(series[k]);
            rows.push({ id, ja: p.ja, kind: `最大離角（${p.east ? '東・夕方の西空' : '西・明け方の東空'}）`, ms: startMs + k * DAY, elong: p.elong, dist: p.rEarth });
            found++;
          }
        }
      } else {
        // 衝: 太陽との黄経差が 180° を通る時刻（二分探索で時刻まで絞る）
        let found = 0;
        for (let k = 1; k <= days && found < 1; k++) {
          const a = dlOf(get(series[k - 1]), series[k - 1]) - 180, b = dlOf(get(series[k]), series[k]) - 180;
          if (a > 0 && b <= 0) {
            let lo = startMs + (k - 1) * DAY, hi = startMs + k * DAY;
            for (let it = 0; it < 18; it++) {
              const mid = (lo + hi) / 2, oo = A.orrery(A.jdFromMs(mid));
              if (dlOf(oo.planets.find((p) => p.id === id), oo) - 180 > 0) lo = mid; else hi = mid;
            }
            const oo = A.orrery(A.jdFromMs(lo)), p = oo.planets.find((q) => q.id === id);
            rows.push({ id, ja: p.ja, kind: '衝', ms: lo, elong: p.elong, dist: p.rEarth });
            found++;
          }
        }
      }
    }
    return rows.sort((x, y) => x.ms - y.ms);
  }
  function updateEvents() {
    const key = ymd(state.ms);
    if (eventCache.key !== key) { eventCache.key = key; eventCache.rows = findEvents(state.ms); }
    $('events').querySelector('tbody').innerHTML = eventCache.rows.map((r) =>
      `<tr data-ms="${Math.round(jstNoon(r.ms))}"><td><span style="color:${colorOf[r.id]}">●</span> ${r.ja}</td><td>${r.kind}</td><td>${fmtDate(r.ms)}頃</td><td class="num">${r.elong.toFixed(0)}°</td><td class="num">${r.dist.toFixed(2)} AU</td></tr>`).join('');
    document.querySelectorAll('#events tbody tr').forEach((tr) => tr.addEventListener('click', () => setMs(Number(tr.dataset.ms))));
  }

  // ---- 操作 ----
  function refresh(full) {
    const d = new Date(state.ms + JST);
    $('dateLabel').textContent = `${fmtDate(state.ms)}（${WD[d.getUTCDay()]}）`;
    if ($('date').value !== ymd(state.ms)) $('date').value = ymd(state.ms);
    draw();
    if (full) updateEvents();
  }
  function setMs(ms, keep) {
    state.ms = clamp(ms, Date.UTC(1900, 0, 1), Date.UTC(2100, 11, 31));
    if (!keep) stop();
    refresh(!keep);
  }
  function stop() { state.playing = false; $('play').setAttribute('aria-pressed', 'false'); $('play').textContent = '▶ 再生'; }
  $('date').addEventListener('change', (e) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.target.value); if (m) setMs(Date.UTC(+m[1], +m[2] - 1, +m[3], 12) - JST); });
  $('today').addEventListener('click', () => setMs(jstNoon(Date.now())));
  document.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => setMs(state.ms + Number(b.dataset.days) * DAY)));
  $('range').addEventListener('change', (e) => { state.range = e.target.value; refresh(false); });
  $('rays').addEventListener('change', (e) => { state.rays = e.target.checked; refresh(false); });
  $('speed').addEventListener('change', (e) => { state.speed = Number(e.target.value); });
  $('play').addEventListener('click', () => {
    if (state.playing) { stop(); updateEvents(); return; }
    state.playing = true; $('play').setAttribute('aria-pressed', 'true'); $('play').textContent = '⏸ 一時停止';
  });
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (state.playing) {
      state.ms += dt * state.speed * DAY;
      if (state.ms > Date.UTC(2100, 11, 31)) { state.ms = Date.UTC(2100, 11, 31); stop(); }
      refresh(false);
    }
    requestAnimationFrame(loop);
  }
  window.addEventListener('resize', () => refresh(false));
  const q = new URLSearchParams(location.search).get('d');
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) { const m = q.split('-'); state.ms = Date.UTC(+m[0], +m[1] - 1, +m[2], 12) - JST; }
  $('legend').innerHTML = OBJ.map((o) => `<span><i style="background:${o.color}"></i>${o.ja}</span>`).join('');
  $('sub').textContent = '地球（青）から各惑星へ伸びる点線が、地球から見た方向です。';
  refresh(true);
  requestAnimationFrame(loop);
  window.__planets = { state, findEvents };
})();
