/* 流星群カレンダー */
(function () {
  'use strict';
  const A = window.Astro;
  const D = Math.PI / 180;
  const $ = (id) => document.getElementById(id);
  const JST = 9 * 3600000;
  const pad = (n) => String(n).padStart(2, '0');
  const FONT = 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif';
  const state = { y: new Date().getFullYear(), lat: 35.6895, lon: 139.6917 };

  // night: 極大の夜が「始まる」日（その日の夜〜翌朝）。peak: 表示用の日付
  const SHOWERS = [
    { id: 'qua', ja: 'しぶんぎ座流星群', en: 'Quadrantids', big3: true, night: [1, 3], peak: '1月4日未明', zhr: 110, ra: 230, dec: 49, rad: 'りゅう座・うしかい座の境界付近', parent: '小惑星 2003 EH1', v: 41, tip: '極大の時間が数時間と短く、年による当たり外れが大きい流星群です。真冬の明け方、放射点が高くなってからが狙い目です。' },
    { id: 'lyr', ja: 'こと座流星群', en: 'Lyrids', night: [4, 21], peak: '4月22日未明', zhr: 18, ra: 271, dec: 34, rad: 'こと座', parent: 'サッチャー彗星', v: 49, tip: '春の流星群です。放射点は夜半すぎに高くなります。まれに突発的に数が増えることがあります。' },
    { id: 'eta', ja: 'みずがめ座η流星群', en: 'η-Aquariids', night: [5, 5], peak: '5月6日明け方', zhr: 50, ra: 338, dec: -1, rad: 'みずがめ座', parent: 'ハレー彗星', v: 66, tip: 'ハレー彗星由来の流星群です。放射点が低いため、日本では夜明け前の短い時間が見ごろで、数は少なめです。' },
    { id: 'per', ja: 'ペルセウス座流星群', en: 'Perseids', big3: true, night: [8, 12], peak: '8月13日未明', zhr: 100, ra: 48, dec: 58, rad: 'ペルセウス座', parent: 'スイフト・タットル彗星', v: 59, tip: '三大流星群の一つ。夏休みの時期で観察しやすく、明るい流星や火球が多いのが特徴です。夜半から明け方が見ごろです。' },
    { id: 'dra', ja: 'ジャコビニ流星群（10月りゅう座流星群）', short: 'ジャコビニ', en: 'Draconids', night: [10, 8], peak: '10月8日の宵', zhr: 10, ra: 262, dec: 54, rad: 'りゅう座', parent: 'ジャコビニ・ツィンナー彗星', v: 20, tip: 'ふだんは少ないものの、年によって突発的に多く出現します。放射点は宵の早い時間から高く、遅い流星が多めです。' },
    { id: 'ori', ja: 'オリオン座流星群', en: 'Orionids', night: [10, 20], peak: '10月21日未明', zhr: 20, ra: 95, dec: 16, rad: 'オリオン座', parent: 'ハレー彗星', v: 66, tip: 'ハレー彗星由来で、速い流星が多い流星群です。夜半すぎからオリオン座が昇ってくるころが見ごろです。' },
    { id: 'stau', ja: 'おうし座南流星群', en: 'S. Taurids', night: [11, 4], peak: '11月5日ごろ', zhr: 5, ra: 52, dec: 13, rad: 'おうし座', parent: 'エンケ彗星', v: 27, tip: '数は少ないですが、明るい火球が多いことで知られます。長い期間にゆっくり出現します。' },
    { id: 'ntau', ja: 'おうし座北流星群', en: 'N. Taurids', night: [11, 11], peak: '11月12日ごろ', zhr: 5, ra: 58, dec: 22, rad: 'おうし座', parent: 'エンケ彗星', v: 29, tip: '南流星群とあわせて、秋の長い期間に火球が見られることがあります。' },
    { id: 'leo', ja: 'しし座流星群', en: 'Leonids', night: [11, 17], peak: '11月18日未明', zhr: 15, ra: 152, dec: 22, rad: 'しし座', parent: 'テンペル・タットル彗星', v: 71, tip: '約33年ごとに大出現することがあります（最近は2001年）。ふだんの年は少なめですが、非常に速い流星が特徴です。' },
    { id: 'gem', ja: 'ふたご座流星群', en: 'Geminids', big3: true, night: [12, 13], peak: '12月14日未明', zhr: 150, ra: 112, dec: 33, rad: 'ふたご座', parent: '小惑星 ファエトン', v: 35, tip: '三大流星群の一つで、年間で最も流星の数が多い流星群です。夜の早い時間から見え始め、一晩中楽しめます。寒さ対策を。' },
    { id: 'urs', ja: 'こぐま座流星群', en: 'Ursids', night: [12, 21], peak: '12月22日ごろ', zhr: 10, ra: 217, dec: 76, rad: 'こぐま座', parent: 'タットル彗星', v: 33, tip: '年末の静かな流星群です。数は少なく、一晩中放射点が地平線の上にあります。' },
  ];

  function drawMoon(canvas, phase, size) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = size / 2 - 1.5;
    ctx.translate(size / 2, size / 2);
    if (phase >= 180) ctx.scale(-1, 1);
    const c = Math.cos(phase * D);
    ctx.fillStyle = '#262c40'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#f4f1e0'; ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    for (let i = 0; i <= 28; i++) { const t = Math.PI / 2 - (i / 28) * Math.PI; ctx.lineTo(c * r * Math.cos(t), r * Math.sin(t)); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.stroke();
  }

  const hm = (ms) => { const d = new Date(ms + JST); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };

  /** 極大の夜（21時〜翌4時）の評価 */
  function evaluate(sh, year) {
    const t0 = Date.UTC(year, sh.night[0] - 1, sh.night[1], 21) - JST;
    const samples = [];
    for (let k = 0; k <= 14; k++) {
      const ms = t0 + k * 30 * 60000;
      const fr = A.makeFrame(ms, state.lat, state.lon);
      const c = Math.cos(sh.dec * D);
      const v = [c * Math.cos(sh.ra * D), c * Math.sin(sh.ra * D), Math.sin(sh.dec * D)];
      const alt = Math.asin(A.applyMat(fr.HP, v, [0, 0, 0])[2]) / D;
      const sunAlt = A.sunAltitude(ms, state.lat, state.lon);
      samples.push({ ms, ralt: alt, malt: A.moonAltitude(ms, state.lat, state.lon), sun: sunAlt });
    }
    const dark = samples.filter((s) => s.sun < -12);
    const mid = A.moonInfo(t0 + 4 * 3600000);
    // 月明かり: 暗い時間帯の平均（月が出ている間だけ輝面比を加算）
    const moonScore = dark.length ? dark.reduce((a, s) => a + (s.malt > 0 ? mid.illum : 0), 0) / dark.length : 1;
    const best = dark.reduce((b, s) => (s.ralt > (b ? b.ralt : -90) ? s : b), null);
    const maxAlt = best ? best.ralt : -90;
    // 月の出入り（観察時間中）
    let moonEv = '';
    for (let k = 1; k < samples.length; k++) {
      const a = samples[k - 1], b = samples[k];
      if ((a.malt > 0) !== (b.malt > 0)) {
        const f = a.malt / (a.malt - b.malt);
        const t = a.ms + f * (b.ms - a.ms);
        moonEv += `${b.malt > 0 ? '月の出' : '月の入り'} ${hm(t)}　`;
      }
    }
    if (!moonEv) moonEv = samples.every((s) => s.malt > 0) ? '一晩中月が出ています' : '月は出ていません';
    const sinAlt = Math.max(0, Math.sin(maxAlt * D));
    const score = sh.zhr * sinAlt * (1 - 0.85 * moonScore);
    const stars = score > 60 ? 5 : score > 30 ? 4 : score > 14 ? 3 : score > 6 ? 2 : 1;
    const moonLevel = moonScore < 0.12 ? 'good' : moonScore < 0.4 ? 'mid' : 'bad';
    return { t0, mid, moonScore, moonLevel, maxAlt, bestMs: best ? best.ms : null, moonEv, score, stars, samples };
  }

  function render() {
    const y = state.y;
    $('title').textContent = `${y}年の流星群`;
    $('y').value = String(y);
    const list = SHOWERS.map((sh) => ({ sh, ev: evaluate(sh, y) }));
    const nowMs = Date.now();
    const nextIdx = list.findIndex((x) => x.ev.t0 + 12 * 3600000 > nowMs);
    const isThisYear = y === new Date().getFullYear();
    $('next').textContent = isThisYear && nextIdx >= 0
      ? `次は ${list[nextIdx].sh.ja}（${list[nextIdx].sh.peak}）。見やすさの目安は ${'★'.repeat(list[nextIdx].ev.stars)}${'☆'.repeat(5 - list[nextIdx].ev.stars)} です。`
      : '各流星群の「極大の夜」の見やすさの目安です。';
    const box = $('cards');
    box.textContent = '';
    list.forEach(({ sh, ev }, i) => {
      const el = document.createElement('article');
      el.className = 'mc' + (isThisYear && i === nextIdx ? ' next' : '');
      const tagCls = { good: 'good', mid: 'mid', bad: 'bad' }[ev.moonLevel];
      const tagTxt = { good: '月明かりの影響 小', mid: '月明かりあり', bad: '月明かり強い' }[ev.moonLevel];
      const alt = ev.maxAlt > 0 && ev.bestMs ? `${hm(ev.bestMs)}ごろ（高度${ev.maxAlt.toFixed(0)}°）` : '夜の暗い時間は地平線の下';
      el.innerHTML = `<h3>${sh.ja}${sh.big3 ? ' <span class="tag mid">三大流星群</span>' : ''}</h3>
        <div><span class="date">${sh.peak}</span> <span class="stars" aria-label="見やすさ 5段階中${ev.stars}">${'★'.repeat(ev.stars)}${'☆'.repeat(5 - ev.stars)}</span></div>
        <div class="moonrow"><canvas></canvas><p><span class="tag ${tagCls}">${tagTxt}</span><br>月齢${ev.mid.age.toFixed(1)}・輝面比${Math.round(ev.mid.illum * 100)}%　${ev.moonEv}</p></div>
        <dl>
          <dt>流星の数</dt><dd>ZHR ${sh.zhr}${sh.id === 'dra' ? '（年により大きく変動）' : ''}</dd>
          <dt>放射点</dt><dd>${sh.rad}（赤経${(sh.ra / 15).toFixed(1)}h 赤緯${sh.dec > 0 ? '+' : ''}${sh.dec}°）</dd>
          <dt>放射点が最も高い</dt><dd>${alt}</dd>
          <dt>母天体 / 速度</dt><dd>${sh.parent} ／ 秒速${sh.v}km</dd>
        </dl>
        <p class="tip">${sh.tip}</p>`;
      box.appendChild(el);
      drawMoon(el.querySelector('canvas'), ev.mid.phase, 38);
    });
    drawYear(list);
  }

  // ---- 年間チャート ----
  function drawYear(list) {
    const cv = $('cvYear');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#060b1c'; ctx.fillRect(0, 0, w, h);
    const x0 = 14, x1 = w - 14, yBase = h - 28;
    const y0 = Date.UTC(state.y, 0, 1), span = Date.UTC(state.y + 1, 0, 1) - y0;
    const X = (ms) => x0 + ((ms - y0) / span) * (x1 - x0);
    ctx.font = `11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let m = 0; m < 12; m++) {
      const x = X(Date.UTC(state.y, m, 1));
      ctx.strokeStyle = 'rgba(140,170,255,0.14)'; ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, yBase); ctx.stroke();
      ctx.fillStyle = 'rgba(160,180,230,0.85)'; ctx.fillText(`${m + 1}月`, x + (X(Date.UTC(state.y, m + 1, 1)) - x) / 2, yBase + 6);
    }
    ctx.strokeStyle = 'rgba(160,180,230,0.5)'; ctx.beginPath(); ctx.moveTo(x0, yBase); ctx.lineTo(x1, yBase); ctx.stroke();
    const colors = { good: '#7ee2a1', mid: '#f6d27a', bad: '#ff9c8a' };
    const items = list.map(({ sh, ev }) => ({ sh, ev, x: X(Date.UTC(state.y, sh.night[0] - 1, sh.night[1] + 1)), r: 5 + Math.sqrt(sh.zhr) * 1.7 }));
    const rowsUsed = [];
    for (const it of items) {
      // ラベルが重ならないよう上下にずらす
      let row = 0;
      while (rowsUsed.some((u) => u.row === row && Math.abs(u.x - it.x) < 78)) row++;
      it.row = row; rowsUsed.push(it);
      const cy = yBase - it.r - 4 - (row % 2) * 0;
      ctx.fillStyle = colors[it.ev.moonLevel]; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(it.x, cy, it.r, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8edff'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const short = it.sh.short || it.sh.ja.replace('流星群', '');
      ctx.fillText(short, Math.max(28, Math.min(w - 28, it.x)), cy - it.r - 3 - row * 14);
    }
    // 今日
    const now = Date.now();
    if (now >= y0 && now < y0 + span) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(X(now), 6); ctx.lineTo(X(now), yBase); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // ---- 操作 ----
  for (let y = 1950; y <= 2100; y++) { const o = document.createElement('option'); o.value = y; o.textContent = y + '年'; $('y').appendChild(o); }
  const set = (y) => { state.y = Math.max(1950, Math.min(2100, y)); render(); };
  $('prev').addEventListener('click', () => set(state.y - 1));
  $('nextY').addEventListener('click', () => set(state.y + 1));
  $('thisY').addEventListener('click', () => set(new Date().getFullYear()));
  $('y').addEventListener('change', (e) => set(Number(e.target.value)));
  $('place').addEventListener('change', (e) => { const [la, lo] = e.target.value.split(',').map(Number); state.lat = la; state.lon = lo; render(); });
  window.addEventListener('resize', () => render());
  const q = Number(new URLSearchParams(location.search).get('y'));
  if (q >= 1950 && q <= 2100) state.y = q;
  render();
  window.__meteor = { state, evaluate, SHOWERS };
})();
