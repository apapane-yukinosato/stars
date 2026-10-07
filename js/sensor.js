/* スマホの向き（ジャイロ・コンパス）から、スマホの背面が向いている方向を求める。
 * 地球座標は (東, 北, 天頂)。W3C DeviceOrientation の R = Rz(alpha)·Rx(beta)·Ry(gamma) を使う。
 * 画面の向き（縦・横）は screen.orientation.angle で補正する。 */
(function () {
  'use strict';
  var D = Math.PI / 180;

  function mul(a, b) {
    var o = new Array(9);
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return o;
  }
  function apply(R, v) {
    return [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
  }
  function rotMatrix(alpha, beta, gamma) {
    var a = alpha * D, b = beta * D, g = gamma * D;
    var cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
    var Rz = [cA, -sA, 0, sA, cA, 0, 0, 0, 1];
    var Rx = [1, 0, 0, 0, cB, -sB, 0, sB, cB];
    var Ry = [cG, 0, sG, 0, 1, 0, -sG, 0, cG];
    return mul(Rz, mul(Rx, Ry));
  }
  function norm(v) { var n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

  /** 背面が向く方向 f と、画面の上方向 u（地球座標）。angle は画面の回転角（度） */
  function basis(alpha, beta, gamma, angle) {
    var R = rotMatrix(alpha, beta, gamma), a = angle * D;
    return { f: apply(R, [0, 0, -1]), u: apply(R, [Math.sin(a), Math.cos(a), 0]), top: apply(R, [0, 1, 0]) };
  }
  /** 方位を delta 度（時計回り）だけ回す */
  function yaw(v, delta) {
    var c = Math.cos(delta * D), s = Math.sin(delta * D);
    return [v[0] * c + v[1] * s, -v[0] * s + v[1] * c, v[2]];
  }
  function azimuth(v) { return ((Math.atan2(v[0], v[1]) / D) + 360) % 360; }
  function wrap180(x) { return ((x % 360) + 540) % 360 - 180; }
  /** f と u から直交基底 {f, r, u} を作る（r = f × u: 画面の右） */
  function ortho(f, u) {
    f = norm(f);
    var uu = norm([u[0] - dot(u, f) * f[0], u[1] - dot(u, f) * f[1], u[2] - dot(u, f) * f[2]]);
    return { f: f, u: uu, r: cross(f, uu) };
  }
  /** 日本付近の磁気偏角の概算（度, 東が正）。東京 −7.5°、札幌 −9.3°、那覇 −5.1° 付近 */
  function declination(lat, lon) {
    if (lon < 122 || lon > 154 || lat < 20 || lat > 46) return 0;
    return -7.5 - 0.25 * (lat - 35.7);
  }
  function screenAngle() {
    try {
      if (window.screen && screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
    } catch (e) { /* 取得できない環境 */ }
    return typeof window.orientation === 'number' ? window.orientation : 0;
  }

  /** センサーの制御。onUpdate(basis) が向きの更新ごとに呼ばれる */
  function Controller(opts) {
    this.opts = opts;
    this.on = false;
    this.f = null; this.u = null;
    this.delta = null;      // 方位補正（磁気偏角＋iOSの基準合わせ）
    this.trim = 0;          // 手動の微調整
    this.mode = '';         // absolute / ios / gyro
    this.count = 0;
    this._h = null;
  }
  Controller.prototype.start = function () {
    var self = this;
    var DOE = window.DeviceOrientationEvent;
    if (!DOE) return Promise.reject(new Error('unsupported'));
    // iOS 13+ は、ユーザー操作の中で許可を求める必要がある
    var perm = typeof DOE.requestPermission === 'function' ? DOE.requestPermission() : Promise.resolve('granted');
    return perm.then(function (r) {
      if (r !== 'granted') throw new Error('denied');
      self.on = true; self.count = 0; self.f = null; self.delta = null;
      self._abs = function (e) { self._event(e, true); };
      self._rel = function (e) { self._event(e, false); };
      window.addEventListener('deviceorientationabsolute', self._abs, true);
      window.addEventListener('deviceorientation', self._rel, true);
    });
  };
  Controller.prototype.stop = function () {
    this.on = false;
    window.removeEventListener('deviceorientationabsolute', this._abs, true);
    window.removeEventListener('deviceorientation', this._rel, true);
  };
  Controller.prototype._event = function (e, abs) {
    if (!this.on || e.alpha == null || e.beta == null || e.gamma == null) return;
    // 絶対方位のイベントが来る端末では、通常のイベントは使わない
    if (!abs && this.mode === 'absolute') return;
    var b = basis(e.alpha, e.beta, e.gamma, screenAngle());
    var lat = this.opts.lat(), lon = this.opts.lon();
    var decl = declination(lat, lon);
    var target = this.delta;
    var heading = typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0 ? e.webkitCompassHeading : null;
    if (abs || e.absolute === true) {
      this.mode = 'absolute'; target = decl;
    } else if (heading !== null) {
      this.mode = 'ios';
      // 縦に構えているときは背面、寝かせているときは上端が向く方位がコンパス値になる
      var hb = Math.hypot(b.f[0], b.f[1]), ht = Math.hypot(b.top[0], b.top[1]);
      var ref = hb >= ht ? b.f : b.top;
      target = wrap180(heading + decl - azimuth(ref));
    } else if (this.mode !== 'absolute' && this.mode !== 'ios') {
      this.mode = 'gyro'; if (target === null) target = 0;
    }
    if (target === null) return;
    // 方位補正をなめらかに追従（円周上で平均）
    this.delta = this.delta === null ? target : this.delta + wrap180(target - this.delta) * 0.15;
    var d = this.delta + this.trim;
    var f = yaw(b.f, d), u = yaw(b.u, d);
    if (this.f) {
      var k = 0.35;
      f = norm([this.f[0] + (f[0] - this.f[0]) * k, this.f[1] + (f[1] - this.f[1]) * k, this.f[2] + (f[2] - this.f[2]) * k]);
      u = norm([this.u[0] + (u[0] - this.u[0]) * k, this.u[1] + (u[1] - this.u[1]) * k, this.u[2] + (u[2] - this.u[2]) * k]);
    }
    this.f = f; this.u = u; this.count++;
    this.opts.onUpdate(ortho(f, u), this);
  };

  window.StarSensor = { Controller: Controller, basis: basis, yaw: yaw, ortho: ortho, azimuth: azimuth, declination: declination, rotMatrix: rotMatrix };
})();
