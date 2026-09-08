"""把 pano-mountains.jpg（千里江山图，青绿）做去饱和 + 提亮的墨色化 duotone 处理。
输出 public/images/pano-ink.jpg：阴影落暖墨灰，高光落宣纸白。
"""
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent
src = root / "public" / "images" / "pano-mountains.jpg"
dst = root / "public" / "images" / "pano-ink.jpg"

img = Image.open(src).convert("L")
img = ImageOps.autocontrast(img, cutoff=1)
# 提亮：gamma < 1 提亮中间调
lut = [min(255, round(255 * ((i / 255) ** 0.72))) for i in range(256)]
img = img.point(lut)

shadow = (58, 54, 48)      # 暖墨灰
highlight = (244, 240, 229)  # 宣纸白

w, h = img.size
gray = img.load()
out = Image.new("RGB", (w, h))
px = out.load()
for y in range(h):
    for x in range(w):
        t = gray[x, y] / 255.0
        px[x, y] = tuple(round(shadow[c] * (1 - t) + highlight[c] * t) for c in range(3))

out.save(dst, "JPEG", quality=82, progressive=True)
print("saved", dst, out.size)
