"""体积感云朵纹理离线渲染 v2。
参考目标：蓬松花菜状积云，向阳面银白金边，云腹蓝灰阴影，边缘絮状侵蚀。
方法：FBM Perlin 密度场 + 向太阳方向 16 步光学厚度积分（透射率烘焙）
     + 半球环境光（顶亮底暗）+ 高频侵蚀出絮边。
产出 RGBA PNG（白透底），供 Three.js 纹理平面使用。
"""
import numpy as np
from PIL import Image


def perlin(cells, seed, w, h):
    rng = np.random.default_rng(seed)
    ang = rng.random((cells, cells)) * 2 * np.pi
    gx, gy = np.cos(ang), np.sin(ang)
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float64)
    fx, fy = xs / w * cells, ys / h * cells
    ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
    tx, ty = fx - ix, fy - iy
    tx = tx * tx * tx * (tx * (tx * 6 - 15) + 10)
    ty = ty * ty * ty * (ty * (ty * 6 - 15) + 10)

    def dot(j, i, dx, dy):
        jj, ii = j % cells, i % cells
        return gx[jj, ii] * dx + gy[jj, ii] * dy

    v00 = dot(iy, ix, fx - ix, fy - iy)
    v10 = dot(iy, ix + 1, fx - ix - 1, fy - iy)
    v01 = dot(iy + 1, ix, fx - ix, fy - iy - 1)
    v11 = dot(iy + 1, ix + 1, fx - ix - 1, fy - iy - 1)
    v = v00 + (v10 - v00) * tx + (v01 - v00) * ty + (v00 - v10 - v01 + v11) * tx * ty
    return np.clip(0.5 + v * 1.4, 0, 1)


def fbm(seed, w, h, base_cells, octaves=5, gain=0.55, lac=2.1):
    total, amp, cells, norm = np.zeros((h, w)), 1.0, base_cells, 0.0
    for o in range(octaves):
        total += amp * perlin(max(2, cells), seed + o * 131, w, h)
        norm += amp
        amp *= gain
        cells = int(cells * lac)
    return total / norm


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def sun_transmittance(d, sun_dir, steps=16, step_px=9, absorb=0.16):
    """沿指向太阳的方向做光学厚度积分，返回透射率 T（1=直射阳光，0=深云核）。"""
    tau = np.zeros_like(d)
    sx, sy = sun_dir
    for k in range(1, steps + 1):
        shifted = np.roll(d, (int(round(-sy * k * step_px)), int(round(sx * k * step_px))), axis=(0, 1))
        tau += shifted
    tau *= step_px * absorb / steps * steps / 9.0
    return np.exp(-tau * absorb * steps * 0.55)


def render(seed, base_cells, cover_lo, cover_hi, w, h, out,
           band=False, sun_dir=(0.55, -0.75)):
    # 主密度：低频大形
    d = fbm(seed, w, h, base_cells)
    # 大尺度 warp 让云团更有机
    wx = (fbm(seed + 977, w, h, base_cells * 2) - 0.5)
    wy = (fbm(seed + 551, w, h, base_cells * 2) - 0.5)
    sh = int(w * 0.02)
    xs = (np.arange(w)[None, :] + (wx * sh).astype(int)) % w
    ys = (np.arange(h)[:, None] + (wy * sh).astype(int)) % h
    d = d[ys, xs]
    # 高频絮状侵蚀：边缘处啃出碎絮
    erode = fbm(seed + 313, w, h, base_cells * 8, octaves=3)
    edge_zone = smoothstep(cover_lo - 0.14, cover_lo + 0.06, d) * (1 - smoothstep(cover_hi, cover_hi + 0.15, d))
    d = d - erode * 0.16 * (0.35 + 0.65 * edge_zone)

    cover = smoothstep(cover_lo, cover_hi, d)
    if band:
        yy = np.linspace(0, 1, h)[:, None]
        cover *= np.clip(1.4 - yy * 1.6, 0, 1)

    # 体积光照
    T = sun_transmittance(d * cover.astype(np.float64), sun_dir)
    yy = np.linspace(0, 1, h)[:, None]  # 0 顶 1 底
    ambient = 1.0 - yy * 0.35           # 半球环境：顶亮底暗

    shade = np.array([0.590, 0.620, 0.668])   # 云腹蓝灰（参考图的冷灰阴影）
    lit_c = np.array([1.0, 0.998, 0.988])     # 向阳银白
    gold = np.array([0.98, 0.82, 0.52])       # 金边

    sunlit = T ** 0.75
    col = shade[None, None, :] * (1 - sunlit[:, :, None]) + lit_c[None, None, :] * sunlit[:, :, None]
    col *= ambient[:, :, None]
    # 金边：透射率中等且向阳梯度强处
    grad = np.roll(d, (int(round(sun_dir[1] * 8)), int(round(-sun_dir[0] * 8))), axis=(0, 1)) - d
    rim = np.clip(grad * 10.0, 0, 1) * smoothstep(0.05, 0.3, cover) * (1 - smoothstep(0.6, 0.95, cover))
    col = col * (1 - rim[:, :, None] * 0.45) + gold[None, None, :] * (rim[:, :, None] * 0.45)

    alpha = np.clip(cover * (0.35 + 0.65 * smoothstep(cover_lo, cover_hi + 0.1, d)), 0, 1) ** 0.85
    img = np.dstack([np.clip(col, 0, 1), alpha])
    Image.fromarray((img * 255).astype(np.uint8), 'RGBA').save(out)
    print(out, 'alpha mean', round(float(alpha.mean()), 3))


render(20260908, base_cells=3, cover_lo=0.50, cover_hi=0.62, w=2048, h=512,
       out=r'D:\KimiData\kimi\Workspaces\qingye_blog\public\images\cloud-band.png', band=True)
render(114514, base_cells=4, cover_lo=0.54, cover_hi=0.66, w=2048, h=1024,
       out=r'D:\KimiData\kimi\Workspaces\qingye_blog\public\images\cloud-islands.png')
