#!/usr/bin/env python3
"""d3-celestial (BSD-3-Clause, (c) 2015 Olaf Frohn) のデータから data/sky-data.js を生成する。

使い方:  python3 tools/build_data.py
元データは https://github.com/ofrohn/d3-celestial/tree/master/data
"""
import json
import os
import urllib.request

BASE = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "sky-data.js")
MAG_LIMIT = 6.0        # これより暗い星は載せない
NAME_MAG_LIMIT = 2.8   # 星名を載せる明るさ
MW_STEP = 3            # 天の川ブロブの格子間隔（度）


def fetch(name):
    with urllib.request.urlopen(BASE + name, timeout=60) as r:
        return json.load(r)


def inside(x, y, ring):
    c = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


def main():
    stars = fetch("stars.6.json")["features"]
    names = fetch("starnames.json")
    cons = fetch("constellations.json")["features"]
    lines = {f["id"]: f for f in fetch("constellations.lines.json")["features"]}
    mw = fetch("mw.json")["features"]

    star_out, name_out = [], []
    stars.sort(key=lambda f: f["properties"]["mag"])
    for f in stars:
        p = f["properties"]
        if p["mag"] > MAG_LIMIT:
            continue
        ra = f["geometry"]["coordinates"][0] % 360
        dec = f["geometry"]["coordinates"][1]
        try:
            bv = round(float(p["bv"]), 2)
        except (TypeError, ValueError):
            bv = 0.6
        star_out.append([round(ra, 3), round(dec, 3), p["mag"], bv])
        n = names.get(str(f["id"]))
        if n and p["mag"] <= NAME_MAG_LIMIT and n.get("ja"):
            name_out.append([len(star_out) - 1, n["ja"], n["name"]])

    cons_out = []
    for c in cons:
        cid = c["id"]
        ln = lines.get(cid)
        if not ln:
            continue
        segs = [[[round(x % 360, 3), round(y, 3)] for x, y in s]
                for s in ln["geometry"]["coordinates"]]
        cx, cy = c["geometry"]["coordinates"]
        cons_out.append({
            "id": cid,
            "ja": c["properties"]["ja"],
            "en": c["properties"]["en"],
            "c": [round(cx % 360, 2), round(cy, 2)],
            "l": segs,
        })

    # 天の川: 等高線ポリゴン(穴あり・±180°で切断済み)を格子に落とし、濃さ(1-5)のブロブ列にする
    shapes = []   # 1等高線 = リング集合（偶奇規則で内外判定）
    for f in mw:
        for poly in f["geometry"]["coordinates"]:
            shapes.append([[tuple(pt) for pt in ring] for ring in poly])
    blobs = []
    ras = [i * MW_STEP + MW_STEP / 2 for i in range(360 // MW_STEP)]
    decs = [-90 + j * MW_STEP + MW_STEP / 2 for j in range(180 // MW_STEP)]
    for dec in decs:
        for ra in ras:
            lon = ra - 360 if ra > 180 else ra     # -180..180
            level = sum(1 for rings in shapes
                        if sum(inside(lon, dec, r) for r in rings) % 2)
            if level:
                blobs.append([ra, round(dec, 1), level])

    data = {"stars": star_out, "names": name_out, "constellations": cons_out, "milkyway": blobs}
    with open(OUT, "w", encoding="utf-8") as fp:
        fp.write("// 自動生成: tools/build_data.py（d3-celestial, BSD-3-Clause, (c) 2015 Olaf Frohn）\n")
        fp.write("window.SKY_DATA=")
        json.dump(data, fp, ensure_ascii=False, separators=(",", ":"))
        fp.write(";\n")
    print(len(star_out), "stars,", len(name_out), "names,", len(cons_out), "constellations,", len(blobs), "mw blobs")
    print("size", os.path.getsize(OUT))


if __name__ == "__main__":
    main()
