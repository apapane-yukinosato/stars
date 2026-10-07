# 星空ラボ

**公開サイト（GitHub Pages）: <https://apapane-yukinosato.github.io/stars/>**

トップページ（`index.html`）から、次のシミュレーターへ移動できます。

- **星空シミュレーター**（[`sky.html`](https://apapane-yukinosato.github.io/stars/sky.html)）
- **北極星の移り変わり**（[`pole-star.html`](https://apapane-yukinosato.github.io/stars/pole-star.html)）
- **惑星の位置図**（[`planets.html`](https://apapane-yukinosato.github.io/stars/planets.html)）: 好きな日の太陽系を上から見る。次の衝・最大離角
- **惑星の動きと逆行**（[`retro.html`](https://apapane-yukinosato.github.io/stars/retro.html)）: 毎日同じ時刻に観測した惑星の見かけの動き。火星の逆行ループなど全惑星
- **月の満ち欠けカレンダー**（[`moon.html`](https://apapane-yukinosato.github.io/stars/moon.html)）: 月齢・月の出入り・新月/満月の日時
- **太陽の動きとアナレンマ**（[`sun.html`](https://apapane-yukinosato.github.io/stars/sun.html)）: 日の出入り・昼の長さ・均時差・夏至冬至
- **流星群カレンダー**（[`meteor.html`](https://apapane-yukinosato.github.io/stars/meteor.html)）: 極大の夜の月明かりと放射点の高さ
- **光で旅する宇宙**（[`scale.html`](https://apapane-yukinosato.github.io/stars/scale.html)）: 光速で進んだときの到達時間

## アプリとして追加する（ホーム画面・Dock）

サイトは Web アプリ（PWA）として追加でき、追加後はページ間のリンクもアプリの中で開きます（Safari に切り替わりません）。

- **iPhone / iPad**: Safari で開き、共有ボタン →「ホーム画面に追加」
- **Mac（Safari）**: メニューの「ファイル」→「Dock に追加」
- **Chrome / Edge**: アドレスバーの「インストール」アイコン

すでに追加済みの場合は、いったん削除してから追加し直してください（追加時の設定が古いまま残るため）。外部サイト（d3-celestial の GitHub など）へのリンクだけは、ブラウザで開きます。

## 星空シミュレーター（`sky.html`）

今夜の星座や、日本各地で見える星空をブラウザ上で再現する静的Webページです（GitHub Pages でそのまま公開できます）。ビルド不要・外部ライブラリなし・通信はページの読み込みのみです。

## できること

- **全天図 / 広角ビュー**の切り替え（広角はドラッグで見回し、ホイール・ピンチで拡大縮小）
- **日時（日本時間）と場所**を自由に変更。主要13都市のほか「現在地を使う」にも対応
- **スマホの向きで見る**: スマホ（縦・横どちらも）の背面を向けた方向の星空を、ジャイロとコンパスで表示（画面上の「📱 向きで見る」）
- 恒星約5,000個（6等星まで）、88星座の星座線と名前（日本語）、明るい星の名前、天の川
- **太陽・月（満ち欠け付き）・水星〜土星**の位置、黄道、方位／赤道座標の目盛
- 日の出・日の入り、空が完全に暗くなる時刻、月の出入り、月齢
- **いま見える星座**の一覧（タップでその星座へ移動）
- 空の暗さ（市街地／郊外／暗い場所）、昼・薄明の空の明るさの再現
- 時間の再生（1分/秒 〜 1日/秒）でそのまま星の動きを観察

### スマホの向きで見る（星空シミュレーター）

スマホのブラウザ（またはホーム画面に追加したアプリ）で `sky.html` を開き、「📱 向きで見る」を押すと、スマホの背面を向けた方向の星空が表示されます。横向きにして使うこともできます。

- iPhone では、初回に「モーションと方向」へのアクセス許可を求められます（許可してください）
- 画面は向けた方向の星空に合わせて動きます。ピンチで拡大・縮小できます
- スマホの**画面の回転ロックがオンのままでも**、横向きに構えると、アプリが画面全体を自動で横向きに回します（センサー中のみ）
- 方位が少しずれるときは、下の「◀ 3°」「3° ▶」で合わせます。コンパスがうまく働かないときは、スマホを8の字に動かすと改善することがあります
- 日本付近では、磁気偏角（東京で約7.5°）を自動で補正しています
- 時刻は現在、場所は現在地（許可した場合）で表示します。センサーの使用中は画面が消えないようにします（対応する端末）
- 金属や磁石、電子機器の近くでは、コンパスが乱れることがあります
- 表示が崩れるなど不具合の調査には、URL の末尾に `?debug=1` を付けて開くと、表示サイズ・向き・センサーの状態が画面の隅に表示されます

## 北極星の移り変わり（`pole-star.html`）

歳差運動による天の北極の移動を、紀元前4000年〜西暦22000年の範囲で再現する別ページです。古代ギリシャ時代の北の空、現在のポラリス、将来の北極星候補（アルデラミン、ベガなど）を見比べられます。計算は Vondrák ら（2011）の長期歳差モデルによります（星の固有運動は含みません）。

## 構成

| パス | 内容 |
| --- | --- |
| `manifest.webmanifest`, `js/nav.js`, `assets/icons/` | アプリ追加用の設定・アイコン・アプリ内遷移 |
| `index.html`, `css/top.css`, `assets/` | トップページ（各シミュレーターへのリンク）とサムネイル |
| `sky.html`, `css/style.css` | 星空シミュレーターの画面とスタイル |
| `pole-star.html`, `css/pole.css`, `js/pole.js`, `js/precession.js` | 北極星の移り変わりページ |
| `planets.html`, `retro.html`, `moon.html`, `sun.html`, `meteor.html`, `scale.html`, `css/pages.css`, `js/{planets,retro,moon,sun,meteor,scale}.js` | 追加の各ページ |
| `js/sensor.js` | スマホの向きセンサー（ジャイロ・コンパス）から視線方向を求める |
| `js/astro.js` | 恒星時・歳差・太陽/月/惑星の位置・月相・日の出入りの計算 |
| `js/app.js` | 描画（Canvas）と操作 |
| `data/sky-data.js` | 星表・星座線・天の川（`tools/build_data.py` で生成） |
| `tools/build_data.py` | 元データから `data/sky-data.js` を作り直すスクリプト |

データを作り直す場合: `python3 tools/build_data.py`（インターネット接続が必要）

## 精度について

恒星は J2000.0 の位置に歳差を適用しています。月・惑星は簡易的な軌道計算式（Schlyter）で、位置誤差は惑星で数分角、月で約0.1〜0.3°程度です。大気差（屈折）は考慮していません。肉眼での観察・学習用途を想定しています。

## ライセンス

星表などのデータは [d3-celestial](https://github.com/ofrohn/d3-celestial)（BSD-3-Clause）に由来します。詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。
