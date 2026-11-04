import sys, cv2, numpy as np
# Scale the edited 540 × 968 concept to the 360 px authoring width, then centre it on a 400 × 800 --night-0
# background with a 16 px fade at each edge, so taller and wider screens stay covered (forge spec, Scale and screen).
src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src).astype(np.float32)
s = cv2.resize(im, (360, 645), interpolation=cv2.INTER_AREA)
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
