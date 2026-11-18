"""Draw the decorative topo lines behind the masthead (not data)."""
import math, random
random.seed(11)
W, H, S = 160, 70, 10  # grid cells, px per cell
bumps = [(random.uniform(0, W), random.uniform(0, H), random.uniform(8, 26), random.uniform(-1, 1.4)) for _ in range(14)]
def f(x, y):
    return sum(a * math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s)) for cx, cy, s, a in bumps) + 0.08 * math.sin(x / 9) * math.cos(y / 7)
g = [[f(x, y) for x in range(W + 1)] for y in range(H + 1)]
lo = min(map(min, g)); hi = max(map(max, g))
paths = []
for li in range(1, 18):
    lv = lo + (hi - lo) * li / 18
    seg = []
    for y in range(H):
        for x in range(W):
            v = [g[y][x], g[y][x + 1], g[y + 1][x + 1], g[y + 1][x]]
            pts = []
            corners = [(x, y), (x + 1, y), (x + 1, y + 1), (x, y + 1)]
            for i in range(4):
                a, b = v[i], v[(i + 1) % 4]
                if (a < lv) != (b < lv):
                    t = (lv - a) / (b - a)
                    (x0, y0), (x1, y1) = corners[i], corners[(i + 1) % 4]
                    pts.append((x0 + t * (x1 - x0), y0 + t * (y1 - y0)))
            for i in range(0, len(pts) - 1, 2):
                (a1, b1), (a2, b2) = pts[i], pts[i + 1]
                seg.append(f"M{a1*S:.0f} {b1*S:.0f}L{a2*S:.0f} {b2*S:.0f}")
    cls = ' class="idx"' if li % 5 == 0 else ""
    paths.append(f'<path{cls} d="{"".join(seg)}"/>')
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W*S} {H*S}" preserveAspectRatio="xMidYMid slice">'
       '<style>path{fill:none;stroke:#1d2a24;stroke-opacity:.13;stroke-width:1.1;stroke-linecap:round}.idx{stroke-opacity:.24;stroke-width:1.6}</style>'
       + "".join(paths) + "</svg>")
open("assets/topo.svg", "w").write(svg)
print(len(svg))
