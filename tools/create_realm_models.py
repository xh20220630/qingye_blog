"""Create editable, Y-up glTF assets with Blender's background Python runtime."""

import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "models" / "realm"
SOURCE = ROOT / "originals" / "models"
RNG = random.Random(20260913)
MATERIALS = {}


def vec(p):
    return Vector((p[0], -p[2], p[1]))


def linear(n):
    return n / 12.92 if n <= 0.04045 else ((n + 0.055) / 1.055) ** 2.4


def material(name, color, roughness=0.65, metal=0, emission=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    shader = m.node_tree.nodes.get("Principled BSDF")
    rgb = tuple(linear(int(color[i:i + 2], 16) / 255) for i in (1, 3, 5))
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metal
    if "Feather" in name:
        shader.inputs["Sheen Weight"].default_value = 0.3
        shader.inputs["Sheen Roughness"].default_value = 0.75
    if emission:
        shader.inputs["Emission Color"].default_value = (*rgb, 1)
        shader.inputs["Emission Strength"].default_value = emission
    MATERIALS[name] = m
    return m


def materials():
    for args in [
        ("Limestone", "#c8c9b5", .81), ("StoneCarving", "#e2dfcb", .69),
        ("Plaster", "#ddd2b3", .92), ("Cedar", "#62483a", .74),
        ("Lacquer", "#335654", .49), ("TileJade", "#376e70", .35, .10),
        ("TileShade", "#2b555d", .49, .06), ("AgedBronze", "#b79958", .39, .65),
        ("RicePaper", "#f1dcb3", .86, 0, .42),
        ("FeatherIvory", "#eeeede", .71), ("FeatherBlack", "#30353a", .75),
        ("CraneWhite", "#efefe4", .83), ("CraneCharcoal", "#252b30", .8),
        ("CraneCrown", "#a32525", .78), ("CraneBill", "#899177", .45),
        ("CraneLeg", "#45464a", .7), ("CraneIris", "#8d4c2c", .27),
        ("CraneEye", "#111819", .12),
    ]:
        material(*args)


class Batch:
    def __init__(self, parent):
        self.parent = parent
        self.parts = {}

    def add(self, mat, vertices, faces, smooth=False, uv=None):
        part = self.parts.setdefault(mat, [[], [], [], []])
        offset = len(part[0])
        part[0].extend(vertices)
        part[1].extend(tuple(offset + i for i in f) for f in faces)
        part[2].extend([smooth] * len(faces))
        part[3].extend(uv if uv is not None else [(v[0] * .5, (v[1] + v[2]) * .5) for v in vertices])

    def finish(self):
        for name, (verts, faces, smooth, uv) in self.parts.items():
            mesh = bpy.data.meshes.new(f"{self.parent.name}_{name}")
            mesh.from_pydata([vec(v) for v in verts], [], faces)
            mesh.materials.append(MATERIALS[name])
            layer = mesh.uv_layers.new(name="UVMap")
            for polygon, shading in zip(mesh.polygons, smooth):
                polygon.use_smooth = shading
                for loop in polygon.loop_indices:
                    layer.data[loop].uv = uv[mesh.loops[loop].vertex_index]
            mesh.update()
            obj = bpy.data.objects.new(mesh.name, mesh)
            bpy.context.collection.objects.link(obj)
            obj.parent = self.parent


def empty(name, parent=None, position=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = vec(position)
    return obj


def box(b, mat, p, size, bevel=.035):
    x, y, z = p
    w, h, d = [v / 2 for v in size]
    if bevel < .02 or min(size) < .18:
        verts = [(x + a * w, y + q * h, z + s * d) for q in (-1, 1) for s in (-1, 1) for a in (-1, 1)]
        b.add(mat, verts, [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)])
        return
    c = min(bevel, w * .24, d * .24)
    outline = [(-w + c, -d), (w - c, -d), (w, -d + c), (w, d - c),
               (w - c, d), (-w + c, d), (-w, d - c), (-w, -d + c)]
    verts = [(x + a, y + s * h, z + q) for s in (-1, 1) for a, q in outline]
    faces = [tuple(range(8)), tuple(range(15, 7, -1))]
    faces.extend((i, i + 8, (i + 1) % 8 + 8, (i + 1) % 8) for i in range(8))
    b.add(mat, verts, faces)


def tube(b, mat, points, radii, sides=8, cap=True):
    points = [Vector(p) for p in points]
    verts = []
    previous_axis = None
    for i, p in enumerate(points):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]).normalized()
        ref = Vector((0, 1, 0)) if abs(tangent.y) < .9 else Vector((1, 0, 0))
        a = (previous_axis - tangent * previous_axis.dot(tangent)).normalized() if previous_axis is not None else tangent.cross(ref).normalized()
        previous_axis = a
        c = tangent.cross(a).normalized()
        r = radii[i] if isinstance(radii, (list, tuple)) else radii
        for j in range(sides):
            theta = math.tau * j / sides
            verts.append(tuple(p + (a * math.cos(theta) + c * math.sin(theta)) * r))
    faces = []
    for i in range(len(points) - 1):
        for j in range(sides):
            n = i * sides + j
            k = i * sides + (j + 1) % sides
            faces.append((n, k, k + sides, n + sides))
    if cap:
        faces.extend([tuple(range(sides - 1, -1, -1)), tuple(range(len(verts) - sides, len(verts)))])
    b.add(mat, verts, faces, True)


