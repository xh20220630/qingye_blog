"""Produce web assets from downloaded public-domain paintings + generated paper texture."""
from PIL import Image, ImageFilter
import os, random, math

Image.MAX_IMAGE_PIXELS = None
OUT = "public/images"
os.makedirs(OUT, exist_ok=True)

def save_jpg(im, name, quality=85, max_kb=500):
    path = os.path.join(OUT, name)
    im.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    kb = os.path.getsize(path) // 1024
    # step down quality if over budget
    q = quality
    while kb > max_kb and q > 60:
        q -= 5
        im.save(path, "JPEG", quality=q, optimize=True, progressive=True)
        kb = os.path.getsize(path) // 1024
    print(f"{name}: {im.size[0]}x{im.size[1]}, {kb} KB, q={q}")

# ---------- 1. pano-mountains.jpg : 千里江山图 main-peak section ----------
ql = Image.open("originals/qianli-jiangshan.jpg").convert("RGB")
# segment 3 held the dramatic blue-green main peak; crop 3.2:1 around it
crop = ql.crop((15000, 0, 20120, 1600))          # 5120x1600
pano = crop.resize((2048, 640), Image.LANCZOS)
save_jpg(pano, "pano-mountains.jpg", quality=85)

# ---------- 2. cranes.jpg : 瑞鹤图（亮版） cranes + auspicious clouds + roof ridge ----------
rh = Image.open("originals/ruihe.jpg").convert("RGB")   # 2668x1822
crop = rh.crop((30, 20, 2660, 1680))                    # keep roof, cranes, clouds
w = 1600
cranes = crop.resize((w, round(crop.size[1]*w/crop.size[0])), Image.LANCZOS)
save_jpg(cranes, "cranes.jpg", quality=85)

# ---------- 3. ink-mountains.jpg : 富春山居图（无用师卷） dense ink mountains ----------
fc = Image.open("originals/fuchun-shanju.jpg").convert("RGB")  # 26134x900
crop = fc.crop((19000, 0, 21880, 900))                  # 2880x900, segment-5 layered peaks
ink = crop.resize((2048, 640), Image.LANCZOS)
save_jpg(ink, "ink-mountains.jpg", quality=85)

# ---------- 5. cloud-sea-hero.jpg : 梅清 黄山图册 1-6 (云海/百步云梯) ----------
mq = Image.open("originals/meiqing-huangshan-1-6.png").convert("RGB")  # 3840x2229
# trim album border, then 16:9
crop = mq.crop((140, 150, 3700, 2152))                  # 3560x2002 ≈ 16:9
hero = crop.resize((2048, 1152), Image.LANCZOS)
save_jpg(hero, "cloud-sea-hero.jpg", quality=85)

# ---------- 4. paper-texture.jpg : generated xuan-paper texture, 1024x1024 ----------
random.seed(42)
W = H = 1024
base = (250, 248, 243)   # #faf8f3
# Per-pixel fine fiber noise (grayscale delta, very light)
noise = Image.effect_noise((W, H), 12).convert("L")     # gaussian noise ~128 mean
# blur slightly to feel like fiber rather than grain
noise = noise.filter(ImageFilter.GaussianBlur(0.6))
paper = Image.new("RGB", (W, H), base)
# blend noise as subtle luminance variation (±~4 levels)
import numpy as np
n = np.asarray(noise, dtype=np.float32) - 128.0
n *= 5.0 / 128.0                                        # ±5 max deviation
arr = np.zeros((H, W, 3), dtype=np.float32)
for c, v in enumerate(base):
    arr[:, :, c] = v + n
# sparse longer fibers: random thin strokes slightly darker
fiber_layer = np.zeros((H, W), dtype=np.float32)
for _ in range(2600):
    x, y = random.uniform(0, W), random.uniform(0, H)
    ang = random.uniform(0, math.pi)
    ln = random.uniform(6, 30)
    dx, dy = math.cos(ang), math.sin(ang)
    dark = random.uniform(1.5, 4.0)
    steps = int(ln)
    for s in range(steps):
        px, py = int(x + dx*s), int(y + dy*s)
        if 0 <= px < W and 0 <= py < H:
            fiber_layer[py, px] -= dark * (1 - s/steps)
arr += fiber_layer[:, :, None]
# faint horizontal laid-lines typical of xuan paper
yy = np.arange(H, dtype=np.float32)
laid = 0.8 * np.sin(yy * math.pi / 3.0)
arr += laid[:, None, None]
paper = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
save_jpg(paper, "paper-texture.jpg", quality=85, max_kb=500)
