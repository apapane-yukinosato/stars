/* 光で旅する宇宙 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const C = 299792.458;           // km/s
  const AU = 149597870.7;         // km
  const YR = 365.25 * 86400;      // s
  const LY = C * YR;              // km
  const FONT = 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif';
  const SMAX = 17.65;             // log10(秒): 138億年 ≈ 4.35e17 s

  // [名前, 光で届く時間(秒), 距離の表示, 区分, 補足]  ※距離は光時間から計算
  const ly = (x) => x * YR;
  const OBJ = [
    { n: '国際宇宙ステーション', t: 400 / C, grp: 'near' },
    { n: '静止衛星', t: 35786 / C, grp: 'near' },
    { n: '月', t: 384400 / C, grp: 'sol', jump: true },
    { n: '太陽', t: AU / C, grp: 'sol', jump: true },
    { n: '火星（最接近時）', t: 5.57e7 / C, grp: 'sol' },
    { n: '木星', t: 5.2 * AU / C, grp: 'sol' },
    { n: '土星', t: 9.58 * AU / C, grp: 'sol' },
    { n: '海王星', t: 30.07 * AU / C, grp: 'sol', jump: true },
    { n: '冥王星（平均）', t: 39.5 * AU / C, grp: 'sol' },
    { n: 'ボイジャー1号', t: 86400, grp: 'sol', note: '2026年11月ごろに約1光日（約173AU）へ' },
    { n: 'オールトの雲の外縁', t: ly(1.58), grp: 'sol', note: '約10万AU（目安）' },
    { n: 'プロキシマ・ケンタウリ', t: ly(4.24), grp: 'star', jump: true, jumpName: '最も近い星' },
    { n: 'シリウス', t: ly(8.6), grp: 'star', sky: true },
    { n: 'アルタイル', t: ly(16.7), grp: 'star', sky: true },
    { n: 'ベガ', t: ly(25), grp: 'star', sky: true, jump: true },
    { n: 'アークトゥルス', t: ly(36.7), grp: 'star', sky: true },
    { n: 'カペラ', t: ly(43), grp: 'star', sky: true },
    { n: 'アルデバラン', t: ly(65), grp: 'star', sky: true },
    { n: 'レグルス', t: ly(79), grp: 'star', sky: true },
    { n: 'ポラリス（北極星）', t: ly(430), grp: 'star', sky: true },
    { n: 'プレアデス星団（すばる）', t: ly(444), grp: 'star', sky: true },
    { n: 'アンタレス', t: ly(550), grp: 'star', sky: true },
    { n: 'ベテルギウス', t: ly(550), grp: 'star', sky: true, note: '距離に幅あり（約550〜650光年）' },
    { n: 'リゲル', t: ly(860), grp: 'star', sky: true },
    { n: 'オリオン大星雲', t: ly(1344), grp: 'star', sky: true },
    { n: '銀河系の中心', t: ly(26000), grp: 'gal', jump: true },
    { n: '銀河系の反対側（直径）', t: ly(100000), grp: 'gal', note: '銀河系の直径は約10万光年' },
    { n: '大マゼラン雲', t: ly(160000), grp: 'gal', sky: true },
    { n: '小マゼラン雲', t: ly(200000), grp: 'gal', sky: true },
    { n: 'アンドロメダ銀河', t: ly(2.5e6), grp: 'gal', sky: true, jump: true },
    { n: 'おとめ座銀河団', t: ly(5.4e7), grp: 'gal' },
    { n: 'かみのけ座銀河団', t: ly(3.2e8), grp: 'gal' },
    { n: '宇宙の年齢（光が旅できる限界）', t: ly(1.38e10), grp: 'cos', jump: true, jumpName: '宇宙の果て', note: '観測できる宇宙の半径は膨張のため約465億光年' },
  ];
  OBJ.sort((a, b) => a.t - b.t);
  const COLORS = { near: '#9ad1ff', sol: '#ffd98a', star: '#ffffff', gal: '#d7a8ff', cos: '#ff9c8a' };

  // ---- 表記 ----
  function bigNum(n) {
    if (n < 1e4) return n >= 100 ? Math.round(n).toLocaleString('ja-JP') : n.toPrecision(3).replace(/\.?0+$/, '');
    const units = [[1e16, '京'], [1e12, '兆'], [1e8, '億'], [1e4, '万']];
    for (const [v, u] of units) if (n >= v) { const x = n / v; return (x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(0) : x.toFixed(1)).toString().replace(/\.0$/, '') + u; }
    return String(n);
  }
  function fmtTime(s) {
    if (s < 1) return `${s.toPrecision(2)}秒`;
    if (s < 60) return `${s.toFixed(1).replace(/\.0$/, '')}秒`;
    if (s < 3600) { const m = Math.floor(s / 60); return `${m}分${Math.round(s - m * 60)}秒`; }
    if (s < 86400) { const h = Math.floor(s / 3600); return `${h}時間${Math.round((s - h * 3600) / 60)}分`; }
    if (s < YR) return `${(s / 86400).toFixed(1).replace(/\.0$/, '')}日`;
    const y = s / YR;
    if (y < 100) return `${y.toFixed(y < 10 ? 2 : 1).replace(/\.?0+$/, '')}年`;
    if (y < 1e4) return `${Math.round(y).toLocaleString('ja-JP')}年`;
    return `${bigNum(y)}年`;
  }
  function fmtDist(km) {
    const parts = [`${bigNum(km)}km`];
    if (km >= AU * 0.05) parts.push(`${(km / AU) < 1e4 ? (km / AU).toPrecision(3).replace(/\.?0+$/, '') : bigNum(km / AU)}天文単位`);
    if (km >= LY * 0.05) parts.push(`${bigNum(km / LY)}光年`);
    return parts.join(' ＝ ');
  }
  const rideTime = (km, v) => fmtTime(km / v);

  // ---- 描画 ----
  const cv = $('cv');
  const slider = $('slider');
  const state = { s: 2.7, playing: false };
  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#060b1c'; ctx.fillRect(0, 0, w, h);
    const x0 = 18, x1 = w - 18, yB = h * 0.56;
    const X = (ls) => x0 + (ls / SMAX) * (x1 - x0);
    // 進んだ部分
    const g = ctx.createLinearGradient(x0, 0, X(state.s), 0);
    g.addColorStop(0, 'rgba(246,210,122,0)'); g.addColorStop(1, 'rgba(246,210,122,0.95)');
    ctx.fillStyle = g; ctx.fillRect(x0, yB - 3, X(state.s) - x0, 6);
    ctx.fillStyle = 'rgba(160,180,230,0.25)'; ctx.fillRect(X(state.s), yB - 1, x1 - X(state.s), 2);
    // 時間の目盛り
    const ticks = [[0, '1秒'], [Math.log10(60), '1分'], [Math.log10(3600), '1時間'], [Math.log10(86400), '1日'], [Math.log10(YR), '1年'], [Math.log10(100 * YR), '100年'], [Math.log10(1e4 * YR), '1万年'], [Math.log10(1e6 * YR), '100万年'], [Math.log10(1e8 * YR), '1億年'], [Math.log10(1e10 * YR), '100億年']];
    ctx.font = `11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const [ls, l] of ticks) {
      ctx.strokeStyle = 'rgba(140,170,255,0.18)'; ctx.beginPath(); ctx.moveTo(X(ls), 8); ctx.lineTo(X(ls), h - 26); ctx.stroke();
      ctx.fillStyle = 'rgba(160,180,230,0.85)'; ctx.fillText(l, Math.max(x0 + 8, Math.min(x1 - 12, X(ls))), h - 20);
    }
    // 天体
    ctx.textBaseline = 'bottom';
    const placed = [];
    OBJ.forEach((o) => {
      const ls = Math.log10(o.t);
      const reached = ls <= state.s;
      const x = X(ls);
      let row = 0;
      while (placed.some((p) => p.row === row && Math.abs(p.x - x) < p.wd * 0.5 + 40)) row++;
      const lbl = o.n.replace(/（.*?）/g, '');
      const wd = ctx.measureText(lbl).width;
      placed.push({ x, row, wd });
      const up = row % 2 === 0;
      const lvl = Math.floor(row / 2);
      const ty = up ? yB - 14 - lvl * 15 : yB + 22 + lvl * 15;
      ctx.strokeStyle = reached ? COLORS[o.grp] : 'rgba(160,180,230,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yB); ctx.lineTo(x, up ? ty + 2 : ty - 12); ctx.stroke();
      ctx.fillStyle = reached ? COLORS[o.grp] : 'rgba(160,180,230,0.35)';
      ctx.beginPath(); ctx.arc(x, yB, reached ? 4 : 3, 0, 6.2832); ctx.fill();
      ctx.textBaseline = up ? 'bottom' : 'top';
      ctx.textAlign = x < x0 + 40 ? 'left' : x > x1 - 40 ? 'right' : 'center';
      ctx.fillStyle = reached ? '#e8edff' : 'rgba(160,180,230,0.5)';
      ctx.fillText(lbl, x, ty);
    });
    // 光の先頭
    ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(state.s), 8); ctx.lineTo(X(state.s), h - 26); ctx.stroke();
    const gl = ctx.createRadialGradient(X(state.s), yB, 0, X(state.s), yB, 16);
    gl.addColorStop(0, 'rgba(255,243,196,0.95)'); gl.addColorStop(1, 'rgba(255,243,196,0)');
    ctx.fillStyle = gl; ctx.fillRect(X(state.s) - 16, yB - 16, 32, 32);
  }

  function update() {
    const s = Math.pow(10, state.s);
    $('elapsed').textContent = `光の旅 ${fmtTime(s)}`;
    $('dist').textContent = `進んだ距離: ${fmtDist(s * C)}`;
    const reached = OBJ.filter((o) => o.t <= s);
    const nxt = OBJ.find((o) => o.t > s);
    $('reached').textContent = reached.length ? reached.slice(-6).map((o) => o.n).join(' → ') + (reached.length > 6 ? `（ほか${reached.length - 6}か所を通過）` : '') : 'まだ何にも届いていません。（地球をぐるっと回る前です）';
    $('next').textContent = nxt ? `次に届くのは「${nxt.n}」。あと ${fmtTime(nxt.t - s)}（光で ${fmtTime(nxt.t)} の距離）。${nxt.note ? nxt.note + '。' : ''}` : '宇宙の年齢ぶんの旅をしました。これ以上遠くの光は、まだ地球に届いていません。';
    slider.value = String(Math.round(state.s * 100));
    draw();
  }

  // ---- 表 ----
  function buildTables() {
    const tb = $('tbl').querySelector('tbody');
    tb.innerHTML = OBJ.filter((o) => o.grp !== 'cos').map((o) => {
      const km = o.t * C;
      return `<tr style="cursor:pointer" data-t="${o.t}"><td><span style="color:${COLORS[o.grp]}">●</span> ${o.n}${o.note ? `<br><span class="note">${o.note}</span>` : ''}</td><td class="num">${fmtDist(km).split(' ＝ ').pop()}</td><td class="num">${fmtTime(o.t)}</td><td class="num">${rideTime(km, 17)}</td><td class="num">${rideTime(km, 300 / 3600)}</td></tr>`;
    }).join('');
    tb.querySelectorAll('tr').forEach((tr) => tr.addEventListener('click', () => { stop(); state.s = Math.log10(Number(tr.dataset.t)) + 0.005; update(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));

    const now = new Date().getFullYear();
    $('thisYear').textContent = `${now}年`;
    $('past').querySelector('tbody').innerHTML = OBJ.filter((o) => o.sky).map((o) => {
      const years = o.t / YR;
      return `<tr><td>${o.n}</td><td class="num">${bigNum(years)}光年</td><td class="num">${yearText(now, years)}</td><td>${era(now - years, years)}</td></tr>`;
    }).join('');
  }
  function yearText(now, years) {
    if (years < 10000) { const y = Math.round(now - years); return y > 0 ? `${y}年ごろ` : `紀元前${1 - y}年ごろ`; }
    return `約${bigNum(years)}年前`;
  }
  const JP = [[2019, '令和'], [1989, '平成'], [1926, '昭和'], [1912, '大正'], [1868, '明治'], [1603, '江戸時代'], [1573, '安土桃山時代'], [1336, '室町時代'], [1185, '鎌倉時代'], [794, '平安時代'], [710, '奈良時代'], [593, '飛鳥時代'], [250, '古墳時代'], [-300, '弥生時代']];
  function era(year, years) {
    if (years < 10000) {
      for (const [y, n] of JP) if (year >= y) return `日本は${n}`;
      return year > -10000 ? '日本は縄文時代' : '氷河期';
    }
    if (years < 40000) return '氷河期（旧石器時代）';
    if (years < 3e5) return '氷河期。現生人類（ホモ・サピエンス）が誕生した頃';
    if (years < 2.4e6) return '原人・旧人の時代';
    if (years < 7e6) return 'アウストラロピテクスなど初期の人類の時代';
    if (years < 6.6e7) return '人類が現れるより前（恐竜絶滅後の哺乳類の時代）';
    if (years < 2.5e8) return '恐竜の時代';
    return '恐竜が現れるより前';
  }

  // ---- 操作 ----
  slider.addEventListener('input', () => { stop(); state.s = Number(slider.value) / 100; update(); });
  function stop() { state.playing = false; $('play').setAttribute('aria-pressed', 'false'); $('play').textContent = '▶ 光を走らせる'; }
  $('play').addEventListener('click', () => {
    if (state.playing) { stop(); return; }
    if (state.s >= SMAX - 0.02) state.s = 0;
    state.playing = true; $('play').setAttribute('aria-pressed', 'true'); $('play').textContent = '⏸ 一時停止';
  });
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (state.playing) {
      state.s += dt * (SMAX / 28);
      if (state.s >= SMAX) { state.s = SMAX; stop(); }
      update();
    }
    requestAnimationFrame(loop);
  }
  for (const o of OBJ.filter((x) => x.jump)) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = o.jumpName || o.n;
    b.addEventListener('click', () => { stop(); state.s = Math.log10(o.t) + 0.005; update(); });
    $('jumps').appendChild(b);
  }
  window.addEventListener('resize', draw);
  buildTables();
  const q = Number(new URLSearchParams(location.search).get('s'));
  if (q > 0 && q <= SMAX) state.s = q;
  update();
  requestAnimationFrame(loop);
  window.__scale = { state, OBJ };
})();