def sphere(b, mat, p, scale, segments=16, rings=10):
    verts = []
    for j in range(rings + 1):
        theta = math.pi * j / rings
        for i in range(segments):
            a = math.tau * i / segments
            verts.append((p[0] + scale[0] * math.sin(theta) * math.cos(a),
                          p[1] + scale[1] * math.cos(theta),
                          p[2] + scale[2] * math.sin(theta) * math.sin(a)))
    faces = []
    for j in range(rings):
        for i in range(segments):
            a = j * segments + i
            c = j * segments + (i + 1) % segments
            faces.append((a, c + segments, a + segments) if j == 0 else (a, c, c + segments) if j == rings - 1 else (a, c, c + segments, a + segments))
    b.add(mat, verts, faces, True)


def rail(b, a, c, height=.95, mat="Lacquer"):
    a, c = Vector(a), Vector(c)
    count = max(2, round((c - a).length / .7))
    for i in range(count + 1):
        p = a.lerp(c, i / count)
        box(b, mat, (p.x, p.y + height * .5, p.z), (.13, height, .13))
        sphere(b, "AgedBronze", (p.x, p.y + height + .02, p.z), (.10, .08, .10), 8, 4)
        if i < count:
            q = a.lerp(c, (i + 1) / count)
            mid = (p + q) * .5
            tube(b, mat, [p + Vector((0, .32, 0)), mid + Vector((0, .61, 0)), q + Vector((0, .32, 0))], .034, 5)
    for h in (.18, height):
        tube(b, mat, [a + Vector((0, h, 0)), c + Vector((0, h, 0))], .065, 8)


def bracket(b, x, y, z, side=1):
    for level in range(3):
        h = y + level * .19
        span = .48 + level * .28
        box(b, "Lacquer", (x, h, z + side * level * .12), (span, .13, .26))
        for s in (-1, 1):
            box(b, "AgedBronze", (x + s * span * .39, h + .095, z + side * level * .12), (.17, .13, .30))
    tube(b, "Cedar", [(x, y - .25, z), (x, y + .20, z + side * .48), (x, y + .40, z + side * .77)], [.10, .12, .08], 6)


