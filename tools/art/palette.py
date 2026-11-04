import sys
import numpy as np
from PIL import Image
# Re-sample the forge tokens from the two reference images (wide shot and close-up), 2026-11-04.
# Median cut, run separately on cool pixels (4 tokens: --night-0..2, --soot) and warm pixels
# (10 tokens: --ember-0..3, --fire-0..5), so each token keeps its role; each group sorted darkest first.
px = np.concatenate([np.asarray(Image.open(p).convert('RGB')).reshape(-1, 3) for p in sys.argv[1:]])
r, b = px[:, 0].astype(int), px[:, 2].astype(int)
def lum(c):
    f = lambda v: (v/255/12.92) if v/255 <= 0.04045 else ((v/255+0.055)/1.055)**2.4
    return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])
def cut(sel, n):
    im = Image.fromarray(sel.reshape(1, -1, 3).astype(np.uint8))
    q = im.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:n*3]
    return sorted([tuple(pal[i*3:i*3+3]) for i in range(n)], key=lum)
cool = cut(px[r <= b + 10], 4); warm = cut(px[r > b + 10], 10)
names = ['night-0', 'night-1', 'night-2', 'soot', 'ember-0', 'ember-1', 'ember-2', 'ember-3', 'fire-0', 'fire-1', 'fire-2', 'fire-3', 'fire-4', 'fire-5']
for n, c in zip(names, cool + warm):
    print(f'--{n} #%02x%02x%02x  lum %.3f' % (*c, lum(c)))
