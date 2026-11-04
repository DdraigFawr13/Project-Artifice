# Usage: python3 tools/art/deblade_close.py <close-up concept.jpg from mockups/forge.html> <out.png>
import sys, cv2, numpy as np
# Paint the hot knife and its sparks out of the close-up concept (forge spec S3, assets/close.png).
src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src); H, W = im.shape[:2]
b, g, r = [im[:, :, i].astype(int) for i in range(3)]
warm = ((r - b) > 60) & (r > 130)
blade = np.zeros((H, W), bool); blade[430:500, 120:460] = True
m = (warm & blade).astype(np.uint8)
m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=3).astype(bool) & blade  # the dark outline too
o = im.astype(float)
# Column by column, fill the blade with a straight blend from the pixel above it to the pixel below,
# so the anvil's vertical edges carry straight through.
for x in range(W):
    ys = np.where(m[:, x])[0]
    if len(ys) == 0: continue
    y0, y1 = ys.min() - 1, ys.max() + 1
    a, c = o[y0, x], o[y1, x]
    for y in range(y0 + 1, y1):
        t = (y - y0) / (y1 - y0); o[y, x] = a * (1 - t) + c * t
# Soften the column streaks along the blade's length.
sm_ = cv2.blur(o, (9, 1)); o[m] = sm_[m]
# Sparks above the anvil: small inpaint on the dark wall and stump.
sp = np.zeros((H, W), np.uint8); sp[240:398, 180:420] = 1
sm = ((((r - b) > 25) & (r > 90)).astype(np.uint8) & sp)
sm = cv2.dilate(sm, np.ones((3, 3), np.uint8))
o = cv2.inpaint(np.clip(o, 0, 255).astype(np.uint8), sm * 255, 3, cv2.INPAINT_TELEA).astype(float)
# Cool the blade's warm cast on the face and horn plate, keeping each pixel's brightness.
face = np.zeros((H, W), np.uint8)
cv2.fillPoly(face, [np.array([[130, 398], [535, 398], [535, 548], [130, 548]])], 1)
neutral = np.array([96, 74, 88], float)  # BGR, a cool face tone
lum = o.mean(axis=2, keepdims=True)
cooled = np.clip(neutral * lum / neutral.mean(), 0, 255)
f = face.astype(bool)
o[f] = 0.4 * o[f] + 0.6 * cooled[f]
# Scale to the 360 px authoring width and centre on a 400 × 800 --night-0 background with a 16 px fade, as pad.py
# does for the wide shot (forge spec, Scale and screen). The blade line (y 465 in the concept) lands at y 390.
s = cv2.resize(np.clip(o, 0, 255).astype(np.float32), (360, 640), interpolation=cv2.INTER_AREA)
night0 = np.array([0x1b, 0x09, 0x0d], np.float32)  # BGR of --night-0 #0d091b
h, w = s.shape[:2]
fade = 16
ys = np.minimum(np.arange(h), np.arange(h)[::-1]); xs = np.minimum(np.arange(w), np.arange(w)[::-1])
a = np.minimum(np.clip(ys / fade, 0, 1)[:, None], np.clip(xs / fade, 0, 1)[None, :])[..., None]
s = s * a + night0 * (1 - a)
canvas = np.empty((800, 400, 3), np.float32); canvas[:] = night0
y0, x0 = (800 - h) // 2, (400 - w) // 2
canvas[y0:y0 + h, x0:x0 + w] = s
cv2.imwrite(out, np.round(canvas).astype(np.uint8), [cv2.IMWRITE_PNG_COMPRESSION, 9])
print(out, canvas.shape, 'image at', x0, y0)