def roof(b, width, depth, base, rise, ridge=True, detail=True):
    half_w, half_d = width / 2, depth / 2
    ridge_half = width * .245 if ridge else 0

    def surface(face, u, t):
        uplift = .56 * abs(u) ** 7 * t ** 5
        y = base + rise * (1 - t) ** 1.52 + uplift
        if face < 2:
            return (u * (ridge_half + (half_w - ridge_half) * t), y, (-1 if face == 0 else 1) * half_d * t)
        return ((-1 if face == 2 else 1) * (ridge_half + (half_w - ridge_half) * t), y, u * half_d * t)

    for face in range(4):
        cols, rows = max(12, round(width * 3)), 12
        verts = [surface(face, -1 + i * 2 / cols, j / rows) for j in range(rows + 1) for i in range(cols + 1)]
        faces = []
        for j in range(rows):
            for i in range(cols):
                a = j * (cols + 1) + i
                quad = (a, a + 1, a + cols + 2, a + cols + 1)
                faces.append(quad if face in (0, 3) else quad[::-1])
        b.add("TileShade", verts, faces, True)
        edge = [surface(face, -1 + i / 20 * 2, 1) for i in range(21)]
        tube(b, "Lacquer", [(x, y - .08, z) for x, y, z in edge], .105, 8)
        tube(b, "AgedBronze", edge, .041, 6)
        if not detail:
            continue
        columns = max(10, round((width if face < 2 else depth) / .30))
        for i in range(columns):
            u = -1 + (i + .5) / columns * 2
            for j in range(10):
                t0, t1 = .09 + j * .091, min(1, .09 + (j + 1) * .091 + .012)
                p, q = Vector(surface(face, u, t0)), Vector(surface(face, u, t1))
                sideways = Vector((1, 0, 0)) if face < 2 else Vector((0, 0, 1))
                radius = .077 * (.28 + t0 * .72)
                tile = []
                for center in (p, q):
                    for k in range(5):
                        angle = k / 4 * math.pi
                        tile.append(tuple(center + sideways * math.cos(angle) * radius + Vector((0, math.sin(angle) * radius + .023, 0))))
                faces = [(k, k + 1, k + 6, k + 5) for k in range(4)]
                # Opposite slopes have opposite UV parameter orientation.
                if face in (0, 3):
                    faces = [f[::-1] for f in faces]
                b.add("TileJade" if RNG.random() > .22 else "TileShade", tile, faces, True)
            p = surface(face, u, 1)
            sphere(b, "AgedBronze", (p[0], p[1] - .06, p[2]), (.073, .073, .073), 8, 4)
        for i in range(1, columns, 2):
            u = -1 + i / columns * 2
            points = [surface(face, u, .30 + j / 7 * .7) for j in range(8)]
            tube(b, "Cedar", [(x, y - .21, z) for x, y, z in points], .075, 6)

    for sx in (-1, 1):
        for sz in (-1, 1):
            points = []
            for i in range(17):
                t = i / 16
                points.append((sx * (ridge_half + (half_w - ridge_half) * t), base + rise * (1 - t) ** 1.52 + .56 * t ** 5 + .12, sz * half_d * t))
            tube(b, "TileJade", points, .14, 8)
            tube(b, "AgedBronze", [(x, y + .10, z) for x, y, z in points], .042, 6)
            for t in (.80, .87, .94):
                p = Vector((sx * (ridge_half + (half_w - ridge_half) * t), base + rise * (1 - t) ** 1.52 + .56 * t ** 5 + .27, sz * half_d * t))
                sphere(b, "AgedBronze", p, (.10, .15, .08), 8, 5)
                tube(b, "AgedBronze", [p, p + Vector((sx * .10, .26, sz * .06))], [.10, .018], 6)
    if ridge:
        tube(b, "TileShade", [(-ridge_half, base + rise + .08, 0), (ridge_half, base + rise + .08, 0)], .20, 10)
        tube(b, "AgedBronze", [(-ridge_half, base + rise + .24, 0), (ridge_half, base + rise + .24, 0)], .045, 6)
        for s in (-1, 1):
            tube(b, "AgedBronze", [(s * ridge_half, base + rise, 0), (s * (ridge_half + .28), base + rise + .20, 0), (s * (ridge_half + .45), base + rise + .65, 0), (s * (ridge_half + .20), base + rise + .93, 0)], [.18, .19, .10, .018], 8)
    else:
        tube(b, "AgedBronze", [(0, base + rise, 0), (0, base + rise + .55, 0), (0, base + rise + 1.6, 0)], [.28, .15, .015], 12)
        for h, r in [(0.15, .4), (.55, .26), (.85, .18)]:
            sphere(b, "AgedBronze", (0, base + rise + h, 0), (r, .12, r), 12, 6)


