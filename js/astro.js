/* 天文計算: 恒星時・歳差・太陽/月/惑星の位置・日の出入り
 * 惑星・月の軌道要素は P. Schlyter "How to compute planetary positions" による簡易式
 * （精度は惑星で約1〜2分角、月で約0.1〜0.3°。肉眼での星空シミュレーション用途には十分）。
 */
(function () {
  'use strict';
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;

  const norm360 = (x) => ((x % 360) + 360) % 360;
  const jdFromMs = (ms) => ms / 86400000 + 2440587.5;
  const sind = (x) => Math.sin(x * D2R);
  const cosd = (x) => Math.cos(x * D2R);

  /** 赤経・赤緯(度) → 単位ベクトル */
  function raDecToVec(ra, dec) {
    const c = Math.cos(dec * D2R);
    return [c * Math.cos(ra * D2R), c * Math.sin(ra * D2R), Math.sin(dec * D2R)];
  }

  /** グリニッジ平均恒星時(度) */
  function gmst(jd) {
    return norm360(280.46061837 + 360.98564736629 * (jd - 2451545));
  }

  /** J2000.0 → 観測日 の歳差行列(行優先9要素) */
  function precession(jd) {
    const T = (jd - 2451545) / 36525;
    const as = Math.PI / 648000; // 秒角→rad
    const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * as;
    const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * as;
    const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * as;
    const cz = Math.cos(zeta), sz = Math.sin(zeta);
    const cZ = Math.cos(z), sZ = Math.sin(z);
    const ct = Math.cos(th), st = Math.sin(th);
    return [
      cz * ct * cZ - sz * sZ, -sz * ct * cZ - cz * sZ, -st * cZ,
      cz * ct * sZ + sz * cZ, -sz * ct * sZ + cz * cZ, -st * sZ,
      cz * st, -sz * st, ct,
    ];
  }

  function mul33(a, b) {
    const o = new Array(9);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
      }
    }
    return o;
  }

  /** 赤道座標(観測日の分点) → 地平座標(E,N,U)の行列 */
  function horizonMatrix(lstDeg, latDeg) {
    const ct = cosd(lstDeg), st = sind(lstDeg);
    const sp = sind(latDeg), cp = cosd(latDeg);
    return [
      -st, ct, 0,
      -sp * ct, -sp * st, cp,
      cp * ct, cp * st, sp,
    ];
  }

  /** 時刻・場所ごとの変換フレーム */
  function makeFrame(ms, latDeg, lonDeg) {
    const jd = jdFromMs(ms);
    const lst = norm360(gmst(jd) + lonDeg);
    const H = horizonMatrix(lst, latDeg);
    return { ms, jd, lst, lat: latDeg, lon: lonDeg, H, HP: mul33(H, precession(jd)) };
  }

  function applyMat(m, v, out) {
    out[0] = m[0] * v[0] + m[1] * v[1] + m[2] * v[2];
    out[1] = m[3] * v[0] + m[4] * v[1] + m[5] * v[2];
    out[2] = m[6] * v[0] + m[7] * v[1] + m[8] * v[2];
    return out;
  }

  /** 地平ベクトル(E,N,U) → {az, alt}(度。方位は北0°・東90°) */
  function horToAzAlt(v) {
    return {
      az: norm360(Math.atan2(v[0], v[1]) * R2D),
      alt: Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D,
    };
  }

  // ---- 太陽・月・惑星 ----
  function solveKepler(M, e) {
    let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
    for (let i = 0; i < 12; i++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-9) break;
    }
    return E;
  }

  const obliquity = (d) => 23.4393 - 3.563e-7 * d;

  function eclToEq(x, y, z, d) {
    const eps = obliquity(d) * D2R;
    const ce = Math.cos(eps), se = Math.sin(eps);
    return [x, y * ce - z * se, y * se + z * ce];
  }

  function normalize(v) {
    const r = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / r, v[1] / r, v[2] / r];
  }

  function sunEcl(d) {
    const w = 282.9404 + 4.70935e-5 * d;
    const e = 0.016709 - 1.151e-9 * d;
    const M = norm360(356.047 + 0.9856002585 * d) * D2R;
    const E = solveKepler(M, e);
    const xv = Math.cos(E) - e;
    const yv = Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv);
    const r = Math.hypot(xv, yv);
    const lon = v + w * D2R;
    return { lon: norm360(lon * R2D), r, x: r * Math.cos(lon), y: r * Math.sin(lon), M: M * R2D, w };
  }

  /** 太陽の赤道座標単位ベクトル（観測日の分点） */
  function sunEq(jd) {
    const d = jd - 2451543.5;
    const s = sunEcl(d);
    return { vec: normalize(eclToEq(s.x, s.y, 0, d)), lon: s.lon, dist: s.r };
  }

  const PLANETS = [
    { id: 'mercury', ja: '水星', mag: 0.0, color: '#c9b8a8',
      el: (d) => [48.3313 + 3.24587e-5 * d, 7.0047 + 5e-8 * d, 29.1241 + 1.01444e-5 * d, 0.387098, 0.205635 + 5.59e-10 * d, 168.6562 + 4.0923344368 * d] },
    { id: 'venus', ja: '金星', mag: -4.0, color: '#fff3d0',
      el: (d) => [76.6799 + 2.4659e-5 * d, 3.3946 + 2.75e-8 * d, 54.891 + 1.38374e-5 * d, 0.72333, 0.006773 - 1.302e-9 * d, 48.0052 + 1.6021302244 * d] },
    { id: 'mars', ja: '火星', mag: 0.5, color: '#ff8a65',
      el: (d) => [49.5574 + 2.11081e-5 * d, 1.8497 - 1.78e-8 * d, 286.5016 + 2.92961e-5 * d, 1.523688, 0.093405 + 2.516e-9 * d, 18.6021 + 0.5240207766 * d] },
    { id: 'jupiter', ja: '木星', mag: -2.2, color: '#ffe3b3',
      el: (d) => [100.4542 + 2.76854e-5 * d, 1.303 - 1.557e-7 * d, 273.8777 + 1.64505e-5 * d, 5.20256, 0.048498 + 4.469e-9 * d, 19.895 + 0.0830853001 * d] },
    { id: 'saturn', ja: '土星', mag: 0.6, color: '#f0dca0',
      el: (d) => [113.6634 + 2.3898e-5 * d, 2.4886 - 1.081e-7 * d, 339.3939 + 2.97661e-5 * d, 9.55475, 0.055546 - 9.499e-9 * d, 316.967 + 0.0334442282 * d] },
  ];

  function jupiterM(d) { return 19.895 + 0.0830853001 * d; }
  function saturnM(d) { return 316.967 + 0.0334442282 * d; }

  function planetEq(p, jd) {
    const d = jd - 2451543.5;
    const [N, i, w, a, e, Mdeg] = p.el(d);
    const M = norm360(Mdeg) * D2R;
    const E = solveKepler(M, e);
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv);
    const r = Math.hypot(xv, yv);
    const vw = v + w * D2R;
    const xh = r * (cosd(N) * Math.cos(vw) - sind(N) * Math.sin(vw) * cosd(i));
    const yh = r * (sind(N) * Math.cos(vw) + cosd(N) * Math.sin(vw) * cosd(i));
    const zh = r * Math.sin(vw) * sind(i);
    let lon = Math.atan2(yh, xh) * R2D;
    let lat = Math.atan2(zh, Math.hypot(xh, yh)) * R2D;
    if (p.id === 'jupiter' || p.id === 'saturn') {
      const Mj = jupiterM(d), Ms = saturnM(d);
      if (p.id === 'jupiter') {
        lon += -0.332 * sind(2 * Mj - 5 * Ms - 67.6) - 0.056 * sind(2 * Mj - 2 * Ms + 21) +
          0.042 * sind(3 * Mj - 5 * Ms + 21) - 0.036 * sind(Mj - 2 * Ms) +
          0.022 * cosd(Mj - Ms) + 0.023 * sind(2 * Mj - 3 * Ms + 52) - 0.016 * sind(Mj - 5 * Ms - 69);
      } else {
        lon += 0.812 * sind(2 * Mj - 5 * Ms - 67.6) - 0.229 * cosd(2 * Mj - 4 * Ms - 2) +
          0.119 * sind(Mj - 2 * Ms - 3) + 0.046 * sind(2 * Mj - 6 * Ms - 69) + 0.014 * sind(Mj - 3 * Ms + 32);
        lat += -0.02 * cosd(2 * Mj - 4 * Ms - 2) + 0.018 * sind(2 * Mj - 6 * Ms - 49);
      }
    }
    const xh2 = r * cosd(lat) * cosd(lon);
    const yh2 = r * cosd(lat) * sind(lon);
    const zh2 = r * sind(lat);
    const s = sunEcl(d);
    const g = [xh2 + s.x, yh2 + s.y, zh2];
    return { vec: normalize(eclToEq(g[0], g[1], g[2], d)), dist: Math.hypot(g[0], g[1], g[2]) };
  }

  /** 月の赤道座標単位ベクトル(地心)・距離(地球半径)・月の黄経 */
  function moonEq(jd) {
    const d = jd - 2451543.5;
    const N = 125.1228 - 0.0529538083 * d;
    const i = 5.1454;
    const w = 318.0634 + 0.1643573223 * d;
    const a = 60.2666;
    const e = 0.0549;
    const Mm = norm360(115.3654 + 13.0649929509 * d);
    const E = solveKepler(Mm * D2R, e);
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv);
    let r = Math.hypot(xv, yv);
    const vw = v + w * D2R;
    const xh = r * (cosd(N) * Math.cos(vw) - sind(N) * Math.sin(vw) * cosd(i));
    const yh = r * (sind(N) * Math.cos(vw) + cosd(N) * Math.sin(vw) * cosd(i));
    const zh = r * Math.sin(vw) * sind(i);
    let lon = Math.atan2(yh, xh) * R2D;
    let lat = Math.atan2(zh, Math.hypot(xh, yh)) * R2D;

    const s = sunEcl(d);
    const Ms = s.M;
    const Ls = s.w + Ms;
    const Lm = N + w + Mm;
    const D = Lm - Ls;
    const F = Lm - N;
    lon += -1.274 * sind(Mm - 2 * D) + 0.658 * sind(2 * D) - 0.186 * sind(Ms) -
      0.059 * sind(2 * Mm - 2 * D) - 0.057 * sind(Mm - 2 * D + Ms) + 0.053 * sind(Mm + 2 * D) +
      0.046 * sind(2 * D - Ms) + 0.041 * sind(Mm - Ms) - 0.035 * sind(D) - 0.031 * sind(Mm + Ms) -
      0.015 * sind(2 * F - 2 * D) + 0.011 * sind(Mm - 4 * D);
    lat += -0.173 * sind(F - 2 * D) - 0.055 * sind(Mm - F - 2 * D) - 0.046 * sind(Mm + F - 2 * D) +
      0.033 * sind(F + 2 * D) + 0.017 * sind(2 * Mm + F);
    r += -0.58 * cosd(Mm - 2 * D) - 0.46 * cosd(2 * D);

    const x = r * cosd(lat) * cosd(lon);
    const y = r * cosd(lat) * sind(lon);
    const z = r * sind(lat);
    return { vec: normalize(eclToEq(x, y, z, d)), dist: r, lon: norm360(lon) };
  }

  /** 月・惑星・太陽を地平座標で返す */
  function solarSystem(frame) {
    const jd = frame.jd;
    const out = [];
    const sun = sunEq(jd);
    const sv = applyMat(frame.H, sun.vec, [0, 0, 0]);
    out.push({ id: 'sun', ja: '太陽', hor: sv, eq: sun.vec, lon: sun.lon });
    const moon = moonEq(jd);
    const mv = applyMat(frame.H, moon.vec, [0, 0, 0]);
    // 視差による見かけ位置の補正（月は地球半径の約60倍の距離）
    const alt = Math.asin(mv[2]);
    const par = Math.asin(Math.cos(alt) / moon.dist);
    const hv = mv.slice();
    const k = Math.cos(alt - par) / Math.max(1e-9, Math.cos(alt));
    hv[0] *= k; hv[1] *= k; hv[2] = Math.sin(alt - par);
    const hn = normalize(hv);
    const elong = Math.acos(Math.max(-1, Math.min(1, moon.vec[0] * sun.vec[0] + moon.vec[1] * sun.vec[1] + moon.vec[2] * sun.vec[2])));
    out.push({
      id: 'moon', ja: '月', hor: hn, eq: moon.vec, elong,
      illum: (1 - Math.cos(elong)) / 2,
      age: norm360(moon.lon - sun.lon) / 12.190749,
    });
    for (const p of PLANETS) {
      const pe = planetEq(p, jd);
      out.push({ id: p.id, ja: p.ja, mag: p.mag, color: p.color, hor: applyMat(frame.H, pe.vec, [0, 0, 0]), eq: pe.vec });
    }
    return out;
  }

  /** 太陽の高度(度) */
  function sunAltitude(ms, lat, lon) {
    const fr = makeFrame(ms, lat, lon);
    return Math.asin(applyMat(fr.H, sunEq(fr.jd).vec, [0, 0, 0])[2]) * R2D;
  }

  function moonAltitude(ms, lat, lon) {
    const fr = makeFrame(ms, lat, lon);
    const m = moonEq(fr.jd);
    const v = applyMat(fr.H, m.vec, [0, 0, 0]);
    const alt = Math.asin(v[2]);
    return (alt - Math.asin(Math.cos(alt) / m.dist)) * R2D;
  }

  /** 指定の高度しきい値を横切る時刻を探す（dayStart〜+24h を5分刻みで走査） */
  function crossings(altFn, dayStart, threshold) {
    const step = 5 * 60000;
    const rises = [], sets = [];
    let prevT = dayStart, prev = altFn(prevT) - threshold;
    for (let t = dayStart + step; t <= dayStart + 86400000; t += step) {
      const cur = altFn(t) - threshold;
      if ((prev < 0) !== (cur < 0)) {
        const x = prevT + (step * (0 - prev)) / (cur - prev);
        (cur >= 0 ? rises : sets).push(x);
      }
      prevT = t; prev = cur;
    }
    return { rises, sets };
  }

  /** その日(JST 0:00〜24:00)の日の出入り・薄明・月の出入り */
  function dayEvents(dayStartMs, lat, lon) {
    const sunAlt = (t) => sunAltitude(t, lat, lon);
    const sr = crossings(sunAlt, dayStartMs, -0.833);
    const at = crossings(sunAlt, dayStartMs, -18);
    const mr = crossings((t) => moonAltitude(t, lat, lon), dayStartMs, -0.3);
    return {
      sunrise: sr.rises[0] ?? null,
      sunset: sr.sets[0] ?? null,
      duskEnd: at.sets[0] ?? null,   // 天文薄明終了 = 空が完全に暗くなる
      dawnStart: at.rises[0] ?? null, // 天文薄明開始 = 明るくなり始める
      moonrise: mr.rises[0] ?? null,
      moonset: mr.sets[0] ?? null,
      sunAltAtDay: sunAlt(dayStartMs + 43200000),
    };
  }

  window.Astro = {
    D2R, R2D, norm360, raDecToVec, makeFrame, applyMat, horToAzAlt,
    solarSystem, sunAltitude, dayEvents, PLANETS,
  };
})();
