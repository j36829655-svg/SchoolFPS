# Blender 4.5 headless script: spec.json(게임이 내보낸 건물 사양) → 입체 디테일 건물 모델 buildings.glb
#   실행: blender -b --factory-startup -P tools/blender/build.py -- tools/blender/spec.json assets/models/buildings.glb
# 좌표: x 동쪽, y 북쪽, z 높이(m, 절대값). glTF(+Y up)로 내보내면 three.js 좌표 (x, 높이, -북)와 같아진다.
import bpy, bmesh, json, math, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SPEC, OUT = argv[0], argv[1]
specs = json.load(open(SPEC, encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)

ROLES = ['wall', 'glass', 'frame', 'trim', 'roof', 'flatroof', 'accent', 'wood', 'concrete']
R = {r: i for i, r in enumerate(ROLES)}


def lin(hexstr):
    """sRGB '#rrggbb' → linear RGBA (glTF baseColorFactor는 linear)"""
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c] + [1.0]


# ───────── 외벽 스타일 (로드뷰 사진 기준) ─────────
# kind: band = 층마다 길게 이어진 띠창, punch = 일정 간격 낱창, full = 층 전체 유리(커튼월), none = 창 없음
STYLE = {
    'ribbon':    dict(kind='band', wall='wall', depth=0.15, mullion=1.5, slab=True),
    'grid':      dict(kind='punch', wall='wall', bay=3.0, w=1.5, h=1.5, sill=0.9, depth=0.2, mullion=1, slab=True),
    'brick':     dict(kind='punch', wall='concrete', bay=3.0, w=1.8, h=1.3, sill=0.9, depth=0.2, mullion=1),
    'remnant':   dict(kind='punch', wall='wall', bay=4.0, w=1.2, h=1.4, sill=0.9, depth=0.22, mullion=1),
    'cottage':   dict(kind='punch', wall='wall', bay=4.0, w=1.2, h=1.2, sill=1.0, depth=0.12, mullion=1, trim=True),
    'dormSide':  dict(kind='punch', wall='wood', bay=3.0, w=1.0, h=1.2, sill=0.95, depth=0.15, mullion=0, slab=True),
    'dormEnd':   dict(kind='punch', wall='concrete', bay=3.4, w=2.6, h=2.0, sill=0.5, depth=0.4, mullion=1),
    'glass':     dict(kind='full', wall='frame', depth=0.06, mullion=1.5),
    'curtain':   dict(kind='full', wall='frame', depth=0.06, mullion=1.5),
    'tower':     dict(kind='full', wall='accent', depth=0.06, mullion=1.5),
    'rustframe': dict(kind='full', wall='accent', depth=0.3, mullion=2.0),
    'louver':    dict(kind='band', wall='wall', depth=0.05, mullion=0, fins=True),
    'concrete':  dict(kind='none', wall='concrete'),
    'shed':      dict(kind='none', wall='wall', door=True),
    'dorm':      dict(kind='punch', wall='concrete', bay=3.5, w=1.5, h=1.4, sill=0.9, depth=0.2, mullion=1),
}


class Mesh:
    def __init__(self, name):
        self.bm = bmesh.new()
        self.name = name

    def face(self, pts, role):
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs)
        f.material_index = R[role]
        return f

    def box(self, c, t, n, sw, sh, sd, role):
        """c 중심, t 가로 방향(수평), n 앞 방향(수평), 크기 sw×sh(높이)×sd"""
        t, n, up = Vector((t[0], t[1], 0)), Vector((n[0], n[1], 0)), Vector((0, 0, 1))
        c = Vector(c)
        hw, hh, hd = t * sw / 2, up * sh / 2, n * sd / 2
        p = [c + sx * hw + sy * hh + sz * hd for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
        for idx in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)):
            self.face([p[i] for i in idx], role)


def offset_poly(pts, d):
    """CCW 다각형을 안쪽으로 d 만큼 (꼭짓점 이동량은 제한)"""
    n = len(pts)
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        e0, e1 = (p1 - p0).normalized(), (p2 - p1).normalized()
        n0, n1 = Vector((-e0.y, e0.x)), Vector((-e1.y, e1.x))
        bis = n0 + n1
        if bis.length < 1e-6:
            bis = n0
        bis.normalize()
        cos = max(0.35, bis.dot(n1))
        out.append(tuple(p1 + bis * (d / cos)))
    return out