def screen(b, center, width, height, side=1, axis="x"):
    x, y, z = center

    def pos(u, h, offset=0):
        return (x + u, y + h, z + offset * side) if axis == "x" else (x + offset * side, y + h, z + u)

    def slat(u, h, w, ht, mat="Cedar", offset=.055):
        box(b, mat, pos(u, h, offset), (w, ht, .075) if axis == "x" else (.075, ht, w), .009)

    box(b, "RicePaper", center, (width, height, .035) if axis == "x" else (.035, height, width))
    for u in (-width / 2, 0, width / 2):
        slat(u, 0, .09, height + .14, "Lacquer")
    for h in (-height / 2, height / 2, -height * .22):
        slat(0, h, width, .10, "Lacquer")
    for i in range(-3, 4):
        slat(i * width / 8, height * .12, .028, height * .72)
    for i in range(5):
        slat(0, -height * .19 + i * height * .155, width, .028)
    for s in (-1, 1):
        slat(s * width * .23, -height * .36, width * .39, height * .21, "Lacquer")
        sphere(b, "AgedBronze", pos(s * .09, -height * .15, .12), (.035, .035, .035), 8, 5)


def hall(b, width, levels, open_sides=False, pagoda=False, detail=True):
    depth = width * (.86 if pagoda else .72)
    for y, w, d, h in [(.15, width + 2.5, depth + 2.5, .3), (.53, width + 2.1, depth + 2.1, .46), (.83, width + 2.4, depth + 2.4, .16), (1.01, width + 1.9, depth + 1.9, .2)]:
        box(b, "StoneCarving" if h < .3 else "Limestone", (0, y, 0), (w, h, d), .08)
    for i in range(7):
        box(b, "StoneCarving", (0, .08 + i * .15, depth / 2 + 3.45 - i * .37), (width * .32, .16, .48))
    for level in range(levels):
        w = width * ((.86 if pagoda else .82) ** level)
        d = depth * ((.86 if pagoda else .82) ** level)
        floor = 1.13 + level * (4.65 if pagoda else 5.2)
        h = 2.9 if pagoda else 3.2
        if level:
            box(b, "Cedar", (0, floor - .13, 0), (w + 1.7, .23, d + 1.7))
            for z in (-1, 1):
                rail(b, (-w / 2 - .7, floor, z * (d / 2 + .7)), (w / 2 + .7, floor, z * (d / 2 + .7)), .82)
            for x in (-1, 1):
                rail(b, (x * (w / 2 + .7), floor, -d / 2 - .7), (x * (w / 2 + .7), floor, d / 2 + .7), .82)
        bays = 3 if pagoda or open_sides else 5
        for side in (-1, 1):
            for i in range(bays + 1):
                x, z = -w / 2 + w * i / bays, side * d / 2
                tube(b, "Lacquer", [(x, floor + .18, z), (x, floor + h * .45, z), (x, floor + h, z)], [.17, .19, .15], 12)
                tube(b, "StoneCarving", [(x, floor, z), (x, floor + .17, z), (x, floor + .30, z)], [.27, .25, .19], 12)
                tube(b, "AgedBronze", [(x, floor + .32, z), (x, floor + .38, z)], .19, 12)
                bracket(b, x, floor + h, z, side)
            box(b, "Cedar", (0, floor + h - .13, side * d / 2), (w + .5, .23, .28))
            box(b, "Lacquer", (0, floor + h + .45, side * (d / 2 + .22)), (w + 1, .21, .28))
            for i in range(bays):
                x = -w / 2 + w * (i + .5) / bays
                if not open_sides:
                    screen(b, (x, floor + 1.38, side * (d / 2 - .42)), w / bays - .18, 2.45, side)
                    box(b, "Plaster", (x, floor + 2.78, side * (d / 2 - .43)), (w / bays - .16, .25, .10))
                elif i != bays // 2:
                    rail(b, (x - w / bays * .40, floor, side * d / 2), (x + w / bays * .40, floor, side * d / 2), .7)
        for side in (-1, 1):
            box(b, "Cedar", (side * w / 2, floor + h - .13, 0), (.26, .23, d + .2))
            for i in range(1, 3):
                z = -d / 2 + d * i / 3
                tube(b, "Lacquer", [(side * w / 2, floor, z), (side * w / 2, floor + h, z)], .15, 12)
            for i in range(3):
                z = -d / 2 + d * (i + .5) / 3
                if not open_sides:
                    screen(b, (side * (w / 2 - .20), floor + 1.42, z), d / 3 - .15, 2.35, side, "z")
        roof(b, w + 3.05, d + 3.05, floor + h + .57, 1.85 if pagoda else 2.25, not pagoda, detail)
        if not pagoda and not open_sides:
            box(b, "Lacquer", (0, floor + h - .3, d / 2 + .21), (w * .28, .54, .15))
            for s in (-1, 1):
                box(b, "AgedBronze", (s * w * .145, floor + h - .3, d / 2 + .30), (.055, .52, .055))
            for k in range(3):
                box(b, "AgedBronze", ((k - 1) * w * .065, floor + h - .3, d / 2 + .30), (.065, .29, .032))


