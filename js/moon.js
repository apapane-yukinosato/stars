/* 月の満ち欠けカレンダー */
(function () {
  'use strict';
  const A = window.Astro;
  const $ = (id) => document.getElementById(id);
  const JST = 9 * 3600000, DAY = 86400000;
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (ms) => (ms == null ? '—' : (() => { const d = new Date(ms + JST); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; })());
  const PHASE_NAME = ['新月', '上弦', '満月', '下弦'];
  const state = { y: 2026, m: 0, sel: 1, lat: 35.6895, lon: 139.6917 };

  /** 月の形を描く（北半球から南の空を見た向き: 満ちていくとき右側が明るい） */
  function drawMoon(canvas, phase, size) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = size / 2 - 1.5;
    ctx.translate(size / 2, size / 2);
    if (phase >= 180) ctx.scale(-1, 1);
    const c = Math.cos(phase * Math.PI / 180);
    ctx.fillStyle = '#262c40';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#f4f1e0';
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    for (let i = 0; i <= 28; i++) {
      const t = Math.PI / 2 - (i / 28) * Math.PI;
      ctx.lineTo(c * r * Math.cos(t), r * Math.sin(t));
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.stroke();
  }

  const NAMES = { 1: '朔（新月）', 2: '既朔', 3: '三日月', 7: '七日月（上弦ごろ）', 10: '十日夜', 13: '十三夜', 14: '小望月', 15: '十五夜（満月ごろ）', 16: '十六夜（いざよい）', 17: '立待月', 18: '居待月', 19: '寝待月', 20: '更待月', 23: '二十三夜（下弦ごろ）', 26: '有明月', 30: '三十日月' };
  function dayName(age) { const d = Math.floor(age) + 1; return NAMES[d] || `${d}日月`; }

  function seeText(info) {
    const a = info.age;
    if (a < 1.2 || a > 28.3) return 'ほとんど見えません（新月の頃）。天の川や星を見るのに最適な夜です。';
    if (info.waxing) {
      if (a < 6) return '夕方、日没後の西の空に低く見えます。月は早い時間に沈みます。';
      if (a < 9) return '夕方に南の空高くに見え、真夜中ごろ西に沈みます。';
      if (a < 13.5) return '夕方から夜遅くまで見えます。夜半すぎに西へ沈みます。';
      return '日没のころ東から昇り、一晩中見えます。';
    }
    if (a < 16.5) return '日没後しばらくして東から昇ります。ほぼ一晩中見えます。';
    if (a < 21) return '夜遅くに東から昇り、明け方まで見えます。';
    if (a < 25) return '真夜中に昇り、明け方に南の空高くに見えます。';
    return '明け方、日の出前の東の空に細く見えます。';
  }

  let events = [];
  function render() {
    const { y, m } = state;
    const first = new Date(Date.UTC(y, m, 1));
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const startMs = Date.UTC(y, m, 1) - JST, endMs = Date.UTC(y, m + 1, 1) - JST;
    events = A.findPhases(startMs, endMs);
    $('title').textContent = `${y}年${m + 1}月`;
    $('y').value = String(y); $('m').value = String(m);
    const now = Date.now(), nd = new Date(now + JST);
    const isNowMonth = nd.getUTCFullYear() === y && nd.getUTCMonth() === m;
    const cells = $('cells');
    cells.textContent = '';
    for (let k = 0; k < first.getUTCDay(); k++) { const e = document.createElement('div'); e.className = 'cell empty'; cells.appendChild(e); }
    for (let d = 1; d <= dim; d++) {
      const dayStart = Date.UTC(y, m, d) - JST;
      const info = A.moonInfo(dayStart + 21 * 3600000);
      const rs = A.moonRiseSet(dayStart, state.lat, state.lon);
      const ev = events.filter((e) => e.ms >= dayStart && e.ms < dayStart + DAY);
      const wd = (first.getUTCDay() + d - 1) % 7;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell' + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '') + (isNowMonth && nd.getUTCDate() === d ? ' today' : '') + (state.sel === d ? ' sel' : '');
      b.dataset.d = String(d);
      b.setAttribute('aria-label', `${m + 1}月${d}日 月齢${info.age.toFixed(1)}`);
      b.innerHTML = `<span class="d">${d}</span><canvas></canvas><span class="age">月齢${info.age.toFixed(1)}</span><span class="rs">出${hm(rs.rise)}</span><span class="rs">入${hm(rs.set)}</span>` +
        ev.map((e) => `<span class="ev">${PHASE_NAME[e.q]} ${hm(e.ms)}</span>`).join('');
      cells.appendChild(b);
      drawMoon(b.querySelector('canvas'), info.phase, 36);
      b._info = { info, rs, dayStart };
      b.addEventListener('click', () => { state.sel = d; render(); });
    }
    $('phases').innerHTML = events.map((e) => {
      const d = new Date(e.ms + JST);
      return `<li style="grid-template-columns:5em 1fr"><b style="color:var(--accent)">${PHASE_NAME[e.q]}</b><span>${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${hm(e.ms)}</span></li>`;
    }).join('');
    renderDetail();
  }

  function renderDetail() {
    const b = $('cells').querySelector(`.cell[data-d="${state.sel}"]`);
    const box = $('detail');
    if (!b || !b._info) { box.innerHTML = ''; return; }
    const { info, rs } = b._info;
    box.innerHTML = `<h2>${state.m + 1}月${state.sel}日（21:00の月）</h2>
      <div class="detail-top"><canvas id="big"></canvas><div><h3>${dayName(info.age)}</h3><span class="muted">月齢 ${info.age.toFixed(1)} ／ 輝面比 ${Math.round(info.illum * 100)}%</span></div></div>
      <p class="note" style="margin:10px 0 0">${seeText(info)}</p>
      <dl class="kv2"><dt>月の出</dt><dd>${hm(rs.rise)}</dd><dt>月の入り</dt><dd>${hm(rs.set)}</dd><dt>満ち欠け</dt><dd>${info.age < 1 || info.age > 28.5 ? '新月の頃' : info.waxing ? '満ちていく（月が太っていく）' : '欠けていく（月が痩せていく）'}</dd></dl>`;
    drawMoon($('big'), info.phase, 84);
  }

  // ---- 操作 ----
  for (let y = 1950; y <= 2100; y++) { const o = document.createElement('option'); o.value = y; o.textContent = y + '年'; $('y').appendChild(o); }
  for (let m = 0; m < 12; m++) { const o = document.createElement('option'); o.value = m; o.textContent = (m + 1) + '月'; $('m').appendChild(o); }
  function go(dm) { let t = state.y * 12 + state.m + dm; state.y = Math.floor(t / 12); state.m = t % 12; state.sel = 1; render(); }
  $('prev').addEventListener('click', () => go(-1));
  $('next').addEventListener('click', () => go(1));
  $('y').addEventListener('change', (e) => { state.y = Number(e.target.value); state.sel = 1; render(); });
  $('m').addEventListener('change', (e) => { state.m = Number(e.target.value); state.sel = 1; render(); });
  $('place').addEventListener('change', (e) => { const [la, lo] = e.target.value.split(',').map(Number); state.lat = la; state.lon = lo; render(); });
  function goNow() { const d = new Date(Date.now() + JST); state.y = d.getUTCFullYear(); state.m = d.getUTCMonth(); state.sel = d.getUTCDate(); render(); }
  $('now').addEventListener('click', goNow);

  const q = new URLSearchParams(location.search).get('ym');
  if (q && /^\d{4}-\d{1,2}$/.test(q)) { const [y, m] = q.split('-').map(Number); state.y = y; state.m = m - 1; state.sel = 1; render(); } else goNow();
  window.__moon = { state, render };
})();
