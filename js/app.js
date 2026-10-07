/* 星空シミュレーター: 描画とUI */
(function () {
  'use strict';
  const A = window.Astro;
  const DATA = window.SKY_DATA;
  const D2R = A.D2R, R2D = A.R2D;
  const HALF_PI = Math.PI / 2;
  const JST = 9 * 3600000;
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const APP_VERSION = '08c'; // 画面で確認できる版番号（古い版が残っていないかの確認用）
  const MOBILE_Q = '(max-width: 800px), (max-height: 520px)';
  const FONT = 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif';

  const PLACES = [
    ['wakkanai', '稚内', 45.4155, 141.673],
    ['sapporo', '札幌', 43.0621, 141.3544],
    ['sendai', '仙台', 38.2682, 140.8694],
    ['nagano', '長野', 36.6513, 138.181],
    ['tokyo', '東京', 35.6895, 139.6917],
    ['nagoya', '名古屋', 35.1815, 136.9066],
    ['osaka', '大阪', 34.6937, 135.5023],
    ['hiroshima', '広島', 34.3853, 132.4553],
    ['fukuoka', '福岡', 33.5902, 130.4017],
    ['kagoshima', '鹿児島', 31.5966, 130.5571],
    ['ogasawara', '小笠原（父島）', 27.094, 142.1917],
    ['naha', '那覇', 26.2124, 127.6809],
    ['ishigaki', '石垣島', 24.3448, 124.1572],
  ];
  const BORTLE = { city: { lim: 3.3, mw: 0 }, sub: { lim: 4.9, mw: 0.5 }, dark: { lim: 6.0, mw: 1 } };
  const OPT_KEYS = ['lines', 'conNames', 'starNames', 'milky', 'bodies', 'ecl', 'altaz', 'equ', 'realSky'];

  // ---------- 状態 ----------
  const state = {
    t: Date.now(), live: true, playing: true, speed: 600,
    lat: 35.6895, lon: 139.6917, place: 'tokyo',
    mode: 'dome', az0: 180, alt0: 35, fov: 100,
    bortle: 'sub', sel: null,
    opts: { lines: true, conNames: true, starNames: true, milky: true, bodies: true, ecl: true, altaz: false, equ: false, realSky: false },
  };
  let tween = null;

  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem('stars.prefs.v1') || 'null');
      if (!p) return;
      if (typeof p.lat === 'number' && typeof p.lon === 'number') {
        state.lat = clamp(p.lat, -90, 90); state.lon = clamp(p.lon, -180, 180);
        state.place = String(p.place || 'custom');
      }
      if (BORTLE[p.bortle]) state.bortle = p.bortle;
      if (p.opts) for (const k of OPT_KEYS) if (typeof p.opts[k] === 'boolean') state.opts[k] = p.opts[k];
      if (p.mode === 'view' || p.mode === 'dome') state.mode = p.mode;
    } catch (e) { /* 保存不可の環境では既定値で動く */ }
  }
  function savePrefs() {
    try {
      localStorage.setItem('stars.prefs.v1', JSON.stringify({
        lat: state.lat, lon: state.lon, place: state.place, bortle: state.bortle, opts: state.opts, mode: state.mode,
      }));
    } catch (e) { /* 無視 */ }
  }

  // ---------- データ準備 ----------
  const NS = DATA.stars.length;
  const starVec = new Float32Array(NS * 3);
  const starMag = new Float32Array(NS);
  const starCol = new Array(NS);
  function bvToRGB(bv) {
    // B-V → 色温度 → RGB（実際より白寄りに混ぜて見やすくする）
    const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
    const t = clamp(T, 1500, 40000) / 100;
    let r, g, b;
    r = t <= 66 ? 255 : clamp(329.7 * Math.pow(t - 60, -0.1332), 0, 255);
    g = t <= 66 ? clamp(99.47 * Math.log(t) - 161.12, 0, 255) : clamp(288.12 * Math.pow(t - 60, -0.0755), 0, 255);
    b = t >= 66 ? 255 : t <= 19 ? 0 : clamp(138.52 * Math.log(t - 10) - 305.04, 0, 255);
    const w = 0.55;
    return `rgb(${Math.round(lerp(r, 255, w))},${Math.round(lerp(g, 255, w))},${Math.round(lerp(b, 255, w))})`;
  }
  DATA.stars.forEach((s, i) => {
    const v = A.raDecToVec(s[0], s[1]);
    starVec[i * 3] = v[0]; starVec[i * 3 + 1] = v[1]; starVec[i * 3 + 2] = v[2];
    starMag[i] = s[2];
    starCol[i] = bvToRGB(s[3]);
  });
  const starNames = DATA.names.map(([idx, ja, en]) => ({ idx, ja, en, mag: starMag[idx] }));

  const CONS = DATA.constellations.map((c) => {
    const segs = c.l.map((s) => s.map((p) => A.raDecToVec(p[0], p[1])));
    const all = [];
    const seen = new Set();
    for (const s of segs) for (const v of s) {
      const k = v.map((x) => x.toFixed(4)).join();
      if (!seen.has(k)) { seen.add(k); all.push(v); }
    }
    const sum = [0, 0, 0];
    for (const v of all) { sum[0] += v[0]; sum[1] += v[1]; sum[2] += v[2]; }
    const n = Math.hypot(sum[0], sum[1], sum[2]) || 1;
    return { id: c.id, ja: c.ja, en: c.en, segs, all, cen: [sum[0] / n, sum[1] / n, sum[2] / n] };
  });

  const MW = DATA.milkyway.map((b) => ({ v: A.raDecToVec(b[0], b[1]), lv: b[2] }));

  // 目盛り（赤道座標・観測日の分点基準）
  function gridCircle(f) { const a = []; for (let i = 0; i <= 72; i++) a.push(f(i * 5)); return a; }
  const GRID_EQU = [];
  for (const dec of [-60, -30, 30, 60]) GRID_EQU.push({ pts: gridCircle((a) => A.raDecToVec(a, dec)), main: false });
  GRID_EQU.push({ pts: gridCircle((a) => A.raDecToVec(a, 0)), main: true });
  for (let ra = 0; ra < 360; ra += 30) {
    const pts = []; for (let d = -85; d <= 85; d += 5) pts.push(A.raDecToVec(ra, d));
    GRID_EQU.push({ pts, main: false });
  }
  const EPS = 23.4393 * D2R;
  const ECLIPTIC = gridCircle((l) => {
    const x = Math.cos(l * D2R), y = Math.sin(l * D2R);
    return [x, y * Math.cos(EPS), y * Math.sin(EPS)];
  });
  const GRID_ALT = [];
  for (const alt of [30, 60]) GRID_ALT.push(gridCircle((az) => [Math.cos(alt * D2R) * Math.sin(az * D2R), Math.cos(alt * D2R) * Math.cos(az * D2R), Math.sin(alt * D2R)]));
  for (let az = 0; az < 360; az += 30) {
    const pts = []; for (let alt = 0; alt <= 90; alt += 5) pts.push([Math.cos(alt * D2R) * Math.sin(az * D2R), Math.cos(alt * D2R) * Math.cos(az * D2R), Math.sin(alt * D2R)]);
    GRID_ALT.push(pts);
  }

  // ---------- スプライト ----------
  function makeSprite(size, stops) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return c;
  }
  const GLOW = makeSprite(64, [[0, 'rgba(255,255,255,0.9)'], [0.25, 'rgba(255,255,255,0.28)'], [1, 'rgba(255,255,255,0)']]);
  const MWSPR = makeSprite(64, [[0, 'rgba(200,214,255,0.95)'], [0.5, 'rgba(180,200,255,0.4)'], [1, 'rgba(170,190,255,0)']]);

  // ---------- キャンバス ----------
  const canvas = $('sky');
  const ctx = canvas.getContext('2d');
  // ---------- 画面の回転（OS が画面を回さないとき用） ----------
  // 画面の回転ロックがオンだと、スマホを横向きにしても OS は画面を縦向きのままにする。
  // 向きセンサー中は、スマホの持ち方から横向きと判断して、アプリ側で画面全体を回転させる。
  let appRot = 0; // アプリが追加で回している角度（0 / 90 / 180 / 270, 時計回り）
  const norm360 = (a) => ((a % 360) + 360) % 360;
  function osAngle() { return norm360(window.StarSensor ? window.StarSensor.screenAngle() : 0); }
  /** 画面上の座標(clientX,Y) → 回転前のレイアウト座標 */
  function toLocal(X, Y) {
    const W = window.innerWidth, H = window.innerHeight;
    if (appRot === 90) return [Y, W - X];
    if (appRot === 270) return [H - Y, X];
    if (appRot === 180) return [W - X, H - Y];
    return [X, Y];
  }
  function toLocalDelta(dx, dy) {
    if (appRot === 90) return [dy, -dx];
    if (appRot === 270) return [-dy, dx];
    if (appRot === 180) return [-dx, -dy];
    return [dx, dy];
  }
  function applyRotation(rot) {
    appRot = rot;
    const b = document.body, W = window.innerWidth, H = window.innerHeight;
    if (!rot) {
      b.classList.remove('app-rotated', 'landscape-ui');
      ['position', 'left', 'top', 'width', 'height', 'overflow', 'transformOrigin', 'transform'].forEach((k) => { b.style[k] = ''; });
    } else {
      const swap = rot === 90 || rot === 270;
      b.classList.add('app-rotated'); b.classList.toggle('landscape-ui', swap);
      b.style.position = 'fixed'; b.style.left = '0'; b.style.top = '0'; b.style.overflow = 'hidden';
      b.style.width = (swap ? H : W) + 'px'; b.style.height = (swap ? W : H) + 'px';
      b.style.transformOrigin = '0 0';
      b.style.transform = rot === 90 ? `translate(${W}px, 0) rotate(90deg)` : rot === 270 ? `translate(0, ${H}px) rotate(-90deg)` : `translate(${W}px, ${H}px) rotate(180deg)`;
    }
    syncSize(); updateOverlap(); dirty = true;
  }
  /** 持ち方(物理)と OS の画面の向きの差から、アプリが回す角度を決める */
  function updateRotation() {
    if (!sensorOn || !sensor || sensor.physAngle === null || sensor.physAngle === undefined) { if (appRot) applyRotation(0); return; }
    const rot = norm360(sensor.physAngle - osAngle());
    if (rot !== appRot) applyRotation(rot);
  }

  let cw = 0, ch = 0, dpr = 1, bufSx = 1, bufSy = 1;
  // 描画先の大きさは、実際に画面に表示されている領域（CSS上の寸法）をそのまま使う。
  // 内部の画素数は縦横を別々の倍率で対応づけるので、回転直後などに寸法が少しずれても星は引き伸ばされない。
  function measure() {
    // 画面全体を回転させている間も正しい寸法になるよう、変形の影響を受けない offsetWidth/Height を使う
    return { w: Math.max(1, canvas.offsetWidth), h: Math.max(1, canvas.offsetHeight), d: Math.min(window.devicePixelRatio || 1, 2) };
  }
  function resize() {
    const m = measure();
    dpr = m.d; cw = m.w; ch = m.h;
    canvas.width = Math.max(1, Math.round(cw * dpr)); canvas.height = Math.max(1, Math.round(ch * dpr));
    bufSx = canvas.width / cw; bufSy = canvas.height / ch;
    dirty = true;
  }
  // 表示領域・内部画素数・画面密度のどれかが変わったら取り直す（毎フレーム呼ぶ。回転直後の古い値が残らないように）
  function syncSize() {
    const m = measure();
    if (Math.abs(m.w - cw) > 0.5 || Math.abs(m.h - ch) > 0.5 || m.d !== dpr ||
        canvas.width !== Math.max(1, Math.round(m.w * m.d)) || canvas.height !== Math.max(1, Math.round(m.h * m.d))) {
      resize();
      updateOverlap();
    }
  }

  // ---------- 投影 ----------
  const P = { dome: true, cx: 0, cy: 0, R: 1, scale: 1, f: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] };
  let px = 0, py = 0, pk = 1; // 直前に投影した点の画面座標と「1ラジアンあたりのpx」
  let panelOverlap = 0;
  let sensorBasis = null, sensorOn = false; // スマホの向きセンサー

  function setupProjection() {
    P.dome = state.mode === 'dome';
    const usableW = cw - panelOverlap;
    P.cx = usableW / 2;
    P.cy = ch / 2 + (P.dome ? 8 : 0);
    if (P.dome) {
      P.R = Math.max(80, Math.min(usableW - 56, ch - 72) / 2);
    } else {
      if (sensorBasis && sensorOn) {
        P.f = sensorBasis.f; P.r = sensorBasis.r; P.u = sensorBasis.u;
      } else {
        const a = state.az0 * D2R, h = state.alt0 * D2R;
        P.f = [Math.cos(h) * Math.sin(a), Math.cos(h) * Math.cos(a), Math.sin(h)];
        P.r = [Math.cos(a), -Math.sin(a), 0];
        P.u = [-Math.sin(h) * Math.sin(a), -Math.sin(h) * Math.cos(a), Math.cos(h)];
      }
      P.scale = Math.max(usableW, ch) / 2 / (2 * Math.tan((state.fov * D2R) / 4));
    }
  }

  function project(v) {
    if (P.dome) {
      const h = Math.hypot(v[0], v[1]);
      const z = Math.acos(clamp(v[2], -1, 1));
      const rr = (P.R * z) / HALF_PI;
      pk = P.R / HALF_PI;
      if (h < 1e-9) { px = P.cx; py = P.cy; return true; }
      px = P.cx - (rr * v[0]) / h;
      py = P.cy - (rr * v[1]) / h;
      return true;
    }
    const pf = v[0] * P.f[0] + v[1] * P.f[1] + v[2] * P.f[2];
    if (pf < -0.9) return false;
    const k = 2 / (1 + pf);
    px = P.cx + P.scale * k * (v[0] * P.r[0] + v[1] * P.r[1]);
    py = P.cy - P.scale * k * (v[0] * P.u[0] + v[1] * P.u[1] + v[2] * P.u[2]);
    pk = P.scale * k;
    return true;
  }

  // 大円に沿って滑らかに結ぶ（地平座標ベクトル列）
  function strokeHor(pts) {
    let down = false, prev = null;
    for (const p of pts) {
      if (prev) {
        const dot = clamp(prev[0] * p[0] + prev[1] * p[1] + prev[2] * p[2], -1, 1);
        const ang = Math.acos(dot);
        const n = Math.max(1, Math.ceil(ang / 0.06));
        const s = Math.sin(ang);
        for (let i = 1; i <= n; i++) {
          let q;
          if (n === 1 || s < 1e-6) q = p;
          else {
            const t = i / n, a = Math.sin((1 - t) * ang) / s, b = Math.sin(t * ang) / s;
            q = [a * prev[0] + b * p[0], a * prev[1] + b * p[1], a * prev[2] + b * p[2]];
          }
          down = plot(q, down);
        }
      } else {
        down = plot(p, false);
      }
      prev = p;
    }
  }
  function plot(q, down) {
    if (!project(q)) return false;
    if (down) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    return true;
  }

  // ---------- 色 ----------
  function skyRGB(sunAlt) {
    const stops = [[-18, [4, 7, 17]], [-12, [11, 22, 52]], [-6, [36, 62, 112]], [0, [92, 140, 205]], [8, [118, 170, 225]]];
    if (sunAlt <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (sunAlt <= stops[i][0]) {
        const t = (sunAlt - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        return stops[i - 1][1].map((c, k) => lerp(c, stops[i][1][k], t));
      }
    }
    return stops[stops.length - 1][1];
  }
  const rgb = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a === undefined ? 1 : a})`;

  // ---------- 描画 ----------
  let frame = null, bodies = [], sunAlt = -30, dirty = true, lastRender = 0;
  const pickables = [];
  const tmp = [0, 0, 0];
  const dirNames = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  const dirName = (az) => dirNames[Math.round(az / 45) % 8];
  const fmtAltAz = (hv) => { const o = A.horToAzAlt(hv); return { az: o.az, alt: o.alt, txt: `${dirName(o.az)} ${o.az.toFixed(0)}° ／ 高度 ${o.alt.toFixed(0)}°` }; };

  function limitMag() {
    const base = BORTLE[state.bortle].lim;
    if (!state.opts.realSky) return base;
    const dark = clamp(-sunAlt / 18, 0, 1);
    return lerp(-2, base, Math.pow(dark, 0.7));
  }

  function render() {
    const W = cw, H = ch;
    ctx.setTransform(bufSx, 0, 0, bufSy, 0, 0);
    frame = A.makeFrame(state.t, state.lat, state.lon);
    bodies = A.solarSystem(frame);
    sunAlt = Math.asin(bodies[0].hor[2]) * R2D;
    setupProjection();
    pickables.length = 0;

    const real = state.opts.realSky;
    const skyC = real ? skyRGB(sunAlt) : [5, 9, 21];
    const lim = limitMag();
    const darkness = real ? clamp(-sunAlt / 18, 0, 1) : 1;
    const zoomK = P.dome ? clamp(Math.min(W, H) / 760, 0.85, 1.5) : clamp(Math.pow(90 / state.fov, 0.3), 0.8, 2) * clamp(Math.max(W, H) / 1100, 0.9, 1.4);
    const M = frame.HP;

    // 地面（全天図では円の外側）
    ctx.fillStyle = P.dome ? '#080c10' : rgb(skyC);
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (P.dome) {
      ctx.beginPath(); ctx.arc(P.cx, P.cy, P.R, 0, Math.PI * 2); ctx.clip();
      const g = ctx.createRadialGradient(P.cx, P.cy, 0, P.cx, P.cy, P.R);
      const glow = real ? clamp(1 - Math.abs(sunAlt + 8) / 10, 0, 1) : 0;
      g.addColorStop(0, rgb(skyC));
      g.addColorStop(1, rgb([skyC[0] + 50 * glow + 6, skyC[1] + 30 * glow + 8, skyC[2] + 8 * glow + 14]));
      ctx.fillStyle = g; ctx.fillRect(P.cx - P.R, P.cy - P.R, P.R * 2, P.R * 2);
    } else if (real) {
      const glow = clamp(1 - Math.abs(sunAlt + 8) / 10, 0, 1);
      const g = ctx.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, rgb([skyC[0] + 50 * glow + 6, skyC[1] + 30 * glow + 8, skyC[2] + 8 * glow + 14]));
      g.addColorStop(0.6, rgb(skyC));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // 天の川
    const mwAmt = BORTLE[state.bortle].mw * (real ? Math.pow(clamp(-(sunAlt + 3) / 15, 0, 1), 1.2) : 1);
    if (state.opts.milky && mwAmt > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      const v = [0, 0, 0];
      for (const b of MW) {
        A.applyMat(M, b.v, v);
        if (v[2] < -0.12) continue;
        if (!project(v)) continue;
        const rad = 5.2 * pk * D2R;
        if (px < -rad || px > W + rad || py < -rad || py > H + rad) continue;
        ctx.globalAlpha = Math.min(0.5, 0.045 * Math.pow(b.lv, 0.85)) * mwAmt;
        ctx.drawImage(MWSPR, px - rad, py - rad, rad * 2, rad * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // 目盛り
    ctx.lineWidth = 1;
    const hv = (arr) => arr.map((p) => A.applyMat(frame.H, p, [0, 0, 0]));
    if (state.opts.equ) {
      for (const g of GRID_EQU) {
        ctx.strokeStyle = g.main ? 'rgba(120,220,170,0.55)' : 'rgba(120,220,170,0.2)';
        ctx.beginPath(); strokeHor(hv(g.pts)); ctx.stroke();
      }
    }
    if (state.opts.altaz) {
      ctx.strokeStyle = 'rgba(255,170,120,0.25)';
      for (const g of GRID_ALT) { ctx.beginPath(); strokeHor(g); ctx.stroke(); }
    }
    if (state.opts.ecl) {
      ctx.strokeStyle = 'rgba(255,214,120,0.4)';
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); strokeHor(hv(ECLIPTIC)); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 星座線
    for (let ci = 0; ci < CONS.length; ci++) {
      const c = CONS[ci];
      const selected = state.sel === c.id;
      if (!state.opts.lines && !selected) continue;
      ctx.strokeStyle = selected ? 'rgba(255,214,120,0.95)' : 'rgba(110,160,255,0.42)';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      for (const s of c.segs) {
        const pts = s.map((p) => A.applyMat(M, p, [0, 0, 0]));
        if (pts.every((p) => p[2] < -0.05)) continue;
        strokeHor(pts);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    // 恒星
    const sz = zoomK;
    const nameLim = P.dome ? (P.R < 260 ? 1.2 : 1.9) : state.fov > 70 ? 2.3 : 2.8;
    for (let i = 0; i < NS; i++) {
      const x = starVec[i * 3], y = starVec[i * 3 + 1], z = starVec[i * 3 + 2];
      const U = M[6] * x + M[7] * y + M[8] * z;
      if (U < 0) continue;
      const m = starMag[i] + 0.2 / (U + 0.05);
      if (m > lim) continue;
      tmp[0] = M[0] * x + M[1] * y + M[2] * z;
      tmp[1] = M[3] * x + M[4] * y + M[5] * z;
      tmp[2] = U;
      if (!project(tmp)) continue;
      if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
      const rr = Math.min(0.55 + (lim - m) * 0.34 * sz, 5.6 * sz);
      if (m < 2.3) {
        ctx.globalAlpha = Math.min(0.55, (2.4 - m) * 0.18) * (real ? darkness : 1);
        const gr = rr * 5;
        ctx.drawImage(GLOW, px - gr, py - gr, gr * 2, gr * 2);
      }
      ctx.globalAlpha = Math.min(1, 0.5 + (lim - m) * 0.3) * (real ? Math.max(0.15, darkness) : 1);
      ctx.fillStyle = starCol[i];
      ctx.beginPath(); ctx.arc(px, py, rr, 0, 6.2832); ctx.fill();
      if (starMag[i] < 3.6) pickables.push({ x: px, y: py, w: 4, kind: 'star', idx: i, hv: [tmp[0], tmp[1], tmp[2]] });
    }
    ctx.globalAlpha = 1;

    // 星の名前
    if (state.opts.starNames) {
      ctx.font = `${Math.round(11 * Math.min(zoomK, 1.3))}px ${FONT}`;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillStyle = `rgba(215,225,255,${0.55 * (real ? Math.max(0.2, darkness) : 1) + 0.2})`;
      for (const n of starNames) {
        if (n.mag > nameLim) continue;
        const i = n.idx;
        const x = starVec[i * 3], y = starVec[i * 3 + 1], z = starVec[i * 3 + 2];
        const U = M[6] * x + M[7] * y + M[8] * z;
        if (U < 0.02) continue;
        tmp[0] = M[0] * x + M[1] * y + M[2] * z; tmp[1] = M[3] * x + M[4] * y + M[5] * z; tmp[2] = U;
        if (!project(tmp) || px < 0 || px > W || py < 0 || py > H) continue;
        ctx.fillText(n.ja, px + 6 + Math.max(0, 3.5 - n.mag) * sz, py - 6);
      }
    }

    // 太陽・月・惑星
    if (state.opts.bodies) drawBodies(zoomK, real);

    // 星座名
    if (state.opts.conNames || state.sel) {
      ctx.font = `${Math.round(12.5 * Math.min(zoomK, 1.35) * (P.dome && P.R < 260 ? 0.88 : 1))}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const c of CONS) {
        const selected = state.sel === c.id;
        if (!state.opts.conNames && !selected) continue;
        const v = A.applyMat(M, c.cen, [0, 0, 0]);
        if (v[2] < 0.04) continue;
        if (!project(v) || px < 0 || px > W || py < 0 || py > H) continue;
        ctx.fillStyle = selected ? 'rgba(255,224,150,1)' : `rgba(150,190,255,${0.7 * (real ? Math.max(0.2, darkness) : 1)})`;
        ctx.fillText(c.ja, px, py);
        pickables.push({ x: px, y: py, w: 0, kind: 'con', con: c, hv: v.slice() });
      }
    }
    ctx.restore();

    drawHorizon(skyC);
    dirty = false;
    lastRender = performance.now();
  }

  function drawBodies(zoomK, real) {
    // 手前に大きい天体（太陽・月）を後から描く
    const order = bodies.slice().sort((a, b) => (a.id === 'sun') - (b.id === 'sun') || (a.id === 'moon') - (b.id === 'moon'));
    for (const b of order) {
      const v = b.hor;
      if (v[2] < -0.03 || !project(v)) continue;
      if (px < -40 || px > cw + 40 || py < -40 || py > ch + 40) continue;
      const x = px, y = py;
      ctx.font = `${Math.round(12 * Math.min(zoomK, 1.3))}px ${FONT}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      let rad;
      if (b.id === 'sun') {
        rad = Math.max(9 * zoomK, 0.5 * pk * D2R * 2.2);
        const g = rad * 4;
        ctx.globalAlpha = 0.55; ctx.drawImage(GLOW, x - g, y - g, g * 2, g * 2); ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
      } else if (b.id === 'moon') {
        rad = Math.max(9 * zoomK, 0.5 * pk * D2R * 2.2);
        const g = rad * 3 * (0.4 + b.illum * 0.6);
        ctx.globalAlpha = 0.35 * (0.3 + b.illum); ctx.drawImage(GLOW, x - g, y - g, g * 2, g * 2); ctx.globalAlpha = 1;
        drawMoon(x, y, rad, b);
      } else {
        rad = clamp(3.6 + -b.mag * 0.5, 3.6, 6.5) * zoomK;
        const g = rad * 5;
        ctx.globalAlpha = 0.4 * (real ? clamp(-sunAlt / 12, 0.1, 1) : 1); ctx.drawImage(GLOW, x - g, y - g, g * 2, g * 2);
        ctx.globalAlpha = real ? clamp(-sunAlt / 6, 0.3, 1) : 1;
        ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = b.color; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, rad + 5, 0, 6.2832); ctx.stroke(); ctx.lineWidth = 1;
        ctx.globalAlpha = 1; rad += 5;
        ctx.font = `bold ${Math.round(13 * Math.min(zoomK, 1.3))}px ${FONT}`;
      }
      ctx.fillStyle = b.id === 'sun' ? '#ffe9a8' : b.id === 'moon' ? '#f1f1e6' : '#ffd9a6';
      ctx.fillText(b.ja, x + rad + 5, y - rad * 0.4);
      pickables.push({ x, y, w: -10, kind: 'body', body: b, hv: v.slice() });
    }
  }

  function drawMoon(x, y, r, b) {
    // 太陽の方向を画面上で求め、そちら側を明るくする
    let ang = 0;
    const sv = bodies[0].hor;
    const sx = px, sy = py;
    if (project(sv)) ang = Math.atan2(py - y, px - x);
    px = sx; py = sy;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#2b3042';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
    const c = Math.cos(b.elong);
    ctx.fillStyle = '#f4f1e0';
    ctx.beginPath();
    ctx.arc(0, 0, r, -HALF_PI, HALF_PI, false);
    for (let i = 0; i <= 24; i++) {
      const t = HALF_PI - (i / 24) * Math.PI;
      ctx.lineTo(c * r * Math.cos(t), r * Math.sin(t));
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  const COMPASS = [[0, '北', true], [45, '北東', false], [90, '東', true], [135, '南東', false], [180, '南', true], [225, '南西', false], [270, '西', true], [315, '北西', false]];

  function drawHorizon(skyC) {
    const W = cw, H = ch;
    if (P.dome) {
      ctx.strokeStyle = 'rgba(160,190,255,0.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(P.cx, P.cy, P.R, 0, Math.PI * 2); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [az, name, main] of COMPASS) {
        const v = [Math.sin(az * D2R), Math.cos(az * D2R), 0];
        project(v);
        const dx = px - P.cx, dy = py - P.cy, d = Math.hypot(dx, dy) || 1;
        const off = main ? 16 : 13;
        ctx.font = `${main ? 15 : 11}px ${FONT}`;
        ctx.fillStyle = main ? (az === 0 ? '#ff9c8a' : '#e8edff') : 'rgba(200,210,240,0.7)';
        ctx.fillText(name, px + (dx / d) * off, py + (dy / d) * off);
      }
      return;
    }
    // 広角ビュー: 地平線の下を塗りつぶす（ステレオ投影では地平線は円になる）
    // 地平線の法線(天頂方向)をカメラ座標で表す: (右成分, 上成分, 前方成分)
    const mr = P.r[2], mu = P.u[2], mf = P.f[2];
    const ground = state.opts.realSky ? rgb([skyC[0] * 0.25, skyC[1] * 0.25 + 5, skyC[2] * 0.25 + 4], 0.96) : 'rgba(8,12,16,0.96)';
    ctx.fillStyle = ground;
    ctx.strokeStyle = 'rgba(160,190,255,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (Math.abs(mf) < 0.002) {
      // 地平線がほぼ直線: (mr, mu) の向きの反対側が地面
      const n = Math.hypot(mr, mu) || 1;
      const gx = -mr / n, gy = mu / n;      // 地面側の向き（画面座標）
      const tx = mu / n, ty = mr / n;       // 地平線に沿う向き
      const L = Math.max(W, H) * 3;
      ctx.moveTo(P.cx + tx * L, P.cy + ty * L); ctx.lineTo(P.cx - tx * L, P.cy - ty * L);
      ctx.lineTo(P.cx - tx * L + gx * L, P.cy - ty * L + gy * L); ctx.lineTo(P.cx + tx * L + gx * L, P.cy + ty * L + gy * L);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(P.cx + tx * L, P.cy + ty * L); ctx.lineTo(P.cx - tx * L, P.cy - ty * L); ctx.stroke();
    } else {
      const cxp = (2 * mr) / mf, cyp = (2 * mu) / mf;
      const rr = Math.sqrt(4 + cxp * cxp + cyp * cyp) * P.scale;
      const ccx = P.cx + cxp * P.scale, ccy = P.cy - cyp * P.scale;
      if (mf > 0) { ctx.rect(-5, -5, W + 10, H + 10); ctx.arc(ccx, ccy, rr, 0, Math.PI * 2); ctx.fill('evenodd'); }
      else { ctx.arc(ccx, ccy, rr, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.arc(ccx, ccy, rr, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (const [az, name, main] of COMPASS) {
      const v = [Math.sin(az * D2R), Math.cos(az * D2R), 0.0];
      if (!project(v) || px < 10 || px > W - 10 || py < 20 || py > H - 4) continue;
      ctx.font = `${main ? 15 : 11}px ${FONT}`;
      ctx.fillStyle = main ? (az === 0 ? '#ff9c8a' : '#e8edff') : 'rgba(200,210,240,0.8)';
      ctx.fillText(name, px, py - 6);
      ctx.strokeStyle = 'rgba(160,190,255,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 4); ctx.stroke();
    }
  }

  // ---------- ループ ----------
  let lastTick = performance.now();
  function loop(now) {
    syncSize();
    const dt = Math.min(0.25, (now - lastTick) / 1000);
    lastTick = now;
    let needs = dirty;
    if (state.playing) {
      if (state.live && state.speed === 1) {
        state.t = Date.now();
        if (now - lastRender > 1000) needs = true;
      } else {
        state.live = false;
        state.t += dt * state.speed * 1000;
        needs = true;
      }
    }
    if (tween) {
      const k = 1 - Math.pow(0.0006, dt);
      let dAz = ((tween.az - state.az0 + 540) % 360) - 180;
      state.az0 = (state.az0 + dAz * k + 360) % 360;
      state.alt0 += (tween.alt - state.alt0) * k;
      state.fov += (tween.fov - state.fov) * k;
      if (Math.abs(dAz) < 0.05 && Math.abs(tween.alt - state.alt0) < 0.05 && Math.abs(tween.fov - state.fov) < 0.1) tween = null;
      needs = true;
    }
    if (needs) {
      render();
      refreshUI(false);
    }
    requestAnimationFrame(loop);
  }

  // ---------- 操作 ----------
  const pointers = new Map();
  let dragMoved = 0, pinchDist = 0;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved = 0;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); }
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const [dx, dy] = toLocalDelta(e.clientX - p.x, e.clientY - p.y);
    p.x = e.clientX; p.y = e.clientY;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    if (state.mode !== 'view') return;
    tween = null;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) state.fov = clamp(state.fov * (pinchDist / d), 8, 150);
      pinchDist = d;
    } else if (!sensorOn) {
      const degPerPx = (state.fov / Math.max(cw, ch)) * 1.05;
      state.az0 = (state.az0 - dx * degPerPx + 360) % 360;
      state.alt0 = clamp(state.alt0 + dy * degPerPx, -10, 90);
    }
    dirty = true;
  });
  const endPointer = (e) => {
    const had = pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (!pointers.size) canvas.classList.remove('dragging');
    if (had && e.type === 'pointerup' && dragMoved < 8 && !pointers.size) handleTap(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    if (state.mode !== 'view') return;
    e.preventDefault();
    state.fov = clamp(state.fov * Math.exp(e.deltaY * 0.0012), 8, 150);
    dirty = true;
  }, { passive: false });

  function handleTap(cx, cy) {
    const [x, y] = appRot ? toLocal(cx, cy) : (() => { const r = canvas.getBoundingClientRect(); return [cx - r.left, cy - r.top]; })();
    let best = null, bestScore = 24;
    for (const p of pickables) {
      const score = Math.hypot(p.x - x, p.y - y) + p.w;
      if (score < bestScore) { bestScore = score; best = p; }
    }
    if (!best) { hideInfo(); return; }
    showInfo(best);
  }

  function showInfo(p) {
    const a = fmtAltAz(p.hv);
    let html;
    if (p.kind === 'body') {
      const b = p.body;
      html = `<h3>${b.ja}</h3><p>${a.txt}</p>`;
      if (b.id === 'moon') html += `<p>月齢 約<b>${b.age.toFixed(1)}</b> ／ 輝面比 <b>${Math.round(b.illum * 100)}%</b></p>`;
      if (b.id === 'sun') html += `<p>${a.alt > 0 ? '地平線の上にいます（昼間）' : '地平線の下にいます'}</p>`;
    } else if (p.kind === 'star') {
      const i = p.idx;
      const n = starNames.find((s) => s.idx === i);
      html = `<h3>${n ? n.ja : '恒星'}</h3>${n ? `<p>${n.en}</p>` : ''}<p>${a.txt}</p><p>明るさ <b>${starMag[i].toFixed(1)}</b> 等級</p>`;
    } else {
      const c = p.con;
      state.sel = state.sel === c.id ? null : c.id;
      html = `<h3>${c.ja}</h3><p>${c.en}</p><p>中心付近: ${a.txt}</p>`;
      if (!state.sel) html += '<p>（強調を解除しました）</p>';
      dirty = true; renderConList(true);
    }
    $('infoBody').innerHTML = html;
    $('infoCard').hidden = false;
  }
  function hideInfo() { $('infoCard').hidden = true; }
  $('infoClose').addEventListener('click', hideInfo);

  function gotoCon(id) {
    const c = CONS.find((x) => x.id === id);
    if (!c || !frame) return;
    state.sel = id;
    const v = A.applyMat(frame.HP, c.cen, [0, 0, 0]);
    const o = A.horToAzAlt(v);
    setMode('view', true);
    tween = { az: o.az, alt: clamp(o.alt, 12, 80), fov: 75 };
    dirty = true; renderConList(true);
    if (window.matchMedia(MOBILE_Q).matches) setPanel(false);
  }

  function setMode(m, silent) {
    state.mode = m;
    $('modeDome').classList.toggle('on', m === 'dome');
    $('modeView').classList.toggle('on', m === 'view');
    $('modeDome').setAttribute('aria-pressed', String(m === 'dome'));
    $('modeView').setAttribute('aria-pressed', String(m === 'view'));
    $('hint').textContent = m === 'view'
      ? 'ドラッグで見回す ／ ホイール・ピンチで拡大縮小 ／ 星や星座名をタップで詳細'
      : '全天図: 頂点（真上）が中心、外周が地平線。北が上・東が左です。星や星座名をタップで詳細';
    if (!silent) savePrefs();
    dirty = true;
  }
  $('modeDome').addEventListener('click', () => setMode('dome'));
  $('modeView').addEventListener('click', () => setMode('view'));

  // ---------- パネル ----------
  const panel = $('panel');
  function setPanel(open) {
    panel.classList.toggle('open', open);
    $('menuBtn').setAttribute('aria-expanded', String(open));
    $('menuBtn').textContent = open ? '閉じる' : '設定';
  }
  $('menuBtn').addEventListener('click', () => setPanel(!panel.classList.contains('open')));

  function jstParts(ms) {
    const d = new Date(ms + JST);
    return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), w: d.getUTCDay() };
  }
  const pad = (n) => String(n).padStart(2, '0');
  const fmtHM = (ms) => (ms == null ? '—' : `${pad(jstParts(ms).h)}:${pad(jstParts(ms).mi)}`);
  const dayStartOf = (ms) => Math.floor((ms + JST) / 86400000) * 86400000 - JST;
  const WD = ['日', '月', '火', '水', '木', '金', '土'];

  function setTime(ms, keepPlay) {
    state.t = ms; state.live = false;
    if (!keepPlay) { state.playing = false; $('btnPlay').setAttribute('aria-pressed', 'false'); $('btnPlay').textContent = '▶ 再生'; }
    dirty = true; refreshUI(true);
  }
  function tonight() {
    const now = Date.now();
    let ds = dayStartOf(now);
    if (jstParts(now).h < 4) ds -= 86400000; // 未明は前日の夜として扱う
    return ds + 21 * 3600000;
  }
  $('dt').addEventListener('change', (e) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(e.target.value);
    if (m) setTime(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - JST);
  });
  $('btnNow').addEventListener('click', () => {
    state.t = Date.now(); state.live = true; state.playing = true; state.speed = 1; $('speed').value = '1';
    $('btnPlay').setAttribute('aria-pressed', 'true'); $('btnPlay').textContent = '⏸ 一時停止';
    dirty = true; refreshUI(true);
  });
  $('btnTonight').addEventListener('click', () => setTime(tonight()));
  document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => setTime(state.t + Number(b.dataset.step))));
  $('btnPlay').addEventListener('click', () => {
    state.playing = !state.playing;
    $('btnPlay').setAttribute('aria-pressed', String(state.playing));
    $('btnPlay').textContent = state.playing ? '⏸ 一時停止' : '▶ 再生';
    if (state.playing && state.speed === 1) { state.live = true; }
    lastTick = performance.now();
  });
  $('speed').addEventListener('change', (e) => {
    state.speed = Number(e.target.value);
    if (state.speed !== 1) state.live = false;
  });

  // 場所
  const placeSel = $('place');
  for (const [id, name] of PLACES) {
    const o = document.createElement('option'); o.value = id; o.textContent = name; placeSel.appendChild(o);
  }
  function ensureCustomOption(label) {
    let o = placeSel.querySelector('option[value="custom"]');
    if (!o) { o = document.createElement('option'); o.value = 'custom'; placeSel.appendChild(o); }
    o.textContent = label;
  }
  function applyPlace() {
    $('latlon').textContent = `北緯 ${state.lat.toFixed(2)}° ／ 東経 ${state.lon.toFixed(2)}°`;
    if (!PLACES.some((p) => p[0] === state.place)) { state.place = 'custom'; ensureCustomOption('現在地'); }
    placeSel.value = state.place;
    dayKey = '';
    dirty = true; refreshUI(true);
  }
  placeSel.addEventListener('change', () => {
    const p = PLACES.find((x) => x[0] === placeSel.value);
    if (!p) return;
    state.place = p[0]; state.lat = p[2]; state.lon = p[3];
    savePrefs(); applyPlace();
  });
  $('btnGeo').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('このブラウザでは現在地を取得できません。'); return; }
    toast('現在地を取得しています…');
    navigator.geolocation.getCurrentPosition((pos) => {
      state.lat = clamp(pos.coords.latitude, -90, 90); state.lon = clamp(pos.coords.longitude, -180, 180);
      state.place = 'custom'; ensureCustomOption('現在地');
      savePrefs(); applyPlace(); toast('現在地に切り替えました。');
    }, () => toast('現在地を取得できませんでした。位置情報の許可を確認してください。'), { timeout: 10000, maximumAge: 600000 });
  });

  $('bortle').addEventListener('change', (e) => { state.bortle = e.target.value; savePrefs(); dirty = true; });
  for (const k of OPT_KEYS) {
    const el = $('o_' + k);
    el.checked = state.opts[k];
    el.addEventListener('change', () => { state.opts[k] = el.checked; savePrefs(); dirty = true; });
  }

  let toastTimer = 0;
  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 5200);
  }

  // ---------- 情報表示の更新 ----------
  let dayKey = '', dayEv = null, lastUI = 0, lastConKey = '';
  function sunPhaseLabel(a) {
    return a > 0 ? '昼' : a > -6 ? '市民薄明' : a > -12 ? '航海薄明' : a > -18 ? '天文薄明' : '夜';
  }
  function refreshUI(force) {
    const now = performance.now();
    if (!force && now - lastUI < 400) return;
    lastUI = now;
    if (!frame) return;
    const p = jstParts(state.t);
    $('whenLabel').textContent = `${p.y}/${pad(p.mo)}/${pad(p.d)}（${WD[p.w]}） ${pad(p.h)}:${pad(p.mi)} JST ・ ${placeName()}${state.live ? ' ・ 現在' : ''}`;
    const dtv = `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
    if (document.activeElement !== $('dt') && $('dt').value !== dtv) $('dt').value = dtv;

    const key = `${dayStartOf(state.t)}|${state.lat}|${state.lon}`;
    if (key !== dayKey) { dayKey = key; dayEv = A.dayEvents(dayStartOf(state.t), state.lat, state.lon); }
    const moon = bodies.find((b) => b.id === 'moon');
    $('sunInfo').innerHTML =
      `<dt>太陽の高度</dt><dd>${sunAlt.toFixed(0)}°（${sunPhaseLabel(sunAlt)}）</dd>` +
      `<dt>日の出</dt><dd>${fmtHM(dayEv.sunrise)}</dd><dt>日の入り</dt><dd>${fmtHM(dayEv.sunset)}</dd>` +
      `<dt>空が完全に暗くなる</dt><dd>${fmtHM(dayEv.duskEnd)}</dd><dt>明るくなり始める</dt><dd>${fmtHM(dayEv.dawnStart)}</dd>` +
      `<dt>月の出</dt><dd>${fmtHM(dayEv.moonrise)}</dd><dt>月の入り</dt><dd>${fmtHM(dayEv.moonset)}</dd>` +
      `<dt>月齢 / 輝面比</dt><dd>${moon.age.toFixed(1)} / ${Math.round(moon.illum * 100)}%</dd>`;

    const rows = bodies.filter((b) => b.id !== 'sun').map((b) => {
      const o = A.horToAzAlt(b.hor);
      const night = sunAlt < -6;
      let st, ok = false;
      if (o.alt <= 0) st = '地平線の下';
      else if (!night) st = o.alt < 3 ? '低い（空が明るい）' : '空が明るい時間';
      else if (o.alt < 8) st = '低い';
      else { st = '観察できる'; ok = true; }
      const col = b.id === 'moon' ? '#f4f1e0' : b.color;
      return `<li><span class="dot" style="background:${col}"></span><span>${b.ja}</span><span>${dirName(o.az)} ${o.alt.toFixed(0)}°${b.mag !== undefined ? `<small class="muted"> ${b.mag > 0 ? '+' : ''}${b.mag.toFixed(1)}等</small>` : ''}</span><span class="st${ok ? ' ok' : ''}">${st}</span></li>`;
    });
    $('bodyList').innerHTML = rows.join('');
    renderConList(false);
  }

  function placeName() {
    const p = PLACES.find((x) => x[0] === state.place);
    return p ? p[1] : '現在地';
  }

  function renderConList(force) {
    if (!frame) return;
    const items = [];
    const v = [0, 0, 0];
    for (const c of CONS) {
      let up = 0;
      for (const p of c.all) { A.applyMat(frame.HP, p, v); if (v[2] > 0.087) up++; }
      const frac = up / c.all.length;
      if (frac < 0.3) continue;
      const cv = A.applyMat(frame.HP, c.cen, [0, 0, 0]);
      const o = A.horToAzAlt(cv);
      items.push({ c, frac, alt: o.alt, az: o.az });
    }
    items.sort((a, b) => b.alt - a.alt);
    const k = items.map((i) => i.c.id + (i.frac >= 0.7 ? '+' : '-')).join() + '|' + state.sel + '|' + state.lat;
    if (!force && k === lastConKey) return;
    lastConKey = k;
    const box = $('conList');
    box.textContent = '';
    if (!items.length) { box.textContent = '地平線の上に星座はありません。'; return; }
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = (it.frac < 0.7 ? 'part ' : '') + (state.sel === it.c.id ? 'sel-on' : '');
      b.textContent = it.c.ja.replace(/座$/, '');
      const s = document.createElement('small');
      s.textContent = it.alt > 0 ? dirName(it.az) : '';
      b.appendChild(s);
      b.title = it.frac < 0.7 ? '一部が地平線の上に見えています' : '全体が見えています';
      b.addEventListener('click', () => gotoCon(it.c.id));
      box.appendChild(b);
    }
  }

  // ---------- スマホの向きセンサー ----------
  const sensor = window.StarSensor ? new window.StarSensor.Controller({
    lat: () => state.lat, lon: () => state.lon,
    angle: () => norm360(osAngle() + appRot), // 画面の上方向（OS の回転＋アプリの回転）
    onOrient: () => updateRotation(),
    onUpdate: (b, c) => {
      sensorBasis = b;
      state.az0 = window.StarSensor.azimuth(b.f); state.alt0 = Math.asin(clamp(b.f[2], -1, 1)) * R2D; // 終了後も同じ向きで続ける
      updateRotation(); // 持ち方の判定を取りこぼしても、更新のたびに合わせ直す
      dirty = true;
      if (c.count % 20 === 1) updateSensorStatus();
    },
  }) : null;
  let wakeLock = null;
  function updateSensorStatus() {
    if (!sensor) return;
    const t = (sensor.trim ? `（補正 ${sensor.trim > 0 ? '+' : ''}${sensor.trim}°）` : '') + (appRot ? ` ・画面回転${appRot}°` : '') + ` ・v${APP_VERSION}`;
    $('sensorStatus').textContent = sensor.mode === 'absolute' ? `コンパス有効${t}`
      : sensor.mode === 'ios' ? `コンパス有効${t}`
      : sensor.mode === 'gyro' ? `コンパス未対応: ◀▶で方位を合わせてください${t}`
      : `スマホを星空に向けてください ・v${APP_VERSION}`;
  }
  async function startSensor() {
    if (!sensor) { toast('このブラウザでは向きセンサーを使えません。'); return; }
    try {
      await sensor.start();
    } catch (e) {
      toast(e && e.message === 'denied' ? 'センサーの使用が許可されませんでした。設定でモーションと方向へのアクセスを許可してください。' : 'このブラウザでは向きセンサーを使えません。');
      return;
    }
    sensorOn = true;
    document.body.classList.add('sensing');
    $('sensorBtn').setAttribute('aria-pressed', 'true'); $('sensorBtn').textContent = '📱 センサー中';
    $('sensorBar').hidden = false;
    tween = null; setMode('view', true);
    state.fov = clamp(Math.min(state.fov, 75), 40, 100);
    $('btnNow').click(); // 現在の時刻の星空にする
    setPanel(false);
    updateSensorStatus();
    $('hint').textContent = '';
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* 画面を消さない設定が使えない環境 */ }
    // 現在地を取得して、その場所の星空にする（許可されなければ今の場所のまま）
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((pos) => {
      state.lat = clamp(pos.coords.latitude, -90, 90); state.lon = clamp(pos.coords.longitude, -180, 180);
      state.place = 'custom'; ensureCustomOption('現在地'); savePrefs(); applyPlace();
    }, () => {}, { timeout: 8000, maximumAge: 600000 });
    setTimeout(() => {
      if (sensorOn && sensor.count === 0) { toast('センサーの値を取得できません。スマホのブラウザで開いているか、モーションと方向の許可を確認してください。'); stopSensor(); }
    }, 3000);
    toast('スマホの背面を向けた方向の星空が表示されます。横向きでも使えます。');
  }
  function stopSensor() {
    if (sensor) sensor.stop();
    sensorOn = false; sensorBasis = null; applyRotation(0);
    document.body.classList.remove('sensing');
    $('sensorBtn').setAttribute('aria-pressed', 'false'); $('sensorBtn').textContent = '📱 向きで見る';
    $('sensorBar').hidden = true;
    setMode(state.mode, true);
    try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) { /* 無視 */ }
    dirty = true;
  }
  if (sensor && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)) $('sensorBtn').hidden = false;
  $('sensorBtn').addEventListener('click', () => (sensorOn ? stopSensor() : startSensor()));
  $('sensorStop').addEventListener('click', stopSensor);
  $('trimL').addEventListener('click', () => { sensor.trim -= 3; updateSensorStatus(); });
  $('trimR').addEventListener('click', () => { sensor.trim += 3; updateSensorStatus(); });
  document.addEventListener('visibilitychange', () => { if (sensorOn && document.visibilityState === 'visible' && navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wakeLock = w; }).catch(() => {}); });

  // ?debug=1 を付けて開くと、表示サイズなどの診断を画面の隅に出す（向き・サイズの不具合の調査用）
  if (/[?&]debug=1/.test(location.search)) {
    const dbg = document.createElement('div');
    dbg.style.cssText = 'position:fixed;left:4px;top:60px;z-index:9;padding:3px 6px;background:rgba(0,0,0,.7);color:#9f9;font:11px/1.4 monospace;pointer-events:none;border-radius:4px';
    document.body.appendChild(dbg);
    setInterval(() => {
      const ang = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : window.orientation;
      dbg.textContent = `表示 ${cw.toFixed(0)}x${ch.toFixed(0)} / 内部 ${canvas.width}x${canvas.height} / 比 ${(cw / ch).toFixed(3)}:${(canvas.width / canvas.height).toFixed(3)} / dpr ${dpr} / 窓 ${innerWidth}x${innerHeight} / OS角度 ${ang} / アプリ回転 ${appRot} / 持ち方 ${sensor ? sensor.physAngle : '-'} / v${APP_VERSION} / センサー ${sensorOn ? (sensor ? sensor.mode + ' ' + sensor.count : '-') : 'off'}`;
    }, 300);
  }

  // ---------- 起動 ----------
  loadPrefs();
  $('bortle').value = state.bortle;
  for (const k of OPT_KEYS) $('o_' + k).checked = state.opts[k];
  if (!PLACES.some((p) => p[0] === state.place)) ensureCustomOption('現在地');
  setMode(state.mode, true);
  $('btnPlay').setAttribute('aria-pressed', 'true'); $('btnPlay').textContent = '⏸ 一時停止';
  $('speed').value = '1'; state.speed = 1;

  if (A.sunAltitude(state.t, state.lat, state.lon) > -6) {
    state.t = tonight(); state.live = false; state.playing = false;
    $('btnPlay').setAttribute('aria-pressed', 'false'); $('btnPlay').textContent = '▶ 再生'; $('speed').value = '600'; state.speed = 600;
    toast('今は空が明るいため、今夜21:00の星空を表示しています。「現在」で今の空に戻せます。');
  }
  applyPlace();

  const mq = window.matchMedia(MOBILE_Q);
  function updateOverlap() { panelOverlap = mq.matches ? 0 : panel.offsetWidth; dirty = true; }
  const onResize = () => { resize(); updateOverlap(); };
  window.addEventListener('resize', onResize);
  // 端末の回転は、イベント直後だと寸法が古いことがあるため、少し遅らせて取り直す
  window.addEventListener('orientationchange', () => { [0, 120, 400, 900].forEach((t) => setTimeout(() => { updateRotation(); syncSize(); }, t)); });
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => { [0, 120, 400, 900].forEach((t) => setTimeout(() => { updateRotation(); syncSize(); }, t)); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', syncSize);
  if (window.ResizeObserver) new ResizeObserver(syncSize).observe(canvas);
  (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(updateOverlap);
  resize(); updateOverlap();
  requestAnimationFrame(loop);

  // テスト・デバッグ用
  window.__stars = { state, render, setMode, toLocal, get appRot() { return appRot; }, startSensor, stopSensor, get sensor() { return sensor; } };
})();