def feather(b, mat, start, end, width, curl=.03, normal=(0, 1, 0)):
    start, end = Vector(start), Vector(end)
    direction = end - start
    normal = Vector(normal).normalized()
    lateral = direction.cross(normal).normalized()
    verts, uv = [], []
    rows, cols = 6, 2
    for underside in (False, True):
        for j in range(rows + 1):
            t = j / rows
            profile = (.025 + math.sin(math.pi * t) ** .58) * width / 2
            center = start + direction * t - normal * curl * t * t
            for i in range(cols + 1):
                u = i / cols * 2 - 1
                camber = (1 - u * u) * width * .045 * math.sin(math.pi * t)
                pos = center + lateral * u * profile + normal * (camber + (-.001 if underside else .001))
                verts.append(tuple(pos))
                uv.append((i / cols, t))
    faces = []
    layer = (rows + 1) * (cols + 1)
    for side in range(2):
        for j in range(rows):
            for i in range(cols):
                a = side * layer + j * (cols + 1) + i
                f = (a, a + 1, a + cols + 2, a + cols + 1)
                faces.append(f if side == 0 else f[::-1])
    b.add(mat, verts, faces, True, uv)
    tube(b, mat, [start, start.lerp(end, .4) + normal * width * .042, end - normal * (.002 + curl)], [.004, .0025, .0006], 4)


def smooth_path(points, radii):
    points = [Vector(p) for p in points]
    out, widths = [], []
    for i in range(len(points) - 1):
        p0, p1, p2, p3 = points[max(0, i - 1)], points[i], points[i + 1], points[min(len(points) - 1, i + 2)]
        for j in range(5):
            t = j / 5
            p = .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
            out.append(p)
            widths.append(radii[i] * (1 - t) + radii[i + 1] * t)
    return [*out, points[-1]], [*widths, radii[-1]]


