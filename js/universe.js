/* 宇宙のはじまりから現在まで */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const FONT = 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif';
  const YR = 3.156e7;           // 1年の秒数
  const R0 = 4.4e26;            // 現在の観測可能な宇宙の半径 [m]（約465億光年）
  const LY = 9.461e15;          // 1光年 [m]
  const LOGMIN = -44, LOGMAX = Math.log10(13.8e9 * YR); // 表示する時間の範囲 [秒, 常用対数]
  const SLIDER_MAX = 1000;

  // ================= 宇宙モデル（標準的な ΛCDM の近似） =================
  const T_ANCHORS = [[-44, 32.5], [-36, 28.5], [-32, 27], [-12, 15], [-5, 12.3], [0, 10], [1, 9.5], [2.26, 8.95], [12.2, 3.98], [13.08, 3.48]]; // [log10 t(s), log10 T(K)]
  const T_REC = 3.8e5 * YR;     // 宇宙の晴れ上がり
  function aLate(t) {           // 物質とダークエネルギーの時代のスケール因子（今=1）
    const H0inv = 14.44e9 * YR, tau = 0.96e5 * YR;
    const x = 1.5 * Math.sqrt(0.685) * (t + tau) / H0inv;
    return Math.pow(0.315 / 0.685, 1 / 3) * Math.pow(Math.sinh(x), 2 / 3);
  }
  const A_NOW = aLate(13.8e9 * YR);
  function logT(t) {
    if (t >= T_REC) return Math.log10(2.725 * A_NOW / aLate(t));
    const lt = Math.log10(t);
    for (let i = 1; i < T_ANCHORS.length; i++) {
      if (lt <= T_ANCHORS[i][0]) { const [x0, y0] = T_ANCHORS[i - 1], [x1, y1] = T_ANCHORS[i]; return y0 + (y1 - y0) * (lt - x0) / (x1 - x0); }
    }
    return T_ANCHORS[T_ANCHORS.length - 1][1];
  }
  const aOf = (t) => (t >= T_REC ? aLate(t) / A_NOW : 2.725 / Math.pow(10, logT(t)));
  /** 観測可能な範囲の半径 [m] の常用対数。インフレーション前は null */
  function logR(t) {
    if (t < 1e-36) return null;
    if (t < 1e-32) { const f = (t - 1e-36) / (1e-32 - 1e-36); return (Math.log10(R0) + Math.log10(2.725) - 27) + (-26 + 26 * f); } // t に対して指数的に成長
    return Math.log10(R0 * aOf(t));
  }
  /** エネルギー密度の割合 [放射, 物質(ダークマター含む), ダークエネルギー] */
  function fractions(t) {
    const a = aOf(t), m = 0.315 * a ** -3, r = 9.2e-5 * a ** -4, l = 0.685, s = m + r + l;
    return [r / s, m / s, l / s];
  }

  // ================= 表記 =================
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');
  function sci(x, digits = 1) {
    if (x === 0) return '0';
    const e = Math.floor(Math.log10(x)); const m = x / Math.pow(10, e);
    const mm = m.toFixed(digits) === '10.0' ? '1.0' : m.toFixed(digits);
    return `${mm}×10${sup(m.toFixed(digits) === '10.0' ? e + 1 : e)}`;
  }
  function fmtTime(t) {
    if (t < 1e-3) return `${sci(t)} 秒`;
    if (t < 1) return `${t.toPrecision(2)} 秒`;
    if (t < 60) return `${t < 10 ? t.toFixed(1) : Math.round(t)} 秒`;
    if (t < 3600) return `${Math.round(t / 60)} 分`;
    if (t < 86400) return `${Math.round(t / 3600)} 時間`;
    if (t < YR) return `${Math.round(t / 86400)} 日`;
    const y = t / YR;
    if (y < 1e4) return `${y < 100 ? y.toFixed(y < 10 ? 1 : 0) : Math.round(y)} 年`.replace('.0 ', ' ');
    if (y < 1e8) return `${(y / 1e4) < 100 ? (y / 1e4).toFixed(1).replace('.0', '') : Math.round(y / 1e4)} 万年`;
    return `${(y / 1e8) < 100 ? (y / 1e8).toFixed(1).replace('.0', '') : Math.round(y / 1e8)} 億年`;
  }
  function fmtTemp(lt) {
    const T = Math.pow(10, lt);
    if (T >= 1e4) return `${sci(T)} K`;
    if (T >= 100) return `約 ${Math.round(T).toLocaleString('ja-JP')} K`;
    return `${T.toFixed(T < 10 ? 2 : 1)} K（${(T - 273.15).toFixed(0)}℃）`;
  }
  const SIZE_NAMES = [[1e-15, '陽子（約10⁻¹⁵ m）より'], [1, '人の背丈'], [1.3e7, '地球の直径'], [1.4e9, '太陽の直径'], [1.5e11, '地球と太陽の距離（1天文単位）'], [4.5e12, '太陽系（海王星の軌道）'], [LY, '1光年'], [4e16, '最も近い恒星までの距離（約4光年）'], [LY * 1e5, '天の川銀河の大きさ（約10万光年）'], [LY * 1e7, '銀河が集まった「銀河群」'], [LY * 1e9, '10億光年（超銀河団より大きい）'], [LY * 4.65e10, '現在の観測可能な宇宙']];
  function sizeText(lr) {
    if (lr === null) return '極めて小さい（現在の物理学では扱えない）';
    const R = Math.pow(10, lr);
    let txt;
    if (R < 1e2) txt = R < 0.01 ? `${sci(R)} m` : `${R.toPrecision(2)} m`;
    else if (R < 1e3) txt = `${Math.round(R)} m`;
    else if (R < LY * 0.5) txt = `${sci(R)} m`;
    else if (R < LY * 1e4) txt = `${(R / LY) >= 100 ? Math.round(R / LY).toLocaleString('ja-JP') : (R / LY).toFixed(1)} 光年`;
    else txt = `${(R / LY / 1e8) >= 1 ? (R / LY / 1e8).toFixed(1) + ' 億光年' : (R / LY / 1e4).toFixed(R / LY / 1e4 < 100 ? 1 : 0) + ' 万光年'}`;
    let best = SIZE_NAMES[0], bd = 1e9;
    for (const s of SIZE_NAMES) { const d = Math.abs(Math.log10(R) - Math.log10(s[0])); if (d < bd) { bd = d; best = s; } }
    const rel = R < best[0] * 0.5 ? 'より小さい' : R > best[0] * 2 ? 'より大きい' : 'ほど';
    return { txt, cmp: best[1] + (best[1].endsWith('より') ? (R < best[0] ? '小さい' : '大きい') : rel === 'ほど' ? 'ほど' : rel) };
  }

  // ================= 時代の定義 =================
  const E = (o) => o;
  const EPOCHS = [
    E({ id: 'planck', name: 'プランク時代', sn: 'プランク', t0: 1e-44, range: '誕生〜10⁻⁴³秒', cert: ['hyp', '仮説（現在の理論では記述できない）'], color: '#c9a0ff',
      cap: '時間と空間が量子の泡のように揺らぐ。「特異点」は、ここで理論が使えなくなる点。',
      sum: '宇宙のはじまり。この極限の領域では、時間と空間そのものが量子的に揺らぎ、一般相対性理論と量子論のどちらか一方だけでは説明できません。',
      b: ['<b>特異点</b>: 一般相対性理論だけで過去へさかのぼると、密度や温度が無限大になる「特異点」に行き着きます。ただし、この極限では量子効果が無視できず、理論そのものが成り立ちません。本当に特異点があったのかは分かっていません。',
        'ビッグバンは「どこかが爆発した」のではなく、<b>空間そのものが膨張</b>していくこと。中心や外側があるわけではありません。',
        '4つの力（重力・強い力・弱い力・電磁気力）は、一つの力だったと考えられています。',
        '解き明かすには「量子重力理論」（超弦理論やループ量子重力理論など）が必要で、まだ完成していません。'] }),
    E({ id: 'gut', name: '大統一時代', sn: '大統一', t0: 1e-43, range: '10⁻⁴³〜10⁻³⁶秒', cert: ['hyp', '仮説'], color: '#b48cff',
      cap: '重力が分かれ、残りの3つの力は「大統一力」として一つだったと考えられている。',
      sum: '重力が他の力から分かれた時代。強い力・弱い力・電磁気力は、まだ一つの力（大統一力）だったと考えられています。',
      b: ['温度は10²⁸ K（1000京度の1000倍以上）以上。',
        '3つの力の統一を説明する<b>大統一理論</b>は、有力な候補ですが、まだ実験で確かめられていません（予言される陽子の崩壊が見つかっていない）。',
        '10⁻³⁶秒ごろに「強い力」が分かれ、このとき解放された莫大なエネルギーが、次のインフレーションを引き起こしたとする考え方があります。'] }),
    E({ id: 'inflation', name: 'インフレーション', sn: 'インフレ', t0: 1e-36, range: '10⁻³⁶〜10⁻³²秒ごろ', cert: ['good', '有力な理論（直接の証拠は未発見）'], color: '#7ec8ff',
      cap: '宇宙が指数関数的に、一瞬で10²⁶倍以上に膨れ上がる。小さなゆらぎも一緒に引き伸ばされた。',
      sum: 'ほんの一瞬のあいだに、宇宙が少なくとも10²⁶倍（原子1個が太陽系になる以上）に急激に膨張した、という理論です。',
      b: ['宇宙のどこでも温度がほぼ同じ（<b>一様</b>）で、空間がほぼ平らである理由を、うまく説明できます。',
        'もともとは極微の領域にあった<b>量子のゆらぎ</b>が引き伸ばされ、後の銀河や銀河団の「種」になりました。',
        '光より速く空間が広がっても、物や情報が光速を超えたわけではありません（空間そのものの膨張）。',
        '終わるとき、莫大なエネルギーが粒子と光に変わり（<b>再加熱</b>）、高温の火の玉の宇宙＝いわゆる「ビッグバン」になりました。',
        '宇宙背景放射の温度ゆらぎの分布は、この理論の予測とよく合っています。直接の証拠になる「原始重力波」は、まだ見つかっていません。'] }),
    E({ id: 'ew', name: '電弱時代・物質の誕生', sn: '電弱', t0: 1e-32, range: '10⁻³²〜10⁻¹²秒', cert: ['good', '一部は実験で確認（ヒッグス粒子）'], color: '#ffb36b',
      cap: '粒子と反粒子のペアが生まれては消える。ごくわずかな物質が残った。最後にヒッグス場が働き、粒子に質量が生まれる。',
      sum: '再加熱された高温の粒子のスープの時代。物質がわずかに多く残り、最後にヒッグス場の働きで、粒子が質量を持ちました。',
      b: ['<b>物質と反物質のわずかな差</b>: 反物質10億個に対して物質10億＋1個ほどの割合で、物質が多く残ったとされます。その差が、いまの星・銀河・私たちの材料です。なぜ差が生まれたのかは未解明です。',
        '10⁻¹²秒ごろ、<b>ヒッグス場</b>の働き（電弱対称性の破れ）で、素粒子が質量を持ち、弱い力と電磁気力が分かれました。',
        'この時代のエネルギー（約10¹⁵ K）は、大型ハドロン衝突型加速器（LHC）で再現できます。2012年にヒッグス粒子が発見されました。'] }),
    E({ id: 'quark', name: 'クォーク時代', sn: 'クォーク', t0: 1e-12, range: '10⁻¹²〜10⁻⁵秒', cert: ['ok', '加速器の実験で再現・確認'], color: '#ff8f8f',
      cap: 'クォークとグルーオンが、閉じ込められずに飛び回る「クォーク・グルーオン・プラズマ」。',
      sum: '宇宙全体が、クォークとグルーオンの熱いスープ（クォーク・グルーオン・プラズマ）でした。',
      b: ['クォークは、まだ陽子や中性子の中に閉じ込められず、自由に飛び回っていました。',
        '温度は約10¹⁵ K〜10¹² K。',
        '重イオン衝突実験（RHIC・LHC）で、この状態が小さな領域で実際に作り出され、液体のようにふるまうことが分かっています。'] }),
    E({ id: 'hadron', name: 'ハドロン時代', sn: 'ハドロン', t0: 1e-5, range: '10⁻⁵〜1秒', cert: ['ok', '理論と実験でよく理解されている'], color: '#ffd166',
      cap: '冷えたクォークが3個ずつ結びつき、陽子と中性子ができる。反粒子とペアで消え、わずかな物質が残る。',
      sum: '宇宙が冷えて、クォークが3個ずつ閉じ込められ、陽子と中性子（ハドロン）ができました。',
      b: ['約10⁻⁵秒（約2×10¹² K）で、クォークが結合して<b>陽子・中性子</b>が誕生。',
        '粒子と反粒子の多くはペアで消滅（<b>対消滅</b>）し、光になりました。生き残ったわずかな物質が、いまの宇宙の物質のすべてです。',
        '約1秒で、ニュートリノが他の物質とほとんど反応しなくなり、自由に飛び出しました（宇宙ニュートリノ背景）。',
        '中性子は陽子より少し重いため、その数の比はこの時期に約1：6となり、後のヘリウムの量を決めました。'] }),
    E({ id: 'lepton', name: 'レプトン時代', sn: 'レプトン', t0: 1, range: '1〜10秒', cert: ['ok', '理論でよく理解されている'], color: '#9be8b0',
      cap: '電子と陽電子が対消滅して光になり、わずかな電子だけが残る。ニュートリノは自由に飛び去る。',
      sum: '温度が約100億Kまで下がり、電子と陽電子がほぼ全て対消滅して、光（光子）になりました。',
      b: ['わずかに余った電子が、後に原子を作る材料になります。',
        'このときに出たエネルギーで光子が増えたため、現在の宇宙背景放射（約2.7 K）は、ニュートリノ背景（約1.9 K）より少し高温です。'] }),
    E({ id: 'bbn', name: '原子核の合成（ビッグバン元素合成）', sn: '元素合成', t0: 10, range: '10秒〜20分（おもに3分ごろ）', cert: ['ok', '観測で確認'], color: '#7ee2a1',
      cap: '陽子と中性子が結びつき、重水素を経てヘリウム4ができる。水素約75%、ヘリウム約25%（質量比）。',
      sum: '宇宙が約10億Kまで冷えると、陽子と中性子が結びついて、ヘリウムなどの軽い原子核ができました。',
      b: ['陽子＋中性子→<b>重水素</b>→<b>ヘリウム4</b>。約3分で重水素が壊れにくくなり、一気に合成が進みました。',
        '結果は、質量の比で<b>水素約75％・ヘリウム約25％</b>、ごく微量の重水素・ヘリウム3・リチウム7。',
        'この比率は、遠い宇宙の古いガスの観測と、よく一致します（ビッグバンの強い証拠）。',
        '炭素や酸素など、より重い元素は、ここでは作られません。のちに星の中や超新星爆発、中性子星の合体で作られます。',
        'リチウム7だけは、理論の予測が観測より多く、未解決の「リチウム問題」です。'] }),
    E({ id: 'photon', name: '光と物質のプラズマ時代', sn: 'プラズマ', t0: 1200, range: '20分〜38万年', cert: ['ok', '観測で確認'], color: '#ff9c5c',
      cap: '電子と原子核がバラバラのプラズマ。光は電子にぶつかり続け、霧の中のように直進できない。',
      sum: '宇宙全体が高温のプラズマ（電子と原子核がバラバラの状態）で、光が電子にぶつかり続けて、遠くまで進めませんでした。',
      b: ['宇宙は、明るく熱いものの、<b>光が通り抜けられない「霧」</b>の状態でした。',
        '約5万年のころ、物質のエネルギーが光（放射）のエネルギーを上回り、<b>物質が主役の宇宙</b>になりました。',
        '<b>ダークマター</b>は光と反応しないため、先に重力で集まり始め、のちの銀河の骨組み（重力の「くぼみ」）を作りました。'] }),
    E({ id: 'recomb', name: '宇宙の晴れ上がり', sn: '晴れ上がり', t0: 1.2e13, range: '約38万年', cert: ['ok', '観測で直接確認'], color: '#ffd9a8',
      cap: '電子が原子核に捕まって原子ができ、光が直進できるように。この光が宇宙背景放射として、いまも届く。',
      sum: '温度が約3000 Kまで下がると、電子が原子核に捕まって水素などの原子ができ、光がまっすぐ進めるようになりました。',
      b: ['このときに放たれた光が、宇宙のあらゆる方向から届く<b>宇宙背景放射（CMB）</b>です。',
        '宇宙の膨張で引き伸ばされ、いまは約2.7 K（波長約2 mm）のマイクロ波として観測されます。',
        '1964年にペンジアスとウィルソンが偶然発見し、のちに COBE・WMAP・プランク衛星が精密に観測しました。',
        '温度ゆらぎは10万分の1ほど。この小さな濃淡が、銀河の「種」でした。'] }),
    E({ id: 'dark', name: '暗黒時代', sn: '暗黒', t0: 3.156e13, range: '100万年〜1.5億年ごろ', cert: ['good', '理論（直接の観測はこれから）'], color: '#6b7fd7',
      cap: '星も銀河もまだない。ダークマターの網の目に、水素ガスがゆっくり集まっていく。',
      sum: 'まだ光る天体がなく、宇宙は暗いままでした。その間に、重力が少しずつ物質を集めていきました。',
      b: ['<b>ダークマター</b>の濃い場所に、水素ガスが落ち込んで、雲の塊ができていきました。',
        'この時代は光が出ないため、観測は難しいですが、水素が出す電波（21 cm線）を、将来の電波望遠鏡（SKAなど）で調べる計画があります。'] }),
    E({ id: 'first', name: '宇宙の夜明け（最初の星と銀河）', sn: '夜明け', t0: 4.7e15, range: '1.5億〜10億年ごろ', cert: ['good', '観測が始まったばかり'], color: '#8fd0ff',
      cap: '最初の星が輝き、その紫外線で周りの水素が再びイオン化。電離した泡が広がり、宇宙が再び透明になっていく。',
      sum: '宇宙で最初の星が生まれ、その光で、周りの水素ガスが再び電離しました（再電離）。',
      b: ['<b>最初の星</b>は、水素とヘリウムだけでできていて、とても重く、短い寿命で超新星爆発を起こし、初めて重い元素を宇宙にまきました。',
        '星の紫外線で水素が電離し、<b>電離した泡</b>が広がって、宇宙は10億年ごろまでに再び透明になりました（再電離）。',
        'ジェイムズ・ウェッブ宇宙望遠鏡は、誕生から約3億年後（現在の年齢の約2％）の銀河まで見つけています。'] }),
    E({ id: 'galaxy', name: '銀河の成長と大規模構造', sn: '銀河', t0: 3.156e16, range: '10億〜75億年ごろ', cert: ['ok', '観測で確認'], color: '#c8a2ff',
      cap: '銀河が合体・成長しながら、泡のような網の目「宇宙の大規模構造」を作る。',
      sum: '重力で銀河が集まって成長し、銀河団や、網の目状の大規模構造ができていきました。',
      b: ['銀河が合体を繰り返して大きくなり、<b>銀河団</b>や、フィラメントと空洞が連なる<b>宇宙の大規模構造</b>ができました。',
        '星が最も盛んに作られたのは、誕生から約30億〜40億年のころ（約100億年前）です。',
        '星の誕生と超新星爆発で、炭素・酸素・鉄など、重い元素がだんだん増えていきました。'] }),
    E({ id: 'accel', name: '加速膨張のはじまり', sn: '加速', t0: 2.37e17, range: '75億〜90億年ごろ', cert: ['ok', '観測で確認（正体は不明）'], color: '#ff9cd6',
      cap: '遠い銀河は、ますます速く遠ざかる。約78億年のころ、膨張が減速から加速に転じた。',
      sum: 'それまで重力で膨張にブレーキがかかっていた宇宙は、約78億年のころ（約60億年前）から、膨張が加速する宇宙になりました。',
      b: ['原因とされるのは、正体不明の<b>ダークエネルギー</b>。宇宙のエネルギーの約68％を占めます。',
        '1990年代末に、遠い超新星の観測で発見されました（2011年ノーベル物理学賞）。',
        '膨張で物質の密度が薄まる一方、ダークエネルギーは薄まらず、相対的に勢力を増しました。'] }),
    E({ id: 'solar', name: '太陽系の誕生', sn: '太陽系', t0: 2.84e17, range: '約92億年（約46億年前）', cert: ['ok', '隕石などの年代測定で確認'], color: '#ffd86b',
      cap: 'ガスと塵の雲が収縮し、中心に太陽、周りの円盤から惑星が生まれる。',
      sum: '宇宙の誕生から約92億年たったころ、ガスと塵の雲から、太陽と惑星が生まれました。',
      b: ['材料の重い元素は、<b>それ以前に生まれて死んだ星々</b>が作ったものです。',
        '約46億年前に太陽系ができ、地球は約45億年前に誕生しました。',
        '宇宙の年齢の3分の2が過ぎてから、ようやく私たちの太陽系が生まれたことになります。'] }),
    E({ id: 'now', name: '現在の宇宙', sn: '現在', t0: 3.06e17, range: '約97億年〜現在（138億年）', cert: ['ok', '観測で確認'], color: '#ffffff',
      cap: '宇宙のエネルギーの約68%がダークエネルギー、約27%がダークマター、私たちの知る物質は約5%。',
      sum: '生命が生まれ、138億年後のいま、私たちは宇宙を観測しています。',
      b: ['最古の生命の痕跡は約38億年前（宇宙の年齢が約100億歳のころ）。',
        '現在の観測できる宇宙は、半径約465億光年（光が宇宙の年齢ぶん旅しても、空間の膨張でそれ以上に遠くなった）。',
        '宇宙の中身は、<b>ダークエネルギー約68％・ダークマター約27％・通常の物質（星や私たち）約5％</b>。私たちが知っているのは、宇宙のごく一部です。',
        '宇宙背景放射の温度は、2.725 K。'] }),
  ];
  EPOCHS.forEach((e, i) => { e.lt0 = Math.log10(e.t0); e.lt1 = i + 1 < EPOCHS.length ? Math.log10(EPOCHS[i + 1].t0) : LOGMAX; });
  EPOCHS[0].lt0 = LOGMIN;
  const JUMPS = [['インフレーション', 1e-34], ['クォーク', 1e-9], ['陽子・中性子', 1e-3], ['原子核の合成（3分）', 180], ['晴れ上がり（38万年）', 1.2e13], ['最初の星', 6e15], ['太陽系の誕生', 2.9e17], ['現在', 13.8e9 * YR]];

  // ================= 状態 =================
  const state = { v: 0, playing: false, speed: 24 };
  // スライダーの位置: 各時代の幅は時間の桁数に比例させるが、短い時代でも一定以上の幅を確保する
  const VPOS = (function () {
    const MIN = 3.2, spans = EPOCHS.map((e) => Math.max(e.lt1 - e.lt0, MIN)), tot = spans.reduce((a, b) => a + b, 0);
    const pos = [0]; spans.forEach((sp, i) => pos.push(pos[i] + (sp / tot) * SLIDER_MAX));
    return pos;
  })();
  const vToLog = (v) => {
    let i = 0; while (i < EPOCHS.length - 1 && v >= VPOS[i + 1]) i++;
    const f = clamp((v - VPOS[i]) / (VPOS[i + 1] - VPOS[i]), 0, 1);
    return lerp(EPOCHS[i].lt0, EPOCHS[i].lt1, f);
  };
  const logToV = (lt) => {
    let i = 0; while (i < EPOCHS.length - 1 && lt >= EPOCHS[i + 1].lt0) i++;
    const f = clamp((lt - EPOCHS[i].lt0) / (EPOCHS[i].lt1 - EPOCHS[i].lt0), 0, 1);
    return lerp(VPOS[i], VPOS[i + 1], f);
  };
  const epochAt = (lt) => { let k = 0; for (let i = 0; i < EPOCHS.length; i++) if (lt >= EPOCHS[i].lt0 - 1e-9) k = i; return k; };

  // ================= 描画共通 =================
  function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const rnd = mulberry(20261101);
  const PTS = Array.from({ length: 260 }, () => ({ x: rnd(), y: rnd(), a: rnd() * 6.283, s: 0.4 + rnd() * 0.8, k: rnd(), c: Math.floor(rnd() * 3) }));
  function setup(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(cv.width / w, 0, 0, cv.height / h, 0, 0);
    return { ctx, w, h };
  }
  function txt(ctx, s, x, y, size, color, align = 'center', bold = false) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    const maxW = (ctx.canvas.clientWidth || 9999) - 14, mw = ctx.measureText(s).width;
    if (mw > maxW) { size = Math.max(9, size * maxW / mw); ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`; }
    if (align === 'center') x = clamp(x, ctx.measureText(s).width / 2 + 7, (ctx.canvas.clientWidth || 9999) - ctx.measureText(s).width / 2 - 7);
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(3,6,16,0.85)'; ctx.strokeText(s, x, y);
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  function glowColor(lt) { // 温度に応じた背景の光の色
    const S = [[32, [255, 255, 255]], [14, [255, 255, 250]], [11, [255, 238, 200]], [9.5, [255, 205, 140]], [8.5, [255, 160, 90]], [7, [220, 100, 50]], [4, [170, 60, 30]], [3.5, [140, 40, 25]], [3, [60, 20, 20]], [0.5, [5, 8, 18]]];
    for (let i = 1; i < S.length; i++) if (lt >= S[i][0]) { const t = (lt - S[i][0]) / (S[i - 1][0] - S[i][0]); return S[i][1].map((c, k) => lerp(c, S[i - 1][1][k], t)); }
    return S[S.length - 1][1];
  }
  function backdrop(ctx, w, h, lt, strength = 0.55) {
    ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, w, h);
    const c = glowColor(lt), a = lt > 3 ? strength : strength * clamp((lt - 0.5) / 2.5, 0, 1) * 0.5;
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.65);
    g.addColorStop(0, `rgba(${c.map(Math.round).join(',')},${a})`); g.addColorStop(1, 'rgba(5,7,15,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  const dot = (ctx, x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, Math.max(0.4, r), 0, 6.2832); ctx.fill(); };
  const QC = ['#ff5a5a', '#5aff8a', '#5a8aff'];

  // ================= 各時代の図 =================
  const DRAW = {
    planck(ctx, w, h, p, tm) {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.2;
      ctx.strokeStyle = 'rgba(200,170,255,0.55)'; ctx.lineWidth = 1.3;
      for (let i = 0; i < 90; i++) {
        const q = PTS[i], a = q.a + tm * (0.6 + q.s), r = R * (0.15 + q.k * 0.95) * (1 + 0.18 * Math.sin(tm * 3 + q.a * 5));
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * 0.55 * q.s, cy + Math.sin(a) * R * 0.55 * q.s, r * 0.28, 0, 6.2832); ctx.stroke();
      }
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, 6.2832); ctx.fill();
      txt(ctx, 't = 0 ?', cx, cy + R * 2.0, 16, '#e8d8ff', 'center', true);
      txt(ctx, '時間も空間も、量子的にゆらいでいる', cx, cy + R * 2.0 + 24, 13, '#cdb8ff');
    },
    gut(ctx, w, h, p, tm) {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.22;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(180,140,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, 6.2832); ctx.fill();
      for (let i = 0; i < 70; i++) { const q = PTS[i], a = q.a + tm * 0.8 * q.s, r = R * (0.2 + q.k); dot(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, 1.6, 'rgba(255,255,255,0.9)'); }
      // 力のラベル: 重力は最初に分かれ、強い力は終わりに分かれる
      const items = [['重力', '#c9a0ff', true], ['強い力', '#ff8f8f', p > 0.85], ['弱い力', '#9be8b0', false], ['電磁気力', '#ffd166', false]];
      txt(ctx, '重力は分かれた', cx, cy - R * 2.0, 15, '#c9a0ff', 'center', true);
      txt(ctx, p < 0.85 ? '強い力・弱い力・電磁気力は一つ（大統一力）' : '強い力が分かれ始める…', cx, cy + R * 2.0, 14, p < 0.85 ? '#fff' : '#ff8f8f');
      void items;
    },
    inflation(ctx, w, h, p, tm) {
      const cx = w / 2, cy = h / 2, maxR = Math.min(w, h) * 0.46;
      const r = maxR * Math.pow(10, -2.6 * (1 - p)) ; // 指数的に成長（見やすさのため圧縮表示）
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(180,220,255,0.55)'); g.addColorStop(1, 'rgba(90,150,255,0.18)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(160,210,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
      // 量子ゆらぎ: 引き伸ばされて濃淡の模様になる
      const amp = lerp(0.2, 1, p);
      for (let i = 0; i < 160; i++) { const q = PTS[i], a = q.a, rr = Math.sqrt(q.k) * r * 0.95; dot(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1 + q.s * 3.2 * amp * (r / maxR + 0.2), `rgba(255,255,255,${0.12 + 0.35 * q.s * amp})`); }
      const factor = Math.round(26 * p);
      txt(ctx, `約 10${sup(factor)} 倍に膨張`, cx, cy - maxR - 4 < 14 ? 16 : 18, 15, '#bfe3ff', 'center', true);
      txt(ctx, '小さなゆらぎも一緒に引き伸ばされる', cx, h - 22, 13, '#cfe8ff');
    },
    ew(ctx, w, h, p, tm) {
      const earlyP = clamp(p / 0.8, 0, 1);
      if (p < 0.82) {
        // 粒子(青)と反粒子(赤)のペアが消える。物質がわずかに残る。
        const n = 110;
        for (let i = 0; i < n; i++) {
          const q = PTS[i], x = (q.x + 0.06 * Math.sin(tm * q.s + q.a)) * w, y = (q.y + 0.06 * Math.cos(tm * q.s * 1.1 + q.a)) * h;
          const gone = q.k < earlyP * 0.94;
          if (!gone) { dot(ctx, x, y, 4.2, i % 2 ? '#ff7a7a' : '#6ea8ff'); }
          else if (q.k < earlyP * 0.94 + 0.04 && i % 2 === 0) { ctx.strokeStyle = 'rgba(255,230,150,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke(); }
        }
        for (let i = 0; i < 9; i++) { const q = PTS[120 + i]; dot(ctx, q.x * w, q.y * h, 4.8, '#6ea8ff'); }
        txt(ctx, '粒子（青）と反粒子（赤）がペアで消え、物質がわずかに残る', w / 2, h - 22, 13, '#ffe8c8');
      } else {
        const f = clamp((p - 0.82) / 0.18, 0, 1);
        ctx.fillStyle = `rgba(255,200,120,${0.16 * f})`; ctx.fillRect(0, 0, w, h);
        for (let gx = 0; gx < 26; gx++) for (let gy = 0; gy < 16; gy++) dot(ctx, (gx + 0.5) * w / 26, (gy + 0.5) * h / 16, 1.2, `rgba(255,210,140,${0.55 * f})`);
        for (let i = 0; i < 40; i++) { const q = PTS[i], sp = lerp(1, 0.25, f) * q.s; dot(ctx, ((q.x + tm * 0.05 * sp) % 1) * w, q.y * h, lerp(3, 6, f * q.k), '#6ea8ff'); }
        txt(ctx, 'ヒッグス場が満ちて、粒子に質量が生まれる', w / 2, 22, 14, '#ffe8c8', 'center', true);
        txt(ctx, '（光速で飛んでいた粒子が、動きにくくなる）', w / 2, h - 22, 13, '#ffe8c8');
      }
    },
    quark(ctx, w, h, p, tm) {
      for (let i = 0; i < 120; i++) {
        const q = PTS[i], x = (q.x + 0.05 * Math.sin(tm * 3 * q.s + q.a)) * w, y = (q.y + 0.05 * Math.cos(tm * 3.3 * q.s + q.a)) * h;
        dot(ctx, x, y, 5, QC[q.c]);
        if (i % 6 === 0) { const q2 = PTS[(i + 7) % 120]; ctx.strokeStyle = 'rgba(255,230,120,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 1; k <= 6; k++) ctx.lineTo(lerp(x, q2.x * w, k / 6) + (k % 2 ? 4 : -4), lerp(y, q2.y * h, k / 6)); ctx.stroke(); }
      }
      txt(ctx, '色つきの点: クォーク（赤・緑・青の3色）／黄色の線: グルーオン', w / 2, h - 22, 13, '#ffd6d6');
      txt(ctx, 'クォーク・グルーオン・プラズマ', w / 2, 22, 15, '#ffd6d6', 'center', true);
    },
    hadron(ctx, w, h, p, tm) {
      const clump = clamp((p - 0.25) / 0.6, 0, 1);
      for (let i = 0; i < 120; i += 3) {
        const q = PTS[i], cx = (q.x + 0.03 * Math.sin(tm * q.s + q.a)) * w, cy = (q.y + 0.03 * Math.cos(tm * q.s + q.a)) * h;
        const bound = q.k < clump;
        for (let j = 0; j < 3; j++) {
          const ang = j * 2.094 + tm * 0.8, rr = bound ? 7 : 7 + (1 - clump) * 38 * (0.6 + PTS[i + j].k);
          dot(ctx, cx + Math.cos(ang + PTS[i + j].a * (bound ? 0 : 1)) * rr, cy + Math.sin(ang + PTS[i + j].a * (bound ? 0 : 1)) * rr, 4, QC[j]);
        }
        if (bound) { ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.55)' : 'rgba(180,180,200,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 6.2832); ctx.stroke(); }
      }
      txt(ctx, '3つのクォークが結びつく ＝ 陽子・中性子', w / 2, h - 22, 13, '#fff0c0');
      txt(ctx, '反粒子とのペアは消え、わずかな物質が残る', w / 2, 22, 14, '#fff0c0', 'center', true);
    },
    lepton(ctx, w, h, p, tm) {
      const n = 60;
      for (let i = 0; i < n; i++) {
        const q = PTS[i], x = (q.x + 0.04 * Math.sin(tm * q.s + q.a)) * w, y = (q.y + 0.04 * Math.cos(tm * q.s + q.a)) * h;
        if (q.k > p * 0.97) { dot(ctx, x, y, 4.2, i % 2 ? '#7ec8ff' : '#ff9a9a'); }
        else if (q.k > p * 0.97 - 0.07) { ctx.strokeStyle = 'rgba(255,240,170,0.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 10, y); for (let k = 1; k <= 6; k++) ctx.lineTo(x - 10 + k * 3.4, y + (k % 2 ? -4 : 4)); ctx.stroke(); }
      }
      for (let i = 0; i < 26; i++) { const q = PTS[100 + i], x = ((q.x + tm * 0.12 * q.s) % 1) * w; ctx.strokeStyle = 'rgba(200,200,220,0.5)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x - 24, q.y * h); ctx.lineTo(x, q.y * h); ctx.stroke(); ctx.setLineDash([]); }
      txt(ctx, '電子（青）と陽電子（赤）は対消滅して光（黄色）に', w / 2, h - 40, 13, '#d6ffe0');
      txt(ctx, '点線: ニュートリノは物質と反応せず、自由に飛び去る', w / 2, h - 20, 13, '#d6ffe0');
    },
    bbn(ctx, w, h, p, tm) {
      const he = clamp((p - 0.15) / 0.55, 0, 1);       // ヘリウムができた割合
      const cols = 14, rows = 8;
      for (let i = 0; i < cols * rows; i++) {
        const gx = i % cols, gy = Math.floor(i / cols), q = PTS[i], x = (gx + 0.5) * w / cols * 0.62 + w * 0.02, y = (gy + 0.5) * (h * 0.7) / rows + h * 0.06;
        const isHe = q.k < he * 0.5;
        if (isHe) { dot(ctx, x - 3, y - 3, 3.4, '#fff'); dot(ctx, x + 3, y - 3, 3.4, '#9aa0b5'); dot(ctx, x - 3, y + 3, 3.4, '#9aa0b5'); dot(ctx, x + 3, y + 3, 3.4, '#fff'); }
        else dot(ctx, x, y, 4.4, '#fff');
      }
      // 組成のバー
      const bx = w * 0.7, bw = w * 0.2, by = h * 0.1, bh = h * 0.58, heFrac = 0.25 * he;
      ctx.fillStyle = '#fff'; ctx.fillRect(bx, by + bh * heFrac, bw, bh * (1 - heFrac));
      ctx.fillStyle = '#ffd166'; ctx.fillRect(bx, by, bw, bh * heFrac);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.strokeRect(bx, by, bw, bh);
      txt(ctx, `水素 ${Math.round(100 - 25 * he)}%`, bx + bw / 2, by + bh * (heFrac + (1 - heFrac) / 2), 14, '#101830', 'center', true);
      if (he > 0.25) txt(ctx, `He ${Math.round(25 * he)}%`, bx + bw / 2, by + bh * heFrac / 2, 13, '#3a2a00', 'center', true);
      txt(ctx, '質量の比', bx + bw / 2, by - 12, 12, '#fff');
      txt(ctx, '白: 陽子 ／ 灰: 中性子 ／ 4つ組: ヘリウム4', w * 0.36, h - 42, 13, '#d6ffe6');
      txt(ctx, p < 0.4 ? '陽子と中性子が結びつき始める' : '約3分で一気に合成が進む', w * 0.36, h - 20, 14, '#d6ffe6', 'center', true);
    },
    photon(ctx, w, h, p, tm) {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6); g.addColorStop(0, `rgba(255,170,90,${0.35 - 0.2 * p})`); g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { const q = PTS[i], x = q.x * w, y = q.y * h; dot(ctx, x, y, q.c === 0 ? 5 : 2.6, q.c === 0 ? '#ffb27a' : '#7ec8ff'); }
      // 光の経路（電子にぶつかり続ける）
      ctx.strokeStyle = 'rgba(255,245,170,0.95)'; ctx.lineWidth = 2; ctx.beginPath();
      let x = w * 0.1, y = h * 0.5; ctx.moveTo(x, y);
      const steps = Math.floor(2 + 28 * ((tm * 0.35) % 1));
      for (let i = 0; i < steps; i++) { const q = PTS[120 + i]; x = clamp(x + (q.x - 0.45) * 90, 10, w - 10); y = clamp(y + (q.y - 0.5) * 90, 10, h - 10); ctx.lineTo(x, y); }
      ctx.stroke(); dot(ctx, x, y, 4, '#fffbd0');
      txt(ctx, '光は電子にぶつかり続け、まっすぐ進めない（霧の中）', w / 2, h - 22, 13, '#ffe3cc');
      txt(ctx, p > 0.55 ? '約5万年: 物質が主役の宇宙に' : '橙: 電子 ／ 青: 原子核', w / 2, 22, 14, '#ffe3cc', 'center', true);
    },
    recomb(ctx, w, h, p, tm) {
      const edge = lerp(0.12, 0.98, clamp(p * 1.15, 0, 1)) * w; // 左: 原子ができた領域（晴れ上がり）
      ctx.fillStyle = 'rgba(255,170,90,0.14)'; ctx.fillRect(edge, 0, w - edge, h);
      for (let i = 0; i < 70; i++) {
        const q = PTS[i], x = q.x * w, y = q.y * h;
        if (x < edge) { dot(ctx, x, y, 5, '#ffb27a'); ctx.strokeStyle = 'rgba(126,200,255,0.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 10, 0, 6.2832); ctx.stroke(); dot(ctx, x + 10 * Math.cos(tm * 2 + q.a), y + 10 * Math.sin(tm * 2 + q.a), 2.4, '#7ec8ff'); }
        else { dot(ctx, x, y, 4.4, '#ffb27a'); dot(ctx, x + 14 * q.s, y - 8, 2.4, '#7ec8ff'); }
      }
      for (let i = 0; i < 16; i++) { const q = PTS[100 + i], y = (0.06 + 0.88 * q.k) * h, x0 = ((tm * 0.18 * (0.6 + q.s) + q.x) % 1) * edge; ctx.strokeStyle = 'rgba(255,245,170,0.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 - 26, y); ctx.lineTo(x0, y); ctx.stroke(); }
      txt(ctx, '電子が原子核に捕まり原子に → 光が直進できる', w / 2, 22, 14, '#fff0e0', 'center', true);
      txt(ctx, 'この光が、今も届く「宇宙背景放射」', w / 2, h - 22, 13, '#fff0e0');
    },
    dark(ctx, w, h, p, tm) {
      const k = 8, n = 22; // ダークマターの網: 少しずつ濃くなる
      ctx.strokeStyle = `rgba(140,150,255,${0.12 + 0.5 * p})`; ctx.lineWidth = 1 + 2 * p;
      const nodes = Array.from({ length: n }, (_, i) => ({ x: PTS[i].x * w, y: PTS[i].y * h }));
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y); if (d < Math.min(w, h) * 0.3) { ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke(); } }
      for (let i = 0; i < n; i++) { const g = ctx.createRadialGradient(nodes[i].x, nodes[i].y, 0, nodes[i].x, nodes[i].y, 10 + 22 * p); g.addColorStop(0, `rgba(255,170,110,${0.1 + 0.4 * p})`); g.addColorStop(1, 'rgba(255,120,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(nodes[i].x, nodes[i].y, 10 + 22 * p, 0, 6.2832); ctx.fill(); }
      for (let i = 0; i < 60; i++) dot(ctx, PTS[40 + i].x * w, PTS[40 + i].y * h, 1, 'rgba(180,190,255,0.35)');
      void k;
      txt(ctx, '星はまだない。ダークマターの網（青紫）に、水素ガス（橙）が集まっていく', w / 2, h - 22, 13, '#cfd6ff');
    },
    first(ctx, w, h, p, tm) {
      for (let i = 0; i < 40; i++) { const q = PTS[i]; dot(ctx, q.x * w, q.y * h, 0.8, 'rgba(160,170,255,0.3)'); }
      const nStars = 7, R = Math.min(w, h);
      for (let i = 0; i < nStars; i++) {
        const q = PTS[200 + i], cx = (0.12 + 0.76 * q.x) * w, cy = (0.15 + 0.7 * q.y) * h, on = clamp((p * 1.4 - q.k * 0.5), 0, 1);
        if (on <= 0) continue;
        const r = R * (0.05 + 0.2 * on);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(120,180,255,0.35)'); g.addColorStop(1, 'rgba(120,180,255,0.05)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(150,200,255,0.55)'; ctx.lineWidth = 1.3; ctx.stroke();
        dot(ctx, cx, cy, 3.5 + Math.sin(tm * 3 + i) * 0.5, '#e8f4ff');
      }
      txt(ctx, '最初の星の紫外線が、周りの水素を電離させる（青い泡が広がる）', w / 2, h - 22, 13, '#d6ecff');
      txt(ctx, `宇宙の水素のイオン化: ${Math.round(100 * p)}%`, w / 2, 22, 14, '#d6ecff', 'center', true);
    },
    galaxy(ctx, w, h, p, tm) {
      const n = 26;
      const nodes = Array.from({ length: n }, (_, i) => ({ x: PTS[i].x * w, y: PTS[i].y * h }));
      ctx.strokeStyle = 'rgba(150,160,255,0.28)'; ctx.lineWidth = 2;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < Math.min(w, h) * 0.32) { ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke(); }
      for (let i = 0; i < n; i++) { const q = PTS[i], s = (3 + 11 * clamp(p * 1.3 - q.k * 0.4, 0, 1)); if (s <= 3.1) continue; ctx.save(); ctx.translate(nodes[i].x, nodes[i].y); ctx.rotate(q.a + tm * 0.1); ctx.scale(1, 0.55); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.6); g.addColorStop(0, 'rgba(255,240,200,0.95)'); g.addColorStop(0.35, 'rgba(255,220,160,0.45)'); g.addColorStop(1, 'rgba(120,150,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 1.6, 0, 6.2832); ctx.fill(); ctx.restore(); }
      for (let i = 0; i < 80; i++) dot(ctx, PTS[60 + i].x * w, PTS[60 + i].y * h, 0.9, 'rgba(255,255,255,0.35)');
      txt(ctx, '銀河が合体・成長し、網の目状の大規模構造を作る', w / 2, h - 22, 13, '#e6dcff');
    },
    accel(ctx, w, h, p, tm) {
      const cx = w * 0.5, cy = h * 0.46, Rm = Math.min(w, h) * 0.46;
      const t = lerp(7.5, 9.0, p), a = (tt) => aLate(tt * 1e9 * YR) / aLate(7.5e9 * YR);
      const s = a(t);
      for (let i = 0; i < 70; i++) { const q = PTS[i], ang = q.a, r0 = (0.08 + 0.92 * Math.sqrt(q.k)) * Rm * 0.62, r = r0 * s; if (r > Rm * 1.05) continue; dot(ctx, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 2.4, i === 0 ? '#ffd166' : 'rgba(210,225,255,0.95)'); }
      dot(ctx, cx, cy, 5, '#ffd166'); txt(ctx, '私たちの銀河', cx, cy + 16, 12, '#ffe8a8');
      // 小さなグラフ: スケール因子 a(t) の曲線
      const gx = w * 0.04, gy = h * 0.58, gw = w * 0.34, gh = h * 0.32;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.strokeRect(gx, gy, gw, gh);
      ctx.strokeStyle = '#ff9cd6'; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k <= 40; k++) { const tt = lerp(3, 13.8, k / 40), aa = aLate(tt * 1e9 * YR); const x = gx + gw * k / 40, y = gy + gh * (1 - aa); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      const mt = lerp(7.5, 9, p), mx = gx + gw * (mt - 3) / 10.8, my = gy + gh * (1 - aLate(mt * 1e9 * YR)); dot(ctx, mx, my, 4, '#fff');
      txt(ctx, '宇宙の大きさ（縦）と時間（横）', gx + gw / 2, gy - 10, 11, '#ffd0ec');
      txt(ctx, '遠い銀河ほど速く、しかもますます速く遠ざかる', w / 2, h - 18, 13, '#ffe3f1');
    },
    solar(ctx, w, h, p, tm) {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.42);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, 'rgba(255,200,120,0.5)'); g.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.2832); ctx.fill(); ctx.restore();
      const planets = [[0.22, 4, '#c9b8a8'], [0.32, 6, '#fff3d0'], [0.42, 6, '#6ea8ff'], [0.54, 5, '#ff8a65'], [0.7, 11, '#ffe3b3'], [0.86, 9, '#f0dca0'], [0.97, 7, '#a8e6ef']];
      planets.forEach(([f, s, col], i) => {
        const on = clamp(p * 1.6 - i * 0.12, 0, 1); if (on <= 0) return;
        ctx.strokeStyle = `rgba(200,210,255,${0.3 * on})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, R * f, R * f * 0.42, 0, 0, 6.2832); ctx.stroke();
        const a = tm * (0.6 / (f + 0.2)) + i * 1.3; dot(ctx, cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f * 0.42, s * 0.5 * on + 1, col);
      });
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24); sg.addColorStop(0, 'rgba(255,240,180,1)'); sg.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, 24, 0, 6.2832); ctx.fill();
      txt(ctx, p < 0.4 ? 'ガスと塵の円盤が回り、中心に太陽が輝き始める' : '円盤の中で惑星が育つ（宇宙の年齢が約92億年のころ）', w / 2, h - 22, 13, '#fff1c8');
    },
    now(ctx, w, h, p, tm) {
      const cx = w * 0.5, cy = h * 0.46, R = Math.min(w, h) * 0.36;
      const parts = [[0.685, '#ff9cd6', 'ダークエネルギー 約68%'], [0.265, '#8f9bff', 'ダークマター 約27%'], [0.05, '#ffd166', '通常の物質 約5%']];
      let a0 = -Math.PI / 2;
      parts.forEach(([f, col, label]) => {
        const a1 = a0 + f * 6.2832; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
        const am = (a0 + a1) / 2; const lx = cx + Math.cos(am) * (R + 12), ly = cy + Math.sin(am) * (R + 12);
        txt(ctx, label, clamp(lx, 90, w - 90), ly + (Math.sin(am) > 0 ? 12 : -12), 12.5, '#fff', Math.cos(am) > 0.3 ? 'left' : Math.cos(am) < -0.3 ? 'right' : 'center', true);
        a0 = a1;
      });
      ctx.fillStyle = '#05070f'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.46, 0, 6.2832); ctx.fill();
      txt(ctx, '138億年', cx, cy - 8, 17, '#fff', 'center', true); txt(ctx, 'いまの宇宙', cx, cy + 12, 12, '#cfd8ff');
      txt(ctx, '私たちの知っている物質は、宇宙のごく一部', w / 2, h - 18, 13, '#fff');
    },
  };

  // ================= 画面の更新 =================
  const cvIllu = $('cvIllu');
  function render(tm) {
    const lt = vToLog(state.v), t = Math.pow(10, lt), ei = epochAt(lt), ep = EPOCHS[ei];
    const p = clamp((lt - ep.lt0) / (ep.lt1 - ep.lt0), 0, 1);
    const { ctx, w, h } = setup(cvIllu);
    const lT = logT(t);
    backdrop(ctx, w, h, lT, ei <= 4 ? 0.7 : 0.55);
    (DRAW[ep.id] || (() => {}))(ctx, w, h, p, tm);
    drawLine(); drawGraphs(lt); drawTree(lt);
  }

  function updateText(force) {
    const lt = vToLog(state.v), t = Math.pow(10, lt), ei = epochAt(lt), ep = EPOCHS[ei];
    $('timeLabel').textContent = state.v >= SLIDER_MAX ? '138億年（現在）' : `誕生から ${fmtTime(t)}`;
    $('epochLabel').textContent = ep.name;
    if (force || updateText.last !== ei) {
      updateText.last = ei;
      $('eName').textContent = ep.name; $('eRange').textContent = `時期: ${ep.range}`;
      $('eSummary').textContent = ep.sum;
      $('eBullets').innerHTML = ep.b.map((x) => `<li>${x}</li>`).join('');
      const c = $('cert'); c.className = 'cert ' + ep.cert[0]; c.textContent = ep.cert[1];
      $('illuCap').textContent = ep.cap;
      document.querySelectorAll('#jumps button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.ei) === ei)));
    }
    const lT = logT(t), lr = logR(t), sz = sizeText(lr), fr = t < 1e-32 ? null : fractions(t);
    const stats = [
      ['誕生からの時間', fmtTime(t), t >= 3.156e16 ? `現在から約 ${fmtTime(13.8e9 * YR - t)} 前` : ''],
      ['温度', fmtTemp(lT), t < 1e-32 && t >= 1e-36 ? 'インフレーション後に再加熱（モデルにより異なる）' : ''],
      ['いま見えている範囲の大きさ（半径）', typeof sz === 'string' ? sz : sz.txt, typeof sz === 'string' ? '' : `${sz.cmp}の大きさ`],
    ];
    $('stats').innerHTML = stats.map(([a, b, c]) => `<div class="stat"><span>${a}</span><b>${b}</b><small>${c || '&nbsp;'}</small></div>`).join('');
    // 宇宙の中身
    const cb = $('compbar'), cl = $('complegend');
    let parts;
    if (fr === null) parts = [['インフラトン場（インフレーションを起こすエネルギー）', 1, '#7ec8ff']];
    else parts = [['放射（光・ニュートリノ）', fr[0], '#ffb36b'], ['物質（ダークマター＋通常の物質）', fr[1], '#8f9bff'], ['ダークエネルギー', fr[2], '#ff9cd6']];
    if (t < 1e-36) parts = [['極めて高温の「統一された」エネルギー（詳細は不明）', 1, '#c9a0ff']];
    cb.innerHTML = parts.map(([n, f, c]) => `<i style="width:${(f * 100).toFixed(2)}%;background:${c}" title="${n} ${(f * 100).toFixed(1)}%"></i>`).join('');
    cl.innerHTML = parts.map(([n, f, c]) => `<span style="--c:${c}">${n} ${f >= 0.9995 ? '100' : (f * 100).toFixed(f < 0.01 ? 2 : 1)}%</span>`).join('');
  }

  // ---- 年表バー ----
  const cvLine = $('cvLine');
  function drawLine() {
    const { ctx, w, h } = setup(cvLine);
    ctx.clearRect(0, 0, w, h);
    const x0 = 6, x1 = w - 6, X = (lt) => x0 + (logToV(lt) / SLIDER_MAX) * (x1 - x0);
    const by = 34, bh = 42;
    EPOCHS.forEach((e, i) => {
      const a = X(e.lt0), b = X(e.lt1);
      ctx.fillStyle = e.color; ctx.globalAlpha = i === epochAt(vToLog(state.v)) ? 0.95 : 0.55; ctx.fillRect(a, by, Math.max(1, b - a - 1), bh); ctx.globalAlpha = 1;
      ctx.font = `600 11px ${FONT}`;
      const tw = ctx.measureText(e.sn).width;
      if (b - a > tw + 6) { ctx.fillStyle = '#0a1020'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.sn, (a + b) / 2, by + bh / 2); }
    });
    const ticks = [[-40, '10⁻⁴⁰秒'], [-30, '10⁻³⁰'], [-20, '10⁻²⁰'], [-10, '10⁻¹⁰'], [0, '1秒'], [Math.log10(3600), '1時間'], [Math.log10(YR), '1年'], [Math.log10(1e4 * YR), '1万年'], [Math.log10(1e6 * YR), '100万年'], [Math.log10(1e8 * YR), '1億年'], [Math.log10(1e10 * YR), '100億年']];
    ctx.font = `10.5px ${FONT}`; ctx.fillStyle = 'rgba(160,180,230,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    let lastX = -99;
    ticks.forEach(([lt, l]) => { const x = X(lt); ctx.strokeStyle = 'rgba(160,180,230,0.5)'; ctx.beginPath(); ctx.moveTo(x, by + bh); ctx.lineTo(x, by + bh + 5); ctx.stroke(); if (x - lastX > 44) { ctx.fillText(l, clamp(x, 24, w - 24), by + bh + 7); lastX = x; } });
    const cx = X(vToLog(state.v));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, by - 12); ctx.lineTo(cx, by + bh + 4); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(cx - 6, by - 14); ctx.lineTo(cx + 6, by - 14); ctx.lineTo(cx, by - 4); ctx.closePath(); ctx.fill();
  }

  // ---- 温度と大きさのグラフ ----
  function graph(cv, f, ymin, ymax, ylabel, yticks, lt) {
    const { ctx, w, h } = setup(cv);
    ctx.fillStyle = '#060b1c'; ctx.fillRect(0, 0, w, h);
    const box = [46, 12, w - 12, h - 28], pw = box[2] - box[0], ph = box[3] - box[1];
    const X = (x) => box[0] + ((x - LOGMIN) / (LOGMAX - LOGMIN)) * pw, Y = (y) => box[3] - ((y - ymin) / (ymax - ymin)) * ph;
    ctx.font = `10.5px ${FONT}`; ctx.fillStyle = 'rgba(160,180,230,0.85)'; ctx.strokeStyle = 'rgba(140,170,255,0.12)'; ctx.lineWidth = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [[-40, '10⁻⁴⁰'], [-20, '10⁻²⁰'], [0, '1秒'], [Math.log10(YR), '1年'], [Math.log10(1e9 * YR), '10億年']].forEach(([x, l]) => { ctx.beginPath(); ctx.moveTo(X(x), box[1]); ctx.lineTo(X(x), box[3]); ctx.stroke(); ctx.fillText(l, X(x), box[3] + 6); });
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    yticks.forEach(([y, l]) => { ctx.beginPath(); ctx.moveTo(box[0], Y(y)); ctx.lineTo(box[2], Y(y)); ctx.stroke(); ctx.fillText(l, box[0] - 5, Y(y)); });
    ctx.strokeStyle = 'rgba(160,180,230,0.5)'; ctx.strokeRect(box[0], box[1], pw, ph);
    // 時代の色帯
    EPOCHS.forEach((e) => { ctx.fillStyle = e.color; ctx.globalAlpha = 0.14; ctx.fillRect(X(e.lt0), box[1], X(e.lt1) - X(e.lt0), ph); ctx.globalAlpha = 1; });
    ctx.strokeStyle = '#ffb36b'; ctx.lineWidth = 2.4; ctx.beginPath(); let started = false;
    for (let k = 0; k <= 300; k++) { const x = LOGMIN + (LOGMAX - LOGMIN) * k / 300, y = f(Math.pow(10, x)); if (y === null) continue; started ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); started = true; }
    ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(X(lt), box[1]); ctx.lineTo(X(lt), box[3]); ctx.stroke(); ctx.setLineDash([]);
    const yy = f(Math.pow(10, lt)); if (yy !== null) { dot(ctx, X(lt), Y(yy), 5, '#fff'); }
    ctx.save(); ctx.translate(12, (box[1] + box[3]) / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = 'rgba(160,180,230,0.9)'; ctx.textAlign = 'center'; ctx.fillText(ylabel, 0, 0); ctx.restore();
  }
  function drawGraphs(lt) {
    graph($('cvT'), (t) => logT(t), 0, 33, '温度 [K]', [[0, '1'], [5, '10⁵'], [10, '10¹⁰'], [15, '10¹⁵'], [20, '10²⁰'], [25, '10²⁵'], [30, '10³⁰']], lt);
    graph($('cvR'), (t) => logR(t), -27, 28, '範囲の半径 [m]', [[-25, '10⁻²⁵'], [-15, '10⁻¹⁵'], [0, '1 m'], [10, '10¹⁰'], [16, '1光年'], [26, '10²⁶']], lt);
  }

  // ---- 力の分岐図 ----
  function drawTree(lt) {
    const { ctx, w, h } = setup($('cvTree'));
    ctx.fillStyle = '#060b1c'; ctx.fillRect(0, 0, w, h);
    const x0 = 24, x1 = w - 150, X = (x) => x0 + ((x - LOGMIN) / (-2 - LOGMIN)) * (x1 - x0);
    const yG = h * 0.18, yS = h * 0.4, yW = h * 0.62, yE = h * 0.84;
    const lines = [
      ['重力', yG, '#c9a0ff', -43.3, null], ['強い力', yS, '#ff8f8f', -36, null], ['弱い力', yW, '#9be8b0', -12, null], ['電磁気力', yE, '#ffd166', -12, null]];
    ctx.lineWidth = 3;
    // 幹: 統一された力
    const yU = (yG + yE) / 2;
    ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(X(LOGMIN), yU); ctx.lineTo(X(-43.3), yU); ctx.stroke();
    ctx.strokeStyle = '#c9a0ff'; ctx.beginPath(); ctx.moveTo(X(-43.3), yU); ctx.lineTo(X(-43.3), yG); ctx.lineTo(x1, yG); ctx.stroke();
    ctx.strokeStyle = '#d0b0ff'; ctx.beginPath(); ctx.moveTo(X(-43.3), yU); ctx.lineTo(X(-36), yU); ctx.stroke();
    ctx.strokeStyle = '#ff8f8f'; ctx.beginPath(); ctx.moveTo(X(-36), yU); ctx.lineTo(X(-36), yS); ctx.lineTo(x1, yS); ctx.stroke();
    ctx.strokeStyle = '#ffcf8a'; ctx.beginPath(); ctx.moveTo(X(-36), yU); ctx.lineTo(X(-12), yU); ctx.stroke();
    ctx.strokeStyle = '#9be8b0'; ctx.beginPath(); ctx.moveTo(X(-12), yU); ctx.lineTo(X(-12), yW); ctx.lineTo(x1, yW); ctx.stroke();
    ctx.strokeStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(X(-12), yU); ctx.lineTo(X(-12), yE); ctx.lineTo(x1, yE); ctx.stroke();
    ctx.lineWidth = 1;
    lines.forEach(([n, y, c]) => txt(ctx, n, x1 + 8, y, 14, c, 'left', true));
    if (w > 560) {
      txt(ctx, '一つの力', X(-43.8) + 36, yU - 14, 12, '#fff', 'center');
      txt(ctx, '大統一力', X(-40), yU - 14, 12, '#d0b0ff', 'center');
    }
    txt(ctx, '電弱力', X(-24), yU - 14, 12, '#ffcf8a', 'center');
    [[-43.3, '10⁻⁴³秒'], [-36, '10⁻³⁶秒'], [-12, '10⁻¹²秒']].forEach(([x, l]) => { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(X(x), 10); ctx.lineTo(X(x), h - 22); ctx.stroke(); ctx.setLineDash([]); txt(ctx, l, X(x), h - 10, 11, '#cfd8ff'); });
    const mx = X(Math.min(lt, -2));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, 6); ctx.lineTo(mx, h - 22); ctx.stroke(); ctx.lineWidth = 1;
    if (lt > -2) txt(ctx, '以降は4つの力のまま', x1 - 60, h - 38, 11, '#cfd8ff');
  }

  // ================= 操作 =================
  const slider = $('slider');
  function setV(v, fromUser) { state.v = clamp(Math.round(v), 0, SLIDER_MAX); slider.value = String(state.v); updateText(false); if (fromUser) stop(); }
  slider.addEventListener('input', () => setV(Number(slider.value), true));
  function stop() { state.playing = false; $('play').setAttribute('aria-pressed', 'false'); $('play').textContent = '▶ 自動で進める'; }
  $('play').addEventListener('click', () => {
    if (state.playing) { stop(); return; }
    if (state.v >= SLIDER_MAX) setV(0);
    state.playing = true; $('play').setAttribute('aria-pressed', 'true'); $('play').textContent = '⏸ 一時停止';
  });
  $('speed').addEventListener('change', (e) => { state.speed = Number(e.target.value); });
  function gotoEpoch(i) { i = clamp(i, 0, EPOCHS.length - 1); const e = EPOCHS[i]; setV(logToV(lerp(e.lt0, e.lt1, 0.35)), true); }
  $('prev').addEventListener('click', () => { const lt = vToLog(state.v), ei = epochAt(lt), e = EPOCHS[ei]; gotoEpoch(lt - e.lt0 > 0.08 * (e.lt1 - e.lt0) ? ei : ei - 1); });
  $('next').addEventListener('click', () => gotoEpoch(epochAt(vToLog(state.v)) + 1));
  JUMPS.forEach(([label, t]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.ei = String(epochAt(Math.log10(t)));
    b.addEventListener('click', () => setV(logToV(Math.log10(t)), true));
    $('jumps').appendChild(b);
  });
  // 年表バーのクリック・ドラッグ
  let drag = false;
  const lineV = (e) => { const r = cvLine.getBoundingClientRect(); return clamp(((e.clientX - r.left - 6) / (r.width - 12)) * SLIDER_MAX, 0, SLIDER_MAX); };
  cvLine.addEventListener('pointerdown', (e) => { drag = true; cvLine.setPointerCapture(e.pointerId); setV(lineV(e), true); });
  cvLine.addEventListener('pointermove', (e) => { if (drag) setV(lineV(e), true); });
  cvLine.addEventListener('pointerup', () => { drag = false; });
  cvLine.addEventListener('pointercancel', () => { drag = false; });

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (state.playing) {
      state.v = Math.min(SLIDER_MAX, state.v + dt * state.speed); slider.value = String(Math.round(state.v));
      if (state.v >= SLIDER_MAX) stop();
      updateText(false);
    }
    render(now / 1000);
    requestAnimationFrame(loop);
  }
  // 目盛りラベルを実際の位置に配置
  (function () {
    const sc = document.querySelector('.scale'); if (!sc) return;
    sc.style.position = 'relative'; sc.style.display = 'block'; sc.style.height = '1.6em';
    const pos = [LOGMIN, Math.log10(1), Math.log10(YR), Math.log10(1e6 * YR), LOGMAX];
    [...sc.children].forEach((el, i) => { const f = logToV(pos[i]) / SLIDER_MAX; el.style.position = 'absolute'; el.style.left = (f * 100) + '%'; el.style.transform = i === 0 ? 'none' : i === 4 ? 'translateX(-100%)' : 'translateX(-50%)'; el.style.whiteSpace = 'nowrap'; if (i === 3) el.className = 'hide-narrow'; if (i === 4) el.textContent = '現在（138億年）'; });
  })();
  const q = new URLSearchParams(location.search).get('v');
  if (q !== null && Number.isFinite(Number(q))) state.v = clamp(Number(q), 0, SLIDER_MAX);
  slider.value = String(state.v);
  updateText(true);
  requestAnimationFrame(loop);
  window.__universe = { state, EPOCHS, logT, logR, fractions, fmtTime, epochAt, vToLog, logToV, setV };
})();
