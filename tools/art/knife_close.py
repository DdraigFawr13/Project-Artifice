# Usage: python3 tools/art/knife_close.py <close-up concept.jpg from mockups/forge.html> <json out>
# Cuts the hot knife out of the close-up concept at the spot it was painted, as data the game draws in code (D-003):
# its shape and shading steps in close.png px. The game tints the shading with the heat colour and adds a dark outline
# (src/game/shapes.ts).
# The concept is scaled by 2/3 and offset by (20, 80) into close.png, as deblade_close.py does.
import sys, json, cv2, numpy as np
src, mask_out = sys.argv[1], sys.argv[2]
im = cv2.imread(src).astype(np.float32)
b, g, r = im[:, :, 0], im[:, :, 1], im[:, :, 2]
region = np.zeros(r.shape, bool); region[430:500, 120:460] = True
fill = (((r - b) > 160) & (r > 200) & region).astype(np.uint8)  # the knife: r − b ≥ 180; its glow on the anvil: about 120
fill = cv2.morphologyEx(fill, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))  # close JPEG speckle holes
# Keep only the knife itself: the largest connected warm area.
n, lab, stats, _ = cv2.connectedComponentsWithStats(fill)
fill = (lab == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
# Fill holes inside the knife (its darker tang end falls under the threshold).
cs, _ = cv2.findContours(fill, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
fill = cv2.drawContours(np.zeros_like(fill), cs, -1, 1, thickness=cv2.FILLED)
lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
lo, hi = np.percentile(lum[fill > 0], [5, 95])
shade = np.clip(0.55 + 0.45 * (lum - lo) / (hi - lo), 0.55, 1.0)  # 0.55–1: the hottest spots take the full heat colour

# Into close.png px: scale by 2/3 (area), then threshold alpha so edges stay crisp pixels.
k = 2 / 3
x0, y0, x1, y1 = 120, 430, 460, 500
def down(a):
    return cv2.resize(a[y0:y1, x0:x1].astype(np.float32), None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
a = down(fill.astype(np.float32)) >= 0.5
s = down(shade * fill) / np.maximum(down(fill.astype(np.float32)), 1e-6)
ys, xs = np.where(a)
top, left, bottom, right = ys.min(), xs.min(), ys.max() + 1, xs.max() + 1
a, s = a[top:bottom, left:right], s[top:bottom, left:right]
h, w = a.shape
# Flat pixel-art steps instead of JPEG mottling: smooth, then round the shading to 4 levels.
s = cv2.GaussianBlur(np.where(a, s, 0).astype(np.float32), (3, 3), 0) / np.maximum(cv2.GaussianBlur(a.astype(np.float32), (3, 3), 0), 1e-6)
levels = np.array([0.62, 0.76, 0.88, 1.0])
s = levels[np.abs(s[..., None] - levels).argmin(axis=-1)]
# The painted knife's darker rim: the outermost knife pixels at 0.4, still tinted, so they glow with the heat.
rim = a & ~cv2.erode(a.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
s = np.where(rim, 0.4, s)
# One character per pixel: '.' empty, 'r' the rim, '1'–'4' the shading steps (0.62, 0.76, 0.88, 1.0).
X = int(round(x0 * k)) + 20 + int(left); Y = int(round(y0 * k)) + 80 + int(top)
def code(on, v):
    if not on: return '.'
    if v <= 0.45: return 'r'
    return str(int(np.abs(levels - v).argmin()) + 1)
rows = [''.join(code(a[y, x], s[y, x]) for x in range(w)) for y in range(h)]
json.dump({'x': X, 'y': Y, 'w': int(w), 'h': int(h), 'rows': rows}, open(mask_out, 'w'))
print('knife at', X, Y, 'size', w, h)