def crane_body(b, standing=False):
    height = 1.45 if standing else 0
    sphere(b, "CraneWhite", (0, height, 0), (.23, .28, .59), 24, 16)
    sphere(b, "CraneWhite", (0, height + .04, -.36), (.20, .235, .26), 20, 12)
    if standing:
        neck = [(0, height + .13, -.32), (0, 1.75, -.45), (0, 2.04, -.36), (0, 2.26, -.48), (0, 2.39, -.66)]
        head = (0, 2.40, -.69)
    else:
        neck = [(0, .04, -.36), (0, .10, -.58), (0, .11, -.86), (0, .13, -1.12), (0, .15, -1.39), (0, .18, -1.56)]
        head = (0, .18, -1.62)
    neck, widths = smooth_path(neck, [.108, .082, .065, .055, .056] if standing else [.10, .084, .063, .053, .052, .055])
    tube(b, "CraneCharcoal", neck, widths, 16)
    tube(b, "CraneWhite", [(x, y + (.012 if standing else r * .88), z + (r * .90 if standing else 0)) for (x, y, z), r in zip(neck, widths)], [r * .42 for r in widths], 10)
    sphere(b, "CraneCharcoal", head, (.078, .080, .144), 24, 16)
    sphere(b, "CraneWhite", (0, head[1] + .027, head[2] + .052), (.074, .056, .088), 20, 12)
    sphere(b, "CraneCrown", (0, head[1] + .068, head[2] - .026), (.055, .020, .074), 24, 12)
    tube(b, "CraneBill", [(0, head[1] - .006, head[2] - .11), (0, head[1] - .015, head[2] - .33), (0, head[1] - .025, head[2] - .53)], [.039, .021, .001], 12)
    tube(b, "CraneCharcoal", [(0, head[1] - .024, head[2] - .14), (0, head[1] - .031, head[2] - .49)], [.005, .001], 4)
    for s in (-1, 1):
        sphere(b, "CraneIris", (s * .073, head[1] + .018, head[2] - .045), (.006, .017, .018), 12, 8)
        sphere(b, "CraneEye", (s * .078, head[1] + .019, head[2] - .05), (.004, .010, .011), 12, 8)
        if standing:
            leg = [(s * .10, 1.34, .09), (s * .13, .79, .23), (s * .14, .08, .07)]
        else:
            leg = [(s * .11, -.16, .28), (s * .12, -.18, .80), (s * .13, -.20, 1.39)]
        tube(b, "CraneLeg", leg, [.030, .022, .014], 10)
        sphere(b, "CraneLeg", leg[1], (.031, .036, .030), 10, 6)
        foot = Vector(leg[-1])
        for i in (-1, 0, 1):
            end = foot + Vector((i * .065, -.015 if standing else 0, -.22 if standing else .17))
            tube(b, "CraneLeg", [foot, foot.lerp(end, .6) + Vector((0, .008, 0)), end], [.013, .009, .002], 6)
    for i in range(9):
        x = (i - 4) * .035
        feather(b, "FeatherIvory", (x, height + .07, .32), (x * 1.8, height - .12, .85 - abs(x) * .8), .14, .06)
    for side in (-1, 1):
        for row in range(3):
            for i in range(9):
                z = -.38 + i * .071
                a = .23 + row * .42
                cross = math.sqrt(max(.05, 1 - z * z / .59 ** 2))
                end_cross = math.sqrt(max(.05, 1 - (z + .21) ** 2 / .59 ** 2))
                n = (side * math.cos(a), math.sin(a), 0)
                start = (n[0] * .235 * cross, height + n[1] * .29 * cross, z)
                end = (n[0] * .24 * end_cross, height + n[1] * .29 * end_cross, z + .21)
                feather(b, "FeatherIvory", start, end, .12, .004, n)


def crane(standing=False):
    root = empty("CraneStanding" if standing else "CraneFlight")
    body = empty("Body", root)
    b = Batch(body)
    crane_body(b, standing)
    b.finish()
    for side, label in [(-1, "L"), (1, "R")]:
        shoulder = empty(f"Shoulder_{label}", root, (side * .16, 1.52 if standing else .07, -.25))
        b = Batch(shoulder)
        if standing:
            sphere(b, "CraneWhite", (side * .048, -.03, .24), (.105, .24, .43), 20, 12)
            for row in range(3):
                for i in range(12):
                    z = -.03 + i * .043
                    t = i / 11
                    feather(b, "FeatherBlack" if row == 2 else "FeatherIvory", (side * (.10 + row * .016), .06 - row * .085, z), (side * (.12 + row * .02 + math.sin(t * math.pi) * .02), -.25 - row * .055 + abs(t - .4) * .13, z + .30 + math.sin(t * math.pi) * .06), .13, .006, (side, 0, 0))
            b.finish()
            continue
        sphere(b, "CraneWhite", (side * .38, .015, .04), (.43, .084, .24), 20, 10)
        for i in range(13):
            t = i / 12
            feather(b, "FeatherBlack", (side * (.13 + t * .81), -.028, .02 - t * .12), (side * (.19 + t * .86), -.045, .68 - t * .12), .19, .055)
        for row in range(3):
            for i in range(13):
                t = i / 12
                feather(b, "FeatherIvory", (side * (.06 + t * .84), .074 + row * .009, -.11 + row * .11), (side * (.12 + t * .85), .038, .17 + row * .11), .145, .014)
        b.finish()
        wrist = empty(f"Wrist_{label}", shoulder, (side * .89, .0, -.095))
        b = Batch(wrist)
        sphere(b, "CraneWhite", (side * .31, .014, .03), (.37, .055, .17), 16, 8)
        for i in range(10):
            t = i / 9
            feather(b, "FeatherIvory", (side * (.04 + t * .54), .012, -.07 + t * .06), (side * (.41 + t * .67), -.085 + t * .025, .67 - t * .69), .20 - t * .045, .07)
        for row in range(2):
            for i in range(9):
                t = i / 8
                feather(b, "FeatherIvory", (side * (.01 + t * .61), .063 + row * .012, -.09 + row * .09), (side * (.15 + t * .69), .022, .14 + row * .11 - t * .08), .14, .01)
        b.finish()
    return root