def openings_for(style, L, z0, floors, fh, top):
    """벽 한 면(길이 L)의 창 구멍 [(u0, u1, v0, v1)]"""
    s = STYLE[style]
    ops = []
    if L < 2.2 or s['kind'] == 'none':
        return ops
    for f in range(floors):
        fz = z0 + f * fh
        if s['kind'] == 'band':
            if L > 2.0:
                ops.append((0.5, L - 0.5, fz + 0.9, fz + min(fh - 0.5, 0.9 + 1.5)))
        elif s['kind'] == 'full':
            ops.append((0.12, L - 0.12, fz + 0.12, min(top - 0.15, fz + fh - 0.12)))
        else:
            n = int(L // s['bay'])
            if n < 1:
                if L > s['w'] + 0.8:
                    n = 1
                else:
                    continue
            step = L / n
            h = min(s['h'], fh - s['sill'] - 0.3)
            for k in range(n):
                cu = step * (k + 0.5)
                ops.append((cu - s['w'] / 2, cu + s['w'] / 2, fz + s['sill'], fz + s['sill'] + h))
    return ops


def wall_with_holes(m, A, t, n, L, zb, zt, holes, role):
    """벽면(A에서 t 방향 L 길이, 높이 zb~zt)을 구멍을 피해 사각형들로 채운다"""
    vs = sorted({zb, zt, *[h[2] for h in holes], *[h[3] for h in holes]})
    vs = [v for v in vs if zb <= v <= zt]
    P = lambda u, v: (A[0] + t[0] * u, A[1] + t[1] * u, v)
    for a, b in zip(vs, vs[1:]):
        if b - a < 1e-4:
            continue
        mid = (a + b) / 2
        cuts = sorted((h[0], h[1]) for h in holes if h[2] < mid < h[3])
        u = 0.0
        for c0, c1 in cuts + [(L, L)]:
            if c0 - u > 1e-4:
                m.face([P(u, a), P(c0, a), P(c0, b), P(u, b)], role)
            u = max(u, c1)


def window(m, A, t, n, h, s, glass_role='glass', frame_role='frame'):
    """구멍 h=(u0,u1,v0,v1)에 안쪽 측면(리빌), 유리, 창틀·창살, 창턱"""
    u0, u1, v0, v1 = h
    d = s.get('depth', 0.15)
    T, N = Vector((t[0], t[1], 0)), Vector((n[0], n[1], 0))
    Pw = lambda u, v, dd: tuple(Vector((A[0], A[1], 0)) + T * u - N * dd + Vector((0, 0, v)))
    # 리빌(구멍 안쪽 4면)
    m.face([Pw(u0, v0, 0), Pw(u0, v0, d), Pw(u0, v1, d), Pw(u0, v1, 0)], 'trim')
    m.face([Pw(u1, v0, 0), Pw(u1, v1, 0), Pw(u1, v1, d), Pw(u1, v0, d)], 'trim')
    m.face([Pw(u0, v1, 0), Pw(u0, v1, d), Pw(u1, v1, d), Pw(u1, v1, 0)], 'trim')
    m.face([Pw(u0, v0, 0), Pw(u1, v0, 0), Pw(u1, v0, d), Pw(u0, v0, d)], 'trim')
    # 유리
    m.face([Pw(u0, v0, d), Pw(u1, v0, d), Pw(u1, v1, d), Pw(u0, v1, d)], glass_role)
    # 창틀(테두리) + 창살
    fw = 0.06
    w, hh = u1 - u0, v1 - v0
    cen = lambda u, v: Pw(u, v, d - 0.03)
    m.box(cen(u0 + fw / 2, (v0 + v1) / 2), T, N, fw, hh, 0.06, frame_role)
    m.box(cen(u1 - fw / 2, (v0 + v1) / 2), T, N, fw, hh, 0.06, frame_role)
    m.box(cen((u0 + u1) / 2, v0 + fw / 2), T, N, w, fw, 0.06, frame_role)
    m.box(cen((u0 + u1) / 2, v1 - fw / 2), T, N, w, fw, 0.06, frame_role)
    sp = s.get('mullion', 0)
    if sp:
        k = max(1, round(w / sp)) if sp > 1 else 2
        for i in range(1, k):
            m.box(cen(u0 + w * i / k, (v0 + v1) / 2), T, N, 0.05, hh, 0.05, frame_role)
        if s['kind'] == 'full' and hh > 2.2:  # 커튼월 가로대
            m.box(cen((u0 + u1) / 2, v0 + hh * 0.55), T, N, w, 0.05, 0.05, frame_role)
    # 창턱 (낱창만)
    if s['kind'] == 'punch':
        m.box(Pw((u0 + u1) / 2, v0 - 0.03, -0.05), T, N, w + 0.12, 0.06, 0.16, 'trim')


def build(spec):
    sid = spec['id']
    style = spec['style'] if spec['style'] in STYLE else 'grid'
    S = STYLE[style]
    pts = [tuple(p) for p in spec['pts']]
    ground, h, eave, rise, floors = spec['ground'], spec['h'], spec['eave'], spec['rise'], spec['floors']
    sloped = spec['roofType'] != 'flat'
    base = ground - 0.6
    top = ground + (eave if sloped else h)
    win_top = top if sloped else top - 0.6
    fh = max(2.6, (win_top - ground) / floors)
    m = Mesh(sid)
    o = spec['obb']
    end_len = o['L'] * 0.7
    edges = [(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]
    longest = max(range(len(edges)), key=lambda i: (Vector(edges[i][1]) - Vector(edges[i][0])).length)

    for i, (A, B) in enumerate(edges):
        d = Vector(B) - Vector(A)
        L = d.length
        if L < 0.05:
            continue
        t = (d.x / L, d.y / L)
        n = (t[1], -t[0])  # CCW → 바깥쪽
        # 끝면 = 건물 긴 축에 수직인 면 (꺾인 외곽선에서도 방향으로 판단)
        is_end = abs(t[0] * o['ux'] + t[1] * o['uy']) < 0.5
        st = spec['endStyle'] if (spec['endStyle'] and is_end) else style
        s = STYLE.get(st, S)
        holes = openings_for(st, L, ground, floors, fh, win_top)
        # 출입문: 가장 긴 면 가운데 (유리벽·창고·콘크리트 제외)
        if i == longest and s['kind'] in ('band', 'punch') and L > 4:
            du0, du1 = L / 2 - 0.9, L / 2 + 0.9
            holes = [hh for hh in holes if not (hh[2] < ground + 2.4 and hh[0] < du1 and hh[1] > du0)]
            if s['kind'] == 'band':
                holes = [hh for hh in holes if hh[2] >= ground + 2.4] + \
                        [(0.5, du0 - 0.3, ground + 0.9, ground + 2.4), (du1 + 0.3, L - 0.5, ground + 0.9, ground + 2.4)] if L > 6 else holes
                holes = [hh for hh in holes if hh[1] - hh[0] > 0.6]
            door = (du0, du1, ground, ground + 2.3)
            holes.append(door)
        wall_with_holes(m, A, t, n, L, base, top, holes, s['wall'])
        for hh in holes:
            window(m, A, t, n, hh, s)
        # 층 슬래브 띠
        if s.get('slab'):
            for f in range(1, floors):
                z = ground + f * fh
                m.box((A[0] + t[0] * L / 2 + n[0] * 0.03, A[1] + t[1] * L / 2 + n[1] * 0.03, z), t, n, L, 0.22, 0.06, 'trim')
        # 세로 루버 핀
        if s.get('fins'):
            k = int(L / 0.6)
            for j in range(1, k):
                u = L * j / k
                m.box((A[0] + t[0] * u + n[0] * 0.18, A[1] + t[1] * u + n[1] * 0.18, (ground + 0.3 + win_top) / 2), t, n, 0.08, win_top - ground - 0.3, 0.36, 'frame')

    if not sloped:
        inner = offset_poly(pts, 0.3)
        rz = top - 0.6
        m.face([(x, y, rz) for x, y in inner], 'flatroof')
        for i in range(len(pts)):
            a, b = inner[i], inner[(i + 1) % len(inner)]
            m.face([(b[0], b[1], rz), (a[0], a[1], rz), (a[0], a[1], top), (b[0], b[1], top)], 'wall')  # 난간벽 안쪽
            pa, pb = pts[i], pts[(i + 1) % len(pts)]
            m.face([(pa[0], pa[1], top), (pb[0], pb[1], top), (b[0], b[1], top), (a[0], a[1], top)], 'trim')  # 난간 위 마감
    else:
        sloped_roof(m, o, top, rise, spec)

    me = bpy.data.meshes.new(sid)
    m.bm.to_mesh(me)
    m.bm.free()
    for role in ROLES:
        mat = bpy.data.materials.new(f'{sid}:{role}')
        accent = spec.get('accent') or '#8a8f94'
        col = {'wall': spec['wall'], 'roof': spec['roof'], 'flatroof': spec['roof'], 'accent': accent,
               'glass': {'tower': spec['wall'], 'rustframe': '#4f86c6'}.get(style, accent) if STYLE[style]['kind'] == 'full' else '#3f5f7c',
               'frame': '#ffffff' if style == 'cottage' else '#cfd5da', 'trim': '#d6d4ce', 'wood': '#ffffff',
               'concrete': spec['wall'] if style in ('concrete', 'brick', 'dormSide', 'dormEnd') else '#c8c8c2'}[role]
        mat.diffuse_color = lin(col)
        mat.use_nodes = True
        mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = lin(col)
        me.materials.append(mat)
    uv_meters(me)
    ob = bpy.data.objects.new(sid, me)
    bpy.context.scene.collection.objects.link(ob)


def sloped_roof(m, o, eave_z, rise, spec):
    """박공·모임·아치 지붕: 처마가 0.5m 나온 두께 0.15m 지붕판 + 박공 삼각벽"""
    ux, uy = o['ux'], o['uy']
    ov, th = 0.5, 0.15
    hl, hw = o['L'] / 2 + ov, o['W'] / 2 + ov
    P = lambda u, v, z: (o['cx'] + u * ux - v * uy, o['cy'] + u * uy + v * ux, z)
    typ = spec['roofType']
    slope = rise / (o['W'] / 2)
    low = eave_z - ov * slope
    gable_role = 'glass' if spec['endGlass'] else ('roof' if spec['style'] == 'cottage' else 'wall')
    if typ == 'arch':
        seg = 12
        prof = [(-math.cos(math.pi * k / seg) * o['W'] / 2, eave_z + math.sin(math.pi * k / seg) * rise) for k in range(seg + 1)]
        for (v0, z0), (v1, z1) in zip(prof, prof[1:]):
            m.face([P(-hl, v0, z0), P(hl, v0, z0), P(hl, v1, z1), P(-hl, v1, z1)], 'roof')
            m.face([P(-hl, v1, z1 - th), P(hl, v1, z1 - th), P(hl, v0, z0 - th), P(-hl, v0, z0 - th)], 'roof')
        for u in (-o['L'] / 2, o['L'] / 2):
            m.face([P(u, v, z) for v, z in prof], gable_role)
        return
    r = max(0.0, o['L'] / 2 - o['W'] / 2) if typ == 'hip' else hl
    top = eave_z + rise
    for zz, role in ((0, 'roof'), (-th, 'roof')):
        A = [P(-hl, -hw, low + zz), P(hl, -hw, low + zz), P(r, 0, top + zz), P(-r, 0, top + zz)]
        B = [P(hl, hw, low + zz), P(-hl, hw, low + zz), P(-r, 0, top + zz), P(r, 0, top + zz)]
        if zz:
            A.reverse(); B.reverse()
        m.face(A, role); m.face(B, role)
        if typ == 'hip':
            C = [P(hl, -hw, low + zz), P(hl, hw, low + zz), P(r, 0, top + zz)]
            D = [P(-hl, hw, low + zz), P(-hl, -hw, low + zz), P(-r, 0, top + zz)]
            if zz:
                C.reverse(); D.reverse()
            m.face(C, role); m.face(D, role)
    # 처마 끝 두께(물받이 판)
    for v in (-hw, hw):
        m.face([P(-hl, v, low - th), P(hl, v, low - th), P(hl, v, low), P(-hl, v, low)], 'trim')
    if typ == 'gable':
        for u in (-o['L'] / 2, o['L'] / 2):
            m.face([P(u, -o['W'] / 2, eave_z), P(u, o['W'] / 2, eave_z), P(u, 0, top)], gable_role)


def uv_meters(me):
    """텍스처가 m 단위로 반복되게: 수평면은 (x, y), 벽은 (벽 방향 거리, 높이)"""
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.normal_update()
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        nz = f.normal.z
        if abs(nz) > 0.7:
            for l in f.loops:
                l[uv].uv = (l.vert.co.x, l.vert.co.y)
        else:
            hx, hy = -f.normal.y, f.normal.x
            hl = math.hypot(hx, hy) or 1
            for l in f.loops:
                l[uv].uv = ((l.vert.co.x * hx + l.vert.co.y * hy) / hl, l.vert.co.z)
    bm.to_mesh(me)
    bm.free()


for sp in specs:
    try:
        build(sp)
    except Exception as e:
        print('FAILED', sp['id'], e)

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=False,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_normals=True, export_texcoords=True, export_materials='EXPORT')
print('EXPORTED', OUT, len(specs))
