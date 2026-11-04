import sys, cv2, numpy as np
src, out, zoom = sys.argv[1], sys.argv[2], sys.argv[3]
im = cv2.imread(src)
FACE = np.array([82, 64, 94], np.uint8)  # BGR, sampled from the clean anvil face at (385-420, 553-556)
poly = np.array([[246, 589], [258, 574], [290, 559], [322, 549], [347, 546], [368, 549], [370, 566], [330, 580], [292, 590], [252, 593]], np.int32)
mask = np.zeros(im.shape[:2], np.uint8)
cv2.fillPoly(mask, [poly], 255)
b, g, r = [im[:, :, i].astype(int) for i in range(3)]
warm = ((r - b) > 20).astype(np.uint8) * 255
# Inside the polygon: flat face colour wherever the blade or its warm reflection is.
sel = (mask > 0) & ((warm > 0) | (r < 70))
fixed = im.copy()
fixed[sel] = FACE
cv2.imwrite(out, fixed)
c = fixed[510:610, 180:450]
cv2.imwrite(zoom, cv2.resize(c, None, fx=4, fy=4, interpolation=cv2.INTER_NEAREST))
# Tang: redraw the strip it crosses as wall, the anvil's black back-edge outline, then anvil face.
WALL = np.array([0x2c, 0x18, 0x1b], np.uint8)
EDGE = np.array([0x10, 0x05, 0x0d], np.uint8)
for x in range(332, 400):
    ye = 541 + (x - 338) * 0.13
    for y in range(530, 556):
        if y < ye - 1:
            if y >= 533: fixed[y, x] = WALL
        elif y <= ye + 0.5:
            fixed[y, x] = EDGE
        elif y <= 556 and (x > 345 or y < 548):
            fixed[y, x] = FACE
cv2.imwrite(out, fixed)
c = fixed[510:610, 180:450]
cv2.imwrite(zoom, cv2.resize(c, None, fx=4, fy=4, interpolation=cv2.INTER_NEAREST))