def architecture(kind):
    root = empty(kind.title())
    b = Batch(root)
    if kind == "library":
        hall(b, 11, 3)
        for s in (-1, 1):
            wing = empty(f"SideHall_{s}", root, (s * 9.1, 0, -1.5))
            wb = Batch(wing)
            hall(wb, 4.5, 1)
            wb.finish()
            box(b, "Cedar", (s * 6.8, 1.11, -1.5), (3.8, .18, 2.3))
            rail(b, (s * 5.5, 1.15, -.25), (s * 8, 1.15, -.25), .7)
    elif kind == "pagoda":
        hall(b, 7.4, 5, pagoda=True)
    elif kind in ("pavilion", "ferry"):
        hall(b, 8.6 if kind == "pavilion" else 5.5, 1, True)
        if kind == "pavilion":
            tube(b, "StoneCarving", [(0, 1.1, 0), (0, 1.95, 0)], [.29, .37], 16)
            sphere(b, "StoneCarving", (0, 1.95, 0), (1, .10, .8), 24, 8)
            for x in (-1.6, 1.6):
                tube(b, "Limestone", [(x, 1.1, 0), (x, 1.62, 0)], [.36, .42], 16)
        else:
            for i in range(19):
                z = 4 + i * .46
                y = .77 + math.sin(i / 18 * math.pi) * .65
                box(b, "Cedar", (0, y, z), (3, .20, .43))
            for s in (-1, 1):
                for i in range(6):
                    a, c = i * 3 / 18, (i + 1) * 3 / 18
                    rail(b, (s * 1.4, .9 + math.sin(a * math.pi) * .65, 4 + a * 8.28), (s * 1.4, .9 + math.sin(c * math.pi) * .65, 4 + c * 8.28), .85)
    elif kind == "gate":
        for x in (-3.8, 3.8):
            for y, sz in [(.35, (2.3, .7, 2.4)), (.82, (1.95, .24, 2.1)), (4.9, (1.2, 8.1, 1.3)), (8.6, (1.8, .4, 1.8))]:
                box(b, "StoneCarving", (x, y, 0), sz, .1)
            for z in (-.66, .66):
                for k in range(5):
                    box(b, "Limestone", (x, 2 + k * 1.22, z), (.69, .82, .05))
            bracket(b, x, 8.65, 0)
        box(b, "Cedar", (0, 9.12, 0), (9.6, .46, 1.3))
        box(b, "Lacquer", (0, 8.3, 0), (5.8, .88, .6))
        roof(b, 12.2, 4.5, 9.7, 2)
        box(b, "Limestone", (0, .3, 0), (4.4, .6, 2.2))
        box(b, "Lacquer", (0, 3.45, 0), (2.7, 5.8, .66), .15)
        for s in (-1, 1):
            box(b, "AgedBronze", (s * 1.24, 3.45, .35), (.06, 5.3, .055))
        for i in range(7):
            box(b, "AgedBronze", (0, 1.5 + i * .54, .36), (1.15 - i * .055, .06, .04))
    b.finish()
    return root


def descendants(root):
    return [root, *root.children_recursive]


def export(root, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = PUBLIC / f"{name}.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True,
                              export_yup=True, export_apply=True, export_animations=False,
                              export_cameras=False, export_lights=False, export_extras=True,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                              export_draco_position_quantization=16, export_draco_normal_quantization=10,
                              export_draco_texcoord_quantization=12)
    triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in descendants(root) if o.type == "MESH")
    return {"file": path.name, "bytes": path.stat().st_size, "triangles": triangles,
            "meshes": sum(o.type == "MESH" for o in descendants(root))}


def setup_preview(root, output, name):
    for collection in bpy.data.collections:
        collection.hide_viewport = False
    for obj in bpy.context.scene.objects:
        obj.hide_render = obj not in descendants(root)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 6
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1500, 1100
    scene.render.resolution_percentage = 100
    scene.world.color = (.35, .35, .35)
    scene.view_settings.view_transform = "AgX"
    bird = name.startswith("crane")
    center = Vector((0, 0.45 if bird else 8, 0))
    position = Vector((3.9, 3.25, -5.3)) if bird else Vector((27, 23, 34))
    if name == "crane-standing":
        center, position = Vector((0, 1.35, 0)), Vector((3.6, 2.6, -5.0))
    if name in ("pavilion", "ferry", "gate"):
        center, position = Vector((0, 4.1, 0)), Vector((21, 17, 27))
    camera_data = bpy.data.cameras.new(f"Preview_{name}")
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = vec(position)
    camera.rotation_euler = (vec(center) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 4.9 if bird else 31
    if name == "crane-standing":
        camera.data.ortho_scale = 4.0
    scene.camera = camera
    for label, p, power, size, color in [
        ("Key", (-5, 8, -4) if bird else (-15, 35, 15), 1100 if bird else 16000, 5 if bird else 18, (1, .92, .78)),
        ("Fill", (4, 2, 3) if bird else (20, 18, 10), 450 if bird else 9000, 4 if bird else 15, (.68, .84, 1)),
        ("Rim", (0, 3, 5) if bird else (0, 25, -18), 850 if bird else 19000, 3 if bird else 12, (.77, .93, 1)),
    ]:
        data = bpy.data.lights.new(f"{name}_{label}", "AREA")
        data.energy, data.shape, data.size, data.color = power, "DISK", size, color
        lamp = bpy.data.objects.new(data.name, data)
        bpy.context.collection.objects.link(lamp)
        lamp.location = vec(p)
        lamp.rotation_euler = (vec(center) - lamp.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.film_transparent = False
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get("Background").inputs[0].default_value = (.17, .23, .25, 1)
    scene.world.node_tree.nodes.get("Background").inputs[1].default_value = .5
    scene.render.filepath = str(output / f"{name}.png")
    bpy.ops.render.render(write_still=True)


def configure_source(root):
    center = vec((0, 8, 0))
    rotation = (center - vec((27, 23, 34))).to_track_quat("-Z", "Y")
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                space = area.spaces.active
                space.region_3d.view_location = center
                space.region_3d.view_distance = 43
                space.region_3d.view_rotation = rotation
                space.region_3d.view_perspective = "PERSP"
                space.shading.type = "MATERIAL"
    for obj in bpy.data.objects:
        obj.select_set(False)
    root.select_set(True)
    bpy.context.view_layer.objects.active = root


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview-dir", type=Path)
    parser.add_argument("--preview", nargs="*", default=["library", "crane-flight", "crane-standing"])
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    PUBLIC.mkdir(parents=True, exist_ok=True)
    SOURCE.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    materials()
    assets = {kind: architecture(kind) for kind in ("library", "pagoda", "pavilion", "ferry", "gate")}
    assets["crane-flight"], assets["crane-standing"] = crane(), crane(True)
    report = {name: export(root, name) for name, root in assets.items()}
    (PUBLIC / "manifest.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    # Separate collections keep the overlapping export origins easy to edit.
    for name, root in assets.items():
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
        for obj in descendants(root):
            for old in list(obj.users_collection):
                old.objects.unlink(obj)
            collection.objects.link(obj)
        collection.hide_viewport = name != "library"
    configure_source(assets["library"])
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "qingye-realm.blend"), compress=True)
    print("REALM_MODEL_REPORT", json.dumps(report), flush=True)
    if args.preview_dir:
        args.preview_dir.mkdir(parents=True, exist_ok=True)
        for name in args.preview:
            setup_preview(assets[name], args.preview_dir, name)


if __name__ == "__main__":
    main()
